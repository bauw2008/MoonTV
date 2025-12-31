/**
 * 注册API - 使用新的认证框架
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const { username, password, confirmPassword, reason } =
      await request.json();

    // 检查是否允许注册
    const { getAdminConfig } = await import('@/lib/config');
    const config = await getAdminConfig();

    if (!config.UserConfig?.AllowRegister) {
      return NextResponse.json(
        { error: '管理员已关闭用户注册功能' },
        { status: 403 },
      );
    }

    // 执行注册
    const result = await authManager.register({
      username,
      password,
      confirmPassword,
      reason,
    });

    if (result.success && result.tokens) {
      const response = NextResponse.json({
        ok: true,
        pending: result.pending || false,
        message: result.message || '注册成功',
        user: result.user
          ? {
              username: result.user.username,
              role: result.user.role,
            }
          : null,
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
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7天
        path: '/',
      });

      return response;
    }

    // 处理待审核情况
    if (result.success && result.pending) {
      return NextResponse.json({
        ok: true,
        pending: true,
        message: result.message || '已提交注册申请，等待管理员审核',
      });
    }

    return NextResponse.json(
      { error: result.error || '注册失败' },
      { status: 400 },
    );
  } catch (error) {
    console.error('注册API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
