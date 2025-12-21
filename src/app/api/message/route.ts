import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
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
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 从缓存获取评论
    const commentsData = await db.getCache('message_board_comments');
    const comments: Comment[] = commentsData || [];

    // 计算用户留言数量
    const userCommentCounts = calculateUserCommentCounts(comments);

    // 按置顶状态和时间排序
    const sortedComments = comments.sort((a, b) => {
      // 首先按置顶状态排序，置顶的在前
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // 然后按时间倒序排序
      return b.timestamp - a.timestamp;
    });

    // 计算分页数据
    const total = sortedComments.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = sortedComments.slice(startIndex, endIndex);

    // 为每个评论和回复添加用户头像信息、角色信息和留言数量
    const commentsWithAvatarsAndRoles = await Promise.all(
      paginatedComments.map(async (comment) => {
        // 获取评论用户头像
        let userAvatar = undefined;
        try {
          const avatarData = await db.getUserAvatar(comment.username);
          userAvatar = avatarData || undefined;
        } catch (err) {
          // 如果获取头像失败，保持为undefined
        }

        // 获取评论用户角色
        let userRole: 'owner' | 'admin' | 'user' = 'user';
        try {
          userRole = await getUserRole(comment.username);
        } catch (err) {
          // 如果获取角色失败，保持为user
        }

        // 获取评论用户留言数量
        const userCommentCount = userCommentCounts[comment.username] || 0;

        // 为回复添加用户头像信息、角色信息和留言数量
        const repliesWithAvatarsAndRoles = await Promise.all(
          comment.replies.map(async (reply) => {
            let replyUserAvatar = undefined;
            try {
              const avatarData = await db.getUserAvatar(reply.username);
              replyUserAvatar = avatarData || undefined;
            } catch (err) {
              // 如果获取头像失败，保持为undefined
            }

            // 获取回复用户角色
            let replyUserRole: 'owner' | 'admin' | 'user' = 'user';
            try {
              replyUserRole = await getUserRole(reply.username);
            } catch (err) {
              // 如果获取角色失败，保持为user
            }

            // 获取回复用户留言数量
            const replyUserCommentCount =
              userCommentCounts[reply.username] || 0;

            return {
              ...reply,
              avatar: replyUserAvatar,
              role: replyUserRole,
              commentCount: replyUserCommentCount,
            };
          }),
        );

        return {
          ...comment,
          avatar: userAvatar,
          role: userRole,
          commentCount: userCommentCount,
          replies: repliesWithAvatarsAndRoles,
        };
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        comments: commentsWithAvatarsAndRoles,
        pagination: {
          currentPage: page,
          totalPages,
          totalComments: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('获取评论失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '获取评论失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// 发布新评论
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { content, category } = await request.json();

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '评论内容不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 获取现有评论
    const commentsData = await db.getCache('message_board_comments');
    const comments: Comment[] = commentsData || [];

    // 创建新评论
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

    const newComment: Comment = {
      id: generateId(),
      username: authInfo.username,
      avatar: userAvatar,
      role: userRole,
      content: content.trim(),
      timestamp: Date.now(),
      replies: [],
      category: category || 'other', // 默认分类为其他
    };

    // 添加到评论列表
    comments.push(newComment);

    // 保存到缓存（设置7天过期）
    await db.setCache('message_board_comments', comments, 7 * 24 * 60 * 60);

    return new Response(
      JSON.stringify({ success: true, comment: newComment }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('发布评论失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '发布评论失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
