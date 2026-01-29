import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

/**
 * 获取豆瓣每周热门（电影或剧集）
 * GET /api/douban/weekly-hot?type=movie|tv&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'movie'; // movie 或 tv
    const limit = parseInt(searchParams.get('limit') || '10');
    const start = parseInt(searchParams.get('start') || '0');

    // 根据类型选择不同的collection
    const collectionMap: Record<string, string> = {
      movie: 'movie_weekly_best',
      tv: 'tv_chinese_best_weekly',
    };

    const collection = collectionMap[type] || 'movie_weekly_best';

    // 豆瓣每周热门API
    const apiURL = `https://m.douban.com/rexxar/api/v2/subject_collection/${collection}/items?start=${start}&count=${limit}`;

    const response = await fetch(apiURL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        Referer: 'https://m.douban.com/',
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`豆瓣API请求失败: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('获取豆瓣每周热门失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
