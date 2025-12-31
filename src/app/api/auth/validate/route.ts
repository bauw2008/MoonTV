/**
 * 验证API
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('验证API收到请求');
    console.log('Cookies:', request.cookies);

    const authManager = AuthManager.getInstance();
    const result = await authManager.authenticate(request);

    console.log('认证结果:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('验证API错误:', error);
    return NextResponse.json({ error: '验证失败' }, { status: 500 });
  }
}
