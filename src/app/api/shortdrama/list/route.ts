import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 带超时控制的 fetch 函数
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// 带重试机制的获取函数
async function getShortDramaListInternal(
  category: number,
  page = 1,
  size = 20,
  maxRetries = 2,
): Promise<{
  list: Array<{
    id: number;
    name: string;
    cover: string;
    update_time: string;
    score: number;
    episode_count: number;
    description: string;
  }>;
  hasMore: boolean;
}> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `https://api.r2afosne.dpdns.org/vod/list?categoryId=${category}&page=${page}&size=${size}`,
        {
          headers: {
            'User-Agent': getRandomUserAgent(),
            Accept: 'application/json',
          },
        },
        10000, // 10秒超时
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, statusText: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const items = data.list || [];
      const list = items.map((item: any) => ({
        id: item.id,
        name: item.name,
        cover: item.cover,
        update_time: item.update_time || new Date().toISOString(),
        score: item.score || 0,
        episode_count: 1, // 分页API没有集数信息，ShortDramaCard会自动获取
        description: item.description || '',
      }));

      return {
        list,
        hasMore: data.currentPage < data.totalPages,
      };
    } catch (error) {
      lastError = error as Error;
      logger.error(
        `获取短剧列表失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`,
        error,
      );

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); // 指数退避
      }
    }
  }

  throw lastError || new Error('获取短剧列表失败');
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('categoryId');
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    if (!categoryId) {
      return NextResponse.json(
        { error: '缺少必要参数: categoryId' },
        { status: 400 },
      );
    }

    const category = parseInt(categoryId);
    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(category) || isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const result = await getShortDramaListInternal(
      category,
      pageNum,
      pageSize,
    );

    // 设置与网页端一致的缓存策略（lists: 2小时）
    const response = NextResponse.json(result);

    // 2小时 = 7200秒（与网页端SHORTDRAMA_CACHE_EXPIRE.lists一致）
    const cacheTime = 7200;
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
    response.headers.set('X-Cache-Duration', '2hour');
    response.headers.set(
      'X-Cache-Expires-At',
      new Date(Date.now() + cacheTime * 1000).toISOString(),
    );
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());
    response.headers.set(
      'X-Response-Time',
      `${Date.now() - startTime}ms`,
    );

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(
      `[短剧列表API] 获取失败 (耗时: ${responseTime}ms):`,
      error,
    );

    // 返回更详细的错误信息
    const errorMessage =
      error instanceof Error ? error.message : '服务器内部错误';

    return NextResponse.json(
      {
        error: '获取短剧列表失败',
        details: errorMessage,
        responseTime: `${responseTime}ms`,
      },
      { status: 500 },
    );
  }
}
