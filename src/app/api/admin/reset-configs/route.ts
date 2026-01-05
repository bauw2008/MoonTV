import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { resetConfig } from '@/lib/config';

export const POST = AuthGuard.owner(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      // AuthGuard.owner already handles authentication and authorization

      // 使用config.ts中的resetConfig函数进行重置
      await resetConfig();

      return NextResponse.json({
        success: true,
        message: '所有配置已重置为默认值',
        requiresNavigationRefresh: true,
      });
    } catch (error) {
      console.error('重置配置失败:', error);
      return NextResponse.json(
        { error: '重置配置失败: ' + (error as Error).message },
        { status: 500 },
      );
    }
  },
);
