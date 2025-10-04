import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  getAvailableApiSites,
  getConfig,
  hasSpecialFeaturePermission,
} from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import {
  getTVBoxCache,
  setTVBoxCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
  getTVBoxCategoryCache,
  setTVBoxCategoryCache,
} from '@/lib/tvbox-cache';
import { calculatePagination } from '@/lib/tvbox-utils';
import { getYellowWords } from '@/lib/yellow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定义分类数据的类型
interface Category {
  type_id: number;
  type_pid: number;
  type_name: string;
}

interface CategoryData {
  class?: Category[];
}

// 获取视频源分类信息
async function fetchSourceCategories(apiUrl: string): Promise<Category[]> {
  try {
    // 构造分类信息请求URL
    let categoryUrl = apiUrl;
    if (categoryUrl.includes('/provide/vod')) {
      // 将视频列表端点转换为分类信息端点
      categoryUrl = categoryUrl.replace('/provide/vod/list', '/provide/vod');
      categoryUrl = categoryUrl.replace('/provide/vod', '/provide/vod');
    }

    // 添加分类信息参数
    const params = new URLSearchParams();
    params.append('ac', 'class');
    categoryUrl += (categoryUrl.includes('?') ? '&' : '?') + params.toString();

    const response = await fetch(categoryUrl);

    if (!response.ok) {
      throw new Error(
        `分类信息请求失败: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

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
function buildCategoryStructure(categories: Category[]): {
  primary_categories: Category[];
  secondary_categories: Category[];
  category_map: Record<number, Category>;
} {
  const structure = {
    primary_categories: [] as Category[], // 一级分类
    secondary_categories: [] as Category[], // 二级分类
    category_map: {} as Record<number, Category>, // 分类映射
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
      // 只有在视频缓存存在时，才尝试获取分类缓存，减少不必要的IO
      if (videoCache && videoCache.list && videoCache.list.length > 0) {
        categoryCache = await getTVBoxCategoryCache(source);
        return NextResponse.json({
          list: videoCache.list,
          categories: categoryCache,
          pagecount: videoCache.pagecount,
          fromCache: true,
        });
      }
    } catch (error) {
      // 缓存获取失败，继续从数据源获取
    }

    // 移除备用缓存逻辑，确保数据隔离性
    // 每个分类应该独立处理，不使用其他分类的数据作为备用
    // 这样可以避免分类之间的数据污染问题

    // 获取视频源分类信息（每次请求都获取最新的分类信息，确保准确性）
    let finalCategoryStructure: {
      primary_categories: Category[];
      secondary_categories: Category[];
      category_map: Record<number, Category>;
    };
    try {
      const sourceCategories = await fetchSourceCategories(site.api);
      finalCategoryStructure = buildCategoryStructure(sourceCategories);

      // 获取配置以检查是否禁用18+过滤器
      const config = await getConfig();

      // 检查用户是否有禁用18+过滤的权限
      const hasYellowFilterPermission = await hasSpecialFeaturePermission(
        authInfo.username,
        'disable-yellow-filter',
        config
      );

      // 过滤18+分类：当全局禁用18+过滤关闭时，且用户没有禁用18+过滤权限时进行过滤
      if (
        !config.SiteConfig.DisableYellowFilter &&
        !hasYellowFilterPermission
      ) {
        const yellowWords = await getYellowWords();
        finalCategoryStructure.primary_categories =
          finalCategoryStructure.primary_categories.filter((category) => {
            const categoryName = category.type_name || '';
            const shouldFilter = yellowWords.some((word) =>
              categoryName.includes(word)
            );
            return !shouldFilter;
          });

        finalCategoryStructure.secondary_categories =
          finalCategoryStructure.secondary_categories.filter((category) => {
            const categoryName = category.type_name || '';
            const shouldFilter = yellowWords.some((word) =>
              categoryName.includes(word)
            );
            return !shouldFilter;
          });

        // 从category_map中移除被过滤的分类
        Object.keys(finalCategoryStructure.category_map).forEach((typeId) => {
          const category =
            finalCategoryStructure.category_map[parseInt(typeId)];
          const shouldFilter = yellowWords.some((word) =>
            category.type_name.includes(word)
          );
          if (shouldFilter) {
            delete finalCategoryStructure.category_map[parseInt(typeId)];
          }
        });
      }

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
      };
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
          const {
            totalPages: calcTotalPages,
            start,
            end,
          } = calculatePagination(results.length, page);
          totalPages = calcTotalPages;
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
