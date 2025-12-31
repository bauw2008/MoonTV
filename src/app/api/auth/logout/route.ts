/**
 * 登出API
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    await authManager.logout(request);

    const response = NextResponse.json({ success: true });

    // 清除Cookie
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');

    return response;
  } catch (error) {
    console.error('登出API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
