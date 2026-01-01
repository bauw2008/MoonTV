import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { shouldApplyYellowFilter } from '@/lib/config-separation';
import { searchFromApi } from '@/lib/downstream';
import { getUserVideoSourcesSimple } from '@/lib/config';
import { getYellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

// OrionTV 兼容接口

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const keyword = searchParams.get('keyword') || searchParams.get('q');
      const source = searchParams.get('source');

      if (!keyword) {
        return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
      }

      // 获取可用API站点
      const availableSites = await getUserVideoSourcesSimple(user?.username || '');

      if (availableSites.length === 0) {
        return NextResponse.json({ results: [] });
      }

      // 如果指定了源，使用指定的源；否则使用第一个可用源
      let targetSite = availableSites[0];
      if (source) {
        const foundSite = availableSites.find((site) => site.name === source);
        if (foundSite) {
          targetSite = foundSite;
        }
      }

      // 执行搜索
      const results = await searchFromApi(targetSite, keyword);

      // 应用敏感词过滤
      const yellowWords = await getYellowWords();
      let filteredResults = results;

      if (yellowWords && yellowWords.length > 0) {
        // 获取配置以进行权限检查
        const configResponse = await fetch('/api/admin/config');
        const configData = await configResponse.json();
        
        // 使用统一的权限判断函数
        const shouldFilter = shouldApplyYellowFilter(configData, user?.username || '');
        
        // 当应该应用过滤时，进行过滤
        if (shouldFilter) {
          filteredResults = results.filter(
              (item) => !containsYellowWords(item.title || '', yellowWords),
            );
        }
      }

      return NextResponse.json({
        results: filteredResults,
        total: filteredResults.length,
        source: targetSite.name,
      });
    } catch (error) {
      console.error('单个源搜索失败:', error);
      return NextResponse.json({ error: '搜索失败' }, { status: 500 });
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
