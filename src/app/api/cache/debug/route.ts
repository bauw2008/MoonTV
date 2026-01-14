import { NextResponse } from 'next/server';

import { EdgeOneKVCache } from '@/lib/edgeone-kv-cache';

/**
 * EdgeOne KV 缓存调试 API
 * 用于查看 EdgeOne KV 的状态和统计信息
 *
 * 使用方法：
 * GET /api/cache/debug - 查看 EdgeOne KV 状态
 */
export async function GET() {
  try {
    const edgeOneEnabled = process.env.EDGEONE_KV_ENABLED === 'true';
    const edgeOneAvailable = EdgeOneKVCache.isAvailable();

    // 获取 EdgeOne KV 统计信息
    const stats = await EdgeOneKVCache.getStats();

    return NextResponse.json({
      status: 'ok',
      edgeOneKV: {
        enabled: edgeOneEnabled,
        available: edgeOneAvailable,
        stats,
      },
      environment: {
        EDGEONE_KV_ENABLED: process.env.EDGEONE_KV_ENABLED,
        NEXT_PUBLIC_EDGEONE_KV_ENABLED:
          process.env.NEXT_PUBLIC_EDGEONE_KV_ENABLED,
      },
      tips: {
        enabled: 'EdgeOne KV 已启用，但可能未在 EdgeOne Pages 环境中运行',
        available: 'EdgeOne KV 可用，正在使用 EdgeOne KV 缓存',
        notAvailable: 'EdgeOne KV 不可用，可能是本地环境或未正确初始化 KV 实例',
      },
    });
  } catch (error) {
    console.error('EdgeOne KV 调试 API 错误:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
