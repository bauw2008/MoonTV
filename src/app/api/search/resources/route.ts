/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableApiSites } from '@/lib/config';

export const runtime = 'nodejs';

// OrionTV 兼容接口
export async function GET(request: NextRequest) {
  console.log('request', request.url);
  try {
    const apiSites = await getAvailableApiSites();

    return NextResponse.json(apiSites);
  } catch (error) {
    return NextResponse.json({ error: '获取资源失败' }, { status: 500 });
  }
}
