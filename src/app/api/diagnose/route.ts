import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 收集环境信息
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      EDGEONE_ENV: process.env.EDGEONE_ENV,
      // 检查关键环境变量是否存在
      hasPassword: !!process.env.PASSWORD,
      hasUsername: !!process.env.USERNAME,
      // Node.js版本
      nodeVersion: process.version,
      // 平台信息
      platform: process.platform,
      // 请求信息
      requestHeaders: Object.fromEntries(request.headers.entries()),
      url: request.url,
    };

    // 测试数据库连接
    let dbConnection = 'not tested';
    try {
      const { db } = await import('@/lib/db');
      dbConnection = 'db import successful';
    } catch (dbError) {
      dbConnection = `db error: ${dbError.message}`;
    }

    // 测试文件系统访问（Node.js特定）
    let fsAccess = 'not tested';
    try {
      const fs = await import('fs');
      const path = await import('path');
      fsAccess = 'fs and path modules available';
    } catch (fsError) {
      fsAccess = `fs error: ${fsError.message}`;
    }

    // 测试crypto API
    let cryptoTest = 'not tested';
    try {
      // 测试Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode('test');
      const hash = await crypto.subtle.digest('SHA-256', data);
      cryptoTest = 'crypto API available';
    } catch (cryptoError) {
      cryptoTest = `crypto error: ${cryptoError.message}`;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envInfo,
      tests: {
        database: dbConnection,
        filesystem: fsAccess,
        crypto: cryptoTest,
      },
      // 检查API路由是否被正确部署
      apiRoutes: {
        login: '/api/login exists in build',
        publicConfig: '/api/public-config exists in build',
      },
      message: 'Diagnostic API - 请将此信息用于问题排查',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      },
    }, { status: 500 });
  }
}