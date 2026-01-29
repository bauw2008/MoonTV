'use client';

import { logger } from '@/lib/logger';

import { getDoubanRecommends } from './douban.client';

export interface PosterItem {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  type: 'movie' | 'tv' | 'anime';
  category: string;
  rate?: string;
  year?: string;
  overview?: string;
  doubanId?: string;
  isTMDB?: boolean;
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
    const [moviesResponse, tvShowsResponse] = await Promise.allSettled([
      fetch('/api/douban/weekly-hot?type=movie&limit=6'),
      fetch('/api/douban/weekly-hot?type=tv&limit=6'),
    ]);

    const posters: PosterItem[] = [];

    // 处理电影数据
    if (moviesResponse.status === 'fulfilled') {
      try {
        const response = moviesResponse.value;
        const moviesData = await response.json();
        if (moviesData.success && moviesData.data?.subject_collection_items) {
          // 从前6部电影中随机选择2部
          const selectedMovies = getRandomItems(
            moviesData.data.subject_collection_items,
            2,
          );
          for (const movie of selectedMovies) {
            const movieObj = movie as {
              id: string;
              title: string;
              rating: { value: number };
              cover_url?: string;
              cover?: { url: string };
              year?: string;
            };

            const posterUrl = movieObj.cover_url || movieObj.cover?.url || '';

            // 通过智能名称搜索TMDB海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(movieObj.title, 'movie', movieObj.year)
              : null;

            const finalPosterUrl = tmdbPoster?.backdrop || posterUrl;

            posters.push({
              id: `movie-${movieObj.id}`,
              title: movieObj.title,
              poster: finalPosterUrl, // 优先使用TMDB横屏海报
              type: 'movie',
              category: '热门电影',
              rate: movieObj.rating?.value?.toFixed(1),
              year: movieObj.year,
              overview: tmdbPoster?.overview || '', // 优先使用TMDB简介
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
          // 从前6部剧集中随机选择2部
          const selectedShows = getRandomItems(
            tvShowsData.data.subject_collection_items,
            2,
          );
          for (const show of selectedShows) {
            const showObj = show as {
              id: string;
              title: string;
              rating: { value: number };
              cover_url?: string;
              cover?: { url: string };
              year?: string;
            };

            const posterUrl = showObj.cover_url || showObj.cover?.url || '';

            // 通过智能名称搜索TMDB海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(showObj.title, 'tv', showObj.year)
              : null;

            const finalPosterUrl = tmdbPoster?.backdrop || posterUrl;

            posters.push({
              id: `tv-${showObj.id}`,
              title: showObj.title,
              poster: finalPosterUrl, // 优先使用TMDB横屏海报
              type: 'tv',
              category: '热门剧集',
              rate: showObj.rating?.value?.toFixed(1),
              year: showObj.year,
              overview: tmdbPoster?.overview || '', // 优先使用TMDB简介
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

    // 处理华语动漫数据
    try {
      // 获取番剧（华语地区）
      const seriesAnimeData = await getDoubanRecommends({
        kind: 'tv',
        pageLimit: 10,
        pageStart: 0,
        category: '动画',
        format: '电视剧',
        region: '华语',
      });

      // 获取剧场版（华语地区）
      const movieAnimeData = await getDoubanRecommends({
        kind: 'movie',
        pageLimit: 10,
        pageStart: 0,
        category: '动画',
        region: '华语',
      });

      // 从番剧中随机选择1部
      if (seriesAnimeData.code === 200 && seriesAnimeData.list) {
        const selectedSeriesAnime = getRandomItems(seriesAnimeData.list, 1);
        for (const anime of selectedSeriesAnime) {
          const title = anime.title;
          const year = anime.year || '';

          // 通过智能名称搜索TMDB海报（番剧只搜索TV分类）
          const tmdbPoster = enableTMDBPosters
            ? await searchTMDBPoster(title, 'tv', year, true)
            : null;

          posters.push({
            id: `anime-series-${anime.id}`,
            title: title,
            poster: tmdbPoster?.backdrop || anime.poster || '', // 优先使用TMDB横屏海报
            type: 'anime',
            category: '番剧',
            rate: anime.rate || '',
            year: year,
            overview: tmdbPoster?.overview || anime.plot_summary || '', // 优先使用TMDB简介
            doubanId: anime.id,
            isTMDB: !!tmdbPoster?.backdrop,
          });
        }
      }

      // 从剧场版中随机选择1部
      if (movieAnimeData.code === 200 && movieAnimeData.list) {
        const selectedMovieAnime = getRandomItems(movieAnimeData.list, 1);
        for (const anime of selectedMovieAnime) {
          const title = anime.title;
          const year = anime.year || '';

          // 通过智能名称搜索TMDB海报（剧场版只搜索Movie分类）
          const tmdbPoster = enableTMDBPosters
            ? await searchTMDBPoster(title, 'movie', year, true)
            : null;

          posters.push({
            id: `anime-movie-${anime.id}`,
            title: title,
            poster: tmdbPoster?.backdrop || anime.poster || '', // 优先使用TMDB横屏海报
            type: 'anime',
            category: '剧场版',
            rate: anime.rate || '',
            year: year,
            overview: tmdbPoster?.overview || anime.plot_summary || '', // 优先使用TMDB简介
            doubanId: anime.id,
            isTMDB: !!tmdbPoster?.backdrop,
          });
        }
      }
    } catch (error) {
      logger.error('处理动漫数据失败:', error);
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
