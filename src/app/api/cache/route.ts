import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { EdgeOneKVCache, SmartCache } from '@/lib/edgeone-kv-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const debug = searchParams.get('debug') === 'true';

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    // 检查 EdgeOne KV 状态
    const edgeOneAvailable = EdgeOneKVCache.isAvailable();
    const edgeOneEnabled = process.env.EDGEONE_KV_ENABLED === 'true';

    // 使用智能缓存：优先从 EdgeOne KV 读取，未命中时从 Redis 读取
    let source = 'unknown';
    let data = null;

    // 先尝试从 EdgeOne KV 读取
    if (edgeOneAvailable) {
      const edgeOneData = await EdgeOneKVCache.get(key);
      if (edgeOneData !== null) {
        data = edgeOneData;
        source = 'edgeone-kv';
      }
    }

    // EdgeOne KV 未命中，从 Redis 读取
    if (data === null) {
      const redisData = await db.getCache(key);
      if (redisData !== null) {
        data = redisData;
        source = 'redis';

        // 回写到 EdgeOne KV
        if (edgeOneAvailable) {
          await EdgeOneKVCache.set(key, redisData);
        }
      } else {
        source = 'miss';
      }
    }

    // 如果是调试模式，返回详细信息
    if (debug) {
      return NextResponse.json({
        data,
        debug: {
          key,
          source,
          edgeOneKV: {
            enabled: edgeOneEnabled,
            available: edgeOneAvailable,
            hit: source === 'edgeone-kv',
          },
          redis: {
            hit: source === 'redis',
          },
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ API缓存错误 (key: ${request.nextUrl.searchParams.get('key')}):`,
      error,
    );
    // eslint-disable-next-line no-console
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json({ data: null }, { status: 200 }); // 确保返回 200 而不是 500
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, data, expireSeconds } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    // 检查 EdgeOne KV 状态
    const edgeOneAvailable = EdgeOneKVCache.isAvailable();
    const edgeOneEnabled = process.env.EDGEONE_KV_ENABLED === 'true';

    // 使用智能缓存：同时写入 EdgeOne KV 和 Redis
    const results = {
      edgeOneKV: false,
      redis: false,
    };

    // 写入 Redis
    await db.setCache(key, data, expireSeconds);
    results.redis = true;

    // 写入 EdgeOne KV
    if (edgeOneAvailable) {
      await EdgeOneKVCache.set(key, data, expireSeconds);
      results.edgeOneKV = true;
    }

    return NextResponse.json({
      success: true,
      debug: {
        edgeOneKV: {
          enabled: edgeOneEnabled,
          available: edgeOneAvailable,
          written: results.edgeOneKV,
        },
        redis: {
          written: results.redis,
        },
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Set cache error:', error);
    return NextResponse.json({ error: 'Failed to set cache' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (prefix) {
      // 清理过期缓存：同时清理 EdgeOne KV 和 Redis
      const edgeOneAvailable = EdgeOneKVCache.isAvailable();
      const results = {
        edgeOneKV: 0,
        redis: 0,
      };

      if (edgeOneAvailable) {
        results.edgeOneKV = await EdgeOneKVCache.clearExpired(prefix);
      }
      await db.clearExpiredCache(prefix);
      results.redis = 1;

      return NextResponse.json({
        success: true,
        debug: {
          edgeOneKV: {
            available: edgeOneAvailable,
            cleared: results.edgeOneKV,
          },
          redis: {
            cleared: results.redis,
          },
        },
      });
    } else if (key) {
      // 删除指定键：同时删除 EdgeOne KV 和 Redis
      const edgeOneAvailable = EdgeOneKVCache.isAvailable();
      const results = {
        edgeOneKV: false,
        redis: false,
      };

      await db.deleteCache(key);
      results.redis = true;

      if (edgeOneAvailable) {
        await EdgeOneKVCache.delete(key);
        results.edgeOneKV = true;
      }

      return NextResponse.json({
        success: true,
        debug: {
          edgeOneKV: {
            available: edgeOneAvailable,
            deleted: results.edgeOneKV,
          },
          redis: {
            deleted: results.redis,
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Key or prefix is required' },
        { status: 400 },
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Delete cache error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cache' },
      { status: 500 },
    );
  }
}

// 处理函数已直接导出
