import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 导出处理函数
export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const config = await getConfig();

      // 返回敏感词列表
      return NextResponse.json({
        yellowWords: config.YellowWords || [],
      });
    } catch (error) {
      console.error('获取敏感词失败:', error);
      return NextResponse.json({ error: '获取敏感词失败' }, { status: 500 });
    }
  },
);
