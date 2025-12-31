import { NextRequest, NextResponse } from 'next/server';

import {
  authFramework,
  getSecurityStats,
  resetUserRateLimit,
} from '@/lib/auth';
import { AuthGuard } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * 获取安全统计信息
 */
async function GETHandler(request: NextRequest, context: any) {
  try {
    console.log('=== 安全统计API ===');

    // AuthGuard已处理认证

    // 获取安全统计信息
    const stats = getSecurityStats();

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        framework: authFramework.getStatus(),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('获取安全统计失败:', error);
    return NextResponse.json({ error: '获取安全统计失败' }, { status: 500 });
  }
}

/**
 * 重置用户限流
 */
async function POSTHandler(request: NextRequest, context: any) {
  try {
    console.log('=== 重置限流API ===');

    // AuthGuard已处理认证

    const body = await request.json();
    const { identifier } = body;

    if (!identifier) {
      return NextResponse.json({ error: '缺少用户标识符' }, { status: 400 });
    }

    // 重置限流
    resetUserRateLimit(identifier);

    console.log('已重置用户限流:', identifier);

    return NextResponse.json({
      success: true,
      message: '限流已重置',
      identifier,
    });
  } catch (error) {
    console.error('重置限流失败:', error);
    return NextResponse.json({ error: '重置限流失败' }, { status: 500 });
  }
}

export const GET = AuthGuard.admin(GETHandler);
export const POST = AuthGuard.admin(POSTHandler);
