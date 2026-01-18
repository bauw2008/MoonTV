import { NextResponse } from 'next/server';

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
async function getShortDramaCategoriesInternal(
  maxRetries = 2,
): Promise<Array<{ type_id: number; type_name: string }>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        'https://api.r2afosne.dpdns.org/vod/categories',
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
      const categories = data.categories || [];
      return categories.map((item: any) => ({
        type_id: item.type_id,
        type_name: item.type_name,
      }));
    } catch (error) {
      lastError = error as Error;
      logger.error(
        `获取短剧分类失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`,
        error,
      );

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); // 指数退避
      }
    }
  }

  throw lastError || new Error('获取短剧分类失败');
}

export async function GET() {
  const startTime = Date.now();

  try {
    const categories = await getShortDramaCategoriesInternal();

    // 设置与网页端一致的缓存策略（categories: 4小时）
    const response = NextResponse.json(categories);

    // 4小时 = 14400秒（与网页端SHORTDRAMA_CACHE_EXPIRE.categories一致）
    const cacheTime = 14400;
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
    response.headers.set('X-Cache-Duration', '4hour');
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
      `[短剧分类API] 获取失败 (耗时: ${responseTime}ms):`,
      error,
    );

    // 返回更详细的错误信息
    const errorMessage =
      error instanceof Error ? error.message : '服务器内部错误';

    return NextResponse.json(
      {
        error: '获取短剧分类失败',
        details: errorMessage,
        responseTime: `${responseTime}ms`,
      },
      { status: 500 },
    );
  }
}
