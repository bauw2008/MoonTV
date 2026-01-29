'use client';

import { logger } from '@/lib/logger';

export interface PosterItem {
  id: string;
  title: string;
  poster: string; // 当前显示的图片URL（根据设备动态选择）
  portraitPoster?: string; // 竖屏海报（移动端使用）
  landscapePoster?: string; // 横屏海报（PC端使用）
  type: 'movie' | 'tv' | 'anime';
  category: string;
  rate?: string;
  year?: string;
  overview?: string;
  doubanId?: string;
  isTMDB?: boolean;
}

// 豆瓣周榜API返回的数据类型
interface DoubanWeeklyItem {
  id: string;
  title: string;
  rating: {
    value: number;
  };
  cover_url?: string;
  cover?: {
    url: string;
  };
  photos?: string[]; // 横屏图片数组
  year?: string;
  description?: string; // 简介
}

// 随机选择函数：从数组中随机选择指定数量的元素
const getRandomItems = <T>(items: T[], count: number): T[] => {
  if (items.length <= count) return items;

  // Fisher-Yates 洗牌算法的优化版本
  const shuffled = [...items];
  const result: T[] = [];

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * (shuffled.length - i)) + i;
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    result.push(shuffled[i]);
  }

  return result;
};

// 智能名称匹配规则 - 简化版
const getSearchTitles = (title: string) => {
  if (!title) return [''];

  const searchTitles = [title];

  // 如果原标题带有非主标题部分，生成简化版本
  // 去除：分隔符、数字结尾、第X季、特别篇、剧场版、TV版、SP等
  let simplifiedTitle = title;

  // 1. 去除分隔符后的内容
  const separators = [':', '：', '-', '—', '–', '|', '｜'];
  for (const sep of separators) {
    const parts = simplifiedTitle.split(sep);
    if (parts.length > 1) {
      simplifiedTitle = parts[0].trim();
      break; // 只去除第一个分隔符后的内容
    }
  }

  // 2. 去除后缀
  const suffixesToRemove = [
    /第[一二三四五六七八九十]+季$/,
    /特别篇$/,
    /剧场版$/,
    /电影版$/,
    /TV版$/,
    /SP$/,
    /\d+$/, // 数字结尾
  ];

  suffixesToRemove.forEach((suffix) => {
    simplifiedTitle = simplifiedTitle.replace(suffix, '').trim();
  });

  if (simplifiedTitle && simplifiedTitle !== title) {
    searchTitles.push(simplifiedTitle);
  }

  return [...new Set(searchTitles)];
};

// 通用TMDB搜索函数（支持TV和Movie双重搜索）
const searchTMDBPoster = async (
  title: string,
  category: 'movie' | 'tv',
  year?: string,
  isAnime: boolean = false,
) => {
  if (!title) return null;

  const searchTitles = getSearchTitles(title);
  // isAnime ? [category] : [category] - 动漫只搜索对应的分类，避免资源浪费
  const searchCategories = isAnime ? [category] : [category];

  for (const searchCategory of searchCategories) {
    for (const searchTitle of searchTitles) {
      try {
        const url = `/api/tmdb/posters?category=${searchCategory}&title=${encodeURIComponent(searchTitle)}&year=${year || ''}`;

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.data) {
            return data.data;
          }
        }
      } catch (error) {
        logger.warn('[PosterCarousel] 搜索TMDB海报失败:', searchTitle, error);
      }
    }
  }

  return null;
};

// 获取TMDB竖屏海报（用于移动端）
const getTMDBPortraitPoster = async (
  title: string,
  category: 'movie' | 'tv',
  year?: string,
  isAnime: boolean = false,
) => {
  if (!title) return null;

  const searchTitles = getSearchTitles(title);
  const searchCategories = isAnime ? [category] : [category];

  for (const searchCategory of searchCategories) {
    for (const searchTitle of searchTitles) {
      try {
        const url = `/api/tmdb/posters?category=${searchCategory}&title=${encodeURIComponent(searchTitle)}&year=${year || ''}`;

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.data) {
            // 返回竖屏海报
            return data.data.poster;
          }
        }
      } catch (error) {
        logger.warn(
          '[PosterCarousel] 搜索TMDB竖屏海报失败:',
          searchTitle,
          error,
        );
      }
    }
  }

  return null;
};

// 检查TMDB海报功能是否启用
const checkTMDBStatus = async () => {
  try {
    const response = await fetch('/api/tmdb/posters?category=movie');
    const data = await response.json();

    return response.ok && data.success;
  } catch (error) {
    logger.error('[PosterCarousel] TMDB海报功能检查失败:', error);
    return false;
  }
};

/**
 * 获取海报轮播数据
 * 整合豆瓣电影周榜、剧集周榜和Bangumi动漫数据
 */
export async function getPosterCarouselData(): Promise<{
  posters: PosterItem[];
  loading: boolean;
}> {
  try {
    // 检查TMDB海报功能是否启用
    const enableTMDBPosters = await checkTMDBStatus();

    // 并行获取所有数据（改为从周榜获取）
    const [moviesResponse, tvShowsResponse, globalTvShowsResponse] =
      await Promise.allSettled([
        fetch('/api/douban/weekly-hot?type=movie&limit=10'),
        fetch('/api/douban/weekly-hot?type=tv&limit=10'),
        fetch('/api/douban/weekly-hot?type=tv-global&limit=10'),
      ]);

    const posters: PosterItem[] = [];

    // 处理电影数据
    if (moviesResponse.status === 'fulfilled') {
      try {
        const response = moviesResponse.value;
        const moviesData = await response.json();
        if (moviesData.success && moviesData.data?.subject_collection_items) {
          // 从前10部电影中随机选择2部
          const selectedMovies = getRandomItems(
            moviesData.data.subject_collection_items,
            2,
          );
          for (const movie of selectedMovies) {
            const movieObj = movie as DoubanWeeklyItem;

            // 豆瓣横屏和竖屏图片
            const doubanLandscapeUrl = movieObj.photos?.[0] || '';
            const doubanPortraitUrl =
              movieObj.cover_url || movieObj.cover?.url || '';

            // 通过智能名称搜索TMDB横屏海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(movieObj.title, 'movie', movieObj.year)
              : null;

            // 获取TMDB竖屏海报（用于移动端）
            const tmdbPortraitPoster = enableTMDBPosters
              ? await getTMDBPortraitPoster(
                  movieObj.title,
                  'movie',
                  movieObj.year,
                )
              : null;

            // 优先级：TMDB横屏 > 豆瓣横屏 > TMDB竖屏 > 豆瓣竖屏
            const landscapePosterUrl =
              tmdbPoster?.backdrop ||
              doubanLandscapeUrl ||
              tmdbPoster?.poster ||
              '';
            const portraitPosterUrl = tmdbPortraitPoster || doubanPortraitUrl;

            // 优先使用TMDB简介，豆瓣简介为辅
            const finalOverview =
              tmdbPoster?.overview || movieObj.description || '';

            posters.push({
              id: `movie-${movieObj.id}`,
              title: movieObj.title,
              poster: landscapePosterUrl, // 默认使用横屏
              portraitPoster: portraitPosterUrl,
              landscapePoster: landscapePosterUrl,
              type: 'movie',
              category: '热门电影',
              rate: movieObj.rating?.value?.toFixed(1),
              year: movieObj.year,
              overview: finalOverview,
              doubanId: movieObj.id,
              isTMDB: !!tmdbPoster?.backdrop,
            });
          }
        }
      } catch (error) {
        logger.error('处理电影数据失败:', error);
      }
    } else {
      logger.warn(
        '[PosterCarousel] 电影数据请求失败:',
        moviesResponse.status,
        moviesResponse.reason,
      );
    }

    // 处理剧集数据
    if (tvShowsResponse.status === 'fulfilled') {
      try {
        const response = tvShowsResponse.value;
        const tvShowsData = await response.json();
        if (tvShowsData.success && tvShowsData.data?.subject_collection_items) {
          // 从前10部剧集中随机选择2部
          const selectedShows = getRandomItems(
            tvShowsData.data.subject_collection_items,
            2,
          );
          for (const show of selectedShows) {
            const showObj = show as DoubanWeeklyItem;

            // 豆瓣横屏和竖屏图片
            const doubanLandscapeUrl = showObj.photos?.[0] || '';
            const doubanPortraitUrl =
              showObj.cover_url || showObj.cover?.url || '';

            // 通过智能名称搜索TMDB横屏海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(showObj.title, 'tv', showObj.year)
              : null;

            // 获取TMDB竖屏海报（用于移动端）
            const tmdbPortraitPoster = enableTMDBPosters
              ? await getTMDBPortraitPoster(showObj.title, 'tv', showObj.year)
              : null;

            // 优先级：TMDB横屏 > 豆瓣横屏 > TMDB竖屏 > 豆瓣竖屏
            const landscapePosterUrl =
              tmdbPoster?.backdrop ||
              doubanLandscapeUrl ||
              tmdbPoster?.poster ||
              '';
            const portraitPosterUrl = tmdbPortraitPoster || doubanPortraitUrl;

            // 优先使用TMDB简介，豆瓣简介为辅
            const finalOverview =
              tmdbPoster?.overview || showObj.description || '';

            posters.push({
              id: `tv-${showObj.id}`,
              title: showObj.title,
              poster: landscapePosterUrl, // 默认使用横屏
              portraitPoster: portraitPosterUrl,
              landscapePoster: landscapePosterUrl,
              type: 'tv',
              category: '热门剧集',
              rate: showObj.rating?.value?.toFixed(1),
              year: showObj.year,
              overview: finalOverview,
              doubanId: showObj.id,
              isTMDB: !!tmdbPoster?.backdrop,
            });
          }
        }
      } catch (error) {
        logger.error('处理剧集数据失败:', error);
      }
    } else {
      logger.warn(
        '[PosterCarousel] 剧集数据请求失败:',
        tvShowsResponse.status,
        tvShowsResponse.reason,
      );
    }

    // 处理全球口碑剧集数据
    if (globalTvShowsResponse.status === 'fulfilled') {
      try {
        const response = globalTvShowsResponse.value;
        const globalTvShowsData = await response.json();
        if (
          globalTvShowsData.success &&
          globalTvShowsData.data?.subject_collection_items
        ) {
          // 从前10部全球口碑剧集中随机选择2部
          const selectedGlobalShows = getRandomItems(
            globalTvShowsData.data.subject_collection_items,
            2,
          );
          for (const show of selectedGlobalShows) {
            const showObj = show as DoubanWeeklyItem;

            // 豆瓣横屏和竖屏图片
            const doubanLandscapeUrl = showObj.photos?.[0] || '';
            const doubanPortraitUrl =
              showObj.cover_url || showObj.cover?.url || '';

            // 通过智能名称搜索TMDB横屏海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(showObj.title, 'tv', showObj.year)
              : null;

            // 获取TMDB竖屏海报（用于移动端）
            const tmdbPortraitPoster = enableTMDBPosters
              ? await getTMDBPortraitPoster(showObj.title, 'tv', showObj.year)
              : null;

            // 优先级：TMDB横屏 > 豆瓣横屏 > TMDB竖屏 > 豆瓣竖屏
            const landscapePosterUrl =
              tmdbPoster?.backdrop ||
              doubanLandscapeUrl ||
              tmdbPoster?.poster ||
              '';
            const portraitPosterUrl = tmdbPortraitPoster || doubanPortraitUrl;

            // 优先使用TMDB简介，豆瓣简介为辅
            const finalOverview =
              tmdbPoster?.overview || showObj.description || '';

            posters.push({
              id: `global-tv-${showObj.id}`,
              title: showObj.title,
              poster: landscapePosterUrl, // 默认使用横屏
              portraitPoster: portraitPosterUrl,
              landscapePoster: landscapePosterUrl,
              type: 'tv',
              category: '海外剧集',
              rate: showObj.rating?.value?.toFixed(1),
              year: showObj.year,
              overview: finalOverview,
              doubanId: showObj.id,
              isTMDB: !!tmdbPoster?.backdrop,
            });
          }
        }
      } catch (error) {
        logger.error('处理海外剧集数据失败:', error);
      }
    } else {
      logger.warn(
        '[PosterCarousel] 海外剧集数据请求失败:',
        globalTvShowsResponse.status,
        globalTvShowsResponse.reason,
      );
    }

    // 随机打乱海报顺序
    const shuffledPosters = [...posters].sort(() => Math.random() - 0.5);

    return {
      posters: shuffledPosters,
      loading: false,
    };
  } catch (error) {
    logger.error('获取海报轮播数据失败:', error);
    return {
      posters: [],
      loading: false,
    };
  }
}

/**
 * 处理图片URL，使用代理绕过防盗链
 */
export function getProxiedImageUrl(url: string): string {
  // 如果是豆瓣图片，使用代理
  if (url?.includes('douban') || url?.includes('doubanio')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  // TMDB图片直接返回原始URL，不需要代理
  return url;
}
