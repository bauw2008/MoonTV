import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sites = await getAvailableApiSites(authInfo.username);
    return NextResponse.json(sites);
  } catch (error) {
    console.error('获取视频源失败:', error);
    return NextResponse.json({ error: '获取视频源失败' }, { status: 500 });
  }
}
