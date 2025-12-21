import { NextRequest } from 'next/server';

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

// 删除评论（仅管理员）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查权限（仅站长和管理员可以删除）
    if (authInfo.role !== 'owner' && authInfo.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: '权限不足' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 获取评论ID（已在上面解构）

    // 获取现有评论
    const commentsData = await db.getCache('message_board_comments');
    const comments: Comment[] = commentsData || [];

    // 查找并删除评论
    const commentIndex = comments.findIndex((comment) => comment.id === id);
    if (commentIndex === -1) {
      return new Response(
        JSON.stringify({ success: false, error: '评论不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 删除评论
    comments.splice(commentIndex, 1);

    // 保存到缓存
    await db.setCache('message_board_comments', comments, 7 * 24 * 60 * 60);

    return new Response(
      JSON.stringify({ success: true, message: '删除成功' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('删除评论失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '删除评论失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
