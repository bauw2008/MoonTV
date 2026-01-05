import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';

// 清空所有评论（仅管理员和站长）

export const POST = AuthGuard.admin(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // AuthGuard.admin already handles authorization
      // No need to check role again

      // 清空所有评论
      const success = await db.clearComments();

      if (success) {
        return NextResponse.json({ success: true, message: '所有评论已清空' });
      } else {
        return NextResponse.json({ error: '清空评论失败' }, { status: 500 });
      }
    } catch (error) {
      console.error('清空评论失败:', error);
      return NextResponse.json(
        { error: '清空评论失败: ' + (error as Error).message },
        { status: 500 },
      );
    }
  },
);
