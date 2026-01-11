import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, hasSpecialFeaturePermission } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ hasPermission: false }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature');

    if (
      !feature ||
      ![
        'ai-recommend',
        'disable-yellow-filter',
        'netdisk-search',
        'tmdb-actor-search',
      ].includes(feature)
    ) {
      return NextResponse.json(
        { error: 'Invalid feature parameter' },
        { status: 400 },
      );
    }

    const hasPermission = await hasSpecialFeaturePermission(
      authInfo.username,
      feature as any,
    );

    return NextResponse.json({ hasPermission }, { status: 200 });
  } catch (error) {
    console.error('Failed to check permission:', error);
    return NextResponse.json({ hasPermission: false }, { status: 200 });
  }
}
