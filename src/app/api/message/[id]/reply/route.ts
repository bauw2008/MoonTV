import { NextRequest } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

// 获取用户角色的辅助函数
async function getUserRole(
  username: string
): Promise<'owner' | 'admin' | 'user'> {
  try {
    // 获取管理员配置
    const adminConfig = await db.getAdminConfig();
    if (adminConfig && adminConfig.UserConfig && adminConfig.UserConfig.Users) {
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
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
  comments: Comment[]
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
  commentCount?: number;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 发布回复
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '回复内容不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const commentId = params.id;

    // 获取现有评论
    const commentsData = await db.getCache('message_board_comments');
    const comments: Comment[] = commentsData || [];

    // 查找评论
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) {
      return new Response(
        JSON.stringify({ success: false, error: '评论不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 计算用户留言数量
    const userCommentCounts = calculateUserCommentCounts(comments);

    // 创建回复
    // 获取用户头像
    let userAvatar = undefined;
    try {
      const avatarData = await db.getUserAvatar(authInfo.username);
      userAvatar = avatarData || undefined;
    } catch (err) {
      // 如果获取头像失败，保持为undefined
    }

    // 获取用户角色
    let userRole: 'owner' | 'admin' | 'user' = 'user';
    try {
      userRole = await getUserRole(authInfo.username);
    } catch (err) {
      // 如果获取角色失败，保持为user
    }

    // 获取用户留言数量
    const userCommentCount = userCommentCounts[authInfo.username]
      ? userCommentCounts[authInfo.username] + 1
      : 1;

    const newReply: Reply = {
      id: generateId(),
      username: authInfo.username,
      avatar: userAvatar,
      role: userRole,
      content: content.trim(),
      timestamp: Date.now(),
      commentCount: userCommentCount,
    };

    // 添加回复
    comment.replies.push(newReply);

    // 保存到缓存
    await db.setCache('message_board_comments', comments, 7 * 24 * 60 * 60);

    return new Response(JSON.stringify({ success: true, reply: newReply }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('发布回复失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '发布回复失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
