/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { CalendarCacheManager } from '@/lib/calendar-cache';
import { getFilters, getReleaseCalendar } from '@/lib/release-calendar-scraper';
import { ReleaseCalendarResult } from '@/lib/types';

export const runtime = 'nodejs';

// 🔄 缓存管理已迁移到数据库（CalendarCacheManager）
// 移除内存缓存，使用数据库缓存实现全局共享

export async function GET(request: NextRequest) {
  // 检查用户认证
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // 获取查询参数
    const type = searchParams.get('type') as 'movie' | 'tv' | null;
    const region = searchParams.get('region');
    const genre = searchParams.get('genre');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit') || '0')
      : undefined;
    const offset = parseInt(searchParams.get('offset') || '0');
    const refresh =
      searchParams.get('refresh') === 'true' || searchParams.has('nocache');

    // 参数验证
    if (type && !['movie', 'tv'].includes(type)) {
      return NextResponse.json(
        { error: 'type 参数必须是 movie 或 tv' },
        { status: 400 },
      );
    }

    // 移除limit限制，因为实际数据量只有65个项目
    if (offset < 0) {
      return NextResponse.json({ error: 'offset 不能为负数' }, { status: 400 });
    }

    // 🔍 检查数据库缓存（除非强制刷新）
    if (!refresh) {
      const cachedData = await CalendarCacheManager.getCalendarData();
      if (cachedData) {
        // eslint-disable-next-line no-console
        console.log('✅ 使用数据库缓存的发布日历数据');

        // 从缓存中应用过滤和分页
        let filteredItems = cachedData.items;

        if (type) {
          filteredItems = filteredItems.filter(
            (item: any) => item.type === type,
          );
        }

        if (region && region !== '全部') {
          filteredItems = filteredItems.filter((item: any) =>
            item.region.includes(region),
          );
        }

        if (genre && genre !== '全部') {
          filteredItems = filteredItems.filter((item: any) =>
            item.genre.includes(genre),
          );
        }

        if (dateFrom) {
          filteredItems = filteredItems.filter(
            (item: any) => item.releaseDate >= dateFrom,
          );
        }

        if (dateTo) {
          filteredItems = filteredItems.filter(
            (item: any) => item.releaseDate <= dateTo,
          );
        }

        const total = filteredItems.length;
        const items = limit
          ? filteredItems.slice(offset, offset + limit)
          : filteredItems.slice(offset);
        const hasMore = limit ? offset + limit < total : false;

        return NextResponse.json({
          items,
          total,
          hasMore,
          filters: cachedData.filters,
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log('🌐 获取新的发布日历数据...');

    // 获取数据和过滤器
    const [calendarData, filters] = await Promise.all([
      getReleaseCalendar({
        type: type || undefined,
        region: region || undefined,
        genre: genre || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit,
        offset,
      }),
      getFilters(),
    ]);

    const result: ReleaseCalendarResult = {
      items: calendarData.items,
      total: calendarData.total,
      hasMore: calendarData.hasMore,
      filters,
    };

    // 💾 更新数据库缓存（仅在获取完整数据时）
    if (!type && !region && !genre && !dateFrom && !dateTo && offset === 0) {
      // eslint-disable-next-line no-console
      console.log('📊 获取完整数据，更新数据库缓存...');
      const allData = await getReleaseCalendar({});
      const cacheData = {
        items: allData.items,
        total: allData.total,
        hasMore: allData.hasMore,
        filters,
      };

      const saveSuccess =
        await CalendarCacheManager.saveCalendarData(cacheData);
      if (saveSuccess) {
        // eslint-disable-next-line no-console
        console.log(
          `✅ 发布日历数据库缓存已更新，包含 ${allData.items.length} 项`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn('⚠️ 数据库缓存更新失败，但不影响API响应');
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取发布日历失败:', error);
    return NextResponse.json(
      {
        error: '获取发布日历失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

// 手动刷新缓存的API
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // eslint-disable-next-line no-console
    console.log('🔄 手动刷新发布日历数据库缓存...');

    // 清除数据库缓存
    await CalendarCacheManager.clearCalendarData();

    // 重新获取数据
    const [calendarData, filters] = await Promise.all([
      getReleaseCalendar({}),
      getFilters(),
    ]);

    // 更新数据库缓存
    const cacheData = {
      items: calendarData.items,
      total: calendarData.total,
      hasMore: calendarData.hasMore,
      filters,
    };

    const saveSuccess = await CalendarCacheManager.saveCalendarData(cacheData);

    if (saveSuccess) {
      // eslint-disable-next-line no-console
      console.log(
        `✅ 发布日历数据库缓存刷新完成，包含 ${calendarData.items.length} 项`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.warn('⚠️ 数据库缓存刷新失败');
    }

    return NextResponse.json({
      success: true,
      message: '发布日历缓存已刷新',
      itemCount: calendarData.items.length,
      cacheUpdated: saveSuccess,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('刷新发布日历缓存失败:', error);
    return NextResponse.json(
      {
        error: '刷新发布日历缓存失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
