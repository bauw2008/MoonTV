import { NextRequest, NextResponse } from 'next/server';

import { getUserVideoSourcesSimple } from '@/lib/config';

export const runtime = 'nodejs';

// OrionTV 兼容接口
export async function GET(_request: NextRequest) {
  try {
    const apiSites = await getUserVideoSourcesSimple(''); // 使用空用户名获取公共资源

    return NextResponse.json(apiSites);
  } catch {
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
