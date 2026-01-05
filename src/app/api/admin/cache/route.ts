import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { DatabaseCacheManager } from '@/lib/database-cache';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 缓存统计接口
async function GETHandler(request: NextRequest, { user }: { user: any }) {
  // AuthGuard已处理权限检查，无需重复验证

  try {
    // 添加调试信息
    // eslint-disable-next-line no-console
    console.log('🔍 开始获取缓存统计...');

    // 检查存储类型
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    // eslint-disable-next-line no-console
    console.log('🔍 存储类型:', storageType);

    // 如果是 Upstash，直接测试连接
    if (storageType === 'upstash') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = (db as any).storage;
      // eslint-disable-next-line no-console
      console.log('🔍 存储实例存在:', !!storage);
      // eslint-disable-next-line no-console
      console.log('🔍 存储实例类型:', storage?.constructor?.name);
      // eslint-disable-next-line no-console
      console.log('🔍 withRetry方法:', typeof storage?.withRetry);
      // eslint-disable-next-line no-console
      console.log('🔍 client存在:', !!storage?.client);
      // eslint-disable-next-line no-console
      console.log('🔍 client.keys方法:', typeof storage?.client?.keys);
      // eslint-disable-next-line no-console
      console.log('🔍 client.mget方法:', typeof storage?.client?.mget);

      if (storage?.client) {
        try {
          // eslint-disable-next-line no-console
          console.log('🔍 测试获取所有cache:*键...');
          const allKeys = await storage.withRetry(() =>
            storage.client.keys('cache:*'),
          );
          // eslint-disable-next-line no-console
          console.log('🔍 找到的键:', allKeys.length, allKeys.slice(0, 5));

          if (allKeys.length > 0) {
            // eslint-disable-next-line no-console
            console.log('🔍 测试获取第一个键的值...');
            const firstValue = await storage.withRetry(() =>
              storage.client.get(allKeys[0]),
            );
            // eslint-disable-next-line no-console
            console.log('🔍 第一个值的类型:', typeof firstValue);
            // eslint-disable-next-line no-console
            console.log(
              '🔍 第一个值的长度:',
              typeof firstValue === 'string' ? firstValue.length : 'N/A',
            );
          }
        } catch (debugError) {
          // eslint-disable-next-line no-console
          console.error('🔍 调试测试失败:', debugError);
        }
      }
    }

    const stats = await getCacheStats();
    return NextResponse.json({
      success: true,
      data: stats,
      debug: {
        storageType,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取缓存统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取缓存统计失败',
      },
      { status: 500 },
    );
  }
}

// 缓存清理接口
async function DELETEHandler(request: NextRequest, { user }: { user: any }) {
  // AuthGuard已处理权限检查，无需重复验证

  const { searchParams } = new URL(request.url);
  const cacheType = searchParams.get('type'); // all, douban, danmu, netdisk, search

  try {
    let clearedCount = 0;
    let message = '';

    switch (cacheType) {
      case 'douban':
        clearedCount = await clearDoubanCache();
        message = `已清理 ${clearedCount} 个豆瓣缓存项`;
        break;

      case 'danmu':
        clearedCount = await clearDanmuCache();
        message = `已清理 ${clearedCount} 个弹幕缓存项`;
        break;

      case 'netdisk':
        clearedCount = await clearNetdiskCache();
        message = `已清理 ${clearedCount} 个网盘搜索缓存项`;
        break;

      case 'search':
        clearedCount = await clearSearchCache();
        message = `已清理 ${clearedCount} 个搜索缓存项`;
        break;

      case 'tvbox':
        clearedCount = await clearTVBoxCache();
        message = `已清理 ${clearedCount} 个TVBox缓存项`;
        break;

      case 'tmdb':
        clearedCount = await clearTMDBCache();
        message = `已清理 ${clearedCount} 个TMDB缓存项`;
        break;

      case 'other':
        clearedCount = await clearOtherCache();
        message = `已清理 ${clearedCount} 个其他缓存项`;
        break;

      case 'expired':
        clearedCount = await clearExpiredCache();
        message = `已清理 ${clearedCount} 个过期缓存项`;
        break;

      case 'all':
        clearedCount = await clearAllCache();
        message = `已清理 ${clearedCount} 个缓存项`;
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: '无效的缓存类型',
          },
          { status: 400 },
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        clearedCount,
        message,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理缓存失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '清理缓存失败',
      },
      { status: 500 },
    );
  }
}

// 获取缓存统计信息
async function getCacheStats() {
  // eslint-disable-next-line no-console
  console.log('📊 开始获取缓存统计信息...');

  // 直接使用数据库统计（支持KVRocks/Upstash/Redis）
  const dbStats = await DatabaseCacheManager.getSimpleCacheStats();

  if (!dbStats) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ 数据库缓存统计失败，返回空统计');
    return {
      douban: { count: 0, size: 0, types: {} },
      tmdb: { count: 0, size: 0, types: {} },
      danmu: { count: 0, size: 0 },
      netdisk: { count: 0, size: 0 },
      search: { count: 0, size: 0 },
      tvbox: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
      total: { count: 0, size: 0 },
      timestamp: new Date().toISOString(),
      source: 'failed',
      note: '数据库统计失败',
      formattedSizes: {
        douban: '0 B',
        tmdb: '0 B',
        danmu: '0 B',
        netdisk: '0 B',
        search: '0 B',
        tvbox: '0 B',
        other: '0 B',
        total: '0 B',
      },
    };
  }

  // eslint-disable-next-line no-console
  console.log(`✅ 缓存统计获取完成: 总计 ${dbStats.total.count} 项`);
  return dbStats;
}

// 清理豆瓣缓存
async function clearDoubanCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的豆瓣缓存
  const dbCleared = await DatabaseCacheManager.clearCacheByType('douban');
  clearedCount += dbCleared;

  // 清理localStorage中的豆瓣缓存（兜底）
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage).filter(
      (key) => key.startsWith('douban-') || key.startsWith('bangumi-'),
    );
    keys.forEach((key) => {
      localStorage.removeItem(key);
      clearedCount++;
    });
    // eslint-disable-next-line no-console
    console.log(`🗑️ localStorage中清理了 ${keys.length} 个豆瓣缓存项`);
  }

  return clearedCount;
}

// 清理弹幕缓存
async function clearDanmuCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的弹幕缓存
  const dbCleared = await DatabaseCacheManager.clearCacheByType('danmu');
  clearedCount += dbCleared;

  // 清理localStorage中的弹幕缓存（兜底）
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage).filter(
      (key) => key.startsWith('danmu-cache') || key === 'lunatv_danmu_cache',
    );
    keys.forEach((key) => {
      localStorage.removeItem(key);
      clearedCount++;
    });
    // eslint-disable-next-line no-console
    console.log(`🗑️ localStorage中清理了 ${keys.length} 个弹幕缓存项`);
  }

  return clearedCount;
}

// 清理网盘搜索缓存
async function clearNetdiskCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的网盘缓存
  const dbCleared = await DatabaseCacheManager.clearCacheByType('netdisk');
  clearedCount += dbCleared;

  // 清理localStorage中的网盘缓存（兜底）
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith('netdisk-search'),
    );
    keys.forEach((key) => {
      localStorage.removeItem(key);
      clearedCount++;
    });
    // eslint-disable-next-line no-console
    console.log(`🗑️ localStorage中清理了 ${keys.length} 个网盘搜索缓存项`);
  }

  return clearedCount;
}

// 清理TVBox缓存
async function clearTVBoxCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的TVBox缓存
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbCleared = await DatabaseCacheManager.clearCacheByType('tvbox' as any);
  clearedCount += dbCleared;

  // 清理所有TVBox相关的缓存键
  try {
    await db.clearExpiredCache('tvbox-');
    await db.clearExpiredCache('tvbox:');
    // eslint-disable-next-line no-console
    console.log('🗑️ TVBox缓存清理完成');
    clearedCount++;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理TVBox缓存失败:', error);
  }

  // 清理频率限制缓存
  try {
    await db.clearExpiredCache('tvbox-rate-limit');
    // eslint-disable-next-line no-console
    console.log('🗑️ TVBox频率限制缓存清理完成');
    clearedCount++;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理TVBox频率限制缓存失败:', error);
  }

  return clearedCount;
}

// 清理TMDB缓存
async function clearTMDBCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的TMDB缓存
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbCleared = await DatabaseCacheManager.clearCacheByType('tmdb' as any);
  clearedCount += dbCleared;

  // 清理所有TMDB相关的缓存键
  try {
    await db.clearExpiredCache('tmdb-');
    // eslint-disable-next-line no-console
    console.log('🗑️ TMDB缓存清理完成');
    clearedCount++;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理TMDB缓存失败:', error);
  }

  return clearedCount;
}

// 清理其他缓存
async function clearOtherCache(): Promise<number> {
  let clearedCount = 0;

  try {
    // 清理数据库中的其他类型缓存
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbCleared = await DatabaseCacheManager.clearCacheByType('other' as any);
    clearedCount += dbCleared;

    // 清理其他可能的缓存键
    await db.clearExpiredCache('other-');
    await db.clearExpiredCache('misc-');
    await db.clearExpiredCache('temp-');
    
    // eslint-disable-next-line no-console
    console.log('🗑️ 其他缓存清理完成');
    clearedCount++;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理其他缓存失败:', error);
  }

  return clearedCount;
}

// 清理搜索缓存（直接调用数据库，因为search类型已从DatabaseCacheManager中移除）
async function clearSearchCache(): Promise<number> {
  let clearedCount = 0;

  try {
    // 直接清理数据库中的search-和cache-前缀缓存
    await db.clearExpiredCache('search-');
    await db.clearExpiredCache('cache-');
    // eslint-disable-next-line no-console
    console.log('🗑️ 搜索缓存清理完成');
    clearedCount = 1; // 标记操作已执行
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('清理搜索缓存失败:', error);
  }

  // 清理localStorage中的搜索缓存（兜底）
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage).filter(
      (key) => key.startsWith('search-') || key.startsWith('cache-'),
    );
    keys.forEach((key) => {
      localStorage.removeItem(key);
      clearedCount++;
    });
    // eslint-disable-next-line no-console
    console.log(`🗑️ localStorage中清理了 ${keys.length} 个搜索缓存项`);
  }

  return clearedCount;
}

// 清理过期缓存
async function clearExpiredCache(): Promise<number> {
  let clearedCount = 0;

  // 清理数据库中的过期缓存
  const dbCleared = await DatabaseCacheManager.clearExpiredCache();
  clearedCount += dbCleared;

  // 清理localStorage中的过期缓存（兜底）
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach((key) => {
      try {
        const data = localStorage.getItem(key);
        if (!data) {
          return;
        }

        const parsed = JSON.parse(data);

        // 检查是否有过期时间字段
        if (parsed.expire && now > parsed.expire) {
          localStorage.removeItem(key);
          clearedCount++;
        } else if (parsed.timestamp && parsed.expireSeconds) {
          const expireTime = parsed.timestamp + parsed.expireSeconds * 1000;
          if (now > expireTime) {
            localStorage.removeItem(key);
            clearedCount++;
          }
        }
      } catch {
        // 数据格式错误，清理掉
        localStorage.removeItem(key);
        clearedCount++;
      }
    });

    // eslint-disable-next-line no-console
    console.log(
      `🗑️ localStorage中清理了 ${clearedCount - dbCleared} 个过期缓存项`,
    );
  }

  return clearedCount;
}

// 清理所有缓存
async function clearAllCache(): Promise<number> {
  const doubanCount = await clearDoubanCache();
  const danmuCount = await clearDanmuCache();
  const netdiskCount = await clearNetdiskCache();
  const searchCount = await clearSearchCache();
  const tvboxCount = await clearTVBoxCache();
  const tmdbCount = await clearTMDBCache();
  const otherCount = await clearOtherCache();

  return doubanCount + danmuCount + netdiskCount + searchCount + tvboxCount + tmdbCount + otherCount;
}

// 格式化字节大小
function _formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const GET = AuthGuard.owner(GETHandler);
export const POST = AuthGuard.owner(
  async (req: NextRequest, { user }: { user: any }) => {
    return NextResponse.json(
      { error: 'POST method not supported' },
      { status: 405 },
    );
  },
);
export const DELETE = AuthGuard.owner(DELETEHandler);
