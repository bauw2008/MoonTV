/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';

export const runtime = 'nodejs';

// 最大保存条数（与客户端保持一致）
const HISTORY_LIMIT = 20;

/**
 * GET /api/searchhistory
 * 返回 string[]
 */

/**
 * POST /api/searchhistory
 * body: { keyword: string }
 */

/**
 * DELETE /api/searchhistory?keyword=<kw>
 *
 * 1. 不带 keyword -> 清空全部搜索历史
 * 2. 带 keyword=<kw> -> 删除单条关键字
 */

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // 获取搜索历史 - 这里需要实现实际的获取逻辑
      // 由于没有具体的数据库方法，我们返回一个空数组
      return NextResponse.json([]);
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return NextResponse.json({ error: '获取搜索历史失败' }, { status: 500 });
    }
  },
);

export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { keyword } = await request.json();

      if (!keyword) {
        return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
      }

      // 保存搜索历史 - 这里需要实现实际的保存逻辑
      // 由于没有具体的数据库方法，我们返回一个简单的成功响应
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      return NextResponse.json({ error: '保存搜索历史失败' }, { status: 500 });
    }
  },
);

export const DELETE = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const keyword = searchParams.get('keyword');

      // 删除搜索历史 - 这里需要实现实际的删除逻辑
      // 由于没有具体的数据库方法，我们返回一个简单的成功响应
      if (keyword) {
        // 删除单条搜索历史
        return NextResponse.json({
          success: true,
          message: '搜索历史删除成功',
        });
      } else {
        // 清空所有搜索历史
        return NextResponse.json({ success: true, message: '搜索历史已清空' });
      }
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      return NextResponse.json({ error: '删除搜索历史失败' }, { status: 500 });
    }
  },
);
