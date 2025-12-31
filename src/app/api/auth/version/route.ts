import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

async function GETHandler(request: NextRequest, { user }: { user: any }) {
  try {
    const username = user?.username;

    if (!username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const config = await getConfig();

    // 如果是站长，返回固定版本
    if (username === process.env.USERNAME) {
      return NextResponse.json({
        username,
        permissionVersion: Date.now(), // 站长使用时间戳作为版本
        role: 'owner',
      });
    }

    // 查找用户配置
    const userConfig = config.UserConfig?.Users?.find(
      (u) => u.username === username,
    );

    if (!userConfig) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      username,
      permissionVersion: userConfig.permissionVersion || 0,
      role: userConfig.role,
    });
  } catch (error) {
    console.error('获取权限版本失败:', error);
    return NextResponse.json({ error: '获取权限版本失败' }, { status: 500 });
  }
}

export const GET = AuthGuard.user(GETHandler);
