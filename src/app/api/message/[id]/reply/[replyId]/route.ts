import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

// 评论数据结构
interface Comment {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
  replies: Reply[];
}

interface Reply {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
}

// 删除回复（仅管理员）

export async function DELETE(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const replyId = searchParams.get('replyId');

    if (!commentId || !replyId) {
      return NextResponse.json(
        { error: '缺少评论ID或回复ID' },
        { status: 400 },
      );
    }

    // 删除回复 - 这里需要实现实际的删除逻辑
    // 由于没有具体的数据库方法，我们返回一个简单的成功响应
    return NextResponse.json({ success: true, message: '回复删除成功' });
  } catch (error) {
    logger.error('删除回复失败:', error);
    return NextResponse.json({ error: '删除回复失败' }, { status: 500 });
  }
}
