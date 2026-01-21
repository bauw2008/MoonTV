import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// 删除回复（仅管理员）
export async function DELETE(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 从URL路径中获取 commentId 和 replyId
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const replyId = pathParts[pathParts.length - 1];
    const commentId = pathParts[pathParts.length - 3];

    if (!commentId || !replyId) {
      return NextResponse.json(
        { error: '缺少评论ID或回复ID' },
        { status: 400 },
      );
    }

    // 检查权限（仅站长和管理员可以删除）
    if (authInfo.role !== 'owner' && authInfo.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 },
      );
    }

    // 删除回复
    const success = await db.deleteReply(commentId, replyId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: '回复不存在或删除失败' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: '回复删除成功' });
  } catch (error) {
    logger.error('删除回复失败:', error);
    return NextResponse.json(
      { success: false, error: '删除回复失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
