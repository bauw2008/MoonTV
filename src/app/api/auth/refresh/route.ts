/**
 * 刷新Token API
 */

import { NextRequest, NextResponse } from 'next/server';

import { TokenService } from '@/lib/auth/services/token.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: '未找到刷新令牌' }, { status: 401 });
    }

    const tokenService = new TokenService();
    const newAccessToken = await tokenService.refresh(refreshToken);

    if (!newAccessToken) {
      return NextResponse.json({ error: '刷新令牌无效或已过期' }, { status: 401 });
    }

    // 设置新的访问Token到Cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8小时
      path: '/'
    });

    
    return response;
  } catch (error) {
    console.error('刷新Token API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
