import { getConfig } from './config';
import { db } from './db';
import { isCacheExpired } from './tvbox-utils';

interface VideoItem {
  id: string;
  title: string;
  poster?: string;
  episodes?: string[];
  year?: string;
  rate?: string;
  type_id?: number;
  class?: string;
  desc?: string;
  type_name?: string;
}

interface CompressedVideoItem {
  id: string;
  t: string; // title
  p?: string; // poster
  e?: number; // episodes count
  y?: string; // year
  r?: string; // rate
  tid?: number; // type_id
  c?: string; // class
  d?: string; // desc
  tn?: string; // type_name
}

interface CategoryItem {
  type_id: number;
  type_pid: number;
  type_name: string;
}

interface TVBoxVideoCacheData {
  list: CompressedVideoItem[];
  pagecount?: number;
  timestamp: number;
}

interface TVBoxCategoryCacheData {
  primary_categories: CategoryItem[];
  secondary_categories: CategoryItem[];
  category_map: Record<number, CategoryItem>;
  timestamp: number;
}

interface TVBoxCacheData {
  list: VideoItem[];
  categories?: TVBoxCategoryCacheData;
  pagecount?: number;
  total?: number;
  timestamp: number;
}

// 缓存配置以减少重复调用
export let yellowFilterConfigCache: {
  disableYellowFilter: boolean;
  timestamp: number;
} | null = null;
const CONFIG_CACHE_TTL = 60 * 1000; // 1分钟

/**
 * 生成TVBox缓存键
 */
export async function generateTVBoxCacheKey(
  source: string,
  type: 'videos' | 'search' | 'categories',
  params?: Record<string, string | number | undefined>
): Promise<string> {
  // 使用缓存的配置，避免频繁调用getConfig
  let disableYellowFilter = 'filter';

  if (
    !yellowFilterConfigCache ||
    Date.now() - yellowFilterConfigCache.timestamp > CONFIG_CACHE_TTL
  ) {
    const config = await getConfig();
    yellowFilterConfigCache = {
      disableYellowFilter: config.SiteConfig.DisableYellowFilter,
      timestamp: Date.now(),
    };
  }

  disableYellowFilter = yellowFilterConfigCache.disableYellowFilter
    ? 'no-filter'
    : 'filter';

  const parts = [`tvbox-${type}-${source}-${disableYellowFilter}`];

  if (params) {
    if (type === 'videos') {
      // 简化分类值处理
      const category = params.category?.toString() || '0';
      parts.push(`cat-${category}`);
      if (params.page) {
        parts.push(`pg-${params.page}`);
      }
    } else if (type === 'search' && params.keyword) {
      parts.push(`kw-${encodeURIComponent(params.keyword)}`);
    }
    // categories类型不需要额外参数
  }

  return parts.join(':');
}

/**
 * 解压缩视频数据，恢复原始格式
 */
function decompressVideoData(
  compressedVideos: CompressedVideoItem[]
): VideoItem[] {
  if (!Array.isArray(compressedVideos)) {
    return [];
  }

  const result: VideoItem[] = [];

  for (const video of compressedVideos) {
    if (!video?.id || !video.t) continue;

    // 优化：预分配episodes数组
    const episodes: string[] = [];
    if (video.e && video.e > 0) {
      for (let i = 0; i < video.e; i++) {
        episodes.push(`第${i + 1}集`);
      }
    }

    result.push({
      id: video.id,
      title: video.t,
      poster: video.p,
      episodes,
      year: video.y,
      rate: video.r,
      type_id: video.tid,
      class: video.c,
      desc: video.d,
      type_name: video.tn,
    });
  }

  return result;
}

/**
 * 获取TVBox视频列表缓存数据
 */
export async function getTVBoxVideoCache(
  source: string,
  category?: string,
  page?: number
): Promise<TVBoxVideoCacheData | null> {
  try {
    const cacheKey = await generateTVBoxCacheKey(source, 'videos', {
      category,
      page,
    });
    const cached = await db.getCache(cacheKey);

    if (!cached) {
      return null;
    }

    // 检查缓存是否过期（视频列表缓存有效期20分钟）
    if (isCacheExpired(cached.timestamp, 20 * 60)) {
      return null;
    }

    // 解压缩数据
    if (cached.list && Array.isArray(cached.list) && cached.list.length > 0) {
      const decompressedList = decompressVideoData(cached.list);

      return {
        ...cached,
        list: decompressedList,
      };
    }

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[CACHE-GET] 获取缓存失败: ${source} - 分类: ${
        category || '全部'
      } - 页码: ${page}`,
      error
    );
    return null;
  }
}

/**
 * 获取TVBox分类结构缓存数据
 */
export async function getTVBoxCategoryCache(
  source: string
): Promise<TVBoxCategoryCacheData | null> {
  try {
    const cacheKey = await generateTVBoxCacheKey(source, 'categories');
    const cached = await db.getCache(cacheKey);

    if (!cached) {
      return null;
    }

    // 检查缓存是否过期（分类结构缓存有效期2小时）
    if (isCacheExpired(cached.timestamp, 2 * 60 * 60)) {
      return null;
    }

    // 验证缓存数据结构
    if (
      !cached.primary_categories ||
      !cached.secondary_categories ||
      !cached.category_map
    ) {
      return null;
    }
    return cached;
  } catch (error) {
    console.error(`[CACHE-GET] 获取分类缓存失败: ${source}`, error);
    return null;
  }
}

/**
 * 获取TVBox缓存数据（保持向后兼容）
 */
export async function getTVBoxCache(
  source: string,
  type: 'videos' | 'search' | 'categories',
  params?: Record<string, string | number | undefined>
): Promise<TVBoxCacheData | null> {
  try {
    if (type === 'videos') {
      const videoCache = await getTVBoxVideoCache(
        source,
        params?.category?.toString(),
        params?.page ? Number(params.page) : undefined
      );
      if (!videoCache) return null;

      // 获取分类数据
      const categoryCache = await getTVBoxCategoryCache(source);

      // 解压缩视频列表数据
      const decompressedList = decompressVideoData(videoCache.list);

      return {
        list: decompressedList,
        categories: categoryCache || undefined,
        pagecount: videoCache.pagecount,
        timestamp: videoCache.timestamp,
      };
    }

    const cacheKey = await generateTVBoxCacheKey(source, type, params);
    const cached = await db.getCache(cacheKey);

    if (!cached) {
      return null;
    }

    // 检查缓存是否过期（TVBox缓存有效期30分钟）
    if (isCacheExpired(cached.timestamp, 30 * 60)) {
      return null;
    }

    return cached;
  } catch (error) {
    console.error('[CACHE-GET] 获取TVBox缓存失败:', error);
    return null;
  }
}

/**
 * 压缩视频数据，减少缓存大小
 */
function compressVideoData(videos: VideoItem[]): CompressedVideoItem[] {
  if (!Array.isArray(videos) || videos.length === 0) {
    return [];
  }

  const compressed: CompressedVideoItem[] = [];

  for (const video of videos) {
    if (!video?.id || !video.title) continue;

    compressed.push({
      id: video.id,
      t: video.title, // title -> t
      p: video.poster, // poster -> p
      e: video.episodes?.length || 0, // episodes length -> e
      y: video.year || '', // year -> y
      r: video.rate || '', // rate -> r
      tid: video.type_id || 0, // type_id -> tid
      c: video.class || '', // class -> c
      d: video.desc || '', // desc -> d
      tn: video.type_name || '', // type_name -> tn
    });
  }

  return compressed;
}

/**
 * 设置TVBox视频列表缓存数据
 */
export async function setTVBoxVideoCache(
  source: string,
  data: { list: VideoItem[]; pagecount?: number },
  category?: string,
  page?: number,
  isHotData = false
): Promise<void> {
  try {
    // 验证输入数据
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      return;
    }

    const cacheKey = await generateTVBoxCacheKey(source, 'videos', {
      category,
      page,
    });

    // 压缩视频数据
    const compressedList = compressVideoData(data.list);

    // 验证压缩后的数据
    if (!compressedList || compressedList.length === 0) {
      return;
    }

    const cacheData: TVBoxVideoCacheData = {
      list: compressedList,
      pagecount: data.pagecount || 1,
      timestamp: Date.now(),
    };

    // 分层缓存：热点数据（前3页）缓存时间更长
    const ttl = isHotData ? 40 * 60 : 20 * 60; // 热点数据40分钟，普通数据20分钟

    await db.setCache(cacheKey, cacheData, ttl);
  } catch (error) {
    console.error('[CACHE-SET] 设置TVBox视频缓存失败:', error);
  }
}

/**
 * 设置TVBox分类结构缓存数据
 */
export async function setTVBoxCategoryCache(
  source: string,
  data: {
    primary_categories: CategoryItem[];
    secondary_categories: CategoryItem[];
    category_map: Record<number, CategoryItem>;
  }
): Promise<void> {
  try {
    // 验证输入数据
    if (
      !data ||
      !data.primary_categories ||
      !data.secondary_categories ||
      !data.category_map
    ) {
      return;
    }

    const cacheKey = await generateTVBoxCacheKey(source, 'categories');
    const cacheData: TVBoxCategoryCacheData = {
      ...data,
      timestamp: Date.now(),
    };

    // 分类结构缓存时间更长，2小时
    const ttl = 2 * 60 * 60;

    await db.setCache(cacheKey, cacheData, ttl);
  } catch (error) {
    console.error('[CACHE-SET] 设置TVBox分类缓存失败:', error);
  }
}

/**
 * 设置TVBox缓存数据（保持向后兼容）
 */
export async function setTVBoxCache(
  source: string,
  type: 'videos' | 'search' | 'categories',
  data: TVBoxCacheData,
  params?: Record<string, string | number | undefined>
): Promise<void> {
  try {
    if (type === 'videos') {
      // 判断是否为热点数据（前3页）
      const isHotData = !params?.page || Number(params.page) <= 3;

      // 分别设置视频列表和分类结构缓存
      await setTVBoxVideoCache(
        source,
        { list: data.list, pagecount: data.pagecount },
        params?.category?.toString(),
        params?.page ? Number(params.page) : undefined,
        isHotData
      );

      if (data.categories) {
        await setTVBoxCategoryCache(source, data.categories);
      }
      return;
    }

    const cacheKey = await generateTVBoxCacheKey(source, type, params);
    const cacheData: TVBoxCacheData = {
      ...data,
      timestamp: Date.now(),
    };

    // 设置缓存，有效期30分钟
    await db.setCache(cacheKey, cacheData, 30 * 60);
    console.log(`[CACHE-SET] TVBox缓存已设置: ${cacheKey}`);
  } catch (error) {
    console.error('[CACHE-SET] 设置TVBox缓存失败:', error);
  }
}

/**
 * 清理TVBox缓存
 */
export async function clearTVBoxCache(
  source?: string,
  type?: 'videos' | 'search' | 'categories'
): Promise<number> {
  let clearedCount = 0;

  try {
    if (source && type) {
      // 清理指定源和类型的缓存
      const pattern = `tvbox-${type}-${source}:*`;
      await db.clearExpiredCache(pattern);
      clearedCount++;
    } else if (source) {
      // 清理指定源的所有缓存
      const pattern = `tvbox-*-${source}:*`;
      await db.clearExpiredCache(pattern);
      clearedCount++;
    } else if (type) {
      // 清理指定类型的所有缓存
      const pattern = `tvbox-${type}:*`;
      await db.clearExpiredCache(pattern);
      clearedCount++;
    } else {
      // 清理所有TVBox缓存
      await db.clearExpiredCache('tvbox-');
      clearedCount++;
    }

    console.log(`[CACHE-CLEAR] 清理TVBox缓存完成: ${clearedCount} 项`);
  } catch (error) {
    console.error('[CACHE-CLEAR] 清理TVBox缓存失败:', error);
  }

  return clearedCount;
}

/**
 * 清理过期的TVBox缓存
 */
export async function clearExpiredTVBoxCache(): Promise<number> {
  try {
    // 由于Redis/Upstash会自动清理过期的键，这里主要是为了统计
    // 在实际实现中，可以通过scan命令查找并删除过期键
    await db.clearExpiredCache('tvbox-');
    return 1;
  } catch (error) {
    console.error('[CACHE-CLEAR] 清理过期TVBox缓存失败:', error);
    return 0;
  }
}
