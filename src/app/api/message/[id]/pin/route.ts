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
  replies: any[];
  commentCount?: number;
  category?: 'suggestion' | 'feedback' | 'discussion' | 'other';
  isPinned?: boolean;
}

// 置顶/取消置顶评论
export async function POST(
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

    // 检查用户是否是管理员或站长
    let userRole: 'owner' | 'admin' | 'user' = 'user';
    try {
      // 获取管理员配置
      const adminConfig = await db.getAdminConfig();
      if (
        adminConfig &&
        adminConfig.UserConfig &&
        adminConfig.UserConfig.Users
      ) {
        const user = adminConfig.UserConfig.Users.find(
          (u) => u.username === authInfo.username,
        );
        if (user) {
          userRole = user.role;
        }
      }
    } catch (error) {
      // 如果获取管理员配置失败，保持为user
      console.warn('获取管理员配置失败:', error);
    }

    // 只有管理员和站长可以置顶评论
    if (userRole !== 'admin' && userRole !== 'owner') {
      return new Response(
        JSON.stringify({ success: false, error: '权限不足' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 获取评论ID（已在上面解构）

    // 获取现有评论
    const commentsData = await db.getCache('message_board_comments');
    const comments: Comment[] = commentsData || [];

    // 查找评论
    const commentIndex = comments.findIndex((c) => c.id === id);
    if (commentIndex === -1) {
      return new Response(
        JSON.stringify({ success: false, error: '评论不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 切换置顶状态
    comments[commentIndex].isPinned = !comments[commentIndex].isPinned;

    // 保存到缓存
    await db.setCache('message_board_comments', comments, 7 * 24 * 60 * 60);

    return new Response(
      JSON.stringify({
        success: true,
        isPinned: comments[commentIndex].isPinned,
        message: comments[commentIndex].isPinned ? '置顶成功' : '取消置顶成功',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('置顶评论失败:', error);
    return new Response(JSON.stringify({ success: false, error: '操作失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
