import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getTVBoxCache, setTVBoxCache } from '@/lib/tvbox-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const keyword = url.searchParams.get('keyword') || '';
    const page = parseInt(url.searchParams.get('page') || '1');

    if (!source)
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });

    if (!keyword.trim())
      return NextResponse.json({ error: '缺少 keyword 参数' }, { status: 400 });

    const availableSites = await getAvailableApiSites(authInfo.username);
    const site = availableSites.find((s) => s.key === source);
    if (!site)
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });

    // 尝试从缓存获取数据
    const cacheParams = {
      keyword,
      page,
    };

    const cachedData = await getTVBoxCache(source, 'search', cacheParams);
    if (cachedData) {
      return NextResponse.json({
        list: cachedData.list,
        pagecount: cachedData.pagecount,
        total: cachedData.total,
        fromCache: true,
      });
    }

    // 使用现有的搜索函数
    const results = await searchFromApi(site, keyword);

    // 计算分页
    const PAGE_SIZE = 24;
    const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedResults = results.slice(start, end);

    // 将结果存入缓存
    const cacheData = {
      list: paginatedResults,
      pagecount: totalPages,
      total: results.length,
      timestamp: Date.now(),
    };

    await setTVBoxCache(source, 'search', cacheData, cacheParams);

    return NextResponse.json({
      list: paginatedResults,
      pagecount: totalPages,
      total: results.length,
      fromCache: false,
    });
  } catch (err) {
    console.error('搜索视频失败:', err);
    return NextResponse.json({ error: '搜索视频失败' }, { status: 500 });
  }
}
