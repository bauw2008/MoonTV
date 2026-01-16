import { NextRequest, NextResponse } from 'next/server';

// 临时测试中间件 - 完全开放所有API
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log('🔍 Proxy Test Middleware:', {
    pathname,
    method: request.method,
    url: request.url,
  });
  
  // 完全开放所有请求
  return NextResponse.next();
}

// 匹配所有请求
export const config = {
  matcher: [
    '/api/:path*',
  ],
};