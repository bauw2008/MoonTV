import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getUserFeatures } from '@/lib/config';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const features = await getUserFeatures(authInfo.username);
    return NextResponse.json(features);
  } catch (error) {
    console.error('获取用户功能权限失败:', error);
    return NextResponse.json({ error: '获取功能权限失败' }, { status: 500 });
  }
}
