import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 尝试从缓存获取数据（视频源列表缓存时间可以更长，1小时）
    const cacheKey = 'tvbox:video-sources:global';
    const cachedData = await db.getCache(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        fromCache: true,
      });
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

    // 将结果存入缓存（缓存1小时）
    await db.setCache(cacheKey, sources, 60 * 60);

    return NextResponse.json({
      ...sources,
      fromCache: false,
    });
  } catch (error) {
    console.error('获取视频源失败:', error);
    return NextResponse.json({ error: '获取视频源失败' }, { status: 500 });
  }
}
