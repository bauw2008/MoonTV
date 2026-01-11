/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过不需要认证的路径
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  if (!process.env.PASSWORD) {
    // 如果没有设置密码，重定向到警告页面
    const warningUrl = new URL('/warning', request.url);
    return NextResponse.redirect(warningUrl);
  }

  // 从cookie获取认证信息
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在middleware中完成验证
  if (storageType === 'localstorage') {
    if (!authInfo.password || authInfo.password !== process.env.PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    // 检查菜单访问权限
    const menuCheckResult = await checkMenuAccess(request, pathname);
    if (menuCheckResult) {
      return menuCheckResult;
    }
    return NextResponse.next();
  }

  // 其他模式：只验证签名
  // 检查是否有用户名（非localStorage模式下密码不存储在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 验证签名（如果存在）
  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.PASSWORD || '',
    );

    // 签名验证通过即可
    if (isValidSignature) {
      // 检查菜单访问权限
      const menuCheckResult = await checkMenuAccess(request, pathname);
      if (menuCheckResult) {
        return menuCheckResult;
      }
      return NextResponse.next();
    }
  }

  // 签名验证失败或不存在签名
  return handleAuthFailure(request, pathname);
}

// 验证签名
async function verifySignature(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // 将十六进制字符串转换为Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    // 验证签名
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData,
    );
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string,
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 否则重定向到登录页面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置middleware匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|warning|api/login|api/register|api/logout|api/cron|api/server-config|api/tvbox|api/live/merged|api/parse).*)',
  ],
};

// 路径到菜单设置的映射
const pathToMenuMap: Record<string, string> = {
  '/douban': 'showMovies', // 默认电影
  '/live': 'showLive',
  '/tvbox': 'showTvbox',
  '/shortdrama': 'showShortDrama',
};

// 检查菜单访问权限
async function checkMenuAccess(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse | null> {
  try {
    const authInfo = getAuthInfoFromCookie(request);

    // 管理员和站长可以访问所有菜单
    // 注意：这里无法获取用户角色，因为不能访问数据库
    // 所以我们假设所有登录用户都可以访问所有菜单
    // 如果需要更严格的控制，需要在前端页面中实现

    // 首页和管理页面总是允许访问
    if (
      pathname === '/' ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/search') ||
      pathname.startsWith('/play') ||
      pathname.startsWith('/message') ||
      pathname.startsWith('/favorites') ||
      pathname.startsWith('/release-calendar') ||
      pathname.startsWith('/warning')
    ) {
      return null;
    }

    // 在 middleware 中，我们无法获取菜单设置，因为需要访问数据库
    // 所以我们允许所有已登录用户访问所有菜单
    // 菜单访问权限控制在前端页面中实现（通过 NavigationConfigContext）

    return null;
  } catch (error) {
    console.error('检查菜单访问权限失败:', error);
    // 出错时允许访问，避免阻塞用户
    return null;
  }
}
