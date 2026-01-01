/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getUserVideoSourcesSimple } from '@/lib/config';
import { TypeInferenceService } from '@/lib/type-inference.service';
import type { SearchResult } from '@/lib/types';
import { getYellowWords } from '@/lib/yellow';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const keyword = searchParams.get('q') || searchParams.get('keyword');

      if (!keyword) {
        return new Response('缺少搜索关键词', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // 获取配置并应用分离逻辑
      const config = await getConfig();
      // 直接使用配置，无需额外处理
      
      // 使用高性能索引查询
          const availableSites = await getUserVideoSourcesSimple(user?.username || '');
          
            
      if (availableSites.length === 0) {
        return new Response('data: {"results": [], "total": 0}\n\n', {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      // 创建一个可读流来发送Server-Sent Events
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // 发送开始消息
            const startMessage = JSON.stringify({
              type: 'start',
              totalSources: availableSites.length,
            });
            controller.enqueue(encoder.encode(`data: ${startMessage}\n\n`));

            let completedCount = 0;
            let allResults: SearchResult[] = [];

            // 逐个搜索每个源
            for (const site of availableSites) {
              try {
                const results = await searchFromApi(site, keyword);

                // 使用类型推断服务为每个结果推断类型
                const resultsWithTypes = results.map((item) => {
                  const typeInference = TypeInferenceService.infer({
                    type: item.type,
                    type_name: item.type_name,
                    source: item.source,
                    title: item.title || '',
                    episodes: item.episodes,
                  });

                  return {
                    ...item,
                    type: typeInference.type,
                  };
                });

                // 正确的18禁过滤逻辑
                const yellowWords = await getYellowWords();
                let filteredResults = resultsWithTypes;
                
                if (yellowWords && yellowWords.length > 0) {
                  // 检查用户是否需要过滤
                  const userConfig = config.UserConfig.Users?.find(u => u.username === user?.username);
                  let shouldFilter = false;
                  let filterReason = '';
                  
                  // 1. 检查全局开关（主开关）
                  if (config.SiteConfig.DisableYellowFilter) {
                    shouldFilter = false;
                    filterReason = '全局关闭18禁过滤';
                  }
                  // 2. 全局开关开启，检查具体设置
                  else {
                    // 站长永远不过滤
                    if (userConfig?.role === 'owner') {
                      shouldFilter = false;
                      filterReason = '站长豁免';
                    }
                    // 检查用户组设置
                    else if (userConfig?.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
                      for (const tagName of userConfig.tags) {
                        const tagConfig = (config.UserConfig.Tags as any)?.find((t: any) => t.name === tagName);
                        // disableYellowFilter = true 表示用户组开启过滤
                        if ((tagConfig as any)?.disableYellowFilter === true) {
                          shouldFilter = true;
                          filterReason = `用户组开启过滤: ${tagName}`;
                          break;
                        }
                      }
                      // 如果用户组没有开启过滤，则不过滤
                      if (!shouldFilter) {
                        shouldFilter = false;
                        filterReason = '用户组关闭过滤';
                      }
                    }
                    // 默认情况：没有用户组设置，不过滤
                    else {
                      shouldFilter = false;
                      filterReason = '无用户组设置';
                    }
                  }
                  
                  // 应用过滤（如果需要过滤）
                  if (shouldFilter) {
                    filteredResults = resultsWithTypes.filter((item) => {
                      // 检查 title 和 type_name 字段
                      const title = (item.title || '').toLowerCase();
                      const typeName = (item.type_name || '').toLowerCase();
                      return !yellowWords.some((word: string) => 
                        title.includes(word.toLowerCase()) || 
                        typeName.includes(word.toLowerCase())
                      );
                    });
                  }
                }

                allResults = allResults.concat(filteredResults);
                // 发送单个源的结果
                const sourceMessage = JSON.stringify({
                  type: 'source_result',
                  source: site.key,
                  results: filteredResults,
                });
                controller.enqueue(
                  encoder.encode(`data: ${sourceMessage}\n\n`),
                );
              } catch (error) {
                console.error(`搜索源 ${site.key} 失败:`, error);
              }

              completedCount++;
            }

            // 发送完成消息
            const completeMessage = JSON.stringify({
              type: 'complete',
              completedSources: completedCount,
              results: allResults,
              total: allResults.length,
            });
            controller.enqueue(encoder.encode(`data: ${completeMessage}\n\n`));
          } catch (error) {
            console.error('WebSocket搜索失败:', error);
            const errorMessage = JSON.stringify({
              type: 'error',
              error: '搜索失败',
            });
            controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      console.error('WebSocket搜索失败:', error);
      return new Response('data: {"error": "搜索失败"}\n\n', {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
  },
);

// 检查是否包含敏感词
function containsYellowWords(title: string, yellowWords: string[]): boolean {
  if (!yellowWords || yellowWords.length === 0) return false;

  return yellowWords.some((word) =>
    title.toLowerCase().includes(word.toLowerCase()),
  );
}
