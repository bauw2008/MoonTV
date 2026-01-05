/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { CalendarCacheManager } from '@/lib/calendar-cache';
import { getFilters, getReleaseCalendar } from '@/lib/release-calendar-scraper';

export const runtime = 'nodejs';

// 🔄 缓存管理已迁移到数据库（CalendarCacheManager）
// 移除内存缓存，使用数据库缓存实现全局共享

// 手动刷新缓存的API

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const filtersParam = searchParams.get('filters');

      let filters;
      if (filtersParam) {
        try {
          filters = JSON.parse(filtersParam);
        } catch (error) {
          return NextResponse.json(
            { error: '无效的filters参数' },
            { status: 400 },
          );
        }
      }

      // 获取发布日历和过滤器
      const [calendarResult, filtersData] = await Promise.all([
        getReleaseCalendar(filters),
        getFilters(),
      ]);

      // 合并结果，包含filters字段
      const result = {
        ...calendarResult,
        filters: filtersData,
      };
      return NextResponse.json(result);
    } catch (error) {
      console.error('获取发布日历失败:', error);
      return NextResponse.json({ error: '获取发布日历失败' }, { status: 500 });
    }
  },
);

export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // 清除缓存（强制下次重新获取）
      await CalendarCacheManager.clearCalendarData();

      return NextResponse.json({ success: true, message: '缓存刷新成功' });
    } catch (error) {
      console.error('刷新缓存失败:', error);
      return NextResponse.json({ error: '刷新缓存失败' }, { status: 500 });
    }
  },
);
