import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    logger.warn('获取管理员配置失败:', error);
  }

  // 默认返回user角色
  return 'user';
}

// 评论数据结构已在文件开头定义

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 发布回复

export async function POST(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, content } = await request.json();

    if (!id || !content) {
      return NextResponse.json({ error: '缺少评论ID或内容' }, { status: 400 });
    }

    // 获取用户角色
    const userRole = await getUserRole(authInfo.username);

    // 创建回复
    const reply: Reply = {
      id: generateId(),
      username: authInfo.username,
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
    logger.error('发布回复失败:', error);
    return NextResponse.json({ error: '发布回复失败' }, { status: 500 });
  }
}
