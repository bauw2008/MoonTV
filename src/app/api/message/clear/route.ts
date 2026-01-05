import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

// 清空所有评论（仅管理员和站长）

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查用户权限（仅管理员和站长可以清空评论）
    if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

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
}
