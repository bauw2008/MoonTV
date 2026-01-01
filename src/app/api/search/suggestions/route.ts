/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfig } from '@/lib/admin.types';
import { AuthGuard } from '@/lib/auth';
import { searchFromApi } from '@/lib/downstream';
import { getUserVideoSourcesSimple } from '@/lib/config';
import { getYellowWords } from '@/lib/yellow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function generateSuggestions(
  config: AdminConfig,
  query: string,
  username: string,
): Promise<
  Array<{
    text: string;
    type: 'exact' | 'related' | 'suggestion';
    score: number;
  }>
> {
  const queryLower = query.toLowerCase();

  const apiSites = await getUserVideoSourcesSimple(username);
  let realKeywords: string[] = [];

  if (apiSites.length > 0) {
    // 取第一个可用的数据源进行搜索
    const firstSite = apiSites[0];
    const results = await searchFromApi(firstSite, query);

    const yellowWords = await getYellowWords();
    realKeywords = Array.from(
      new Set(
        results
          .filter(
            (r: any) =>
              config.SiteConfig.DisableYellowFilter ||
              !yellowWords.some((word: string) =>
                (r.type_name || '').includes(word),
              ),
          )
          .map((r: any) => r.title)
          .filter(Boolean)
          .flatMap((title: string) => title.split(/[ -:：·、-]/))
          .filter(
            (w: string) => w.length > 1 && w.toLowerCase().includes(queryLower),
          ),
      ),
    ).slice(0, 8);
  }

  // 根据关键词与查询的匹配程度计算分数，并动态确定类型
  const realSuggestions = realKeywords.map((word) => {
    const wordLower = word.toLowerCase();
    const queryWords = queryLower.split(/[ -:：·、-]/);

    // 计算匹配分数：完全匹配得分更高
    let score = 1.0;
    if (wordLower === queryLower) {
      score = 2.0; // 完全匹配
    } else if (
      wordLower.startsWith(queryLower) ||
      wordLower.endsWith(queryLower)
    ) {
      score = 1.8; // 前缀或后缀匹配
    } else if (queryWords.some((qw) => wordLower.includes(qw))) {
      score = 1.5; // 包含查询词
    }

    // 根据匹配程度确定类型
    let type: 'exact' | 'related' | 'suggestion' = 'related';
    if (score >= 2.0) {
      type = 'exact';
    } else if (score >= 1.5) {
      type = 'related';
    } else {
      type = 'suggestion';
    }

    return {
      text: word,
      type,
      score,
    };
  });

  // 按分数降序排列，相同分数按类型优先级排列
  const sortedSuggestions = realSuggestions.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score; // 分数高的在前
    }
    // 分数相同时，按类型优先级：exact > related > suggestion
    const typePriority = { exact: 3, related: 2, suggestion: 1 };
    return typePriority[b.type] - typePriority[a.type];
  });

  return sortedSuggestions;
}

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const keyword = searchParams.get('q') || searchParams.get('keyword');

      if (!keyword) {
        return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
      }

      // 搜索建议 - 这里需要实现实际的搜索建议逻辑
      // 由于没有具体的搜索建议方法，我们返回一个空数组
      return NextResponse.json([]);
    } catch (error) {
      console.error('获取搜索建议失败:', error);
      return NextResponse.json({ error: '获取搜索建议失败' }, { status: 500 });
    }
  },
);
