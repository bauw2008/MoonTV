import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 从 wwzy API 搜索短剧
async function searchShortDramasFromWwzy(query: string, page = 1, size = 20) {
  const response = await fetch(
    `https://api.wwzy.tv/api.php/provide/vod?ac=list&wd=${encodeURIComponent(query)}&pg=${page}&pagesize=${size}`,
    {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30秒超时
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const items = data.list || [];
  const list = items.map((item: any) => ({
    id: item.vod_id,
    name: item.vod_name,
    cover: item.vod_pic,
    update_time: item.vod_time || new Date().toISOString(),
    score: parseFloat(item.vod_score) || 0,
    episode_count: item.vod_total || 1,
    description: item.vod_blurb || '',
    author: '',
    backdrop: item.vod_pic,
    vote_average: parseFloat(item.vod_score) || 0,
    tmdb_id: undefined,
  }));

  return {
    list,
    hasMore: page < data.pagecount,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query');
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    if (!query) {
      return NextResponse.json(
        { error: '缺少必要参数: query' },
        { status: 400 },
      );
    }

    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 直接使用 wwzy API 搜索短剧
    const result = await searchShortDramasFromWwzy(query, pageNum, pageSize);
    logger.log('[短剧搜索] wwzy API 获取成功');

    // 设置与网页端一致的缓存策略（搜索结果: 1小时）
    const response = NextResponse.json(result);

    // 1小时 = 3600秒（搜索结果更新频繁，短期缓存）
    const cacheTime = 3600;
    response.headers.set(
      'Cache-Control',
      `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
    );
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${cacheTime}`,
    );

    // 调试信息
    response.headers.set('X-Cache-Duration', '1hour');
    response.headers.set(
      'X-Cache-Expires-At',
      new Date(Date.now() + cacheTime * 1000).toISOString(),
    );
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    logger.error('搜索短剧失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
