import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const results = {
      env: {
        REDIS_URL: process.env.REDIS_URL ? '***' : 'not set',
        REDIS_URL_length: process.env.REDIS_URL?.length || 0,
        STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      },
      redis: {
        canImport: false,
        canConnect: false,
        error: '',
      },
      simpleTest: {
        canRequire: false,
        error: '',
      }
    };

    // 测试1: 简单require测试
    try {
      // 尝试动态导入redis
      const redisModule = await import('redis');
      results.simpleTest.canRequire = true;
      results.redis.canImport = true;
      
      // 测试2: 尝试连接
      if (process.env.REDIS_URL) {
        try {
          const client = redisModule.createClient({
            url: process.env.REDIS_URL,
            socket: {
              reconnectStrategy: (retries) => {
                if (retries > 3) {
                  return new Error('Max retries reached');
                }
                return Math.min(retries * 100, 3000);
              }
            }
          });
          
          client.on('error', (err) => {
            results.redis.error = `Redis error: ${err.message}`;
          });
          
          await client.connect();
          const ping = await client.ping();
          results.redis.canConnect = true;
          await client.quit();
        } catch (connectError) {
          results.redis.error = `Connect failed: ${connectError instanceof Error ? connectError.message : String(connectError)}`;
        }
      }
    } catch (importError) {
      results.redis.error = `Import failed: ${importError instanceof Error ? importError.message : String(importError)}`;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      analysis: results.redis.error ? 
        `❌ Redis问题: ${results.redis.error}` : 
        `✅ Redis连接正常`,
      recommendation: results.redis.error ? 
        '检查REDIS_URL格式和Redis服务状态' : 
        'Redis正常，问题可能在业务逻辑'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      env: {
        hasRedisUrl: !!process.env.REDIS_URL,
        storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      }
    }, { status: 500 });
  }
}