import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const tests = {
    // 测试1：检查EdgeOne Pages特定环境变量
    edgeoneEnv: {
      EDGEONE_ENV: process.env.EDGEONE_ENV,
      EDGEONE_REGION: process.env.EDGEONE_REGION,
      EDGEONE_DEPLOYMENT_ID: process.env.EDGEONE_DEPLOYMENT_ID,
    },
    
    // 测试2：检查Node.js API可用性
    nodeApis: {
      processAvailable: typeof process !== 'undefined',
      requireAvailable: typeof require !== 'undefined',
      fsAvailable: false,
      pathAvailable: false,
    },
    
    // 测试3：检查Web API可用性
    webApis: {
      cryptoAvailable: typeof crypto !== 'undefined' && crypto.subtle,
      fetchAvailable: typeof fetch !== 'undefined',
      setTimeoutAvailable: typeof setTimeout !== 'undefined',
    },
    
    // 测试4：检查运行时信息
    runtimeInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : 'not available',
    },
    
    // 测试5：检查环境变量
    envVars: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      PASSWORD: process.env.PASSWORD ? '***' : 'not set',
      USERNAME: process.env.USERNAME ? '***' : 'not set',
      // 检查所有以EDGEONE_开头的环境变量
      edgeoneVars: Object.keys(process.env)
        .filter(key => key.startsWith('EDGEONE_'))
        .reduce((obj, key) => {
          obj[key] = process.env[key];
          return obj;
        }, {} as Record<string, string>),
    },
    
    // 测试6：检查文件系统访问
    fileSystem: {
      canAccessFs: false,
      error: '',
    },
    
    // 测试7：检查数据库连接
    database: {
      canImportDb: false,
      error: '',
    },
  };

  try {
    // 测试文件系统访问
    const fs = await import('fs');
    const path = await import('path');
    tests.nodeApis.fsAvailable = true;
    tests.nodeApis.pathAvailable = true;
    
    // 尝试读取当前目录
    try {
      const cwd = process.cwd();
      const files = fs.readdirSync(cwd);
      tests.fileSystem.canAccessFs = true;
      tests.fileSystem.currentDir = cwd;
      tests.fileSystem.fileCount = files.length;
    } catch (fsError) {
      tests.fileSystem.error = fsError.message;
    }
  } catch (importError) {
    tests.fileSystem.error = `Cannot import fs/path: ${importError.message}`;
  }

  try {
    // 测试数据库导入
    const { db } = await import('@/lib/db');
    tests.database.canImportDb = true;
  } catch (dbError) {
    tests.database.error = dbError.message;
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    tests,
    recommendations: [
      '如果fs/path不可用，说明运行在Edge Runtime而非Node.js Runtime',
      '如果数据库导入失败，检查数据库配置和环境变量',
      '如果EDGEONE_ENV未设置，可能不是EdgeOne Pages环境',
    ],
  });
}