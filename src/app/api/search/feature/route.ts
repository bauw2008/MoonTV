import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 从环境变量读取开关，默认 true
    const netdiskEnabled = process.env.NETDISK_ENABLED !== 'false';
    const youtubeEnabled = process.env.YOUTUBE_ENABLED !== 'false';

    return NextResponse.json({
      netdiskEnabled,
      youtubeEnabled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

