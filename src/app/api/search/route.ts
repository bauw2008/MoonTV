import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getUserVideoSourcesSimple } from '@/lib/config';
import { TypeInferenceService } from '@/lib/type-inference.service';
import { SearchResult } from '@/lib/types';
import { getYellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = AuthGuard.user(async function(request: NextRequest, { user }: { user: any }) {
  // 添加缓存控制头，防止浏览器和CDN缓存
  const headers = new Headers({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  

  
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || searchParams.get('keyword');

    console.log('🔥 搜索关键词:', q);
    console.log('🔥 完整URL:', request.url);

    if (!q) {
      return NextResponse.json({ 
        error: '缺少搜索关键词',
        debug: { url: request.url, user: user?.username }
      }, { 
        status: 400,
        headers: headers
      });
    }

    // 获取配置并应用分离逻辑
    const config = await getConfig();
    // 直接使用配置，无需额外处理
    
    // 使用高性能索引查询
    const apiSites = await getUserVideoSourcesSimple(user?.username || '');

    if (apiSites.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: '用户没有可用的视频源权限'
      });
    }

    // 执行搜索
    let allResults: SearchResult[] = [];
    for (const site of apiSites) {
      try {
        const results = await searchFromApi(site, q);
        allResults = allResults.concat(results);
      } catch (error) {
        console.error(`搜索源 ${site.key} 失败:`, error);
      }
    }

    // 类型推断
    const resultsWithTypes = allResults.map((item) => {
      const typeInference = TypeInferenceService.infer({
        type: item.type,
        type_name: item.type_name,
        source: item.source,
        title: item.title || '',
        episodes: item.episodes,
      });
      return { ...item, type: typeInference.type };
    });

    // 混合逻辑：全局开关 + 用户级别18禁开关
    let filteredResults = resultsWithTypes;
    
    // 正确的18禁过滤逻辑
    const userConfig = config.UserConfig.Users?.find(u => u.username === user?.username);
    let shouldFilter = false;
    let filterReason = '';
    
    // 1. 检查全局开关（主开关）
    // DisableYellowFilter = true 表示关闭全局过滤
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
        
        // 3. 应用过滤（如果需要过滤）
        if (shouldFilter) {
          const yellowWords = await getYellowWords();
          
          if (yellowWords && yellowWords.length > 0) {
            const beforeFilter = filteredResults.length;
            
            filteredResults = resultsWithTypes.filter((item) => {
              const title = (item.title || '').toLowerCase();
              const typeName = (item.type_name || '').toLowerCase();
              return !yellowWords.some((word: string) => 
                title.includes(word.toLowerCase()) || 
                typeName.includes(word.toLowerCase())
              );
            });
            
            const afterFilter = filteredResults.length;
            // 只在真正过滤时记录统计信息
            if (afterFilter < beforeFilter) {
              console.log(`18禁过滤统计: 用户 ${user?.username}, 过滤 ${beforeFilter} -> ${afterFilter} (过滤 ${beforeFilter - afterFilter} 个结果)`);
            }
          }
        }
    return NextResponse.json({
      results: filteredResults,
      total: filteredResults.length,
      debug: {
        user: user?.username,
        role: user?.role,
        videoSources: apiSites.map(s => ({ key: s.key, name: s.name })),
        sites: apiSites.map(s => ({ key: s.key, name: s.name })),
        searchResults: allResults.length,
        filteredResults: filteredResults.length,
        timestamp: new Date().toISOString(),
        cache: 'disabled'
      }
    }, {
      headers: headers
    });

  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json({ error: '搜索失败' }, { 
      status: 500,
      headers: headers
    });
  }
});

function containsYellowWords(title: string, yellowWords: string[]): boolean {
  if (!yellowWords || yellowWords.length === 0) return false;
  return yellowWords.some((word) => title.toLowerCase().includes(word.toLowerCase()));
}