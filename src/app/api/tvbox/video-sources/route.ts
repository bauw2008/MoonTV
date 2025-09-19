import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const availableSites = await getAvailableApiSites(authInfo.username);

    const sources = availableSites.reduce((acc, site) => {
      acc[site.key] = {
        api: site.api,
        name: site.name,
        detail: site.detail,
      };
      return acc;
    }, {} as Record<string, { api: string; name: string; detail?: string }>);

    return NextResponse.json(sources);
  } catch (error) {
    console.error('获取视频源失败:', error);
    return NextResponse.json({ error: '获取视频源失败' }, { status: 500 });
  }
}
