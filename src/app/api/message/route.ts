import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';

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
  category?: 'suggestion' | 'feedback' | 'discussion' | 'other'; // 留言分类
  isPinned?: boolean; // 是否置顶
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

// 获取所有评论

// 发布新评论

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // 获取所有评论
      const comments = await db.getComments();
      return NextResponse.json({ comments });
    } catch (error) {
      console.error('获取评论失败:', error);
      return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
    }
  },
);

export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      console.log('开始处理POST请求');
      const body = await request.json();
      console.log('请求体:', body);

      const { content, category } = body;

      if (!content) {
        console.log('错误: 缺少评论内容');
        return NextResponse.json({ error: '缺少评论内容' }, { status: 400 });
      }

      console.log('获取用户角色...');
      // 获取用户角色
      const userRole = await getUserRole(user.username);
      console.log('用户角色:', userRole);

      console.log('创建评论对象...');
      // 创建评论
      const comment: Comment = {
        id: generateId(),
        username: user.username,
        role: userRole,
        content,
        timestamp: Date.now(),
        replies: [],
        category: category || 'other',
      };

      console.log('保存评论到数据库...');
      // 保存评论到数据库
      const success = await db.addComment(comment);
      console.log('保存结果:', success);

      if (success) {
        console.log('评论保存成功');
        return NextResponse.json({
          success: true,
          message: '评论发布成功',
          comment,
        });
      } else {
        console.log('评论保存失败');
        return NextResponse.json({ error: '评论保存失败' }, { status: 500 });
      }
    } catch (error) {
      console.error('发布评论失败:', error);
      return NextResponse.json(
        { error: '发布评论失败: ' + (error as Error).message },
        { status: 500 },
      );
    }
  },
);
