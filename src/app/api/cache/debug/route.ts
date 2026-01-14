import { NextResponse } from 'next/server';

import { EdgeOneKVCache } from '@/lib/edgeone-kv-cache';

/**
 * EdgeOne KV 缓存调试 API
 * 用于查看 EdgeOne KV 的状态和统计信息
 *
 * ⚠️ 重要说明：
 * 此 API 运行在 Next.js Node.js 环境中，无法直接访问 EdgeOne KV。
 * EdgeOne KV 只能在 EdgeOne Pages Edge Functions 中使用。
 *
 * 使用方法：
 * GET /api/cache/debug - 查看 EdgeOne KV 状态
 *
 * 如需使用 EdgeOne KV，请使用 EdgeOne 函数：
 * GET /api/edgeone-cache/debug
 */
export async function GET() {
  try {
    const edgeOneEnabled = process.env.EDGEONE_KV_ENABLED === 'true';
    const edgeOneAvailable = EdgeOneKVCache.isAvailable();

    // 获取 EdgeOne KV 统计信息
    const stats = await EdgeOneKVCache.getStats();

    return NextResponse.json({
      status: 'ok',
      environment: 'nextjs-api',  // 明确标识这是 Next.js API
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
      important: {
        note: 'Next.js API 路由无法访问 EdgeOne KV',
        reason: 'EdgeOne KV 只能在 EdgeOne Pages Edge Functions 中使用',
        solution: '请使用 /api/edgeone-cache/* 路由来访问 EdgeOne KV',
      },
      tips: {
        enabled: 'EdgeOne KV 已启用，但需要使用 EdgeOne 函数',
        available: 'EdgeOne KV 可用，正在使用 EdgeOne KV 缓存',
        notAvailable:
          'EdgeOne KV 不可用，请使用 EdgeOne 函数（/api/edgeone-cache/*）',
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
