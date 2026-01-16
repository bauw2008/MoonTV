import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 简化版本，避免数据库依赖
export async function POST(req: NextRequest) {
  try {
    // 读取环境变量
    const STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    const envPassword = process.env.PASSWORD;
    
    console.log('Login API called:', {
      storageType: STORAGE_TYPE,
      hasPassword: !!envPassword,
      nodeEnv: process.env.NODE_ENV,
    });

    // 本地 / localStorage 模式
    if (STORAGE_TYPE === 'localstorage') {
      // 未配置 PASSWORD 时直接放行
      if (!envPassword) {
        const response = NextResponse.json({ ok: true, mode: 'no-password' });
        return response;
      }

      const { password } = await req.json();
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { ok: false, error: '密码错误' },
          { status: 401 },
        );
      }

      // 验证成功
      const response = NextResponse.json({ ok: true, mode: 'localstorage' });
      
      // 简单的cookie设置（不包含敏感信息）
      const authData = {
        authenticated: true,
        timestamp: Date.now(),
        mode: 'localstorage'
      };
      
      response.cookies.set('auth', encodeURIComponent(JSON.stringify(authData)), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7天
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });

      return response;
    }

    // 数据库模式 - 简化版本
    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 检查环境变量中的站长账号
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      const response = NextResponse.json({ ok: true, mode: 'admin' });
      
      const authData = {
        authenticated: true,
        username: username,
        role: 'owner',
        timestamp: Date.now(),
        mode: 'database'
      };
      
      response.cookies.set('auth', encodeURIComponent(JSON.stringify(authData)), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });

      return response;
    }

    // 对于其他用户，返回错误（简化版本）
    return NextResponse.json(
      { error: '用户名或密码错误' },
      { status: 401 },
    );

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        error: '服务器错误',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 },
    );
  }
}