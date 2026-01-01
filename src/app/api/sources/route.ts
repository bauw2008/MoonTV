import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';
import { AuthGuard } from '@/lib/auth';
import { getUserVideoSourcesSimple } from '@/lib/config';

export const runtime = 'nodejs';

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // 获取可用的API站点
      const sources = await getUserVideoSourcesSimple(user.username);

      return NextResponse.json(sources);
    } catch (error) {
      console.error('获取源列表失败:', error);
      return NextResponse.json({ error: '获取源列表失败' }, { status: 500 });
    }
  },
);
