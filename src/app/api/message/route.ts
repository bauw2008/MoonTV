import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    logger.warn('获取管理员配置失败:', error);
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

// 获取所有评论

// 发布新评论

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 获取分页参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 获取所有评论
    const allComments = await db.getComments();

    // 计算分页
    const totalItems = allComments.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = allComments.slice(startIndex, endIndex);

    return NextResponse.json({
      comments: paginatedComments,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('获取评论失败:', error);
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    logger.log('开始处理POST请求');
    const body = await request.json();
    logger.log('请求体:', body);

    const { content, category } = body;

    if (!content) {
      logger.log('错误: 缺少评论内容');
      return NextResponse.json({ error: '缺少评论内容' }, { status: 400 });
    }

    // 获取用户角色
    const userRole = await getUserRole(authInfo.username);

    logger.log('创建评论对象...');
    // 创建评论
    const comment: Comment = {
      id: generateId(),
      username: authInfo.username,
      role: userRole,
      content,
      timestamp: Date.now(),
      replies: [],
      category: category || 'other',
    };

    logger.log('保存评论到数据库...');
    // 保存评论到数据库
    const success = await db.addComment(comment);
    logger.log('保存结果:', success);

    if (success) {
      logger.log('评论保存成功');
      return NextResponse.json({
        success: true,
        message: '评论发布成功',
        comment,
      });
    } else {
      logger.log('评论保存失败');
      return NextResponse.json({ error: '评论保存失败' }, { status: 500 });
    }
  } catch (error) {
    logger.error('发布评论失败:', error);
    return NextResponse.json(
      { error: '发布评论失败: ' + (error as Error).message },
      { status: 500 },
    );
  }
}
