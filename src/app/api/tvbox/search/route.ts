import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  getAvailableApiSites,
  getConfig,
  hasSpecialFeaturePermission,
} from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getTVBoxCache, setTVBoxCache } from '@/lib/tvbox-cache';
import { calculatePagination } from '@/lib/tvbox-utils';
import { getYellowWords } from '@/lib/yellow';

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

    if (!source) {
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });
    }

    if (!keyword.trim()) {
      return NextResponse.json({ error: '缺少 keyword 参数' }, { status: 400 });
    }

    const availableSites = await getAvailableApiSites(authInfo.username);
    const site = availableSites.find((s) => s.key === source);
    if (!site) {
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });
    }

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

    // 获取配置以检查是否禁用18+过滤器
    const config = await getConfig();

    // 检查用户是否有禁用18+过滤的权限
    const hasYellowFilterPermission = await hasSpecialFeaturePermission(
      authInfo.username,
      'disable-yellow-filter',
      config,
    );

    // 过滤18+内容：当全局禁用18+过滤关闭时，且用户没有禁用18+过滤权限时进行过滤
    let filteredResults = results;
    if (!config.SiteConfig.DisableYellowFilter && !hasYellowFilterPermission) {
      const yellowWords = await getYellowWords();
      filteredResults = results.filter((result) => {
        const typeName = result.type_name || '';
        const title = result.title || '';

        // 同时检查 type_name 和 title 字段
        const matchedTypeWord = yellowWords.find((word: string) =>
          typeName.includes(word),
        );
        const matchedTitleWord = yellowWords.find((word: string) =>
          title.includes(word),
        );
        const shouldFilter = !!matchedTypeWord || !!matchedTitleWord;

        return !shouldFilter;
      });
    }

    // 计算分页
    const { totalPages, start, end } = calculatePagination(
      filteredResults.length,
      page,
    );
    const paginatedResults = filteredResults.slice(start, end);

    // 将结果存入缓存
    const cacheData = {
      list: paginatedResults,
      pagecount: totalPages,
      total: filteredResults.length,
      timestamp: Date.now(),
    };

    await setTVBoxCache(source, 'search', cacheData, cacheParams);

    return NextResponse.json({
      list: paginatedResults,
      pagecount: totalPages,
      total: filteredResults.length,
      fromCache: false,
    });
  } catch (err) {
    console.error('搜索视频失败:', err);
    return NextResponse.json({ error: '搜索视频失败' }, { status: 500 });
  }
}
