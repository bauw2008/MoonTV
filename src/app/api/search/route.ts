/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { TypeInferenceService } from '@/lib/type-inference.service';
import { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      },
    );
  }

  try {
    // 获取配置并应用分离逻辑
    const config = await getConfig();
    // 直接使用配置，无需额外处理

    // 使用高性能索引查询
    const apiSites = await getAvailableApiSites(authInfo?.username || '');

    if (apiSites.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: '用户没有可用的视频源权限',
      });
    }

    // 执行搜索
    let allResults: SearchResult[] = [];
    for (const site of apiSites) {
      try {
        const results = await searchFromApi(site, query);
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

    return NextResponse.json({
      results: resultsWithTypes,
      total: resultsWithTypes.length,
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json(
      { error: '搜索失败' },
      {
        status: 500,
      },
    );
  }
}
