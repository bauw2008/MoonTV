import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 收集生产环境关键信息
    const productionInfo = {
      // 1. 环境信息
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        EDGEONE_ENV: process.env.EDGEONE_ENV,
        // 检查认证相关环境变量（不显示具体值）
        hasPassword: !!process.env.PASSWORD,
        hasUsername: !!process.env.USERNAME,
        passwordLength: process.env.PASSWORD ? process.env.PASSWORD.length : 0,
        usernameSet: !!process.env.USERNAME,
      },
      
      // 2. 运行时信息
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage ? 'available' : 'not available',
        cwd: process.cwd ? process.cwd() : 'not available',
      },
      
      // 3. 请求信息
      request: {
        method: request.method,
        url: request.url,
        headers: {
          host: request.headers.get('host'),
          'user-agent': request.headers.get('user-agent'),
          cookie: request.headers.get('cookie') ? 'present' : 'missing',
        },
      },
      
      // 4. 测试关键功能
      tests: {
        cryptoAvailable: typeof crypto !== 'undefined' && crypto.subtle ? 'yes' : 'no',
        fetchAvailable: typeof fetch !== 'undefined' ? 'yes' : 'no',
        processAvailable: typeof process !== 'undefined' ? 'yes' : 'no',
        modules: {} as Record<string, string>, // 添加modules属性类型
      },
    };

    // 5. 尝试导入关键模块
    let moduleTests = {
      fs: 'not tested',
      path: 'not tested',
      db: 'not tested',
    };

    try {
      const fs = await import('fs');
      moduleTests.fs = 'available';
    } catch (fsError) {
      moduleTests.fs = `error: ${fsError instanceof Error ? fsError.message : String(fsError)}`;
    }

    try {
      const path = await import('path');
      moduleTests.path = 'available';
    } catch (pathError) {
      moduleTests.path = `error: ${pathError instanceof Error ? pathError.message : String(pathError)}`;
    }

    try {
      const { db } = await import('@/lib/db');
      moduleTests.db = 'available';
    } catch (dbError) {
      moduleTests.db = `error: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
    }

    productionInfo.tests.modules = moduleTests;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: '生产环境测试API - 用于诊断认证问题',
      data: productionInfo,
      recommendations: [
        '如果NODE_ENV不是production，说明构建环境有问题',
        '如果PASSWORD/USERNAME未设置，登录API会失败',
        '如果数据库导入失败，检查数据库配置',
        '如果fs/path不可用，可能是Edge Runtime限制',
      ],
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        platform: process.platform,
      },
    }, { status: 500 });
  }
}