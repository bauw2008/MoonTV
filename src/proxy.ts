import { NextRequest, NextResponse } from 'next/server';

import { authFramework } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过不需要认证的路径
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  try {
    // 检查是否设置了密码（开发环境可能不需要认证）
    if (!process.env.PASSWORD) {
      const warningUrl = new URL('/warning', request.url);
      return NextResponse.redirect(warningUrl);
    }

    // 确保认证框架已初始化
    if (!authFramework.getStatus().initialized) {
      await authFramework.initialize();
    }

    // 使用认证框架进行认证
    const authManager = authFramework.getAuthManager();
    const authResult = await authManager.authenticate(request);

    if (!authResult.success || !authResult.user) {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // 认证通过，继续处理请求
    return NextResponse.next();
  } catch (error) {
    console.error('Proxy认证失败:', error);
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
}

function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
    '/login',
    '/register',
    '/warning',
    '/admin', // 添加管理员页面，让客户端AdminAccessGuard控制认证
    '/api/register',
    '/api/auth/login', // 统一的认证端点
    '/api/auth/logout', // 统一的认证端点
    // '/api/cron', // 移除 - 需要认证
    // '/api/server-config', // 移除 - 需要认证
    '/api/tvbox', // 重新添加 - TVBox相关API应该由各自的AuthGuard处理
    '/api/tvbox-config', // 添加TVBox配置API路径，允许无需认证访问
    '/api/live/merged',
    '/api/parse',
    '/api/tmdb', // 添加TMDB API路径，允许无需认证访问
    '/api/short-drama', // 添加短剧API路径，允许无需认证访问
    '/api/auth', // 添加认证API路径，允许无需认证访问
    '/.well-known',
  ];
  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置proxy匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|warning|api/login|api/register|api/logout|api/tvbox-config|api/live/merged|api/parse|api/short-drama|api/auth|admin|play-stats).*)',
  ],
};
