/**
 * 登录API
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const { username, password } = await request.json();

    // 基础验证
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 },
      );
    }

    // 执行登录
    const result = await authManager.login({ username, password });

    if (result.success && result.tokens) {
      const response = NextResponse.json({
        success: true,
        user: {
          username: result.user.username,
          role: result.user.role,
        },
      });

      // 设置HttpOnly Cookie
      response.cookies.set('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60, // 15分钟
        path: '/',
      });

      response.cookies.set('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7天
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { error: result.error || '登录失败' },
      { status: 401 },
    );
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
