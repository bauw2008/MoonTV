import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import { secureTvboxData } from '@/lib/tvbox-security';
import {
  getTVBoxCache,
  setTVBoxCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
  getTVBoxCategoryCache,
  setTVBoxCategoryCache,
} from '@/lib/tvbox-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定义分类数据的类型
interface CategoryData {
  class?: Array<{
    type_id: number;
    type_pid: number;
    type_name: string;
  }>;
}

// 获取视频源分类信息
async function fetchSourceCategories(apiUrl: string): Promise<any[]> {
  try {
    const data = await secureTvboxData<CategoryData>(apiUrl);

    if (data && data.class && Array.isArray(data.class)) {
      return data.class;
    }

    return [];
  } catch (error) {
    console.error('获取分类信息失败:', error);
    return [];
  }
}

// 构建分类层级结构
function buildCategoryStructure(categories: any[]): any {
  const structure = {
    primary_categories: [] as any[], // 一级分类
    secondary_categories: [] as any[], // 二级分类
    category_map: {} as Record<number, any>, // 分类映射
  };

  // 获取所有一级分类 (type_pid === 0)
  structure.primary_categories = categories.filter((cat) => cat.type_pid === 0);

  // 获取所有二级分类 (type_pid !== 0)
  structure.secondary_categories = categories.filter(
    (cat) => cat.type_pid !== 0
  );

  // 创建分类映射，便于查找
  categories.forEach((cat) => {
    structure.category_map[cat.type_id] = cat;
  });

  return structure;
}

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    // 统一处理category参数，可能是字符串形式的数字或空字符串
    let category: string = url.searchParams.get('category') || '0';
    if (category === '') {
      category = '0'; // 全部分类
    }
    const page = parseInt(url.searchParams.get('page') || '1');

    // 只在开发环境输出调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `TVBox API请求: source=${source}, category=${category}, page=${page}`
      );
    }

    if (!source)
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });

    let availableSites;
    try {
      availableSites = await getAvailableApiSites(authInfo.username);
    } catch (error) {
      console.error('获取可用站点失败:', error);
      return NextResponse.json({ error: '获取可用站点失败' }, { status: 500 });
    }

    const site = availableSites.find((s) => s.key === source);
    if (!site)
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });

    // 尝试从缓存分别获取视频列表和分类结构
    let videoCache, categoryCache;
    try {
      videoCache = await getTVBoxVideoCache(source, category, page);
      categoryCache = await getTVBoxCategoryCache(source);
    } catch (error) {
      // 缓存获取失败，继续从数据源获取
    }

    // 如果视频缓存存在且有效，直接返回
    if (videoCache && videoCache.list && videoCache.list.length > 0) {
      return NextResponse.json({
        list: videoCache.list,
        categories: categoryCache,
        pagecount: videoCache.pagecount,
        fromCache: true,
      });
    }

    // 移除备用缓存逻辑，确保数据隔离性
    // 每个分类应该独立处理，不使用其他分类的数据作为备用
    // 这样可以避免分类之间的数据污染问题

    // 如果只有分类缓存，可以复用，继续获取视频数据
    const categoryStructure = categoryCache || null;

    // 如果没有分类缓存，获取视频源分类信息
    let finalCategoryStructure = categoryStructure;
    if (!categoryStructure) {
      try {
        const sourceCategories = await fetchSourceCategories(site.api);
        finalCategoryStructure = buildCategoryStructure(sourceCategories);

        // 缓存分类结构
        try {
          if (finalCategoryStructure) {
            await setTVBoxCategoryCache(source, finalCategoryStructure);
          }
        } catch (cacheError) {
          console.error('缓存分类结构失败:', cacheError);
          // 缓存失败不影响主流程
        }
      } catch (error) {
        console.error('获取分类信息失败:', error);
        // 使用空分类结构
        finalCategoryStructure = {
          primary_categories: [],
          secondary_categories: [],
          category_map: {},
          timestamp: Date.now(),
        };
      }
    }

    // 使用新的分类筛选函数
    let results: any[] = [];
    let totalPages = 1;

    try {
      const categoryResult = await getVideosByCategory(
        site,
        category || undefined,
        page
      );
      results = categoryResult.results;
      totalPages = categoryResult.pageCount;
    } catch (err) {
      // 检查是否是频率限制错误
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRateLimitError =
        errorMessage.includes('请求过于频繁') ||
        errorMessage.includes('频率限制') ||
        errorMessage.includes('rate limit');

      if (isRateLimitError) {
        // 尝试从缓存获取数据，但只使用当前分类的缓存，避免数据污染
        try {
          // 首先尝试当前分类和页码的缓存
          const cachedData = await getTVBoxVideoCache(source, category, page);
          if (cachedData && cachedData.list && cachedData.list.length > 0) {
            results = cachedData.list;
            totalPages = cachedData.pagecount || 1;
          } else {
            // 如果当前页没有缓存，尝试当前分类的第1页缓存
            const firstPageCache = await getTVBoxVideoCache(
              source,
              category,
              1
            );
            if (
              firstPageCache &&
              firstPageCache.list &&
              firstPageCache.list.length > 0
            ) {
              results = firstPageCache.list;
              totalPages = firstPageCache.pagecount || 1;
            } else {
              results = [];
              totalPages = 1;
            }
          }
        } catch (cacheError) {
          results = [];
          totalPages = 1;
        }
      } else {
        // 其他错误，尝试备用方案
        try {
          const searchResults = await searchFromApi(site, '');
          // 如果有分类参数，手动过滤结果
          if (category && category !== '0') {
            results = searchResults.filter(
              (item: any) =>
                item.type_id === parseInt(category, 10) ||
                (item.class && item.class.includes(category))
            );
          } else {
            results = searchResults;
          }

          // 计算分页
          const PAGE_SIZE = 24;
          totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          results = results.slice(start, end);

          // 备用方案成功，缓存结果
          if (results.length > 0) {
            try {
              await setTVBoxVideoCache(
                source,
                { list: results, pagecount: totalPages },
                category,
                page,
                page <= 3
              );
            } catch (cacheError) {
              console.error('缓存备用方案结果失败:', cacheError);
            }
          }
        } catch (fallbackError) {
          console.error('备用方案也失败:', fallbackError);
          results = [];
          totalPages = 1;
        }
      }
    }

    // 分别缓存视频列表和分类结构
    if (results && results.length > 0) {
      // 判断是否为热点数据（前3页）
      const isHotData = page <= 3;

      // 缓存视频列表
      try {
        await setTVBoxVideoCache(
          source,
          { list: results, pagecount: totalPages },
          category,
          page,
          isHotData
        );
      } catch (cacheError) {
        console.error('缓存视频列表失败:', cacheError);
        // 缓存失败不影响主流程
      }

      // 分类结构已经在前面缓存过了，这里不需要重复缓存
    }

    return NextResponse.json({
      list: results,
      categories: finalCategoryStructure,
      pagecount: totalPages,
      fromCache: false,
    });
  } catch (err) {
    console.error('加载视频失败:', err);
    return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
  }
}
