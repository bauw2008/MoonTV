// 检测运行环境
export function detectRuntime(): 'nodejs' | 'edge' | 'vercel' | 'edgeone' {
  // 检测 EdgeOne
  if (typeof globalThis !== 'undefined' && (globalThis as any).EdgeRuntime) {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    return 'edgeone';
  }

  // 检测 Vercel Edge Runtime
  if (typeof EdgeRuntime !== 'undefined') {
    return 'edge';
  }

  // 检测 Vercel Node.js 环境
  if (process.env.VERCEL && process.env.VERCEL_ENV) {
    return 'vercel';
  }

  // 默认为 Node.js
  return 'nodejs';
}

// 检测是否为 Edge 兼容环境
export function isEdgeCompatible(): boolean {
  const runtime = detectRuntime();
  return runtime === 'edge' || runtime === 'edgeone';
}

// 检测是否支持 Node.js 特性
export function supportsNodeFeatures(): boolean {
  const runtime = detectRuntime();
  return runtime === 'nodejs' || runtime === 'vercel';
}
