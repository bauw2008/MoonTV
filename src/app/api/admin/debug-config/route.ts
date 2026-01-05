import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();

    return NextResponse.json({
      success: true,
      config: config.SiteConfig,
      enableTMDBActorSearch: config.SiteConfig?.EnableTMDBActorSearch,
      enableTMDBPosters: config.SiteConfig?.EnableTMDBPosters,
      tmdbApiKey: config.SiteConfig?.TMDBApiKey ? '已设置' : '未设置',
    });
  } catch (error) {
    console.error('调试配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 },
    );
  }
}
