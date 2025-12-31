import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getUserVideoSources } from '@/lib/source-index';

export const runtime = 'nodejs';

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // 获取可用的API站点
      const sources = await getUserVideoSources(user.username);

      return NextResponse.json(sources);
    } catch (error) {
      console.error('获取源列表失败:', error);
      return NextResponse.json({ error: '获取源列表失败' }, { status: 500 });
    }
  },
);
