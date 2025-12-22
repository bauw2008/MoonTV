import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

// OrionTV 兼容接口
export async function GET(_request: NextRequest) {
  try {
    const apiSites = await getAvailableApiSites();

    return NextResponse.json(apiSites);
  } catch {
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
