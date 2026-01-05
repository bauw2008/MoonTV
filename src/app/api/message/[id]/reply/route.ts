import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth/guards';
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
  commentCount?: number;
  category?: 'suggestion' | 'feedback' | 'discussion' | 'other';
  isPinned?: boolean;
}

interface Reply {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
  commentCount?: number;
}

// 获取用户角色的辅助函数
async function getUserRole(
  username: string,
): Promise<'owner' | 'admin' | 'user'> {
  try {
    // 获取管理员配置
    const adminConfig = await db.getAdminConfig();
    if (adminConfig && adminConfig.UserConfig && adminConfig.UserConfig.Users) {
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (user) {
        return user.role;
      }
    }
  } catch (error) {
    // 如果获取管理员配置失败，保持为user
    console.warn('获取管理员配置失败:', error);
  }

  // 默认返回user角色
  return 'user';
}

// 计算用户留言数量的辅助函数
function calculateUserCommentCounts(
  comments: Comment[],
): Record<string, number> {
  const userCommentCounts: Record<string, number> = {};

  // 计算每个用户的评论数量
  comments.forEach((comment) => {
    // 计算主评论
    userCommentCounts[comment.username] =
      (userCommentCounts[comment.username] || 0) + 1;

    // 计算回复
    comment.replies.forEach((reply) => {
      userCommentCounts[reply.username] =
        (userCommentCounts[reply.username] || 0) + 1;
    });
  });

  return userCommentCounts;
}

// 评论数据结构已在文件开头定义

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 发布回复

export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { id, content } = await request.json();

      if (!id || !content) {
        return NextResponse.json(
          { error: '缺少评论ID或内容' },
          { status: 400 },
        );
      }

      // 获取用户角色
      const userRole = await getUserRole(user.username);

      // 创建回复
      const reply: Reply = {
        id: generateId(),
        username: user.username,
        role: userRole,
        content,
        timestamp: Date.now(),
      };

      // 保存回复到数据库
      const success = await db.addReply(id, reply);

      if (success) {
        return NextResponse.json({
          success: true,
          message: '回复发布成功',
          reply,
        });
      } else {
        return NextResponse.json(
          { error: '回复保存失败或评论不存在' },
          { status: 500 },
        );
      }
    } catch (error) {
      console.error('发布回复失败:', error);
      return NextResponse.json({ error: '发布回复失败' }, { status: 500 });
    }
  },
);
