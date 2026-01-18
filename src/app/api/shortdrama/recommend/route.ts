import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getHeadersWithUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 服务端专用函数，直接调用外部API
async function getRecommendedShortDramasInternal(
  category?: number,
  size = 10,
  retryCount = 0,
) {
  const params = new URLSearchParams();
  if (category) params.append('category', category.toString());
  params.append('size', size.toString());

  const headers = getHeadersWithUserAgent({
    browserType: 'desktop',
    includeMobile: false,
    includeSecChUa: true,
  });

  // 添加 Referer 和 Origin
  const fetchHeaders = {
    ...headers,
    Referer: 'https://api.r2afosne.dpdns.org/',
    Origin: 'https://api.r2afosne.dpdns.org',
  };

  const response = await fetch(
    `https://api.r2afosne.dpdns.org/vod/recommend?${params.toString()}`,
    {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(30000), // 30秒超时
    },
  );

  // 如果遇到 403 错误，尝试重试一次（更换 User-Agent）
  if (response.status === 403 && retryCount < 2) {
    logger.warn(`获取推荐短剧遇到 403 错误，尝试重试 (${retryCount + 1}/2)`);
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * (retryCount + 1)),
    ); // 延迟重试
    return getRecommendedShortDramasInternal(category, size, retryCount + 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const items = data.items || [];
  return items.map((item: any) => ({
    id: item.vod_id || item.id,
    name: item.vod_name || item.name,
    cover: item.vod_pic || item.cover,
    update_time: item.vod_time || item.update_time || new Date().toISOString(),
    score: item.vod_score || item.score || 0,
    episode_count: parseInt(item.vod_remarks?.replace(/[^\d]/g, '') || '1'),
    description: item.vod_content || item.description || '',
    author: item.vod_actor || item.author || '',
    backdrop: item.vod_pic_slide || item.backdrop || item.vod_pic || item.cover,
    vote_average: item.vod_score || item.vote_average || 0,
    tmdb_id: item.tmdb_id || undefined,
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

    const result = await getRecommendedShortDramasInternal(
      categoryNum,
      pageSize,
    );

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
