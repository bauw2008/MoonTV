import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

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

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 删除评论（仅管理员和站长）
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 从URL中获取评论ID
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    // 检查权限（仅站长和管理员可以删除）
    if (authInfo.role !== 'owner' && authInfo.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 },
      );
    }

    // 删除评论
    const success = await db.deleteComment(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: '评论不存在或删除失败' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    return NextResponse.json(
      { success: false, error: '删除评论失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
