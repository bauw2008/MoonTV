import { NextResponse } from 'next/server';

import { CacheManager } from '@/lib/auth/core/cache-manager';

export async function POST() {
  try {
    const cacheManager = new CacheManager();
    await cacheManager.clear();
    return NextResponse.json({ success: true, message: '认证缓存已清理' });
  } catch (error) {
    console.error('清理缓存失败:', error);
    return NextResponse.json({ error: '清理缓存失败' }, { status: 500 });
  }
}
