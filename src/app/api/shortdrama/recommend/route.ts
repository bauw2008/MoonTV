import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 从 wwzy API 获取推荐短剧
async function getRecommendedShortDramasFromWwzy(category?: number, size = 10) {
  const params = new URLSearchParams();
  params.append('ac', 'list');
  if (category) params.append('t', category.toString());
  params.append('pg', '1');
  params.append('pagesize', size.toString());

  const response = await fetch(
    `https://api.wwzy.tv/api.php/provide/vod?${params.toString()}`,
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
  return items.map((item: any) => ({
    id: item.vod_id,
    name: item.vod_name,
    cover: item.vod_pic,
    update_time: item.vod_time || new Date().toISOString(),
    score: parseFloat(item.vod_score) || 0,
    episode_count: item.vod_total || 1,
    description: item.vod_blurb || '',
    author: item.vod_actor || '',
    backdrop: item.vod_pic,
    vote_average: parseFloat(item.vod_score) || 0,
    tmdb_id: undefined,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const size = searchParams.get('size');

    const categoryNum = category ? parseInt(category) : undefined;
    const pageSize = size ? parseInt(size) : 10;

    if (
      (category && (categoryNum === undefined || isNaN(categoryNum))) ||
      isNaN(pageSize)
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 直接使用 wwzy API 获取推荐短剧
    const result = await getRecommendedShortDramasFromWwzy(
      categoryNum,
      pageSize,
    );
    logger.log('[推荐短剧] wwzy API 获取成功');

    // 测试1小时HTTP缓存策略
    const response = NextResponse.json(result);

    // 1小时 = 3600秒
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
    logger.error('获取推荐短剧失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
