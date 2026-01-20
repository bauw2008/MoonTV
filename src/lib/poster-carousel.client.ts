'use client';

import { logger } from '@/lib/logger';

import { getDoubanDetails, getDoubanRecommends } from './douban.client';

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

// 智能名称匹配规则 - 优化版
const getSearchTitles = (title: string) => {
  if (!title) return [''];

  const searchTitles = [title];

  // 扩展数字转换映射（支持更多季数）
  const chineseToNum: { [key: string]: string } = {
    一: '1',
    二: '2',
    三: '3',
    四: '4',
    五: '5',
    六: '6',
    七: '7',
    八: '8',
    九: '9',
    十: '10',
  };

  const numToChinese: { [key: string]: string } = {
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    六: '6',
    七: '七',
    '8': '八',
    '9': '九',
    '10': '十',
  };

  // 1. 处理中文季数格式
  if (title.includes('第') && title.includes('季')) {
    const seasonMatch = title.match(/(.+)第([一二三四五六七八九十]+)季/);
    if (seasonMatch) {
      const [, baseTitle, seasonNum] = seasonMatch;
      const arabicNum = chineseToNum[seasonNum];
      if (arabicNum) {
        // 生成多种变体，优先级高的放前面
        searchTitles.push(`${baseTitle} Season ${arabicNum}`);
        searchTitles.push(`${baseTitle} S${arabicNum}`);
        searchTitles.push(`${baseTitle} ${arabicNum}`);
        searchTitles.push(`${baseTitle}第${arabicNum}季`);
      }
    }
  }

  // 2. 处理数字季数格式
  const digitalSeasonMatch = title.match(/(.+?)(\d+)$/);
  if (digitalSeasonMatch) {
    const [, baseTitle, seasonNum] = digitalSeasonMatch;
    const chineseNum = numToChinese[seasonNum];
    if (chineseNum) {
      searchTitles.push(`${baseTitle} Season ${seasonNum}`);
      searchTitles.push(`${baseTitle} S${seasonNum}`);
      searchTitles.push(`${baseTitle}第${chineseNum}季`);
      searchTitles.push(`${baseTitle} ${seasonNum}`);
    }
  }

  // 3. 处理英文Season格式："Show Title Season 2"
  const seasonMatch = title.match(/(.+) Season (\d+)/i);
  if (seasonMatch) {
    const [, baseTitle, seasonNum] = seasonMatch;
    const chineseNum = numToChinese[seasonNum];
    if (chineseNum) {
      searchTitles.push(`${baseTitle} S${seasonNum}`);
      searchTitles.push(`${baseTitle} ${seasonNum}`);
      searchTitles.push(`${baseTitle}第${chineseNum}季`);
    }
  }

  // 4. 处理简写英文格式："Show Title S2"
  const shortSeasonMatch = title.match(/(.+) S(\d+)/i);
  if (shortSeasonMatch) {
    const [, baseTitle, seasonNum] = shortSeasonMatch;
    const chineseNum = numToChinese[seasonNum];
    if (chineseNum) {
      searchTitles.push(`${baseTitle} Season ${seasonNum}`);
      searchTitles.push(`${baseTitle}第${chineseNum}季`);
      searchTitles.push(`${baseTitle} ${seasonNum}`);
    }
  }

  // 5. 处理Series格式："Show Title Series 2"
  const seriesMatch = title.match(/(.+) Series (\d+)/i);
  if (seriesMatch) {
    const [, baseTitle, seasonNum] = seriesMatch;
    searchTitles.push(`${baseTitle} Season ${seasonNum}`);
    searchTitles.push(`${baseTitle} S${seasonNum}`);
    searchTitles.push(`${baseTitle} ${seasonNum}`);
  }

  // 6. 处理Part格式："Show Title Part 2"
  const partMatch = title.match(/(.+) Part (\d+)/i);
  if (partMatch) {
    const [, baseTitle, partNum] = partMatch;
    searchTitles.push(`${baseTitle} Season ${partNum}`);
    searchTitles.push(`${baseTitle} S${partNum}`);
    searchTitles.push(`${baseTitle} ${partNum}`);
  }

  // 7. 处理全角字符："Ｓｅａｓｏｎ ２" → "Season 2"
  const fullWidthTitle = title.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });
  if (fullWidthTitle !== title) {
    searchTitles.push(fullWidthTitle);
  }

  // 8. 去掉副标题和分隔符
  const cleanTitles = [
    title.split(/[：:：]/)[0].trim(), // 中文冒号分割
    title.split(/[-—–]/)[0].trim(), // 破折号分割
    title.split(/[|｜]/)[0].trim(), // 竖线分割
    title.split(/第.季/)[0].trim(), // 季数分割
    title.split(/Season \d+/i)[0].trim(), // 英文季数分割
    title.split(/ S\d+/i)[0].trim(), // 简写季数分割
  ];

  cleanTitles.forEach((cleanTitle) => {
    if (cleanTitle && cleanTitle !== title) {
      searchTitles.push(cleanTitle);
    }
  });

  // 9. 处理常见前缀
  const prefixes = ['新', '新版', '2024', '2023', '2022', '2021'];
  prefixes.forEach((prefix) => {
    if (title.startsWith(prefix)) {
      const withoutPrefix = title.substring(prefix.length).trim();
      if (withoutPrefix) {
        searchTitles.push(withoutPrefix);
      }
    }
  });

  // 10. 处理常见后缀
  const suffixes = ['电影版', '剧场版', 'TV版', '特别篇', 'SP'];
  suffixes.forEach((suffix) => {
    if (title.endsWith(suffix)) {
      const withoutSuffix = title
        .substring(0, title.length - suffix.length)
        .trim();
      if (withoutSuffix) {
        searchTitles.push(withoutSuffix);
      }
    }
  });

  // 11. 处理空格和特殊字符
  const normalizedTitle = title
    .replace(/[：:·\-—–|｜]/g, ' ') // 替换分隔符为空格
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();
  if (normalizedTitle !== title) {
    searchTitles.push(normalizedTitle);
  }

  // 12. 去重并按优先级排序（原始标题优先，然后是常见变体）
  const uniqueTitles = [...new Set(searchTitles)];

  // 重新排序：原始标题、Season格式、S格式、数字格式、其他
  return uniqueTitles.sort((a, b) => {
    if (a === title) return -1;
    if (b === title) return 1;
    if (a.includes('Season')) return -1;
    if (b.includes('Season')) return 1;
    if (/ S\d+/.test(a)) return -1;
    if (/ S\d+/.test(b)) return 1;
    return 0;
  });
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
 * 整合豆瓣电影、剧集和Bangumi动漫数据
 */
export async function getPosterCarouselData(): Promise<{
  posters: PosterItem[];
  loading: boolean;
}> {
  try {
    // 检查TMDB海报功能是否启用
    const enableTMDBPosters = await checkTMDBStatus();

    // 并行获取所有数据
    const [moviesResponse, tvShowsResponse] = await Promise.allSettled([
      fetch(
        '/api/douban/categories?kind=movie&category=热门&type=全部&limit=6&start=0',
      ),
      fetch(
        '/api/douban/categories?kind=tv&category=tv&type=tv&limit=6&start=0',
      ),
    ]);

    const posters: PosterItem[] = [];

    // 处理电影数据
    if (moviesResponse.status === 'fulfilled') {
      try {
        const response = moviesResponse.value;
        const moviesData = await response.json();
        if (moviesData.code === 200 && moviesData.list) {
          // 从前6部电影中随机选择2部
          const selectedMovies = getRandomItems(moviesData.list, 2);
          for (const movie of selectedMovies) {
            // 获取详细信息以获得简介
            const movieObj = movie as any;
            let detailedMovie = movieObj;
            if (!movieObj.plot_summary || movieObj.plot_summary.trim() === '') {
              try {
                const detailsResult = await getDoubanDetails(movieObj.id);
                if (detailsResult.code === 200 && detailsResult.data) {
                  detailedMovie = {
                    ...movieObj,
                    plot_summary: detailsResult.data.plot_summary || '',
                  };
                }
              } catch (error) {
                logger.warn(`获取电影详情失败: ${movieObj.title}`, error);
              }
            }

            // 通过智能名称搜索TMDB海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(
                  detailedMovie.title,
                  'movie',
                  detailedMovie.year,
                )
              : null;

            const finalPosterUrl = tmdbPoster?.backdrop || detailedMovie.poster;

            posters.push({
              id: `movie-${movieObj.id}`,
              title: detailedMovie.title,
              poster: finalPosterUrl, // 优先使用TMDB横屏海报
              type: 'movie',
              category: '热门电影',
              rate: detailedMovie.rate,
              year: detailedMovie.year,
              overview:
                tmdbPoster?.overview || detailedMovie.plot_summary || '', // 优先使用TMDB简介
              doubanId: detailedMovie.id,
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
        if (tvShowsData.code === 200 && tvShowsData.list) {
          // 从前6部剧集中随机选择2部
          const selectedShows = getRandomItems(tvShowsData.list, 2);
          for (const show of selectedShows) {
            // 获取详细信息以获得简介
            const showObj = show as any;
            let detailedShow = showObj;
            if (!showObj.plot_summary || showObj.plot_summary.trim() === '') {
              try {
                const detailsResult = await getDoubanDetails(showObj.id);
                if (detailsResult.code === 200 && detailsResult.data) {
                  detailedShow = {
                    ...showObj,
                    plot_summary: detailsResult.data.plot_summary || '',
                  };
                }
              } catch (error) {
                logger.warn(`获取剧集详情失败: ${showObj.title}`, error);
              }
            }

            // 通过智能名称搜索TMDB海报
            const tmdbPoster = enableTMDBPosters
              ? await searchTMDBPoster(
                  detailedShow.title,
                  'tv',
                  detailedShow.year,
                )
              : null;

            const finalPosterUrl = tmdbPoster?.backdrop || detailedShow.poster;

            posters.push({
              id: `tv-${showObj.id}`,
              title: detailedShow.title,
              poster: finalPosterUrl, // 优先使用TMDB横屏海报
              type: 'tv',
              category: '热门剧集',
              rate: detailedShow.rate,
              year: detailedShow.year,
              overview: tmdbPoster?.overview || detailedShow.plot_summary || '', // 优先使用TMDB简介
              doubanId: detailedShow.id,
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
