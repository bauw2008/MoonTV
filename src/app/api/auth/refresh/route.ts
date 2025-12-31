/**
 * 刷新Token API
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: '未找到刷新令牌' }, { status: 401 });
    }

    const authManager = AuthManager.getInstance();
    // 临时禁用token刷新，等待AuthManager实现
    return NextResponse.json(
      { error: 'Token刷新功能暂时不可用' },
      { status: 501 },
    );
  } catch (error) {
    console.error('刷新Token API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
