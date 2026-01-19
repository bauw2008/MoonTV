/* @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';

import {
  getCache,
  getCacheKey,
  setCache,
  SHORTDRAMA_CACHE_EXPIRE,
} from './shortdrama-cache';
import {
  ShortDramaCategory,
  ShortDramaItem,
  ShortDramaParseResult,
} from './types';
import { getRandomUserAgent } from './user-agent';

// 获取短剧分类列表
export async function getShortDramaCategories(): Promise<ShortDramaCategory[]> {
  const cacheKey = getCacheKey('categories', {});

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached as ShortDramaCategory[];
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/categories`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API直接返回数组
    const result = data as ShortDramaCategory[];

    // 缓存结果
    await setCache(cacheKey, result, SHORTDRAMA_CACHE_EXPIRE.categories);
    return result;
  } catch (error) {
    logger.error('获取短剧分类失败:', error);
    return [];
  }
}

// 获取推荐短剧列表
export async function getRecommendedShortDramas(
  category?: number,
  size = 10,
): Promise<ShortDramaItem[]> {
  const cacheKey = getCacheKey('recommends', { category, size });

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached as ShortDramaItem[];
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/recommend?${category ? `category=${category}&` : ''}size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as ShortDramaItem[];

    // 缓存结果
    await setCache(cacheKey, result, SHORTDRAMA_CACHE_EXPIRE.recommends);
    return result;
  } catch (error) {
    logger.error('获取推荐短剧失败:', error);
    return [];
  }
}

// 获取分类短剧列表（分页）
export async function getShortDramaList(
  category: number,
  page = 1,
  size = 20,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
  const cacheKey = getCacheKey('lists', { category, page, size });

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached as { list: ShortDramaItem[]; hasMore: boolean };
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/list?categoryId=${category}&page=${page}&size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as { list: ShortDramaItem[]; hasMore: boolean };

    // 缓存结果 - 第一页缓存时间更长
    const cacheTime =
      page === 1
        ? SHORTDRAMA_CACHE_EXPIRE.lists * 2
        : SHORTDRAMA_CACHE_EXPIRE.lists;
    await setCache(cacheKey, result, cacheTime);
    return result;
  } catch (error) {
    logger.error('获取短剧列表失败:', error);
    return { list: [], hasMore: false };
  }
}

// 搜索短剧
export async function searchShortDramas(
  query: string,
  page = 1,
  size = 20,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
  try {
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as { list: ShortDramaItem[]; hasMore: boolean };

    return result;
  } catch (error) {
    logger.error('搜索短剧失败:', error);
    return { list: [], hasMore: false };
  }
}

// 使用备用API解析单集视频
async function parseWithAlternativeApi(
  dramaName: string,
  episode: number,
  alternativeApiUrl: string,
): Promise<ShortDramaParseResult> {
  try {
    // 规范化 API 基础地址，移除末尾斜杠
    const alternativeApiBase = alternativeApiUrl.replace(/\/+$/, '');

    // 检查是否提供了备用API地址
    if (!alternativeApiBase) {
      return {
        code: -1,
        msg: '备用API未启用',
      };
    }

    // Step 1: Search for the drama by name to get drama ID
    const searchUrl = `${alternativeApiBase}/api/v1/drama/dl?dramaName=${encodeURIComponent(dramaName)}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // 加强数据验证
    if (!searchData || typeof searchData !== 'object') {
      throw new Error('备用API返回数据格式错误');
    }

    if (
      !searchData.data ||
      !Array.isArray(searchData.data) ||
      searchData.data.length === 0
    ) {
      return {
        code: 1,
        msg: `未找到短剧"${dramaName}"`,
      };
    }

    const firstDrama = searchData.data[0];
    if (!firstDrama || !firstDrama.id) {
      throw new Error('备用API返回的短剧数据不完整');
    }

    const dramaId = firstDrama.id;

    // Step 2: Get all episodes for this drama
    const episodesUrl = `${alternativeApiBase}/api/v1/drama/dramas?dramaId=${dramaId}`;
    const episodesResponse = await fetch(episodesUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15秒超时
    });

    if (!episodesResponse.ok) {
      throw new Error(`Episodes fetch failed: ${episodesResponse.status}`);
    }

    const episodesData = await episodesResponse.json();

    // 检查API是否返回错误消息（字符串格式）
    if (typeof episodesData === 'string') {
      if (episodesData.includes('未查询到该剧集')) {
        return {
          code: 1,
          msg: `该短剧暂时无法播放，请稍后再试`,
        };
      }
      return {
        code: 1,
        msg: `视频源暂时不可用`,
      };
    }

    // 验证集数数据
    if (
      !episodesData ||
      !episodesData.data ||
      !Array.isArray(episodesData.data)
    ) {
      return {
        code: 1,
        msg: '视频源暂时不可用',
      };
    }

    if (episodesData.data.length === 0) {
      return {
        code: 1,
        msg: '该短剧暂无可用集数',
      };
    }

    // 注意：episode 参数可能是 0（主API的第一集索引）或 1（从1开始计数）
    // 备用API的数组索引是从0开始的
    let episodeIndex: number;
    if (episode === 0 || episode === 1) {
      // 主API的episode=0 或 episode=1 都对应第一集
      episodeIndex = 0;
    } else {
      // episode >= 2 时，映射到数组索引 episode-1
      episodeIndex = episode - 1;
    }

    if (episodeIndex < 0 || episodeIndex >= episodesData.data.length) {
      return {
        code: 1,
        msg: `集数 ${episode} 不存在（共${episodesData.data.length}集）`,
      };
    }

    // Step 3: 尝试获取视频直链，如果当前集不存在则自动跳到下一集
    // 最多尝试3集（防止无限循环）
    let actualEpisodeIndex = episodeIndex;
    let directData: { url?: string; pic?: string; title?: string } | null =
      null;
    const maxRetries = 3;

    for (let retry = 0; retry < maxRetries; retry++) {
      const currentIndex = episodeIndex + retry;

      // 检查是否超出集数范围
      if (currentIndex >= episodesData.data.length) {
        return {
          code: 1,
          msg: `该集暂时无法播放，请尝试其他集数`,
        };
      }

      const targetEpisode = episodesData.data[currentIndex];
      if (!targetEpisode || !targetEpisode.id) {
        continue;
      }

      const episodeId = targetEpisode.id;
      const directUrl = `${alternativeApiBase}/api/v1/drama/direct?episodeId=${episodeId}`;

      try {
        const directResponse = await fetch(directUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000), // 15秒超时
        });

        if (!directResponse.ok) {
          continue;
        }

        const data = await directResponse.json();

        // 检查是否返回 "未查询到该剧集" 错误
        if (typeof data === 'string' && data.includes('未查询到该剧集')) {
          continue;
        }

        // 验证播放链接数据
        if (!data || !data.url) {
          continue;
        }

        // 成功获取到视频链接
        directData = data;
        actualEpisodeIndex = currentIndex;
        break;
      } catch {
        continue;
      }
    }

    // 如果所有尝试都失败
    if (!directData || !directData.url) {
      return {
        code: 1,
        msg: `该集暂时无法播放，请尝试其他集数`,
      };
    }

    // 将 http:// 转换为 https:// 避免 Mixed Content 错误
    const videoUrl = (directData.url || '').replace(/^http:\/\//i, 'https://');

    // 备用API的视频链接通过代理访问（避免防盗链限制）
    const proxyUrl = `/api/proxy/shortdrama?url=${encodeURIComponent(videoUrl)}`;

    // 计算实际播放的集数（从1开始）
    const actualEpisode = actualEpisodeIndex + 1;

    return {
      code: 0,
      data: {
        videoId: dramaId,
        videoName: firstDrama.name,
        currentEpisode: actualEpisode, // 使用实际播放的集数
        totalEpisodes: episodesData.data.length,
        parsedUrl: proxyUrl,
        proxyUrl: proxyUrl,
        cover: directData.pic || firstDrama.pic || '',
        description: firstDrama.overview || '',
        episode: {
          index: actualEpisode, // 使用实际播放的集数
          label: `第${actualEpisode}集`,
          parsedUrl: proxyUrl,
          proxyUrl: proxyUrl,
          title: directData.title || `第${actualEpisode}集`,
        },
      },
      // 额外的元数据供其他地方使用
      metadata: {
        author: firstDrama.author || '',
        backdrop: firstDrama.backdrop || firstDrama.pic || '',
        vote_average: firstDrama.vote_average || 0,
        tmdb_id: firstDrama.tmdb_id || undefined,
      },
    };
  } catch (error) {
    logger.error('备用API解析失败:', error);
    // 返回更详细的错误信息
    return {
      code: -1,
      msg: `视频源暂时不可用，请稍后再试`,
    };
  }
}

// 解析单集视频（支持跨域代理，自动fallback到备用API）
export async function parseShortDramaEpisode(
  id: number,
  episode: number,
  useProxy = true,
  dramaName?: string,
  alternativeApiUrl?: string,
): Promise<ShortDramaParseResult> {
  // 如果提供了剧名和备用API，优先尝试备用API（因为主API链接经常失效）
  if (dramaName && alternativeApiUrl) {
    try {
      const alternativeResult = await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
      if (alternativeResult.code === 0) {
        return alternativeResult;
      }
    } catch {
      // 备用API失败，继续尝试主API
    }
  }

  try {
    const params = new URLSearchParams({
      id: id.toString(), // API需要string类型的id
      episode: episode.toString(), // episode从1开始
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // API可能返回错误信息
    if (data.code === 1) {
      // 如果主API失败且提供了剧名和备用API地址，尝试使用备用API
      if (dramaName && alternativeApiUrl) {
        return await parseWithAlternativeApi(
          dramaName,
          episode,
          alternativeApiUrl,
        );
      }
      return {
        code: data.code,
        msg: data.msg || '该集暂时无法播放，请稍后再试',
      };
    }

    // API成功时，检查是否有有效的视频链接
    const parsedUrl = data.episode?.parsedUrl || data.parsedUrl || '';

    // 如果主API返回成功但没有有效链接，尝试备用API
    if (!parsedUrl && dramaName && alternativeApiUrl) {
      return await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
    }

    // API成功时直接返回数据对象，根据实际结构解析
    return {
      code: 0,
      data: {
        videoId: data.videoId || id,
        videoName: data.videoName || '',
        currentEpisode: data.episode?.index || episode,
        totalEpisodes: data.totalEpisodes || 1,
        parsedUrl: parsedUrl,
        proxyUrl: data.episode?.proxyUrl || '', // proxyUrl在episode对象内
        cover: data.cover || '',
        description: data.description || '',
        episode: data.episode || null, // 保留原始episode对象
      },
    };
  } catch {
    // 如果主API网络请求失败且提供了剧名和备用API地址，尝试使用备用API
    if (dramaName && alternativeApiUrl) {
      return await parseWithAlternativeApi(
        dramaName,
        episode,
        alternativeApiUrl,
      );
    }
    return {
      code: -1,
      msg: '网络连接失败，请检查网络后重试',
    };
  }
}

// 批量解析多集视频
export async function parseShortDramaBatch(
  id: number,
  episodes: number[],
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
      episodes: episodes.join(','),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('批量解析短剧失败:', error);
    return [];
  }
}

// 解析整部短剧所有集数
export async function parseShortDramaAll(
  id: number,
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('解析完整短剧失败:', error);
    return [];
  }
}

// ============ wwzy API 相关函数 ============

// wwzy API 返回的短剧详情类型
interface WwzyDetail {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_play_url: string;
  vod_total: number;
  vod_blurb: string;
}

// 从 wwzy API 获取短剧详情
async function getWwzyDetail(id: string): Promise<WwzyDetail | null> {
  const response = await fetch(
    `https://api.wwzy.tv/api.php/provide/vod?ac=detail&ids=${id}`,
    {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.list?.[0] || null;
}

// 解析 wwzy 的播放链接
export async function parseWwzyEpisode(
  id: string,
  episode: number,
): Promise<ShortDramaParseResult> {
  try {
    // 获取短剧详情
    const detail = await getWwzyDetail(id);

    if (!detail) {
      return {
        code: 1,
        msg: '未找到该短剧',
      };
    }

    // 解析播放链接
    const playUrl = detail.vod_play_url || '';
    const episodes = playUrl.split('#').filter(Boolean);

    if (episodes.length === 0) {
      return {
        code: 1,
        msg: '该短剧暂无播放链接',
      };
    }

    // 查找指定集数的播放链接
    const targetEpisode = episodes.find((ep) => {
      const [epNum] = ep.split('$');
      return parseInt(epNum) === episode;
    });

    if (!targetEpisode) {
      return {
        code: 1,
        msg: `第${episode}集不存在（共${episodes.length}集）`,
      };
    }

    const [, url] = targetEpisode.split('$');

    if (!url) {
      return {
        code: 1,
        msg: '播放链接无效',
      };
    }

    // wwzy 的播放链接可以直接访问（CORS 允许所有来源），不需要代理
    // 将 http:// 转换为 https:// 避免 Mixed Content 错误
    const videoUrl = url.replace(/^http:\/\//i, 'https://');

    return {
      code: 0,
      data: {
        videoId: id,
        videoName: detail.vod_name || '',
        currentEpisode: episode,
        totalEpisodes: detail.vod_total || episodes.length,
        parsedUrl: videoUrl,
        proxyUrl: videoUrl,
        cover: detail.vod_pic || '',
        description: detail.vod_blurb || '',
        episode: {
          index: episode,
          label: `第${episode}集`,
          parsedUrl: videoUrl,
          proxyUrl: videoUrl,
          title: `第${episode}集`,
        },
      },
    };
  } catch (error) {
    logger.error('解析 wwzy 播放链接失败:', error);
    return {
      code: -1,
      msg: '网络连接失败，请检查网络后重试',
    };
  }
}

// 获取 wwzy 短剧的集数
export async function getWwzyEpisodeCount(id: string): Promise<number> {
  try {
    const detail = await getWwzyDetail(id);
    return detail?.vod_total || 0;
  } catch (error) {
    logger.error('获取 wwzy 集数失败:', error);
    return 0;
  }
}
