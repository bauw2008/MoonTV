export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // 获取完整配置
    const config = await getConfig();

    // 确保 NetDiskConfig 和 YouTubeConfig 存在
    const netdiskEnabled = config.NetDiskConfig?.enabled ?? false;
    const youtubeEnabled = config.YouTubeConfig?.enabled ?? false;
    const tmdbActorSearchEnabled =
      config.SiteConfig?.EnableTMDBActorSearch ?? false;

    return NextResponse.json({
      netdiskEnabled,
      youtubeEnabled,
      tmdbActorSearchEnabled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feature flags',
        netdiskEnabled: false,
        youtubeEnabled: false,
        tmdbActorSearchEnabled: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
