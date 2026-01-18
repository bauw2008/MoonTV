import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import {
  getTVBoxCategoryCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
} from '@/lib/tvbox-cache';
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

export async function GET(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查用户权限
    const config = await getConfig();
    const ownerUsername = process.env.USERNAME;
    const currentUsername = authInfo.username;

    if (currentUsername !== ownerUsername) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === currentUsername,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    let category: string = url.searchParams.get('category') || '0';
    if (category === '') {
      category = '0';
    }
    const page = parseInt(url.searchParams.get('page') || '1');
    const pagesize = url.searchParams.get('pagesize')
      ? parseInt(url.searchParams.get('pagesize') || '0')
      : undefined;
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    if (!source) {
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });
    }

    let availableSites;
    try {
      availableSites = await getAvailableApiSites(currentUsername);
    } catch (error) {
      logger.error('获取可用站点失败:', error);
      return NextResponse.json({ error: '获取可用站点失败' }, { status: 500 });
    }

    const site = availableSites.find((s) => s.key === source);
    if (!site) {
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });
    }

    // 尝试从缓存获取数据（除非强制刷新）
    if (!forceRefresh) {
      try {
        const videoCache = await getTVBoxVideoCache(source, category, page);
        const categoryCache = await getTVBoxCategoryCache(source);

        if (
          videoCache &&
          videoCache.list &&
          videoCache.list.length > 0 &&
          categoryCache &&
          categoryCache.primary_categories &&
          categoryCache.primary_categories.length > 0
        ) {
          // 为缓存的视频添加源名称
          let videosWithSourceName = videoCache.list.map((video: any) => ({
            ...video,
            source_name: site.name,
          }));

          // 应用18+过滤（即使是缓存数据也要过滤）
          const yellowWords = await getYellowWords();
          if (yellowWords && yellowWords.length > 0) {
            // 获取配置以检查是否禁用18+过滤器
            const tvboxConfig = await getConfig();

            // 检查用户是否需要应用18+过滤
            const userConfig = tvboxConfig.UserConfig.Users?.find(
              (u) => u.username === currentUsername,
            );
            let shouldFilter = false;

            // 使用搜索页面的过滤逻辑
            if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
              if (userConfig?.role === 'owner') {
                shouldFilter = false; // 站长豁免
              } else if (
                userConfig?.tags &&
                userConfig.tags.length > 0 &&
                tvboxConfig.UserConfig.Tags
              ) {
                for (const tagName of userConfig.tags) {
                  const tagConfig = (tvboxConfig.UserConfig.Tags as any)?.find(
                    (t: any) => t.name === tagName,
                  );
                  if (tagConfig?.disableYellowFilter === true) {
                    shouldFilter = true; // 用户组开启过滤
                    break;
                  }
                }
              }
            }

            // 当应该应用过滤时，进行过滤
            if (shouldFilter) {
              videosWithSourceName = videosWithSourceName.filter(
                (item: any) =>
                  !yellowWords.some((word: string) => {
                    const title = (item.title || '').toLowerCase();
                    const typeName = (item.type_name || '').toLowerCase();
                    return (
                      title.includes(word.toLowerCase()) ||
                      typeName.includes(word.toLowerCase())
                    );
                  }),
              );
            }
          }

          return NextResponse.json({
            list: videosWithSourceName,
            categories: categoryCache,
            pagecount: videoCache.pagecount || 1,
            fromCache: true,
          });
        }
      } catch (cacheError) {
        // 缓存读取失败，继续从API获取
        logger.error('从缓存读取视频失败:', cacheError);
      }
    }

    // 从API获取数据
    try {
      const { results, pageCount } = await getVideosByCategory(
        site,
        category,
        page,
        pagesize,
      );

      // 获取分类信息
      let finalCategoryStructure;
      try {
        const categoryResponse = await fetch(`${site.api}?ac=list`);
        if (categoryResponse.ok) {
          const categoryData: CategoryData = await categoryResponse.json();
          if (categoryData.class && Array.isArray(categoryData.class)) {
            const primaryCategories = categoryData.class
              .filter((cat) => cat.type_pid === 0)
              .map((cat) => ({
                type_id: cat.type_id,
                type_pid: cat.type_pid,
                type_name: cat.type_name,
              }));

            const secondaryCategories = categoryData.class
              .filter((cat) => cat.type_pid !== 0)
              .map((cat) => ({
                type_id: cat.type_id,
                type_pid: cat.type_pid,
                type_name: cat.type_name,
              }));

            const categoryMap = categoryData.class.reduce(
              (map, cat) => {
                map[cat.type_id] = cat;
                return map;
              },
              {} as Record<number, Category>,
            );

            finalCategoryStructure = {
              primary_categories: primaryCategories,
              secondary_categories: secondaryCategories,
              category_map: categoryMap,
            };

            // 应用18+分类过滤（使用搜索页面的逻辑）
            const yellowWords = await getYellowWords();
            if (yellowWords && yellowWords.length > 0) {
              const tvboxConfig = await getConfig();
              const userConfig = tvboxConfig.UserConfig.Users?.find(
                (u) => u.username === currentUsername,
              );
              let shouldFilter = false;

              if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
                if (userConfig?.role === 'owner') {
                  shouldFilter = false;
                } else if (
                  userConfig?.tags &&
                  userConfig.tags.length > 0 &&
                  tvboxConfig.UserConfig.Tags
                ) {
                  for (const tagName of userConfig.tags) {
                    const tagConfig = (
                      tvboxConfig.UserConfig.Tags as any
                    )?.find((t: any) => t.name === tagName);
                    if (tagConfig?.disableYellowFilter === true) {
                      shouldFilter = true;
                      break;
                    }
                  }
                }
              }

              if (shouldFilter) {
                finalCategoryStructure.primary_categories =
                  finalCategoryStructure.primary_categories.filter(
                    (category) => {
                      const categoryName = (category as any).type_name || '';
                      return !yellowWords.some((word) =>
                        categoryName.includes(word),
                      );
                    },
                  );

                finalCategoryStructure.secondary_categories =
                  finalCategoryStructure.secondary_categories.filter(
                    (category) => {
                      const categoryName = category.type_name || '';
                      return !yellowWords.some((word) =>
                        categoryName.includes(word),
                      );
                    },
                  );

                // 从category_map中移除被过滤的分类
                const filteredCategoryMap: Record<number, any> = {};
                Object.entries(finalCategoryStructure.category_map).forEach(
                  ([id, category]) => {
                    const categoryName = (category as any).type_name || '';
                    const shouldFilter = yellowWords.some((word) =>
                      categoryName.includes(word),
                    );
                    if (!shouldFilter) {
                      filteredCategoryMap[parseInt(id)] = category;
                    }
                  },
                );
                finalCategoryStructure.category_map = filteredCategoryMap;
              }
            }
          }
        }
      } catch (error) {
        logger.error(`获取分类信息失败 (源站: ${source}):`, error);
        finalCategoryStructure = {
          primary_categories: [],
          secondary_categories: [],
          category_map: {},
        };
      }

      // 为结果添加源名称
      let resultsWithSourceName = results.map((video: any) => ({
        ...video,
        source_name: site.name,
      }));

      // 应用18+过滤
      const yellowWords = await getYellowWords();
      if (yellowWords && yellowWords.length > 0) {
        const tvboxConfig = await getConfig();
        const userConfig = tvboxConfig.UserConfig.Users?.find(
          (u) => u.username === currentUsername,
        );
        let shouldFilter = false;

        if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
          if (userConfig?.role === 'owner') {
            shouldFilter = false;
          } else if (
            userConfig?.tags &&
            userConfig.tags.length > 0 &&
            tvboxConfig.UserConfig.Tags
          ) {
            for (const tagName of userConfig.tags) {
              const tagConfig = (tvboxConfig.UserConfig.Tags as any)?.find(
                (t: any) => t.name === tagName,
              );
              if (tagConfig?.disableYellowFilter === true) {
                shouldFilter = true;
                break;
              }
            }
          }
        }

        if (shouldFilter) {
          resultsWithSourceName = resultsWithSourceName.filter((item: any) => {
            const title = (item.title || '').toLowerCase();
            const typeName = (item.type_name || '').toLowerCase();
            const combinedText = title + ' ' + typeName;
            return !yellowWords.some((word) =>
              combinedText.includes(word.toLowerCase()),
            );
          });
        }
      }

      // 缓存结果
      try {
        await setTVBoxVideoCache(
          source,
          {
            list: resultsWithSourceName,
            pagecount: pageCount,
          },
          category,
          page,
        );
      } catch (cacheError) {
        // 缓存写入失败，不影响响应
        logger.error('写入缓存失败:', cacheError);
      }

      return NextResponse.json({
        list: resultsWithSourceName,
        categories: finalCategoryStructure,
        pagecount: pageCount,
        fromCache: false,
      });
    } catch (err) {
      logger.error('加载视频失败:', err);
      return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
    }
  } catch (error) {
    logger.error('TVBox API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
