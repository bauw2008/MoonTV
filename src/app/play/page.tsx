/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import Hls from 'hls.js';
import { Heart } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import artplayerPluginChromecast from '@/lib/artplayer-plugin-chromecast';
import artplayerPluginLiquidGlass from '@/lib/artplayer-plugin-liquid-glass';
import artplayerPluginSkipSettings from '@/lib/artplayer-plugin-skip-settings';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { ClientCache } from '@/lib/client-cache';
import { useUserSettings } from '@/hooks/useUserSettings';
import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  getAllPlayRecords,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanDetails } from '@/lib/douban.client';
import { TypeInferenceService } from '@/lib/type-inference.service';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import BackToTopButton from '@/components/BackToTopButton';
import EpisodeSelector from '@/components/EpisodeSelector';
import NetDiskSearchResults from '@/components/NetDiskSearchResults';
import PageLayout from '@/components/PageLayout';
import { ToastManager } from '@/components/Toast';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

/**
 * 收藏图标组件
 * @param filled 是否已收藏
 */
const FavoriteIcon = ({ filled }: { filled: boolean }) => {
  if (filled) {
    return (
      <svg
        className='h-7 w-7'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='#ef4444' /* Tailwind red-500 */
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return (
    <Heart className='h-7 w-7 stroke-[1] text-gray-600 dark:text-gray-300' />
  );
};
import SkipController from '@/components/SkipController';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

// Wake Lock API 类型声明
interface WakeLockSentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

/**
 * 视频播放器页面组件
 * 提供视频播放、弹幕、选集、换源等功能
 */
function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authInfo = useMemo(
    () => getAuthInfoFromBrowserCookie(),
    [
      // 当页面可见性变化时重新读取
      typeof document !== 'undefined' ? document.visibilityState : null,
    ],
  );
  const updateActivity = useCallback(() => {
    // 这里可以添加更新用户活动的逻辑
    console.log('用户活动更新');
  }, []);

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  // 基础加载和错误状态
  const [loading, setLoading] = useState(true); // 整体加载状态
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching'); // 加载阶段
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...'); // 加载提示信息
  const [error, setError] = useState<string | null>(null); // 错误信息
  const [detail, setDetail] = useState<SearchResult | null>(null); // 视频详情数据

  // 收藏和详情状态
  const [favorited, setFavorited] = useState(false); // 收藏状态
  // 豆瓣详情状态
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loadingMovieDetails, setLoadingMovieDetails] = useState(false);
  const [bangumiDetails, setBangumiDetails] = useState<any>(null); // Bangumi详情
  const [loadingBangumiDetails, setLoadingBangumiDetails] = useState(false); // Bangumi详情加载状态

  // UI交互状态

  // 网盘搜索状态
  const [netdiskResults, setNetdiskResults] = useState<{
    [key: string]: any[];
  } | null>(null);
  const [netdiskLoading, setNetdiskLoading] = useState(false);
  const [netdiskError, setNetdiskError] = useState<string | null>(null);
  const [netdiskTotal, setNetdiskTotal] = useState(0);

  // 使用NavigationConfigContext获取功能启用状态
  const { menuSettings } = useNavigationConfig();

  // SkipController 相关状态
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // 进度条拖拽状态管理
  const isDraggingProgressRef = useRef(false);
  const seekResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // resize事件防抖管理
  const resizeResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // timeupdate防抖管理
  const timeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) {
        return v === 'true';
      }
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 自定义广告过滤配置
  const [customAdFilterEnabled, setCustomAdFilterEnabled] = useState(false);
  const [customAdFilterCode, setCustomAdFilterCode] = useState('');
  const customAdFilterEnabledRef = useRef(customAdFilterEnabled);
  const customAdFilterCodeRef = useRef(customAdFilterCode);

  useEffect(() => {
    customAdFilterEnabledRef.current = customAdFilterEnabled;
  }, [customAdFilterEnabled]);

  useEffect(() => {
    customAdFilterCodeRef.current = customAdFilterCode;
  }, [customAdFilterCode]);

  // 外部弹幕开关（从 localStorage 继承，默认全部关闭）
  const [externalDanmuEnabled, setExternalDanmuEnabled] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem('enable_external_danmu');
        if (v !== null) {
          return v === 'true';
        }
      }
      return false; // 默认关闭外部弹幕
    },
  );
  const externalDanmuEnabledRef = useRef(externalDanmuEnabled);
  useEffect(() => {
    externalDanmuEnabledRef.current = externalDanmuEnabled;
  }, [externalDanmuEnabled]);

  // 更新用户活动时间，防止播放视频时被登出
  useEffect(() => {
    // 每5分钟更新一次活动时间
    const activityInterval = setInterval(
      () => {
        if (updateActivity) {
          updateActivity();
        }
      },
      5 * 60 * 1000,
    ); // 5分钟

    // 立即更新一次
    if (updateActivity) {
      updateActivity();
    }

    return () => clearInterval(activityInterval);
  }, [updateActivity]);

  // 加载自定义广告过滤配置
  const loadCustomAdFilterConfig = async () => {
    try {
      const response = await fetch('/api/ad-filter');
      if (response.ok) {
        const data = await response.json();
        setCustomAdFilterCode(data.CustomAdFilterCode || '');
        // 从配置中读取是否启用
        setCustomAdFilterEnabled(data.CustomAdFilterEnabled === true);
      }
    } catch (error) {
      console.error('加载自定义广告过滤配置失败:', error);
    }
  };

  // 组件加载时获取配置
  useEffect(() => {
    loadCustomAdFilterConfig();
  }, []);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [videoDoubanId, setVideoDoubanId] = useState(
    parseInt(searchParams.get('douban_id') || '0') || 0,
  );
  // 当前源和ID
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || '',
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true',
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const availableSourcesRef = useRef<SearchResult[]>([]);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const videoDoubanIdRef = useRef(videoDoubanId);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
    videoDoubanIdRef.current = videoDoubanId;
    availableSourcesRef.current = availableSources;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
    videoDoubanId,
    availableSources,
  ]);

  // 加载详情（豆瓣或bangumi）
  useEffect(() => {
    const loadMovieDetails = async () => {
      if (!videoDoubanId || videoDoubanId === 0) {
        return;
      }

      // 检测是否为bangumi ID
      if (isBangumiId(videoDoubanId)) {
        // 加载bangumi详情
        if (loadingBangumiDetails || bangumiDetails) {
          return;
        }

        setLoadingBangumiDetails(true);
        try {
          const bangumiData = await fetchBangumiDetails(videoDoubanId);
          if (bangumiData) {
            setBangumiDetails(bangumiData);
          }
        } catch (error) {
          console.error('Failed to load bangumi details:', error);
        } finally {
          setLoadingBangumiDetails(false);
        }
      } else {
        // 加载豆瓣详情
        if (loadingMovieDetails || movieDetails) {
          return;
        }

        setLoadingMovieDetails(true);
        try {
          const response = await getDoubanDetails(videoDoubanId.toString());
          if (response.code === 200 && response.data) {
            setMovieDetails(response.data);
          }
        } catch (error) {
          console.error('❌ Failed to load movie details:', error);
        } finally {
          setLoadingMovieDetails(false);
        }
      }
    };

    loadMovieDetails();
  }, [
    videoDoubanId,
    loadingMovieDetails,
    movieDetails,
    loadingBangumiDetails,
    bangumiDetails,
  ]);

  // 自动网盘搜索：当有视频标题时可以随时搜索
  useEffect(() => {
    // 移除自动搜索，改为用户点击按钮时触发
    // 这样可以避免不必要的API调用
  }, []);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);
  // 上次使用的播放速率，默认 1.0
  const lastPlaybackRateRef = useRef<number>(1.0);

  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null,
  );

  // 使用 useUserSettings hook 管理优化设置
  const { settings } = useUserSettings();
  const optimizationEnabled = settings.enableOptimization;

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  // 弹幕缓存：避免重复请求相同的弹幕数据，支持页面刷新持久化（统一存储）
  const DANMU_CACHE_DURATION = 30 * 60; // 30分钟缓存（秒）
  const DANMU_CACHE_KEY_PREFIX = 'danmu-cache';

  // 获取单个弹幕缓存
  const getDanmuCacheItem = async (
    key: string,
  ): Promise<{ data: any[]; timestamp: number } | null> => {
    try {
      const cacheKey = `${DANMU_CACHE_KEY_PREFIX}-${key}`;
      // 优先从统一存储获取
      const cached = await ClientCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 兜底：从localStorage获取（兼容性）
      if (typeof localStorage !== 'undefined') {
        const oldCacheKey = 'lunatv_danmu_cache';
        const localCached = localStorage.getItem(oldCacheKey);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          const cacheMap = new Map(Object.entries(parsed));
          const item = cacheMap.get(key) as
            | { data: any[]; timestamp: number }
            | undefined;
          if (
            item &&
            typeof item.timestamp === 'number' &&
            Date.now() - item.timestamp < DANMU_CACHE_DURATION * 1000
          ) {
            return item;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('读取弹幕缓存失败:', error);
      return null;
    }
  };

  // 保存单个弹幕缓存
  const setDanmuCacheItem = async (key: string, data: any[]): Promise<void> => {
    try {
      const cacheKey = `${DANMU_CACHE_KEY_PREFIX}-${key}`;
      const cacheData = { data, timestamp: Date.now() };

      // 主要存储：统一存储
      await ClientCache.set(cacheKey, cacheData, DANMU_CACHE_DURATION);

      // 兜底存储：localStorage（兼容性，但只存储最近几个）
      if (typeof localStorage !== 'undefined') {
        try {
          const oldCacheKey = 'lunatv_danmu_cache';
          let localCache: Map<string, { data: any[]; timestamp: number }> =
            new Map();

          const existing = localStorage.getItem(oldCacheKey);
          if (existing) {
            const parsed = JSON.parse(existing);
            localCache = new Map(Object.entries(parsed)) as Map<
              string,
              { data: any[]; timestamp: number }
            >;
          }

          // 清理过期项并限制数量（最多保留10个）
          const now = Date.now();
          const validEntries = Array.from(localCache.entries())
            .filter(
              ([, item]) =>
                typeof item.timestamp === 'number' &&
                now - item.timestamp < DANMU_CACHE_DURATION * 1000,
            )
            .slice(-9); // 保留9个，加上新的共10个

          validEntries.push([key, cacheData]);

          const obj = Object.fromEntries(validEntries);
          localStorage.setItem(oldCacheKey, JSON.stringify(obj));
        } catch {
          // localStorage可能满了，忽略错误
        }
      }
    } catch (error) {
      console.warn('保存弹幕缓存失败:', error);
    }
  };

  // 折叠状态（仅在 lg 及以上屏幕有效）
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // 弹幕加载状态管理，防止重复加载
  const danmuLoadingRef = useRef<boolean>(false);
  const lastDanmuLoadKeyRef = useRef<string>('');

  // 🚀 新增：弹幕操作防抖和性能优化
  const danmuOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const episodeSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const danmuPluginStateRef = useRef<any>(null); // 保存弹幕插件状态
  const isSourceChangingRef = useRef<boolean>(false); // 标记是否正在换源
  const isEpisodeChangingRef = useRef<boolean>(false); // 标记是否正在切换集数

  // 🚀 新增：连续切换源防抖和资源管理
  const sourceSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSwitchRef = useRef<any>(null); // 保存待处理的切换请求
  const switchPromiseRef = useRef<Promise<void> | null>(null); // 当前切换的Promise

  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // Wake Lock 相关
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // bangumi ID检测（3-6位数字）
  const isBangumiId = (id: number): boolean => {
    const length = id.toString().length;
    return id > 0 && length >= 3 && length <= 6;
  };

  // bangumi缓存配置
  const BANGUMI_CACHE_EXPIRE = 4 * 60 * 60 * 1000; // 4小时，和douban详情一致

  // bangumi缓存工具函数（统一存储）
  const getBangumiCache = async (id: number) => {
    try {
      const cacheKey = `bangumi-details-${id}`;
      // 优先从统一存储获取
      const cached = await ClientCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 兜底：从localStorage获取（兼容性）
      if (typeof localStorage !== 'undefined') {
        const localCached = localStorage.getItem(cacheKey);
        if (localCached) {
          const { data, expire } = JSON.parse(localCached);
          if (Date.now() <= expire) {
            return data;
          }
          localStorage.removeItem(cacheKey);
        }
      }

      return null;
    } catch (e) {
      console.warn('获取Bangumi缓存失败:', e);
      return null;
    }
  };

  const setBangumiCache = async (id: number, data: any) => {
    try {
      const cacheKey = `bangumi-details-${id}`;
      const expireSeconds = Math.floor(BANGUMI_CACHE_EXPIRE / 1000); // 转换为秒

      // 主要存储：统一存储
      await ClientCache.set(cacheKey, data, expireSeconds);

      // 兜底存储：localStorage（兼容性）
      if (typeof localStorage !== 'undefined') {
        try {
          const cacheData = {
            data,
            expire: Date.now() + BANGUMI_CACHE_EXPIRE,
            created: Date.now(),
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch {
          // localStorage可能满了，忽略错误
        }
      }
    } catch (error) {
      console.warn('设置Bangumi缓存失败:', error);
    }
  };

  // 获取bangumi详情（带缓存）
  const fetchBangumiDetails = async (bangumiId: number) => {
    // 检查缓存
    const cached = await getBangumiCache(bangumiId);
    if (cached) {
      console.log(`Bangumi详情缓存命中: ${bangumiId}`);
      return cached;
    }

    try {
      const response = await fetch(
        `https://api.bgm.tv/v0/subjects/${bangumiId}`,
      );
      if (response.ok) {
        const bangumiData = await response.json();

        // 保存到缓存
        await setBangumiCache(bangumiId, bangumiData);
        console.log(`Bangumi详情已缓存: ${bangumiId}`);

        return bangumiData;
      }
    } catch (error) {
      console.log('Failed to fetch bangumi details:', error);
    }
    return null;
  };

  /**
   * 生成搜索查询的多种变体，提高搜索命中率
   * @param originalQuery 原始查询
   * @returns 按优先级排序的搜索变体数组
   */
  const generateSearchVariants = (originalQuery: string): string[] => {
    const variants: string[] = [];
    const trimmed = originalQuery.trim();

    // 1. 原始查询（最高优先级）
    variants.push(trimmed);

    // 2. 处理中文标点符号变体
    const chinesePunctuationVariants =
      generateChinesePunctuationVariants(trimmed);
    chinesePunctuationVariants.forEach((variant) => {
      if (!variants.includes(variant)) {
        variants.push(variant);
      }
    });

    // 如果包含空格，生成额外变体
    if (trimmed.includes(' ')) {
      // 4. 去除所有空格
      const noSpaces = trimmed.replace(/\s+/g, '');
      if (noSpaces !== trimmed) {
        variants.push(noSpaces);
      }

      // 5. 标准化空格（多个空格合并为一个）
      const normalizedSpaces = trimmed.replace(/\s+/g, ' ');
      if (
        normalizedSpaces !== trimmed &&
        !variants.includes(normalizedSpaces)
      ) {
        variants.push(normalizedSpaces);
      }

      // 6. 提取关键词组合（针对"中餐厅 第九季"这种情况）
      const keywords = trimmed.split(/\s+/);
      if (keywords.length >= 2) {
        // 主要关键词 + 季/集等后缀
        const mainKeyword = keywords[0];
        const lastKeyword = keywords[keywords.length - 1];

        // 如果最后一个词包含"第"、"季"、"集"等，尝试组合
        if (/第|季|集|部|篇|章/.test(lastKeyword)) {
          const combined = mainKeyword + lastKeyword;
          if (!variants.includes(combined)) {
            variants.push(combined);
          }
        }

        // 7. 空格变冒号的变体（重要！针对"死神来了 血脉诅咒" -> "死神来了：血脉诅咒"）
        const withColon = trimmed.replace(/\s+/g, '：');
        if (!variants.includes(withColon)) {
          variants.push(withColon);
        }

        // 8. 空格变英文冒号的变体
        const withEnglishColon = trimmed.replace(/\s+/g, ':');
        if (!variants.includes(withEnglishColon)) {
          variants.push(withEnglishColon);
        }

        // 仅使用主关键词搜索（过滤无意义的词）
        const meaninglessWords = [
          'the',
          'a',
          'an',
          'and',
          'or',
          'of',
          'in',
          'on',
          'at',
          'to',
          'for',
          'with',
          'by',
        ];
        if (
          !variants.includes(mainKeyword) &&
          !meaninglessWords.includes(mainKeyword.toLowerCase()) &&
          mainKeyword.length > 2
        ) {
          variants.push(mainKeyword);
        }
      }
    }

    // 去重并返回
    return Array.from(new Set(variants));
  };

  /**
   * 生成中文标点符号的搜索变体
   * @param query 原始查询
   * @returns 标点符号变体数组
   */
  const generateChinesePunctuationVariants = (query: string): string[] => {
    const variants: string[] = [];

    // 检查是否包含中文标点符号
    const chinesePunctuation = /[：；，。！？、""''（）【】《》]/;
    if (!chinesePunctuation.test(query)) {
      return variants;
    }

    // 中文冒号变体 (针对"死神来了：血脉诅咒"这种情况)
    if (query.includes('：')) {
      // 优先级1: 替换为空格 (最可能匹配，如"死神来了 血脉诅咒" 能匹配到 "死神来了6：血脉诅咒")
      const withSpace = query.replace(/：/g, ' ');
      variants.push(withSpace);

      // 优先级2: 完全去除冒号
      const noColon = query.replace(/：/g, '');
      variants.push(noColon);

      // 优先级3: 替换为英文冒号
      const englishColon = query.replace(/：/g, ':');
      variants.push(englishColon);

      // 优先级4: 提取冒号前的主标题 (降低优先级，避免匹配到错误的系列)
      const beforeColon = query.split('：')[0].trim();
      if (beforeColon && beforeColon !== query) {
        variants.push(beforeColon);
      }

      // 优先级5: 提取冒号后的副标题
      const afterColon = query.split('：')[1]?.trim();
      if (afterColon) {
        variants.push(afterColon);
      }
    }

    // 其他中文标点符号处理
    let cleanedQuery = query;

    // 替换中文标点为对应英文标点
    cleanedQuery = cleanedQuery.replace(/；/g, ';');
    cleanedQuery = cleanedQuery.replace(/，/g, ',');
    cleanedQuery = cleanedQuery.replace(/。/g, '.');
    cleanedQuery = cleanedQuery.replace(/！/g, '!');
    cleanedQuery = cleanedQuery.replace(/？/g, '?');
    cleanedQuery = cleanedQuery.replace(/"/g, '"');
    cleanedQuery = cleanedQuery.replace(/"/g, '"');
    cleanedQuery = cleanedQuery.replace(/'/g, "'");
    cleanedQuery = cleanedQuery.replace(/'/g, "'");
    cleanedQuery = cleanedQuery.replace(/（/g, '(');
    cleanedQuery = cleanedQuery.replace(/）/g, ')');
    cleanedQuery = cleanedQuery.replace(/【/g, '[');
    cleanedQuery = cleanedQuery.replace(/】/g, ']');
    cleanedQuery = cleanedQuery.replace(/《/g, '<');
    cleanedQuery = cleanedQuery.replace(/》/g, '>');

    if (cleanedQuery !== query) {
      variants.push(cleanedQuery);
    }

    // 完全去除所有标点符号
    const noPunctuation = query.replace(
      /[：；，。！？、""''（）【】《》:;,.!?'()[\]<>]/g,
      '',
    );
    if (noPunctuation !== query && noPunctuation.trim()) {
      variants.push(noPunctuation);
    }

    return variants;
  };

  // 检查是否包含查询中的所有关键词（与downstream评分逻辑保持一致）
  const checkAllKeywordsMatch = (
    queryTitle: string,
    resultTitle: string,
  ): boolean => {
    const queryWords = queryTitle
      .replace(/[^\w\s\u4e00-\u9fff]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // 检查结果标题是否包含查询中的所有关键词
    return queryWords.every((word) => resultTitle.includes(word));
  };

  // 网盘搜索函数
  const handleNetDiskSearch = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    setNetdiskLoading(true);
    setNetdiskError(null);
    setNetdiskResults(null);
    setNetdiskTotal(0);

    try {
      const response = await fetch(
        `/api/netdisk/search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();

      if (data.success) {
        setNetdiskResults(data.data.merged_by_type || {});
        setNetdiskTotal(data.data.total || 0);
        console.log(
          `网盘搜索完成: "${query}" - ${data.data.total || 0} 个结果`,
        );
      } else {
        setNetdiskError(data.error || '网盘搜索失败');
      }
    } catch (error: any) {
      console.error('网盘搜索请求失败:', error);
      setNetdiskError('网盘搜索请求失败，请稍后重试');
    } finally {
      setNetdiskLoading(false);
    }
  };

  // 播放源优选函数（针对旧iPad做极端保守优化）
  const preferBestSource = async (
    sources: SearchResult[],
  ): Promise<SearchResult> => {
    if (sources.length === 1) {
      return sources[0];
    }

    // 使用全局统一的设备检测结果
    const _isIPad =
      /iPad/i.test(userAgent) ||
      (userAgent.includes('Macintosh') && navigator.maxTouchPoints >= 1);
    const _isIOS = isIOSGlobal;
    const isIOS13 = isIOS13Global;
    const isMobile = isMobileGlobal;

    // 如果是iPad或iOS13+（包括新iPad在桌面模式下），使用极简策略避免崩溃
    if (isIOS13) {
      console.log('检测到iPad/iOS13+设备，使用无测速优选策略避免崩溃');

      // 简单的源名称优先级排序，不进行实际测速
      const sourcePreference = [
        'ok',
        'niuhu',
        'ying',
        'wasu',
        'mgtv',
        'iqiyi',
        'youku',
        'qq',
      ];

      const sortedSources = sources.sort((a, b) => {
        const aIndex = sourcePreference.findIndex((name) =>
          a.source_name?.toLowerCase().includes(name),
        );
        const bIndex = sourcePreference.findIndex((name) =>
          b.source_name?.toLowerCase().includes(name),
        );

        // 如果都在优先级列表中，按优先级排序
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // 如果只有一个在优先级列表中，优先选择它
        if (aIndex !== -1) {
          return -1;
        }
        if (bIndex !== -1) {
          return 1;
        }

        // 都不在优先级列表中，保持原始顺序
        return 0;
      });

      console.log(
        'iPad/iOS13+优选结果:',
        sortedSources.map((s) => s.source_name),
      );
      return sortedSources[0];
    }

    // 移动设备使用轻量级测速（仅ping，不创建HLS）
    if (isMobile) {
      console.log('移动设备使用轻量级优选');
      return await lightweightPreference(sources);
    }

    // 桌面设备使用原来的测速方法（控制并发）
    return await fullSpeedTest(sources);
  };

  /**
   * 轻量级优选：仅测试连通性，不创建video和HLS
   * @param sources 播放源列表
   * @returns 优选后的最佳播放源
   */
  const lightweightPreference = async (
    sources: SearchResult[],
  ): Promise<SearchResult> => {
    console.log('开始轻量级测速，仅测试连通性');

    const results = await Promise.all(
      sources.map(async (source) => {
        try {
          if (!source.episodes || source.episodes.length === 0) {
            return { source, pingTime: 9999, available: false };
          }

          const episodeUrl =
            source.episodes.length > 1
              ? source.episodes[1]
              : source.episodes[0];

          // 仅测试连通性和响应时间
          const startTime = performance.now();
          await fetch(episodeUrl, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: AbortSignal.timeout(3000), // 3秒超时
          });
          const pingTime = performance.now() - startTime;

          return {
            source,
            pingTime: Math.round(pingTime),
            available: true,
          };
        } catch (error) {
          console.warn(`轻量级测速失败: ${source.source_name}`, error);
          return { source, pingTime: 9999, available: false };
        }
      }),
    );

    // 按可用性和响应时间排序
    const sortedResults = results
      .filter((r) => r.available)
      .sort((a, b) => a.pingTime - b.pingTime);

    if (sortedResults.length === 0) {
      console.warn('所有源都不可用，返回第一个');
      return sources[0];
    }

    console.log(
      '轻量级优选结果:',
      sortedResults.map((r) => `${r.source.source_name}: ${r.pingTime}ms`),
    );

    return sortedResults[0].source;
  };

  /**
   * 完整测速（桌面设备）
   * @param sources 播放源列表
   * @returns 优选后的最佳播放源
   */
  const fullSpeedTest = async (
    sources: SearchResult[],
  ): Promise<SearchResult> => {
    // 桌面设备使用小批量并发，避免创建过多实例
    const concurrency = 2;
    const allResults: Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    } | null> = [];

    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      console.log(
        `测速批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(
          sources.length / concurrency,
        )}: ${batch.length} 个源`,
      );

      const batchResults = await Promise.all(
        batch.map(async (source) => {
          try {
            if (!source.episodes || source.episodes.length === 0) {
              return null;
            }

            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];

            const testResult = await getVideoResolutionFromM3u8(episodeUrl);
            return { source, testResult };
          } catch (error) {
            console.warn(`测速失败: ${source.source_name}`, error);
            return null;
          }
        }),
      );

      allResults.push(...batchResults);

      // 批次间延迟，让资源有时间清理
      if (i + concurrency < sources.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 等待所有测速完成，包含成功和失败的结果
    // 保存所有测速结果到 precomputedVideoInfo，供 EpisodeSelector 使用（包含错误结果）
    const newVideoInfoMap = new Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >();
    allResults.forEach((result, index) => {
      const source = sources[index];
      const sourceKey = `${source.source}-${source.id}`;

      if (result) {
        // 成功的结果
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    // 过滤出成功的结果用于优选计算
    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      console.warn('所有播放源测速都失败，使用第一个播放源');
      return sources[0];
    }

    // 找出所有有效速度的最大值，用于线性映射
    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') {
          return 0;
        }

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) {
          return 0;
        }

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value; // 统一转换为 KB/s
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024; // 默认1MB/s作为基准

    // 找出所有有效延迟的最小值和最大值，用于线性映射
    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    // 计算每个结果的评分
    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing,
      ),
    }));

    // 按综合评分排序，选择最佳播放源
    resultsWithScore.sort((a, b) => b.score - a.score);

    console.log('播放源评分排序结果:');
    resultsWithScore.forEach((result, index) => {
      console.log(
        `${index + 1}. ${
          result.source.source_name
        } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
          result.testResult.loadSpeed
        }, ${result.testResult.pingTime}ms)`,
      );
    });

    return resultsWithScore[0].source;
  };

  /**
   * 计算播放源综合评分
   * @param testResult 测试结果
   * @param maxSpeed 最大速度
   * @param minPing 最小延迟
   * @param maxPing 最大延迟
   * @returns 综合评分
   */
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number,
  ): number => {
    let score = 0;

    // 分辨率评分 (40% 权重)
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.4;

    // 下载速度评分 (40% 权重) - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') {
        return 30;
      }

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) {
        return 30;
      }

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    // 网络延迟评分 (20% 权重) - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) {
        return 0;
      } // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) {
        return 100;
      }

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

  /**
   * 更新视频URL
   * @param detailData 视频详情数据
   * @param episodeIndex 集数索引
   */
  const updateVideoUrl = (
    detailData: SearchResult | null,
    episodeIndex: number,
  ) => {
    if (!detailData?.episodes || episodeIndex >= detailData.episodes.length) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) {
      setVideoUrl(newUrl);
    }
  };

  /**
   * 确保视频源正确设置
   * @param video 视频元素
   * @param url 视频URL
   */
  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) {
      return;
    }
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      // 移除旧的 source，保持唯一
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source') as HTMLSourceElement;
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    // 始终允许远程播放（AirPlay / Cast）
    video.disableRemotePlayback = false;
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

  // 检测移动设备（在组件层级定义）- 参考ArtPlayer compatibility.js
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOSGlobal =
    /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
  const isIOS13Global =
    isIOSGlobal ||
    (userAgent.includes('Macintosh') && navigator.maxTouchPoints >= 1);
  const isMobileGlobal =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    ) || isIOS13Global;

  /**
   * 内存压力检测和清理（针对移动设备）
   * @returns 是否触发了清理
   */
  const checkMemoryPressure = async () => {
    // 仅在支持performance.memory的浏览器中执行
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      try {
        const memInfo = (performance as any).memory;
        const usedJSHeapSize = memInfo.usedJSHeapSize;
        const heapLimit = memInfo.jsHeapSizeLimit;

        // 计算内存使用率
        const memoryUsageRatio = usedJSHeapSize / heapLimit;

        console.log(
          `内存使用情况: ${(memoryUsageRatio * 100).toFixed(2)}% (${(
            usedJSHeapSize /
            1024 /
            1024
          ).toFixed(2)}MB / ${(heapLimit / 1024 / 1024).toFixed(2)}MB)`,
        );

        // 如果内存使用超过75%，触发清理
        if (memoryUsageRatio > 0.75) {
          console.warn('内存使用过高，清理缓存...');

          // 清理弹幕缓存
          try {
            await ClientCache.clearExpired('danmu-cache');
            const oldCacheKey = 'lunatv_danmu_cache';
            localStorage.removeItem(oldCacheKey);
            console.log('弹幕缓存已清理');
          } catch (e) {
            console.warn('清理弹幕缓存失败:', e);
          }

          // 尝试强制垃圾回收（如果可用）
          if (typeof (window as any).gc === 'function') {
            (window as any).gc();
            console.log('已触发垃圾回收');
          }

          return true;
        }
      } catch (error) {
        console.warn('内存检测失败:', error);
      }
    }
    return false;
  };

  // 定期内存检查（仅在移动设备上）
  useEffect(() => {
    if (!isMobileGlobal) {
      return;
    }

    const memoryCheckInterval = setInterval(() => {
      checkMemoryPressure().catch(console.error);
    }, 30000); // 每30秒检查一次

    return () => {
      clearInterval(memoryCheckInterval);
    };
  }, [isMobileGlobal]);
  /**
   * 请求Wake Lock保持屏幕常亮
   */
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request(
          'screen',
        );
      }
    } catch (err) {
      console.warn('Wake Lock 请求失败:', err);
    }
  };

  /**
   * 释放Wake Lock
   */
  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn('Wake Lock 释放失败:', err);
    }
  };

  /**
   * 清理播放器资源
   */
  const cleanupPlayer = () => {
    // 清理弹幕优化相关的定时器
    if (danmuOperationTimeoutRef.current) {
      clearTimeout(danmuOperationTimeoutRef.current);
      danmuOperationTimeoutRef.current = null;
    }

    if (episodeSwitchTimeoutRef.current) {
      clearTimeout(episodeSwitchTimeoutRef.current);
      episodeSwitchTimeoutRef.current = null;
    }

    // 清理弹幕状态引用
    danmuPluginStateRef.current = null;

    if (artPlayerRef.current) {
      try {
        // 清理弹幕插件的WebWorker
        if (artPlayerRef.current.plugins?.artplayerPluginDanmuku) {
          const danmukuPlugin =
            artPlayerRef.current.plugins.artplayerPluginDanmuku;

          if (
            danmukuPlugin.worker &&
            typeof danmukuPlugin.worker.terminate === 'function'
          ) {
            danmukuPlugin.worker.terminate();
            console.log('弹幕WebWorker已清理');
          }

          if (typeof danmukuPlugin.reset === 'function') {
            danmukuPlugin.reset();
          }
        }

        // 销毁HLS实例
        if (artPlayerRef.current.video.hls) {
          artPlayerRef.current.video.hls.destroy();
          console.log('HLS实例已销毁');
        }

        // 销毁ArtPlayer实例
        artPlayerRef.current.destroy(false);
        artPlayerRef.current = null;

        console.log('播放器资源已清理');
      } catch (err) {
        console.warn('清理播放器资源时出错:', err);
        artPlayerRef.current = null;
      }
    }

    // 清理 timeUpdate 定时器
    if (timeUpdateTimeoutRef.current) {
      clearTimeout(timeUpdateTimeoutRef.current);
      timeUpdateTimeoutRef.current = null;
    }
  };

  /**
   * 内置去广告函数：从M3U8内容中过滤广告分段
   * @param m3u8Content M3U8内容
   * @returns 过滤后的M3U8内容
   */
  function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) {
      return '';
    }

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];
    let inAdBlock = false; // 是否在广告区块内
    let _adSegmentCount = 0; // 统计移除的广告片段数量

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 🎯 增强功能1: 检测行业标准广告标记（SCTE-35系列）
      // 使用 line.includes() 保持与原逻辑一致，兼容各种格式
      if (
        line.includes('#EXT-X-CUE-OUT') ||
        (line.includes('#EXT-X-DATERANGE') && line.includes('SCTE35')) ||
        line.includes('#EXT-X-SCTE35') ||
        line.includes('#EXT-OATCLS-SCTE35')
      ) {
        inAdBlock = true;
        _adSegmentCount++;
        continue; // 跳过广告开始标记
      }

      // 🎯 增强功能2: 检测广告结束标记
      if (line.includes('#EXT-X-CUE-IN')) {
        inAdBlock = false;
        continue; // 跳过广告结束标记
      }

      // 🎯 增强功能3: 如果在广告区块内，跳过所有内容
      if (inAdBlock) {
        continue;
      }

      // ✅ 原始逻辑保留: 过滤#EXT-X-DISCONTINUITY标识
      if (!line.includes('#EXT-X-DISCONTINUITY')) {
        filteredLines.push(line);
      }
    }

    return filteredLines.join('\n');
  }

  /**
   * 组合去广告函数：先执行内置过滤，再执行自定义过滤
   * @param m3u8Content M3U8内容
   * @returns 过滤后的M3U8内容
   */
  function filterAdsWithCustom(m3u8Content: string): string {
    // 先执行内置过滤
    let filteredContent = filterAdsFromM3U8(m3u8Content);

    // 如果启用了自定义过滤，则执行自定义代码
    if (customAdFilterEnabledRef.current && customAdFilterCodeRef.current) {
      try {
        // 创建安全的执行环境
        const customFilterFunction = new Function(
          'type',
          'm3u8Content',
          customAdFilterCodeRef.current,
        );

        // 执行自定义过滤函数
        const customResult = customFilterFunction('m3u8', filteredContent);

        // 检查返回值是否有效
        if (typeof customResult === 'string' && customResult) {
          filteredContent = customResult;
        }
      } catch (error) {
        console.error('自定义广告过滤代码执行失败:', error);
        // 出错时只使用内置过滤的结果
      }
    }

    return filteredContent;
  }

  /**
   * 工具函数：格式化时间显示
   * @param seconds 秒数
   * @returns 格式化后的时间字符串
   */
  const _formatTime = (seconds: number): string => {
    if (seconds === 0) {
      return '00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours === 0) {
      // 不到一小时，格式为 00:00
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      // 超过一小时，格式为 00:00:00
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  /**
   * 自定义HLS加载器，用于过滤广告
   */
  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (
            response: any,
            stats: any,
            context: any,
          ) {
            // 如果是m3u8文件，处理内容以移除广告分段
            if (response.data && typeof response.data === 'string') {
              // 过滤掉广告段 - 先执行内置过滤，再执行自定义过滤（如果启用）
              response.data = filterAdsWithCustom(response.data);
            }
            return onSuccess(response, stats, context, null);
          };
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  }

  /**
   * 优化的弹幕操作处理函数（防抖 + 性能优化）
   * @param nextState 弹幕开关状态
   */
  const handleDanmuOperationOptimized = (nextState: boolean) => {
    // 清除之前的防抖定时器
    if (danmuOperationTimeoutRef.current) {
      clearTimeout(danmuOperationTimeoutRef.current);
    }

    // 立即更新UI状态
    externalDanmuEnabledRef.current = nextState;
    setExternalDanmuEnabled(nextState);

    // 同步保存到localStorage
    try {
      localStorage.setItem('enable_external_danmu', String(nextState));
    } catch (e) {
      console.warn('localStorage设置失败:', e);
    }

    // 防抖处理弹幕数据操作
    danmuOperationTimeoutRef.current = setTimeout(async () => {
      try {
        if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
          const plugin = artPlayerRef.current.plugins.artplayerPluginDanmuku;

          if (nextState) {
            // 开启弹幕：使用更温和的加载方式
            console.log('开启外部弹幕...');

            // 确保弹幕可见性和发射器启用
            plugin.show();
            // 使用config方法动态更新弹幕设置
            plugin.config({
              emitter: true,
              visible: true,
            });

            // 显示弹幕控件并重新挂载发射器
            const showDanmakuControls = () => {
              const danmakuControls = document.querySelector(
                '.artplayer-plugin-danmuku',
              ) as HTMLElement;
              if (danmakuControls) {
                // 重置所有可能影响显示的样式
                danmakuControls.style.display = '';
                danmakuControls.style.visibility = 'visible';
                danmakuControls.style.opacity = '1';

                // 安全地重新挂载发射器到正确位置
                try {
                  if (plugin.mount && typeof plugin.mount === 'function') {
                    plugin.mount();
                  }
                } catch (error) {
                  console.warn('弹幕插件挂载失败，忽略此错误:', error);
                }
              }
            };

            // 立即执行一次，如果控件还没创建则稍后再试
            showDanmakuControls();
            setTimeout(showDanmakuControls, 100); // 确保在DOM更新后执行

            const loadDanmu = async () => {
              const externalDanmu = await loadExternalDanmu();
              if (
                externalDanmuEnabledRef.current &&
                artPlayerRef.current?.plugins?.artplayerPluginDanmuku
              ) {
                plugin.load(externalDanmu);
                console.log('外部弹幕已加载:', externalDanmu.length, '条');

                if (artPlayerRef.current && externalDanmu.length > 0) {
                  artPlayerRef.current.notice.show = `已加载 ${externalDanmu.length} 条弹幕`;
                }
              }
            };

            if (
              typeof window !== 'undefined' &&
              typeof window.requestIdleCallback !== 'undefined'
            ) {
              window.requestIdleCallback(loadDanmu, { timeout: 1000 });
            } else {
              setTimeout(loadDanmu, 50);
            }
          } else {
            // 关闭弹幕：立即处理
            console.log('关闭外部弹幕...');
            plugin.load();
            plugin.hide();
            // 使用config方法动态更新弹幕设置
            plugin.config({
              emitter: false,
              visible: false,
            });

            // 隐藏弹幕控件
            const danmakuControls = document.querySelector(
              '.artplayer-plugin-danmuku',
            ) as HTMLElement;
            if (danmakuControls) {
              danmakuControls.style.display = 'none';
            }
            console.log('外部弹幕已关闭');

            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = '外部弹幕已关闭';
            }
          }
        }
      } catch (error) {
        console.error('弹幕操作失败:', error);
      }
    }, 300);
  };

  /**
   * 加载外部弹幕数据（带缓存和防重复）
   * @returns 弹幕数据数组
   */
  const loadExternalDanmu = async (): Promise<any[]> => {
    if (!externalDanmuEnabledRef.current) {
      console.log('外部弹幕开关已关闭');
      return [];
    }

    // 生成当前请求的唯一标识
    const currentVideoTitle = videoTitle;
    const currentVideoYear = videoYear;
    const currentVideoDoubanId = videoDoubanId;
    const currentEpisodeNum = currentEpisodeIndex + 1;
    const requestKey = `${currentVideoTitle}_${currentVideoYear}_${currentVideoDoubanId}_${currentEpisodeNum}`;

    // 优化加载状态检测
    const now = Date.now();
    const loadingState = danmuLoadingRef.current as any;
    const lastLoadTime = loadingState?.timestamp || 0;
    const lastRequestKey = loadingState?.requestKey || '';
    const isStuckLoad = now - lastLoadTime > 15000; // 15秒超时
    const isSameRequest = lastRequestKey === requestKey;

    // 智能重复检测
    if (loadingState?.loading && isSameRequest && !isStuckLoad) {
      console.log('弹幕正在加载中，跳过重复请求');
      return [];
    }

    // 强制重置卡住的加载状态
    if (isStuckLoad && loadingState?.loading) {
      console.warn('检测到弹幕加载超时，强制重置');
      danmuLoadingRef.current = false;
    }

    // 设置新的加载状态
    danmuLoadingRef.current = {
      loading: true,
      timestamp: now,
      requestKey,
      source: currentSource,
      episode: currentEpisodeNum,
    } as any;
    lastDanmuLoadKeyRef.current = requestKey;

    try {
      const params = new URLSearchParams();

      // 使用当前最新的state值而不是ref值
      const currentVideoTitle = videoTitle;
      const currentVideoYear = videoYear;
      const currentVideoDoubanId = videoDoubanId;
      const currentEpisodeNum = currentEpisodeIndex + 1;
      const currentVideoUrl = (detailRef.current as any)?.url || '';

      // 优先使用视频URL
      if (currentVideoUrl) {
        params.append('url', currentVideoUrl);
      }
      // 如果没有URL，使用豆瓣信息
      else {
        // 更宽松的参数检查，只要有标题就尝试获取弹幕
        if (currentVideoTitle) {
          params.append('title', currentVideoTitle);
        }
        if (currentVideoYear) {
          params.append('year', currentVideoYear);
        }
        if (currentVideoDoubanId && currentVideoDoubanId > 0) {
          params.append('douban_id', currentVideoDoubanId.toString());
        }
        if (currentEpisodeIndex !== null && currentEpisodeIndex >= 0) {
          params.append('episode', currentEpisodeNum.toString());
        }
      }

      if (!params.toString()) {
        console.log('没有可用的参数获取弹幕');
        return [];
      }

      // 生成缓存键（使用state值确保准确性）
      const cacheKey = `${currentVideoTitle}_${currentVideoYear}_${currentVideoDoubanId}_${currentEpisodeNum}`;

      // 检查缓存
      console.log('检查弹幕缓存:', cacheKey);
      const cached = await getDanmuCacheItem(cacheKey);
      if (cached) {
        if (Date.now() - cached.timestamp < DANMU_CACHE_DURATION * 1000) {
          // 检查缓存数据是否过少（可能是错误的旧缓存）
          if (cached.data.length < 100) {
            console.log('缓存弹幕数量过少，可能是错误缓存，重新获取');
            // 清理这个错误的缓存
            try {
              await ClientCache.delete(`danmu-cache-${cacheKey}`);
              console.log('已清理错误的弹幕缓存');
            } catch (e) {
              console.warn('清理缓存失败:', e);
            }
          } else {
            console.log('使用弹幕缓存数据，缓存键:', cacheKey);
            console.log('缓存弹幕数量:', cached.data.length);
            return cached.data;
          }
        }
      }

      console.log('开始获取外部弹幕，参数:', params.toString());
      const response = await fetch(`/api/danmu-external?${params}`);
      console.log('弹幕API响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('弹幕API请求失败:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log('外部弹幕API返回数据:', data);
      console.log('外部弹幕加载成功:', data.total || 0, '条');

      const finalDanmu = data.danmu || [];
      console.log('最终弹幕数据:', finalDanmu.length, '条');

      // 缓存结果
      await setDanmuCacheItem(cacheKey, finalDanmu);

      return finalDanmu;
    } catch (error) {
      console.error('加载外部弹幕失败:', error);
      return [];
    } finally {
      // 重置加载状态
      danmuLoadingRef.current = false;
    }
  };

  /**
   * 优化的集数变化处理（防抖 + 状态保护）
   */
  useEffect(() => {
    // 标记正在切换集数（只在非换源时）
    if (!isSourceChangingRef.current) {
      isEpisodeChangingRef.current = true;
    }

    updateVideoUrl(detail, currentEpisodeIndex);

    // 如果正在换源，跳过弹幕处理
    if (isSourceChangingRef.current) {
      console.log('正在换源，跳过弹幕处理');
      return;
    }

    // 重置弹幕加载标识，确保新集数能正确加载弹幕
    lastDanmuLoadKeyRef.current = '';
    danmuLoadingRef.current = false;

    // 清除之前的集数切换定时器
    if (episodeSwitchTimeoutRef.current) {
      clearTimeout(episodeSwitchTimeoutRef.current);
    }

    // 如果播放器已经存在且弹幕插件已加载，重新加载弹幕
    if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
      console.log('集数变化，重新加载弹幕');

      // 立即清空当前弹幕，避免旧弹幕残留
      const plugin = artPlayerRef.current.plugins.artplayerPluginDanmuku;
      plugin.reset();
      plugin.load();
      console.log('已清空旧弹幕数据');

      // 保存当前弹幕插件状态
      danmuPluginStateRef.current = {
        isHide: artPlayerRef.current.plugins.artplayerPluginDanmuku.isHide,
        isStop: artPlayerRef.current.plugins.artplayerPluginDanmuku.isStop,
        option: artPlayerRef.current.plugins.artplayerPluginDanmuku.option,
      };

      // 使用防抖处理弹幕重新加载
      episodeSwitchTimeoutRef.current = setTimeout(async () => {
        try {
          if (!artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
            console.warn('集数切换后弹幕插件不存在，跳过弹幕加载');
            return;
          }

          const externalDanmu = await loadExternalDanmu();
          console.log('集数变化后外部弹幕加载结果:', externalDanmu);

          if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
            const plugin = artPlayerRef.current.plugins.artplayerPluginDanmuku;

            if (externalDanmu.length > 0) {
              console.log(
                '向播放器插件重新加载弹幕数据:',
                externalDanmu.length,
                '条',
              );
              plugin.load(externalDanmu);

              // 恢复弹幕插件的状态
              if (danmuPluginStateRef.current) {
                if (!danmuPluginStateRef.current.isHide) {
                  plugin.show();
                }
              }

              if (artPlayerRef.current) {
                artPlayerRef.current.notice.show = `已加载 ${externalDanmu.length} 条弹幕`;
              }
            } else {
              console.log('集数变化后没有弹幕数据可加载');
              plugin.load();

              if (artPlayerRef.current) {
                artPlayerRef.current.notice.show = '暂无弹幕数据';
              }
            }
          }
        } catch (error) {
          console.error('集数变化后加载外部弹幕失败:', error);
        } finally {
          episodeSwitchTimeoutRef.current = null;
        }
      }, 800);
    }
  }, [detail, currentEpisodeIndex]);

  /**
   * 进入页面时直接获取全部源信息
   */
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string,
    ): Promise<SearchResult[]> => {
      setSourceSearchLoading(true);
      setSourceSearchError(null);

      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`,
        );
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        // 不设置错误状态，让后续搜索继续进行
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };
    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      // 使用智能搜索变体获取全部源信息
      try {
        console.log('开始智能搜索，原始查询:', query);
        const searchVariants = generateSearchVariants(query.trim());
        console.log('生成的搜索变体:', searchVariants);

        const allResults: SearchResult[] = [];
        let bestResults: SearchResult[] = [];

        // 依次尝试每个搜索变体
        for (const variant of searchVariants) {
          console.log('尝试搜索变体:', variant);

          const response = await fetch(
            `/api/search?q=${encodeURIComponent(variant)}`,
          );
          if (!response.ok) {
            console.warn(`搜索变体 "${variant}" 失败:`, response.statusText);
            continue;
          }
          const data = await response.json();

          if (data.results && data.results.length > 0) {
            allResults.push(...data.results);

            // 处理搜索结果，根据规则过滤
            const filteredResults = data.results.filter(
              (result: SearchResult) => {
                // 如果有 douban_id，优先使用 douban_id 精确匹配
                if (
                  videoDoubanIdRef.current &&
                  videoDoubanIdRef.current > 0 &&
                  result.douban_id
                ) {
                  return result.douban_id === videoDoubanIdRef.current;
                }

                const queryTitle = videoTitleRef.current
                  .replaceAll(' ', '')
                  .toLowerCase();
                const resultTitle = result.title
                  .replaceAll(' ', '')
                  .toLowerCase();

                // 智能标题匹配：支持数字变体和标点符号变化
                const titleMatch =
                  resultTitle.includes(queryTitle) ||
                  queryTitle.includes(resultTitle) ||
                  // 移除数字和标点后匹配（针对"死神来了：血脉诅咒" vs "死神来了6：血脉诅咒"）
                  resultTitle.replace(/\d+|[：:]/g, '') ===
                    queryTitle.replace(/\d+|[：:]/g, '') ||
                  // 通用关键词匹配：仅当查询标题较长时（4个字符以上）才使用关键词匹配
                  // 避免短标题（如"玫瑰"2字）被拆分匹配
                  (queryTitle.length > 4 &&
                    checkAllKeywordsMatch(queryTitle, resultTitle));

                const yearMatch = videoYearRef.current
                  ? result.year.toLowerCase() ===
                    videoYearRef.current.toLowerCase()
                  : true;
                const typeMatch = searchType
                  ? (searchType === 'tv' && result.episodes.length > 1) ||
                    (searchType === 'movie' && result.episodes.length === 1) ||
                    (searchType === 'anime' && result.episodes.length > 1) || // 动漫视为多集内容
                    (searchType === 'variety' && result.episodes.length > 1) || // 综艺视为多集内容
                    searchType === 'shortdrama' // 短剧可能是单集或多集
                  : true;

                return titleMatch && yearMatch && typeMatch;
              },
            );

            if (filteredResults.length > 0) {
              console.log(
                `变体 "${variant}" 找到 ${filteredResults.length} 个匹配结果`,
              );
              bestResults = filteredResults;
              break; // 找到精确匹配就停止
            }
          }
        }
        // 智能匹配：英文标题严格匹配，中文标题宽松匹配
        let finalResults = bestResults;

        // 如果没有精确匹配，根据语言类型进行不同策略的匹配
        if (bestResults.length === 0) {
          const queryTitle = videoTitleRef.current.toLowerCase().trim();
          const allCandidates = allResults;

          // 检测查询主要语言（英文 vs 中文）
          const englishChars = (queryTitle.match(/[a-z\s]/g) || []).length;
          const chineseChars = (queryTitle.match(/[\u4e00-\u9fff]/g) || [])
            .length;
          const isEnglishQuery = englishChars > chineseChars;

          console.log(
            `搜索语言检测: ${
              isEnglishQuery ? '英文' : '中文'
            } - "${queryTitle}"`,
          );

          let relevantMatches;

          if (isEnglishQuery) {
            // 英文查询：使用词汇匹配策略，避免不相关结果
            console.log('使用英文词汇匹配策略');

            // 提取有效英文词汇（过滤停用词）
            const queryWords = queryTitle
              .toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(/\s+/)
              .filter(
                (word) =>
                  word.length > 2 &&
                  ![
                    'the',
                    'a',
                    'an',
                    'and',
                    'or',
                    'of',
                    'in',
                    'on',
                    'at',
                    'to',
                    'for',
                    'with',
                    'by',
                  ].includes(word),
              );

            console.log('英文关键词:', queryWords);

            relevantMatches = allCandidates.filter((result) => {
              const title = result.title.toLowerCase();
              const titleWords = title
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter((word) => word.length > 1);

              // 计算词汇匹配度：标题必须包含至少50%的查询关键词
              const matchedWords = queryWords.filter((queryWord) =>
                titleWords.some(
                  (titleWord) =>
                    titleWord.includes(queryWord) ||
                    queryWord.includes(titleWord) ||
                    // 允许部分相似（如gumball vs gum）
                    (queryWord.length > 4 &&
                      titleWord.length > 4 &&
                      queryWord.substring(0, 4) === titleWord.substring(0, 4)),
                ),
              );

              const wordMatchRatio = matchedWords.length / queryWords.length;
              if (wordMatchRatio >= 0.5) {
                console.log(
                  `英文词汇匹配 (${matchedWords.length}/${
                    queryWords.length
                  }): "${result.title}" - 匹配词: [${matchedWords.join(', ')}]`,
                );
                return true;
              }
              return false;
            });
          } else {
            // 中文查询：宽松匹配，保持现有行为
            console.log('使用中文宽松匹配策略');
            relevantMatches = allCandidates.filter((result) => {
              const title = result.title.toLowerCase();
              const normalizedQuery = queryTitle.replace(
                /[^\w\u4e00-\u9fff]/g,
                '',
              );
              const normalizedTitle = title.replace(/[^\w\u4e00-\u9fff]/g, '');

              // 包含匹配或50%相似度
              if (
                normalizedTitle.includes(normalizedQuery) ||
                normalizedQuery.includes(normalizedTitle)
              ) {
                console.log(`中文包含匹配: "${result.title}"`);
                return true;
              }

              const commonChars = Array.from(normalizedQuery).filter((char) =>
                normalizedTitle.includes(char),
              ).length;
              const similarity = commonChars / normalizedQuery.length;
              if (similarity >= 0.5) {
                console.log(
                  `中文相似匹配 (${(similarity * 100).toFixed(1)}%): "${
                    result.title
                  }"`,
                );
                return true;
              }
              return false;
            });
          }

          console.log(
            `匹配结果: ${relevantMatches.length}/${allCandidates.length}`,
          );

          const maxResults = isEnglishQuery ? 5 : 20; // 英文更严格控制结果数
          if (
            relevantMatches.length > 0 &&
            relevantMatches.length <= maxResults
          ) {
            finalResults = Array.from(
              new Map(
                relevantMatches.map((item) => [
                  `${item.source}-${item.id}`,
                  item,
                ]),
              ).values(),
            ) as SearchResult[];
          } else {
            console.log('没有找到合理的匹配，返回空结果');
            finalResults = [];
          }
        }
        console.log(`智能搜索完成，最终返回 ${finalResults.length} 个结果`);
        setAvailableSources(finalResults);
        return finalResults;
      } catch (err) {
        console.error('智能搜索失败:', err);
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...',
      );

      let sourcesInfo: SearchResult[] = [];

      // 如果明确指定了源和ID，先获取该源的详情，然后搜索所有源
      if (currentSource && currentId) {
        const detailSources = await fetchSourceDetail(currentSource, currentId);

        // 总是搜索所有源，确保换源功能正常

        const allSources = await fetchSourcesData(searchTitle || videoTitle);

        // 如果搜索到了源，使用搜索结果；否则使用详情源
        sourcesInfo = allSources.length > 0 ? allSources : detailSources;
      } else {
        // 没有指定源和ID，进行搜索

        sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      }

      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) =>
            source.source === currentSource && source.id === currentId,
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        detailData = await preferBestSource(sourcesInfo);
      }

      console.log(detailData.source, detailData.id);

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      // 优先保留URL参数中的豆瓣ID，如果URL中没有则使用详情数据中的
      setVideoDoubanId(videoDoubanIdRef.current || detailData.douban_id || 0);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  }, []);

  // 播放记录处理
  useEffect(() => {
    // 仅在初次挂载时检查播放记录
    const initFromHistory = async () => {
      if (!currentSource || !currentId) {
        return;
      }

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          // 更新当前选集索引
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // 🚀 优化的换源处理（防连续点击）
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string,
  ) => {
    try {
      // 防止连续点击换源
      if (isSourceChangingRef.current) {
        console.log('正在换源中，忽略重复点击');
        return;
      }

      // 设置换源标识，防止useEffect重复处理弹幕
      isSourceChangingRef.current = true;

      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      // 立即重置弹幕相关状态，避免残留
      lastDanmuLoadKeyRef.current = '';
      danmuLoadingRef.current = false;

      // 清除弹幕操作定时器
      if (danmuOperationTimeoutRef.current) {
        clearTimeout(danmuOperationTimeoutRef.current);
        danmuOperationTimeoutRef.current = null;
      }
      if (episodeSwitchTimeoutRef.current) {
        clearTimeout(episodeSwitchTimeoutRef.current);
        episodeSwitchTimeoutRef.current = null;
      }

      // 正确地清空弹幕状态
      if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
        const plugin = artPlayerRef.current.plugins.artplayerPluginDanmuku;

        try {
          if (typeof plugin.reset === 'function') {
            plugin.reset();
          }

          if (typeof plugin.load === 'function') {
            plugin.load();
            console.log('已完全清空弹幕队列');
          }

          if (typeof plugin.hide === 'function') {
            plugin.hide();
          }

          console.log('换源时已清空旧弹幕数据');
        } catch (error) {
          console.warn('清空弹幕时出错，但继续换源:', error);
        }
      }

      // 记录当前播放进度
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除前一个历史记录
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current,
          );
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId,
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      // 更新URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      // 优先保留URL参数中的豆瓣ID，如果URL中没有则使用详情数据中的
      setVideoDoubanId(videoDoubanIdRef.current || newDetail.douban_id || 0);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);

      // 换源完成后，优化弹幕加载流程
      setTimeout(async () => {
        isSourceChangingRef.current = false;

        if (
          artPlayerRef.current?.plugins?.artplayerPluginDanmuku &&
          externalDanmuEnabledRef.current
        ) {
          console.log('换源完成，开始优化弹幕加载...');

          // 确保状态完全重置
          lastDanmuLoadKeyRef.current = '';
          danmuLoadingRef.current = false;

          try {
            const startTime = performance.now();
            const danmuData = await loadExternalDanmu();

            if (
              danmuData.length > 0 &&
              artPlayerRef.current?.plugins?.artplayerPluginDanmuku
            ) {
              const plugin =
                artPlayerRef.current.plugins.artplayerPluginDanmuku;

              // 确保在加载新弹幕前完全清空旧弹幕
              plugin.reset();
              plugin.load();
              console.log('换源后已清空旧弹幕，准备加载新弹幕');

              // 优化大量弹幕的加载：分批处理，减少阻塞
              if (danmuData.length > 1000) {
                console.log(
                  `检测到大量弹幕 (${danmuData.length}条)，启用分批加载`,
                );

                // 先加载前500条，快速显示
                const firstBatch = danmuData.slice(0, 500);
                plugin.load(firstBatch);

                // 剩余弹幕分批异步加载，避免阻塞
                const remainingBatches = [];
                for (let i = 500; i < danmuData.length; i += 300) {
                  remainingBatches.push(danmuData.slice(i, i + 300));
                }

                // 使用requestIdleCallback分批加载剩余弹幕
                remainingBatches.forEach((batch, index) => {
                  setTimeout(
                    () => {
                      if (
                        artPlayerRef.current?.plugins?.artplayerPluginDanmuku
                      ) {
                        batch.forEach((danmu) => {
                          plugin.emit(danmu).catch(console.warn);
                        });
                      }
                    },
                    (index + 1) * 100,
                  );
                });

                console.log(
                  `分批加载完成: 首批${firstBatch.length}条 + ${remainingBatches.length}个后续批次`,
                );
              } else {
                // 弹幕数量较少，正常加载
                plugin.load(danmuData);
                console.log(`换源后弹幕加载完成: ${danmuData.length} 条`);
              }

              const loadTime = performance.now() - startTime;
              console.log(`弹幕加载耗时: ${loadTime.toFixed(2)}ms`);
            } else {
              console.log('换源后没有弹幕数据');
            }
          } catch (error) {
            console.error('换源后弹幕加载失败:', error);
          }
        }
      }, 1000);
    } catch (err) {
      // 重置换源标识
      isSourceChangingRef.current = false;

      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // 🚀 组件卸载时清理所有定时器和状态
  useEffect(() => {
    return () => {
      // 清理所有定时器
      if (danmuOperationTimeoutRef.current) {
        clearTimeout(danmuOperationTimeoutRef.current);
      }
      if (episodeSwitchTimeoutRef.current) {
        clearTimeout(episodeSwitchTimeoutRef.current);
      }
      if (sourceSwitchTimeoutRef.current) {
        clearTimeout(sourceSwitchTimeoutRef.current);
      }

      // 重置状态
      isSourceChangingRef.current = false;
      switchPromiseRef.current = null;
      pendingSwitchRef.current = null;
    };
  }, []);

  /**
   * 处理集数切换
   * @param episodeNumber 集数编号
   */
  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      // 在更换集数前保存当前播放进度
      if (artPlayerRef.current?.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(episodeNumber);
    }
  };

  /**
   * 处理上一集
   */
  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  /**
   * 处理下一集
   */
  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  /**
   * 处理全局快捷键
   * @param e 键盘事件
   */
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
      if (
        artPlayerRef.current &&
        artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
      ) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100,
        )}`;
        e.preventDefault();
      }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100,
        )}`;
        e.preventDefault();
      }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  };

  /**
   * 保存播放进度
   */
  const saveCurrentPlayProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      // 获取现有播放记录以保持原始集数
      const existingRecord = await getAllPlayRecords()
        .then((records) => {
          const key = generateStorageKey(
            currentSourceRef.current,
            currentIdRef.current,
          );
          return records[key];
        })
        .catch(() => null);

      const currentTotalEpisodes = detailRef.current?.episodes.length || 1;

      // 尝试从换源列表中获取更准确的 remarks（搜索接口比详情接口更可能有 remarks）
      const sourceFromList = availableSourcesRef.current?.find(
        (s) =>
          s.source === currentSourceRef.current &&
          s.id === currentIdRef.current,
      );
      const remarksToSave =
        sourceFromList?.remarks || detailRef.current?.remarks;

      await savePlayRecord(
        currentSourceRef.current,
        currentIdRef.current || '',
        {
          id: currentIdRef.current || '',
          source: currentSourceRef.current, // 添加缺少的 source 字段
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
          total_episodes: currentTotalEpisodes,
          // 🔑 关键：不要在这里设置 original_episodes
          original_episodes: existingRecord?.original_episodes, // 只传递已有值，不自动填充
          play_time: Math.floor(currentTime),
          total_time: Math.floor(duration),
          save_time: Date.now(),
          search_title: searchTitle,
          remarks: remarksToSave, // 优先使用搜索结果的 remarks，因为详情接口可能没有
          type: searchType, // 添加类型字段，从URL参数获取
        },
      );

      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

  useEffect(() => {
    // 页面即将卸载时保存播放进度和清理资源
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
      releaseWakeLock();
      cleanupPlayer();
    };

    // 页面可见性变化时保存播放进度和释放 Wake Lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
        releaseWakeLock();
      } else if (document.visibilityState === 'visible') {
        // 页面重新可见时，如果正在播放则重新请求 Wake Lock
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, artPlayerRef.current]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) {
      return;
    }
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
        ToastManager.error('检查收藏状态失败');
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) {
      return;
    }

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      },
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    ) {
      return;
    }

    try {
      if (favorited) {
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 使用统一的类型推断服务
        const inferenceResult = TypeInferenceService.infer({
          type: searchType, // 优先使用URL传递的类型
          type_name: detailRef.current?.type_name,
          source: currentSourceRef.current,
          title: videoTitleRef.current || '',
          episodes: detailRef.current?.episodes.length || 1,
        });

        // 如果未收藏，添加收藏
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle || videoTitleRef.current, // 确保 search_title 不为空
          type: inferenceResult.type,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  useEffect(() => {
    /**
     * 异步初始化播放器，避免SSR问题
     */
    const initPlayer = async () => {
      if (
        !Hls ||
        !videoUrl ||
        loading ||
        currentEpisodeIndex === null ||
        !artRef.current
      ) {
        return;
      }

      // 确保选集索引有效
      if (
        !detail?.episodes ||
        currentEpisodeIndex >= detail.episodes.length ||
        currentEpisodeIndex < 0
      ) {
        setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
        return;
      }

      if (!videoUrl) {
        setError('视频地址无效');
        return;
      }
      console.log(videoUrl);

      // 检测移动设备和浏览器类型 - 使用统一的全局检测结果
      const isSafari = /^(?:(?!chrome|android).)*safari/i.test(userAgent);
      const isIOS = isIOSGlobal;
      const isIOS13 = isIOS13Global;
      const isMobile = isMobileGlobal;
      const isWebKit = isSafari || isIOS;
      // Chrome浏览器检测 - 只有真正的Chrome才支持Chromecast
      // 排除各种厂商浏览器，即使它们的UA包含Chrome字样
      const isChrome =
        /Chrome/i.test(userAgent) &&
        !/Edg/i.test(userAgent) && // 排除Edge
        !/OPR/i.test(userAgent) && // 排除Opera
        !/SamsungBrowser/i.test(userAgent) && // 排除三星浏览器
        !/OPPO/i.test(userAgent) && // 排除OPPO浏览器
        !/OppoBrowser/i.test(userAgent) && // 排除OppoBrowser
        !/HeyTapBrowser/i.test(userAgent) && // 排除HeyTapBrowser (OPPO新版浏览器)
        !/OnePlus/i.test(userAgent) && // 排除OnePlus浏览器
        !/Xiaomi/i.test(userAgent) && // 排除小米浏览器
        !/MIUI/i.test(userAgent) && // 排除MIUI浏览器
        !/Huawei/i.test(userAgent) && // 排除华为浏览器
        !/Vivo/i.test(userAgent) && // 排除Vivo浏览器
        !/UCBrowser/i.test(userAgent) && // 排除UC浏览器
        !/QQBrowser/i.test(userAgent) && // 排除QQ浏览器
        !/Baidu/i.test(userAgent) && // 排除百度浏览器
        !/SogouMobileBrowser/i.test(userAgent); // 排除搜狗浏览器

      // 调试信息：输出设备检测结果和投屏策略
      console.log('🔍 设备检测结果:', {
        userAgent,
        isIOS,
        isSafari,
        isMobile,
        isWebKit,
        isChrome,
        AirPlay按钮: isIOS || isSafari ? '✅ 显示' : '❌ 隐藏',
        Chromecast按钮: isChrome && !isIOS ? '✅ 显示' : '❌ 隐藏',
        投屏策略:
          isIOS || isSafari
            ? '🍎 AirPlay (WebKit)'
            : isChrome
              ? '📺 Chromecast (Cast API)'
              : '❌ 不支持投屏',
      });

      // 🚀 优化连续切换：防抖机制 + 资源管理
      if (artPlayerRef.current && !loading) {
        try {
          // 清除之前的切换定时器
          if (sourceSwitchTimeoutRef.current) {
            clearTimeout(sourceSwitchTimeoutRef.current);
            sourceSwitchTimeoutRef.current = null;
          }

          // 如果有正在进行的切换，先取消
          if (switchPromiseRef.current) {
            console.log('⏸️ 取消前一个切换操作，开始新的切换');
            // ArtPlayer没有提供取消机制，但我们可以忽略旧的结果
            switchPromiseRef.current = null;
          }

          // 保存弹幕状态
          if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
            danmuPluginStateRef.current = {
              isHide:
                artPlayerRef.current.plugins.artplayerPluginDanmuku.isHide,
              isStop:
                artPlayerRef.current.plugins.artplayerPluginDanmuku.isStop,
              option:
                artPlayerRef.current.plugins.artplayerPluginDanmuku.option,
            };
          }

          // 🚀 关键修复：区分换源和切换集数
          const isEpisodeChange = isEpisodeChangingRef.current;
          const currentTime = artPlayerRef.current.currentTime || 0;

          let switchPromise: Promise<any>;
          if (isEpisodeChange) {
            // 切换集数时重置播放时间到0
            switchPromise = artPlayerRef.current.switchUrl(videoUrl);
          } else {
            console.log(
              `🎯 开始切换源: ${videoUrl} (保持进度: ${currentTime.toFixed(
                2,
              )}s)`,
            );
            // 换源时保持播放进度
            switchPromise = artPlayerRef.current.switchQuality(videoUrl);
          }

          // 创建切换Promise
          switchPromise = switchPromise
            .then(() => {
              // 只有当前Promise还是活跃的才执行后续操作
              if (switchPromiseRef.current === switchPromise) {
                artPlayerRef.current.title = `${videoTitle} - 第${
                  currentEpisodeIndex + 1
                }集`;
                artPlayerRef.current.poster = videoCover;
                console.log('✅ 源切换完成');

                // 🔥 重置集数切换标识
                if (isEpisodeChange) {
                  isEpisodeChangingRef.current = false;
                  console.log('🎯 集数切换完成，重置标识');
                }
              }
            })
            .catch((error: any) => {
              if (switchPromiseRef.current === switchPromise) {
                console.warn('⚠️ 源切换失败，将重建播放器:', error);
                // 重置集数切换标识
                if (isEpisodeChange) {
                  isEpisodeChangingRef.current = false;
                }
                throw error; // 让外层catch处理
              }
            });

          switchPromiseRef.current = switchPromise;
          await switchPromise;

          if (artPlayerRef.current?.video) {
            ensureVideoSource(
              artPlayerRef.current.video as HTMLVideoElement,
              videoUrl,
            );
          }

          // 🚀 移除原有的 setTimeout 弹幕加载逻辑，交由 useEffect 统一优化处理

          console.log('使用switch方法成功切换视频');
          return;
        } catch (error) {
          console.warn('Switch方法失败，将重建播放器:', error);
          // 重置集数切换标识
          isEpisodeChangingRef.current = false;
          // 如果switch失败，清理播放器并重新创建
          cleanupPlayer();
        }
      }
      if (artPlayerRef.current) {
        cleanupPlayer();
      }

      // 确保 DOM 容器完全清空，避免多实例冲突
      if (artRef.current) {
        artRef.current.innerHTML = '';
      }

      try {
        // 使用动态导入的 Artplayer
        const Artplayer = (window as any).DynamicArtplayer;
        const artplayerPluginDanmuku = (window as any)
          .DynamicArtplayerPluginDanmuku;

        // 创建新的播放器实例
        Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
        Artplayer.USE_RAF = true;
        // 重新启用5.3.0内存优化功能，但使用false参数避免清空DOM
        Artplayer.REMOVE_SRC_WHEN_DESTROY = true;

        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: videoUrl,
          poster: videoCover,
          volume: 0.7,
          isLive: false,
          // iOS设备需要静音才能自动播放，参考ArtPlayer源码处理
          muted: isIOS || isSafari,
          autoplay: true,
          pip: true,
          autoSize: false,
          autoMini: false,
          screenshot: !isMobile, // 桌面端启用截图功能
          setting: true,
          loop: false,
          flip: false,
          playbackRate: true,
          aspectRatio: false,
          fullscreen: true,
          fullscreenWeb: true,
          subtitleOffset: false,
          miniProgressBar: false,
          mutex: true,
          playsInline: true,
          autoPlayback: false,
          theme: '#22c55e',
          lang: 'zh-cn',
          hotkey: false,
          fastForward: true,
          autoOrientation: true,
          lock: true,
          // AirPlay 仅在支持 WebKit API 的浏览器中启用
          // 主要是 Safari (桌面和移动端) 和 iOS 上的其他浏览器
          airplay: isIOS || isSafari,
          moreVideoAttr: {
            crossOrigin: 'anonymous',
          },
          // HLS 支持配置
          customType: {
            m3u8: function (video: HTMLVideoElement, url: string) {
              if (!Hls) {
                console.error('HLS.js 未加载');
                return;
              }

              if (video.hls) {
                video.hls.destroy();
              }

              // 在函数内部重新检测iOS13+设备
              const localIsIOS13 = isIOS13;

              // 🚀 根据 HLS.js 官方源码的最佳实践配置
              const hls = new Hls({
                debug: false,
                enableWorker: true,
                // 参考 HLS.js config.ts：移动设备关闭低延迟模式以节省资源
                lowLatencyMode: !isMobile,

                // 🎯 官方推荐的缓冲策略 - iOS13+ 特别优化
                /* 缓冲长度配置 - 参考 hlsDefaultConfig */
                maxBufferLength: isMobile
                  ? localIsIOS13
                    ? 8
                    : isIOS
                      ? 10
                      : 15 // iOS13+: 8s, iOS: 10s, Android: 15s
                  : 30, // 桌面默认30s
                backBufferLength: isMobile
                  ? localIsIOS13
                    ? 5
                    : isIOS
                      ? 8
                      : 10 // iOS13+更保守
                  : Infinity, // 桌面使用无限回退缓冲

                /* 缓冲大小配置 - 基于官方 maxBufferSize */
                maxBufferSize: isMobile
                  ? localIsIOS13
                    ? 20 * 1000 * 1000
                    : isIOS
                      ? 30 * 1000 * 1000
                      : 40 * 1000 * 1000 // iOS13+: 20MB, iOS: 30MB, Android: 40MB
                  : 60 * 1000 * 1000, // 桌面: 60MB (官方默认)

                /* 网络加载优化 - 参考 defaultLoadPolicy */
                maxLoadingDelay: isMobile ? (localIsIOS13 ? 2 : 3) : 4, // iOS13+设备更快超时
                maxBufferHole: isMobile ? (localIsIOS13 ? 0.05 : 0.1) : 0.1, // 减少缓冲洞容忍度

                /* Fragment管理 - 参考官方配置 */
                liveDurationInfinity: false, // 避免无限缓冲 (官方默认false)
                liveBackBufferLength: isMobile ? (localIsIOS13 ? 3 : 5) : null, // 已废弃，保持兼容

                /* 高级优化配置 - 参考 StreamControllerConfig */
                maxMaxBufferLength: isMobile ? (localIsIOS13 ? 60 : 120) : 600, // 最大缓冲长度限制
                maxFragLookUpTolerance: isMobile ? 0.1 : 0.25, // 片段查找容忍度

                /* ABR优化 - 参考 ABRControllerConfig */
                abrEwmaFastLive: isMobile ? 2 : 3, // 移动端更快的码率切换
                abrEwmaSlowLive: isMobile ? 6 : 9,
                abrBandWidthFactor: isMobile ? 0.8 : 0.95, // 移动端更保守的带宽估计

                /* 启动优化 */
                startFragPrefetch: !isMobile, // 移动端关闭预取以节省资源
                testBandwidth: !localIsIOS13, // iOS13+关闭带宽测试以快速启动

                /* Loader配置 - 参考官方 fragLoadPolicy */
                fragLoadPolicy: {
                  default: {
                    maxTimeToFirstByteMs: isMobile ? 6000 : 10000,
                    maxLoadTimeMs: isMobile ? 60000 : 120000,
                    timeoutRetry: {
                      maxNumRetry: isMobile ? 2 : 4,
                      retryDelayMs: 0,
                      maxRetryDelayMs: 0,
                    },
                    errorRetry: {
                      maxNumRetry: isMobile ? 3 : 6,
                      retryDelayMs: 1000,
                      maxRetryDelayMs: isMobile ? 4000 : 8000,
                    },
                  },
                },

                /* 自定义loader */
                loader: blockAdEnabledRef.current
                  ? CustomHlsJsLoader
                  : Hls.DefaultConfig.loader,
              });

              hls.loadSource(url);
              hls.attachMedia(video);
              video.hls = hls;

              ensureVideoSource(video, url);

              hls.on(Hls.Events.ERROR, function (event: any, data: any) {
                // 改进错误处理：检查数据是否存在
                if (!data || Object.keys(data).length === 0) {
                  console.warn(
                    'HLS Error: 收到空错误数据，可能是网络或初始化问题',
                  );

                  // 空错误数据不显示用户提示，只在控制台记录
                  // 尝试静默恢复
                  if (hls && video) {
                    try {
                      hls.startLoad(video.currentTime || 0);
                    } catch (e) {
                      console.error('HLS 重新加载失败:', e);
                    }
                  }
                  return;
                }

                console.error('HLS Error:', event, data);
                // v1.6.13 增强：处理片段解析错误（针对initPTS修复）
                if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
                  console.log('片段解析错误，尝试重新加载...');
                  // 重新开始加载，利用v1.6.13的initPTS修复
                  hls.startLoad();
                  return;
                }

                // v1.6.13 增强：处理时间戳相关错误（直播回搜修复）
                if (
                  data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR &&
                  data.err?.message?.includes('timestamp')
                ) {
                  console.log('时间戳错误，清理缓冲区并重新加载...');
                  try {
                    // 清理缓冲区后重新开始，利用v1.6.13的时间戳包装修复
                    const currentTime = video.currentTime;
                    hls.trigger(Hls.Events.BUFFER_RESET, undefined);
                    hls.startLoad(currentTime);
                  } catch (e) {
                    console.warn('缓冲区重置失败:', e);
                    hls.startLoad();
                  }
                  return;
                }

                // 非致命错误不显示用户提示，只在控制台记录
                if (!data.fatal) {
                  console.log('非致命 HLS 错误，静默处理:', data.details);
                  return;
                }
                // 处理致命错误
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.log('网络错误，尝试恢复...');
                      if (typeof window !== 'undefined') {
                        import('@/components/Toast').then(
                          ({ ToastManager }) => {
                            ToastManager?.warning(
                              '网络不稳定，正在尝试恢复播放...',
                            );
                          },
                        );
                      }
                      try {
                        hls.startLoad();
                      } catch (e) {
                        console.error('网络错误恢复失败:', e);
                        if (typeof window !== 'undefined') {
                          import('@/components/Toast').then(
                            ({ ToastManager }) => {
                              ToastManager?.error(
                                '网络连接失败，请检查网络后刷新页面',
                              );
                            },
                          );
                        }
                        hls.destroy();
                      }
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('媒体错误，尝试恢复...');
                      if (typeof window !== 'undefined') {
                        import('@/components/Toast').then(
                          ({ ToastManager }) => {
                            ToastManager?.warning(
                              '视频解码异常，正在尝试恢复...',
                            );
                          },
                        );
                      }
                      try {
                        hls.recoverMediaError();
                      } catch (e) {
                        console.error('媒体错误恢复失败:', e);
                        if (typeof window !== 'undefined') {
                          import('@/components/Toast').then(
                            ({ ToastManager }) => {
                              ToastManager?.error(
                                '视频格式不支持，请尝试其他视频源',
                              );
                            },
                          );
                        }
                        hls.destroy();
                      }
                      break;
                    default:
                      console.log(
                        '无法恢复的错误类型:',
                        data.type,
                        data.details,
                      );
                      // 对于未知错误，尝试重新初始化
                      try {
                        if (video && video.src) {
                          const currentTime = video.currentTime;
                          hls.destroy();
                          const newHls = new Hls();
                          newHls.loadSource(video.src);
                          newHls.attachMedia(video);
                          newHls.startLoad(currentTime);
                        }
                      } catch (e) {
                        console.error('错误恢复失败:', e);
                        hls.destroy();
                      }
                      break;
                  }
                } else {
                  // 非致命错误，记录但不中断播放
                  console.warn(
                    'HLS 非致命错误:',
                    data.details || '未知错误详情',
                  );
                }
              });
            },
          },
          settings: [
            {
              html: '去广告',
              icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
              tooltip: blockAdEnabled ? '已开启' : '已关闭',
              switch: blockAdEnabled,
              onSwitch: function (item: any) {
                const nextState = !item.switch;
                try {
                  localStorage.setItem('enable_blockad', String(nextState));
                  if (artPlayerRef.current) {
                    resumeTimeRef.current = artPlayerRef.current.currentTime;
                    if (artPlayerRef.current.video.hls) {
                      artPlayerRef.current.video.hls.destroy();
                    }
                    artPlayerRef.current.destroy(false);
                    artPlayerRef.current = null;
                  }
                  setBlockAdEnabled(nextState);
                } catch {
                  // ignore
                }
                // 更新tooltip显示
                item.tooltip = nextState ? '已开启' : '已关闭';

                return nextState; // 立即返回新状态
              },
            },
            {
              name: '外部弹幕',
              html: '外部弹幕',
              icon: '<text x="50%" y="50%" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">弹</text>',
              tooltip: externalDanmuEnabled ? '已开启' : '已关闭',
              switch: externalDanmuEnabled,
              onSwitch: function (item: any) {
                const nextState = !item.switch;

                // 🚀 使用优化后的弹幕操作处理函数
                handleDanmuOperationOptimized(nextState);

                // 更新tooltip显示
                item.tooltip = nextState ? '已开启' : '已关闭';

                return nextState; // 立即返回新状态
              },
            },
          ],
          // 控制栏配置
          controls: [
            {
              position: 'left',
              index: 13,
              html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
              tooltip: '播放下一集',
              click: function () {
                handleNextEpisode();
              },
            },

            {
              position: 'right',
              index: 15,
              html: '<i class="art-icon flex"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 3" stroke="currentColor" stroke="2" stroke-linecap="round"/></svg></i>',
              tooltip: '跳过设置',
              click: function () {
                // 调用跳过设置插件的 toggle 方法
                if (
                  artPlayerRef.current?.plugins?.artplayerPluginSkipSettings
                ) {
                  artPlayerRef.current.plugins.artplayerPluginSkipSettings.toggle();
                }
                return '';
              },
            },
          ],
          // 🚀 性能优化的弹幕插件配置 - 保持弹幕数量，优化渲染性能
          plugins: [
            artplayerPluginDanmuku(
              (() => {
                // 🎯 设备性能检测
                const getDevicePerformance = () => {
                  const hardwareConcurrency =
                    navigator.hardwareConcurrency || 2;
                  const memory =
                    (performance as any).memory?.jsHeapSizeLimit || 0;

                  // 简单性能评分（0-1）
                  let score = 0;
                  score += Math.min(hardwareConcurrency / 4, 1) * 0.5; // CPU核心数权重
                  score += Math.min(memory / (1024 * 1024 * 1024), 1) * 0.3; // 内存权重
                  score += (isMobile ? 0.2 : 0.5) * 0.2; // 设备类型权重

                  if (score > 0.7) {
                    return 'high';
                  }
                  if (score > 0.4) {
                    return 'medium';
                  }
                  return 'low';
                };

                const devicePerformance = getDevicePerformance();
                console.log(`🎯 设备性能等级: ${devicePerformance}`);

                // 🚀 根据设备性能调整弹幕渲染策略（不减少数量）
                const getOptimizedConfig = () => {
                  const baseConfig = {
                    danmuku: [], // 初始为空数组，后续通过load方法加载
                    speed: parseInt(
                      localStorage.getItem('danmaku_speed') || '6',
                    ),
                    opacity: parseFloat(
                      localStorage.getItem('danmaku_opacity') || '0.8',
                    ),
                    fontSize: parseInt(
                      localStorage.getItem('danmaku_fontSize') || '25',
                    ),
                    color: '#FFFFFF',
                    mode: 0 as const, // 修正类型：使用 const assertion
                    modes: JSON.parse(
                      localStorage.getItem('danmaku_modes') || '[0, 1, 2]',
                    ) as Array<0 | 1 | 2>,
                    margin: JSON.parse(
                      localStorage.getItem('danmaku_margin') || '[10, "75%"]',
                    ) as [number | `${number}%`, number | `${number}%`],
                    visible:
                      localStorage.getItem('danmaku_visible') !== 'false' &&
                      externalDanmuEnabled,
                    emitter: true, // 始终创建发射器，通过控制显示/隐藏来管理
                    maxLength: 50,
                    lockTime: 2,
                    theme: 'dark' as const,
                    width: (() => {
                      // 检测是否为全屏模式
                      const checkFullscreen = () => {
                        const player = document.querySelector('.artplayer');
                        return (
                          player &&
                          (player.classList.contains('art-fullscreen') ||
                            player.classList.contains('art-fullscreen-web'))
                        );
                      };
                      // 全屏模式下缩短30%，从300px变为210px
                      return checkFullscreen() ? 150 : 250;
                    })(),

                    // 🎯 激进优化配置 - 保持功能完整性
                    antiOverlap: devicePerformance === 'high', // 只有高性能设备开启防重叠，避免重叠计算
                    synchronousPlayback: true, // ✅ 必须保持true！确保弹幕与视频播放速度同步
                    heatmap: false, // 关闭热力图，减少DOM计算开销

                    // 🧠 智能过滤器 - 激进性能优化，过滤影响性能的弹幕
                    filter: (danmu: any) => {
                      // 基础验证
                      if (!danmu.text?.trim()) {
                        return false;
                      }

                      const text = danmu.text.trim();

                      // 🔥 激进长度限制，减少DOM渲染负担
                      if (text.length > 50) {
                        return false;
                      } // 从100改为50，更激进
                      if (text.length < 2) {
                        return false;
                      } // 过短弹幕通常无意义

                      // 🔥 激进特殊字符过滤，避免复杂渲染
                      const specialCharCount = (
                        text.match(
                          /[^\u4e00-\u9fa5a-zA-Z0-9\s.,!?；，。！？]/g,
                        ) || []
                      ).length;
                      if (specialCharCount > 5) {
                        return false;
                      } // 从10改为5，更严格

                      // 🔥 过滤纯数字或纯符号弹幕，减少无意义渲染
                      if (/^\d+$/.test(text)) {
                        return false;
                      }
                      if (/^[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/.test(text)) {
                        return false;
                      }

                      // 🔥 过滤常见低质量弹幕，提升整体质量
                      const lowQualityPatterns = [
                        /^666+$/,
                        /^好+$/,
                        /^哈+$/,
                        /^啊+$/,
                        /^[!！.。？?]+$/,
                        /^牛+$/,
                        /^强+$/,
                      ];
                      if (
                        lowQualityPatterns.some((pattern) => pattern.test(text))
                      ) {
                        return false;
                      }

                      return true;
                    },

                    // 🚀 优化的弹幕显示前检查（换源时性能优化）
                    beforeVisible: (danmu: any) => {
                      return new Promise<boolean>((resolve) => {
                        // 换源期间快速拒绝弹幕显示，减少处理开销
                        if (isSourceChangingRef.current) {
                          resolve(false);
                          return;
                        }

                        // 🎯 动态弹幕密度控制 - 根据当前屏幕上的弹幕数量决定是否显示
                        const currentVisibleCount = document.querySelectorAll(
                          '.art-danmuku [data-state="emit"]',
                        ).length;
                        const maxConcurrentDanmu =
                          devicePerformance === 'high'
                            ? 60
                            : devicePerformance === 'medium'
                              ? 40
                              : 25;

                        if (currentVisibleCount >= maxConcurrentDanmu) {
                          // 🔥 当弹幕密度过高时，随机丢弃部分弹幕，保持流畅性
                          const dropRate =
                            devicePerformance === 'high'
                              ? 0.1
                              : devicePerformance === 'medium'
                                ? 0.3
                                : 0.5;
                          if (Math.random() < dropRate) {
                            resolve(false); // 丢弃当前弹幕
                            return;
                          }
                        }

                        // 🎯 硬件加速优化
                        if (danmu.$ref && danmu.mode === 0) {
                          danmu.$ref.style.willChange = 'transform';
                          danmu.$ref.style.backfaceVisibility = 'hidden';

                          // 低性能设备额外优化
                          if (devicePerformance === 'low') {
                            danmu.$ref.style.transform = 'translateZ(0)'; // 强制硬件加速
                            danmu.$ref.classList.add('art-danmuku-optimized');
                          }
                        }

                        resolve(true);
                      });
                    },
                  };

                  // 根据设备性能调整核心配置
                  switch (devicePerformance) {
                    case 'high': // 高性能设备 - 完整功能
                      return {
                        ...baseConfig,
                        antiOverlap: true, // 开启防重叠
                        synchronousPlayback: true, // 保持弹幕与视频播放速度同步
                        useWorker: true, // v5.2.0: 启用Web Worker优化
                      };

                    case 'medium': // 中等性能设备 - 适度优化
                      return {
                        ...baseConfig,
                        antiOverlap: !isMobile, // 移动端关闭防重叠
                        synchronousPlayback: true, // 保持同步播放以确保体验一致
                        useWorker: true, // v5.2.0: 中等设备也启用Worker
                      };

                    case 'low': // 低性能设备 - 平衡优化
                      return {
                        ...baseConfig,
                        antiOverlap: false, // 关闭复杂的防重叠算法
                        synchronousPlayback: true, // 保持同步以确保体验，计算量不大
                        useWorker: true, // 开启Worker减少主线程负担
                        maxLength: 30, // v5.2.0优化: 减少弹幕数量是关键优化
                      };
                  }
                };

                const config = getOptimizedConfig();

                // 🎨 为低性能设备添加CSS硬件加速样式
                if (devicePerformance === 'low') {
                  // 创建CSS动画样式（硬件加速）
                  if (!document.getElementById('danmaku-performance-css')) {
                    const style = document.createElement('style');
                    style.id = 'danmaku-performance-css';
                    style.textContent = `
                  /* 🚀 硬件加速的弹幕优化 */
                  .art-danmuku-optimized {
                    will-change: transform !important;
                    backface-visibility: hidden !important;
                    transform: translateZ(0) !important;
                    transition: transform linear !important;
                  }
                `;
                    document.head.appendChild(style);
                    console.log('🎨 已加载CSS硬件加速优化');
                  }
                }

                return config;
              })(),
            ),
            // Chromecast 插件加载策略：
            // 只在 Chrome 浏览器中显示 Chromecast（排除 iOS Chrome）
            // Safari 和 iOS：不显示 Chromecast（用原生 AirPlay）
            // 其他浏览器：不显示 Chromecast（不支持 Cast API）
            ...(isChrome && !isIOS
              ? [
                  artplayerPluginChromecast({
                    onStateChange: (state) => {
                      console.log('Chromecast state changed:', state);
                    },
                    onCastAvailable: (available) => {
                      console.log('Chromecast available:', available);
                    },
                    onCastStart: () => {
                      console.log('Chromecast started');
                    },
                    onError: (error) => {
                      console.error('Chromecast error:', error);
                    },
                  }),
                ]
              : []),
            // 毛玻璃效果控制栏插件 - 现代化悬浮设计
            // CSS已优化：桌面98%宽度，移动端100%，按钮可自动缩小适应
            artplayerPluginLiquidGlass(),
            // 跳过设置插件 - 集成到播放器内部
            artplayerPluginSkipSettings(),
          ],
        });

        // 监听播放器事件
        artPlayerRef.current.on('ready', async () => {
          setError(null);

          // iOS设备自动播放优化：如果是静音启动的，在开始播放后恢复音量
          if ((isIOS || isSafari) && artPlayerRef.current.muted) {
            console.log('iOS设备静音自动播放，准备在播放开始后恢复音量');

            const handleFirstPlay = () => {
              setTimeout(() => {
                if (artPlayerRef.current?.muted) {
                  artPlayerRef.current.muted = false;
                  artPlayerRef.current.volume = lastVolumeRef.current || 0.7;
                  console.log(
                    'iOS设备已恢复音量:',
                    artPlayerRef.current.volume,
                  );
                }
              }, 500); // 延迟500ms确保播放稳定

              // 只执行一次
              artPlayerRef.current.off('video:play', handleFirstPlay);
            };

            artPlayerRef.current.on('video:play', handleFirstPlay);
          }

          // 播放器就绪后，立即根据外部弹幕开关状态设置弹幕控件的显示状态
          // 使用更短的超时时间，确保在弹幕控件创建后立即处理
          setTimeout(() => {
            const danmakuControls = document.querySelector(
              '.artplayer-plugin-danmuku',
            ) as HTMLElement;
            if (danmakuControls) {
              if (!externalDanmuEnabled) {
                // 立即隐藏弹幕控件
                danmakuControls.style.display = 'none';
              } else {
                // 确保弹幕控件可见
                danmakuControls.style.display = '';
                danmakuControls.style.visibility = 'visible';
                danmakuControls.style.opacity = '1';
              }
            }
          }, 50); // 减少延迟时间，从500ms改为50ms

          // 播放器就绪后，根据外部弹幕开关状态设置弹幕控件的初始显示状态
          const initDanmakuState = () => {
            const danmakuControls = document.querySelector(
              '.artplayer-plugin-danmuku',
            ) as HTMLElement;
            if (danmakuControls) {
              if (!externalDanmuEnabled) {
                // 隐藏整个弹幕控件
                danmakuControls.style.display = 'none';
              } else {
                // 确保弹幕控件可见
                danmakuControls.style.display = '';
                danmakuControls.style.visibility = 'visible';
                danmakuControls.style.opacity = '1';
              }
            } else {
              // 如果控件还没创建，稍后再试
              setTimeout(initDanmakuState, 50);
            }
          };
          initDanmakuState();

          // 播放器就绪后，加载外部弹幕数据

          setTimeout(async () => {
            try {
              const externalDanmu = await loadExternalDanmu(); // 这里会检查开关状态
              console.log('外部弹幕加载结果:', externalDanmu);

              if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
                if (externalDanmu.length > 0) {
                  console.log(
                    '向播放器插件加载弹幕数据:',
                    externalDanmu.length,
                    '条',
                  );
                  artPlayerRef.current.plugins.artplayerPluginDanmuku.load(
                    externalDanmu,
                  );
                  artPlayerRef.current.notice.show = `已加载 ${externalDanmu.length} 条弹幕`;
                } else {
                  console.log('没有弹幕数据可加载');
                  artPlayerRef.current.notice.show = '暂无弹幕数据';
                }
              } else {
                console.error('弹幕插件未找到');
              }
            } catch (error) {
              console.error('加载外部弹幕失败:', error);
            }
          }, 1000); // 延迟1秒确保插件完全初始化

          // 监听播放进度跳转，优化弹幕重置（减少闪烁）
          artPlayerRef.current.on('seek', () => {
            if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
              // 清除之前的重置计时器
              if (seekResetTimeoutRef.current) {
                clearTimeout(seekResetTimeoutRef.current);
              }

              // 增加延迟并只在非拖拽状态下重置，减少快进时的闪烁
              seekResetTimeoutRef.current = setTimeout(() => {
                if (
                  !isDraggingProgressRef.current &&
                  artPlayerRef.current?.plugins?.artplayerPluginDanmuku &&
                  !artPlayerRef.current.seeking
                ) {
                  artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
                  console.log('进度跳转，弹幕已重置');
                }
              }, 500); // 增加到500ms延迟，减少频繁重置导致的闪烁
            }
          });

          // 监听拖拽状态 - v5.2.0优化: 在拖拽期间暂停弹幕更新以减少闪烁
          artPlayerRef.current.on('video:seeking', () => {
            isDraggingProgressRef.current = true;
            // v5.2.0新增: 拖拽时隐藏弹幕，减少CPU占用和闪烁
            // 只有在外部弹幕开启且当前显示时才隐藏
            if (
              artPlayerRef.current?.plugins?.artplayerPluginDanmuku &&
              externalDanmuEnabledRef.current &&
              !artPlayerRef.current.plugins.artplayerPluginDanmuku.isHide
            ) {
              artPlayerRef.current.plugins.artplayerPluginDanmuku.hide();
            }
          });

          artPlayerRef.current.on('video:seeked', () => {
            isDraggingProgressRef.current = false;
            // v5.2.0优化: 拖拽结束后根据外部弹幕开关状态决定是否恢复弹幕显示
            if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
              // 只有在外部弹幕开启时才恢复显示
              if (externalDanmuEnabledRef.current) {
                artPlayerRef.current.plugins.artplayerPluginDanmuku.show(); // 先恢复显示
                setTimeout(() => {
                  // 延迟重置以确保播放状态稳定
                  if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
                    artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
                    console.log('拖拽结束，弹幕已重置');
                  }
                }, 100);
              } else {
                // 外部弹幕关闭时，确保保持隐藏状态
                artPlayerRef.current.plugins.artplayerPluginDanmuku.hide();
                console.log('拖拽结束，外部弹幕已关闭，保持隐藏状态');
              }
            }
          });

          // 监听播放器窗口尺寸变化，触发弹幕重置（双重保障）
          artPlayerRef.current.on('resize', () => {
            // 清除之前的重置计时器
            if (resizeResetTimeoutRef.current) {
              clearTimeout(resizeResetTimeoutRef.current);
            }

            // 延迟重置弹幕，避免连续触发（全屏切换优化）
            resizeResetTimeoutRef.current = setTimeout(() => {
              if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
                artPlayerRef.current.plugins.artplayerPluginDanmuku.reset();
                console.log('窗口尺寸变化，弹幕已重置（防抖优化）');
              }
            }, 300); // 300ms防抖，减少全屏切换时的卡顿
          });

          // 播放器就绪后，如果正在播放则请求 Wake Lock
          if (artPlayerRef.current && !artPlayerRef.current.paused) {
            requestWakeLock();
          }
        });

        // 监听播放状态变化，控制 Wake Lock
        artPlayerRef.current.on('play', () => {
          requestWakeLock();
        });

        artPlayerRef.current.on('pause', () => {
          releaseWakeLock();
          saveCurrentPlayProgress();
        });

        artPlayerRef.current.on('video:ended', () => {
          releaseWakeLock();
        });

        // 如果播放器初始化时已经在播放状态，则请求 Wake Lock
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }

        artPlayerRef.current.on('video:volumechange', () => {
          lastVolumeRef.current = artPlayerRef.current.volume;
        });
        artPlayerRef.current.on('video:ratechange', () => {
          lastPlaybackRateRef.current = artPlayerRef.current.playbackRate;
        });

        // 监听视频可播放事件，这时恢复播放进度更可靠
        artPlayerRef.current.on('video:canplay', () => {
          // 若存在需要恢复的播放进度，则跳转
          if (resumeTimeRef.current && resumeTimeRef.current > 0) {
            try {
              const duration = artPlayerRef.current.duration || 0;
              let target = resumeTimeRef.current;
              if (duration && target >= duration - 2) {
                target = Math.max(0, duration - 5);
              }
              artPlayerRef.current.currentTime = target;
              console.log('成功恢复播放进度到:', resumeTimeRef.current);
            } catch (err) {
              console.warn('恢复播放进度失败:', err);
            }
          }
          resumeTimeRef.current = null;

          // iOS设备自动播放回退机制：如果自动播放失败，尝试用户交互触发播放
          if ((isIOS || isSafari) && artPlayerRef.current.paused) {
            console.log('iOS设备检测到视频未自动播放，准备交互触发机制');

            const tryAutoPlay = async () => {
              try {
                // 多重尝试策略
                let playAttempts = 0;
                const maxAttempts = 3;

                const attemptPlay = async (): Promise<boolean> => {
                  playAttempts++;
                  console.log(`iOS自动播放尝试 ${playAttempts}/${maxAttempts}`);

                  try {
                    await artPlayerRef.current.play();
                    console.log('iOS设备自动播放成功');
                    return true;
                  } catch (playError: any) {
                    console.log(
                      `播放尝试 ${playAttempts} 失败:`,
                      playError.name,
                    );

                    // 根据错误类型采用不同策略
                    if (playError.name === 'NotAllowedError') {
                      // 用户交互需求错误 - 最常见
                      if (playAttempts < maxAttempts) {
                        // 尝试降低音量再播放
                        artPlayerRef.current.volume = 0.1;
                        await new Promise((resolve) =>
                          setTimeout(resolve, 200),
                        );
                        return attemptPlay();
                      }
                      return false;
                    } else if (playError.name === 'AbortError') {
                      // 播放被中断 - 等待后重试
                      if (playAttempts < maxAttempts) {
                        await new Promise((resolve) =>
                          setTimeout(resolve, 500),
                        );
                        return attemptPlay();
                      }
                      return false;
                    }
                    return false;
                  }
                };

                const success = await attemptPlay();

                if (!success) {
                  console.log(
                    'iOS设备需要用户交互才能播放，这是正常的浏览器行为',
                  );
                  // 显示友好的播放提示
                  if (artPlayerRef.current) {
                    artPlayerRef.current.notice.show = '轻触播放按钮开始观看';

                    // 添加一次性点击监听器用于首次播放
                    let hasHandledFirstInteraction = false;
                    const handleFirstUserInteraction = async () => {
                      if (hasHandledFirstInteraction) {
                        return;
                      }
                      hasHandledFirstInteraction = true;

                      try {
                        await artPlayerRef.current.play();
                        // 首次成功播放后恢复正常音量
                        setTimeout(() => {
                          if (
                            artPlayerRef.current &&
                            !artPlayerRef.current.muted
                          ) {
                            artPlayerRef.current.volume =
                              lastVolumeRef.current || 0.7;
                          }
                        }, 1000);
                      } catch (error) {
                        console.warn('用户交互播放失败:', error);
                      }

                      // 移除监听器
                      artPlayerRef.current?.off(
                        'video:play',
                        handleFirstUserInteraction,
                      );
                      document.removeEventListener(
                        'click',
                        handleFirstUserInteraction,
                      );
                    };

                    // 监听播放事件和点击事件
                    artPlayerRef.current.on(
                      'video:play',
                      handleFirstUserInteraction,
                    );
                    document.addEventListener(
                      'click',
                      handleFirstUserInteraction,
                    );
                  }
                }
              } catch (error) {
                console.warn('自动播放回退机制执行失败:', error);
              }
            };

            // 延迟尝试，避免与进度恢复冲突
            setTimeout(tryAutoPlay, 200);
          }

          setTimeout(() => {
            if (
              Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) >
              0.01
            ) {
              artPlayerRef.current.volume = lastVolumeRef.current;
            }
            if (
              Math.abs(
                artPlayerRef.current.playbackRate - lastPlaybackRateRef.current,
              ) > 0.01 &&
              isWebKit
            ) {
              artPlayerRef.current.playbackRate = lastPlaybackRateRef.current;
            }
            artPlayerRef.current.notice.show = '';
          }, 0);

          // 隐藏换源加载状态
          setIsVideoLoading(false);

          // 🔥 重置集数切换标识（播放器成功创建后）
          if (isEpisodeChangingRef.current) {
            isEpisodeChangingRef.current = false;
          }
        });

        // 监听播放器错误
        artPlayerRef.current.on('error', (err: any) => {
          console.error('播放器错误:', err);
          if (artPlayerRef.current.currentTime > 0) {
            return;
          }
        });

        // 监听视频播放结束事件，自动播放下一集
        artPlayerRef.current.on('video:ended', () => {
          const d = detailRef.current;
          const idx = currentEpisodeIndexRef.current;
          if (d && d.episodes && idx < d.episodes.length - 1) {
            setTimeout(() => {
              setCurrentEpisodeIndex(idx + 1);
            }, 1000);
          }
        });

        // 合并的timeupdate监听器 - 处理跳过片头片尾和保存进度
        artPlayerRef.current.on('video:timeupdate', () => {
          const currentTime = artPlayerRef.current.currentTime || 0;
          const duration = artPlayerRef.current.duration || 0;
          const _now = performance.now(); // 使用performance.now()更精确

          // 防抖更新播放时间信息 - 减少不必要的渲染
          if (timeUpdateTimeoutRef.current) {
            clearTimeout(timeUpdateTimeoutRef.current);
          }
          timeUpdateTimeoutRef.current = setTimeout(() => {
            setCurrentPlayTime(currentTime);
            setVideoDuration(duration);
          }, 500); // 500ms 防抖

          // 保存播放进度逻辑 - 优化所有存储类型的保存间隔
          const saveNow = Date.now();
          // upstash需要更长间隔避免频率限制，其他存储类型也适当降低频率减少性能开销
          const interval =
            process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash' ? 20000 : 10000; // 统一提高到10秒

          if (saveNow - lastSaveTimeRef.current > interval) {
            saveCurrentPlayProgress();
            lastSaveTimeRef.current = saveNow;
          }
        });

        artPlayerRef.current.on('pause', () => {
          saveCurrentPlayProgress();
        });

        if (artPlayerRef.current?.video) {
          ensureVideoSource(
            artPlayerRef.current.video as HTMLVideoElement,
            videoUrl,
          );
        }
      } catch (err) {
        console.error('创建播放器失败:', err);
        // 重置集数切换标识
        isEpisodeChangingRef.current = false;
        setError('播放器初始化失败');
      }
    }; // 结束 initPlayer 函数

    // 动态导入 ArtPlayer 并初始化
    const loadAndInit = async () => {
      try {
        const [{ default: Artplayer }, { default: artplayerPluginDanmuku }] =
          await Promise.all([
            import('artplayer'),
            import('artplayer-plugin-danmuku'),
          ]);

        // 将导入的模块设置为全局变量供 initPlayer 使用
        (window as any).DynamicArtplayer = Artplayer;
        (window as any).DynamicArtplayerPluginDanmuku = artplayerPluginDanmuku;

        await initPlayer();
      } catch (error) {
        console.error('动态导入 ArtPlayer 失败:', error);
        setError('播放器加载失败');
      }
    };

    loadAndInit();
  }, [Hls, videoUrl, loading, blockAdEnabled]);

  /**
   * 当组件卸载时清理定时器、Wake Lock 和播放器资源
   */
  useEffect(() => {
    return () => {
      // 清理定时器
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }

      // 清理弹幕重置定时器
      if (seekResetTimeoutRef.current) {
        clearTimeout(seekResetTimeoutRef.current);
      }

      // 清理resize防抖定时器
      if (resizeResetTimeoutRef.current) {
        clearTimeout(resizeResetTimeoutRef.current);
      }

      // 释放 Wake Lock
      releaseWakeLock();

      // 销毁播放器实例
      cleanupPlayer();
    };
  }, []);

  if (loading) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画影院图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>
                  {loadingStage === 'searching' && '🔍'}
                  {loadingStage === 'preferring' && '⚡'}
                  {loadingStage === 'fetching' && '🎬'}
                  {loadingStage === 'ready' && '✨'}
                </div>
                {/* 旋转光环 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>

              {/* 浮动粒子效果 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-80 mx-auto'>
              <div className='flex justify-center space-x-2 mb-4'>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'searching' || loadingStage === 'fetching'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'preferring' ||
                          loadingStage === 'ready'
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'preferring'
                      ? 'bg-green-500 scale-125'
                      : loadingStage === 'ready'
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                  }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    loadingStage === 'ready'
                      ? 'bg-green-500 scale-125'
                      : 'bg-gray-300'
                  }`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width:
                      loadingStage === 'searching' ||
                      loadingStage === 'fetching'
                        ? '33%'
                        : loadingStage === 'preferring'
                          ? '66%'
                          : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 错误图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>😵</div>
                {/* 脉冲效果 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-20 animate-pulse'></div>
              </div>

              {/* 浮动错误粒子 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-red-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-yellow-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-4 mb-8'>
              <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
                哎呀，出现了一些问题
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                <p className='text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                请检查网络连接或尝试刷新页面
              </p>
            </div>

            {/* 操作按钮 */}
            <div className='space-y-3'>
              <button
                onClick={() =>
                  videoTitle
                    ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                    : router.back()
                }
                className='w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl'
              >
                {videoTitle ? '🔍 返回搜索' : '← 返回上页'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className='w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200'
              >
                🔄 重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col -mt-4 lg:-mt-6 pt-2'>
        {/* 第一行：影片标题 */}
        <div>
          <h1 className='text-xl font-semibold text-gray-800 dark:text-gray-200'>
            {videoTitle || '影片标题'}
            {totalEpisodes > 1 && (
              <span className='text-gray-600 dark:text-gray-400'>
                {` > ${
                  detail?.episodes_titles?.[currentEpisodeIndex] ||
                  `第 ${currentEpisodeIndex + 1} 集`
                }`}
              </span>
            )}
          </h1>
        </div>
        {/* 第二行：播放器和选集 */}
        <div className='space-y-2'>
          {/* 折叠控制 */}
          <div className='flex justify-end items-center'>
            {/* 折叠控制按钮 - 仅在 lg 及以上屏幕显示 */}
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='hidden lg:flex group relative items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${
                  isEpisodeSelectorCollapsed
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              ></div>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${
                isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
              }`}
            >
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'
                ></div>

                {/* SkipController 组件 */}
                {currentSource && currentId && detail?.title && (
                  <SkipController
                    source={currentSource}
                    id={currentId}
                    episodeIndex={currentEpisodeIndex}
                    artPlayerRef={artPlayerRef}
                    currentTime={currentPlayTime}
                    duration={videoDuration}
                    onNextEpisode={handleNextEpisode}
                  />
                )}

                {/* 换源加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 动画影院图标 */}
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>🎬</div>
                          {/* 旋转光环 */}
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>

                        {/* 浮动粒子效果 */}
                        <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                          <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                          <div
                            className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                            style={{ animationDelay: '0.5s' }}
                          ></div>
                          <div
                            className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                            style={{ animationDelay: '1s' }}
                          ></div>
                        </div>
                      </div>

                      {/* 换源消息 */}
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>
                          {videoLoadingStage === 'sourceChanging'
                            ? '🔄 切换播放源...'
                            : '🔄 视频加载中...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${
                isEpisodeSelectorCollapsed
                  ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                  : 'md:col-span-1 lg:opacity-100 lg:scale-100'
              }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
              />
            </div>
          </div>
        </div>

        {/* 详情展示 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          {/* 文字区 */}
          <div className='md:col-span-3'>
            <div className='p-6 flex flex-col min-h-0'>
              {/* 标题 */}
              <h1 className='text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0 text-center md:text-left w-full text-gray-800 dark:text-gray-100'>
                {videoTitle || '影片标题'}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                  className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity'
                >
                  <FavoriteIcon filled={favorited} />
                </button>

                {/* 网盘资源提示按钮 */}
                {menuSettings.showNetDiskSearch && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 触发网盘搜索（如果还没搜索过）
                      if (!netdiskResults && !netdiskLoading && videoTitle) {
                        handleNetDiskSearch(videoTitle);
                      }
                      // 滚动到网盘区域
                      setTimeout(() => {
                        const element =
                          document.getElementById('netdisk-section');
                        if (element) {
                          element.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }
                      }, 100);
                    }}
                    className='ml-3 flex-shrink-0 hover:opacity-90 transition-all duration-200 hover:scale-105'
                  >
                    <div className='flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-md'>
                      📁
                      {netdiskLoading ? (
                        <span className='flex items-center gap-1'>
                          <span className='inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                          搜索中...
                        </span>
                      ) : netdiskTotal > 0 ? (
                        <span>{netdiskTotal}个网盘资源</span>
                      ) : (
                        <span>网盘资源</span>
                      )}
                    </div>
                  </button>
                )}
              </h1>

              {/* 关键信息行 */}
              <div className='flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0'>
                {detail?.class && String(detail.class) !== '0' && (
                  <span className='text-green-600 font-semibold bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded'>
                    {detail.class}
                  </span>
                )}
                {(detail?.year || videoYear) && (
                  <span className='text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/30 px-2 py-0.5 rounded'>
                    {detail?.year || videoYear}
                  </span>
                )}
                {detail?.source_name && (
                  <span className='border border-blue-500/60 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded'>
                    {detail.source_name}
                  </span>
                )}
                {detail?.type_name && (
                  <span className='text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded'>
                    {detail.type_name}
                  </span>
                )}
              </div>

              {/* 详细信息（豆瓣或bangumi） */}
              {currentSource !== 'shortdrama' &&
                videoDoubanId !== 0 &&
                detail &&
                detail.source !== 'shortdrama' && (
                  <div className='mb-4 flex-shrink-0'>
                    {/* 加载状态 */}
                    {(loadingMovieDetails || loadingBangumiDetails) &&
                      !movieDetails &&
                      !bangumiDetails && (
                        <div className='animate-pulse'>
                          <div className='h-4 bg-gray-300 rounded w-64 mb-2'></div>
                          <div className='h-4 bg-gray-300 rounded w-48'></div>
                        </div>
                      )}

                    {/* Bangumi详情 */}
                    {bangumiDetails && (
                      <div className='space-y-2 text-sm'>
                        {/* Bangumi评分 */}
                        {bangumiDetails.rating?.score &&
                          parseFloat(bangumiDetails.rating.score) > 0 && (
                            <div className='flex items-center gap-2'>
                              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                Bangumi评分:{' '}
                              </span>
                              <div className='flex items-center'>
                                <span className='text-yellow-600 dark:text-yellow-400 font-bold text-base'>
                                  {bangumiDetails.rating.score}
                                </span>
                                <div className='flex ml-1'>
                                  {[...Array(5)].map((_, i) => (
                                    <svg
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i <
                                        Math.floor(
                                          parseFloat(
                                            bangumiDetails.rating.score,
                                          ) / 2,
                                        )
                                          ? 'text-yellow-500'
                                          : 'text-gray-300 dark:text-gray-600'
                                      }`}
                                      fill='currentColor'
                                      viewBox='0 0 20 20'
                                    >
                                      <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                    </svg>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* 制作信息从infobox提取 */}
                        {bangumiDetails.infobox?.map(
                          (info: any, index: number) => {
                            if (info.key === '导演' && info.value) {
                              const directors = Array.isArray(info.value)
                                ? info.value
                                    .map((v: any) => v.v || v)
                                    .join('、')
                                : info.value;
                              return (
                                <div key={index}>
                                  <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                    导演:{' '}
                                  </span>
                                  <span className='text-gray-600 dark:text-gray-400'>
                                    {directors}
                                  </span>
                                </div>
                              );
                            }
                            if (info.key === '制作' && info.value) {
                              const studios = Array.isArray(info.value)
                                ? info.value
                                    .map((v: any) => v.v || v)
                                    .join('、')
                                : info.value;
                              return (
                                <div key={index}>
                                  <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                    制作:{' '}
                                  </span>
                                  <span className='text-gray-600 dark:text-gray-400'>
                                    {studios}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          },
                        )}

                        {/* 播出日期 */}
                        {bangumiDetails.date && (
                          <div>
                            <span className='font-semibold text-gray-700 dark:text-gray-300'>
                              播出日期:{' '}
                            </span>
                            <span className='text-gray-600 dark:text-gray-400'>
                              {bangumiDetails.date}
                            </span>
                          </div>
                        )}

                        {/* 标签信息 */}
                        <div className='flex flex-wrap gap-2 mt-3'>
                          {bangumiDetails.tags
                            ?.slice(0, 4)
                            .map((tag: any, index: number) => (
                              <span
                                key={index}
                                className='bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs'
                              >
                                {tag.name}
                              </span>
                            ))}
                          {bangumiDetails.total_episodes && (
                            <span className='bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs'>
                              共{bangumiDetails.total_episodes}话
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 豆瓣详情 */}
                    {movieDetails && (
                      <div className='space-y-2 text-sm'>
                        {/* 豆瓣评分 */}
                        {movieDetails.rate &&
                          movieDetails.rate !== '0' &&
                          parseFloat(movieDetails.rate) > 0 && (
                            <div className='flex items-center gap-2'>
                              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                豆瓣评分:{' '}
                              </span>
                              <div className='flex items-center'>
                                <span className='text-yellow-600 dark:text-yellow-400 font-bold text-base'>
                                  {movieDetails.rate}
                                </span>
                                <div className='flex ml-1'>
                                  {[...Array(5)].map((_, i) => (
                                    <svg
                                      key={i}
                                      className={`w-3 h-3 ${
                                        i <
                                        Math.floor(
                                          parseFloat(movieDetails.rate) / 2,
                                        )
                                          ? 'text-yellow-500'
                                          : 'text-gray-300 dark:text-gray-600'
                                      }`}
                                      fill='currentColor'
                                      viewBox='0 0 20 20'
                                    >
                                      <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                    </svg>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* 导演 */}
                        {movieDetails.directors &&
                          movieDetails.directors.length > 0 && (
                            <div>
                              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                导演:{' '}
                              </span>
                              <span className='text-gray-600 dark:text-gray-400'>
                                {movieDetails.directors.join('、')}
                              </span>
                            </div>
                          )}

                        {/* 编剧 */}
                        {movieDetails.screenwriters &&
                          movieDetails.screenwriters.length > 0 && (
                            <div>
                              <span className='font-semibold text-gray-700 dark:text-gray-300'>
                                编剧:{' '}
                              </span>
                              <span className='text-gray-600 dark:text-gray-400'>
                                {movieDetails.screenwriters.join('、')}
                              </span>
                            </div>
                          )}

                        {/* 主演 */}
                        {movieDetails.cast && movieDetails.cast.length > 0 && (
                          <div>
                            <span className='font-semibold text-gray-700 dark:text-gray-300'>
                              主演:{' '}
                            </span>
                            <span className='text-gray-600 dark:text-gray-400'>
                              {movieDetails.cast.join('、')}
                            </span>
                          </div>
                        )}

                        {/* 首播日期 */}
                        {movieDetails.first_aired && (
                          <div>
                            <span className='font-semibold text-gray-700 dark:text-gray-300'>
                              {movieDetails.episodes ? '首播' : '上映'}:
                            </span>
                            <span className='text-gray-600 dark:text-gray-400'>
                              {movieDetails.first_aired}
                            </span>
                          </div>
                        )}

                        {/* 标签信息 */}
                        <div className='flex flex-wrap gap-2 mt-3'>
                          {movieDetails.countries
                            ?.slice(0, 2)
                            .map((country: string, index: number) => (
                              <span
                                key={index}
                                className='bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs'
                              >
                                {country}
                              </span>
                            ))}
                          {movieDetails.languages
                            ?.slice(0, 2)
                            .map((language: string, index: number) => (
                              <span
                                key={index}
                                className='bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full text-xs'
                              >
                                {language}
                              </span>
                            ))}
                          {movieDetails.episodes && (
                            <span className='bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs'>
                              共{movieDetails.episodes}集
                            </span>
                          )}
                          {movieDetails.episode_length && (
                            <span className='bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full text-xs'>
                              单集{movieDetails.episode_length}分钟
                            </span>
                          )}
                          {movieDetails.movie_duration && (
                            <span className='bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full text-xs'>
                              {movieDetails.movie_duration}分钟
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              {/* 剧情简介 */}
              {(movieDetails?.plot_summary ||
                detail?.desc ||
                bangumiDetails?.summary) && (
                <div
                  className='mt-0 text-base leading-relaxed text-gray-700 dark:text-gray-300 opacity-90 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide bg-white/60 dark:bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm'
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {movieDetails?.plot_summary ||
                    bangumiDetails?.summary ||
                    detail?.desc}
                </div>
              )}

              {/* 网盘资源区域 */}
              {menuSettings.showNetDiskSearch && (
                <div id='netdisk-section' className='mt-6'>
                  <div className='border-t border-gray-200 dark:border-gray-700 pt-6'>
                    <div className='mb-4'>
                      <h3 className='text-xl font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2'>
                        📁 网盘资源
                        {netdiskLoading && (
                          <span className='inline-block align-middle'>
                            <span className='inline-block h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin'></span>
                          </span>
                        )}
                        {netdiskTotal > 0 && (
                          <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'>
                            {netdiskTotal} 个资源
                          </span>
                        )}
                      </h3>
                      {videoTitle && !netdiskLoading && !netdiskResults && (
                        <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
                          点击上方"📁 网盘资源"按钮开始搜索
                        </p>
                      )}
                      {videoTitle &&
                        !netdiskLoading &&
                        (netdiskResults || netdiskError) && (
                          <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
                            搜索关键词：{videoTitle}
                          </p>
                        )}
                    </div>

                    <NetDiskSearchResults
                      results={netdiskResults}
                      loading={netdiskLoading}
                      error={netdiskError}
                      total={netdiskTotal}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 封面展示 */}
          <div className='hidden md:block md:col-span-1 md:order-first'>
            <div className='pl-0 py-4 pr-6'>
              <div className='relative bg-gray-300 dark:bg-gray-700 aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
                {bangumiDetails?.images?.large || videoCover ? (
                  <>
                    {/* 渐变光泽动画层 */}
                    <div
                      className='absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10'
                      style={{
                        background:
                          'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 55%, transparent 70%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 2.5s ease-in-out infinite',
                      }}
                    />

                    <img
                      src={processImageUrl(
                        bangumiDetails?.images?.large || videoCover,
                      )}
                      alt={videoTitle}
                      className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
                    />

                    {/* 链接按钮（bangumi或豆瓣） */}
                    {videoDoubanId !== 0 && (
                      <a
                        href={
                          bangumiDetails
                            ? `https://bgm.tv/subject/${videoDoubanId.toString()}`
                            : `https://movie.douban.com/subject/${videoDoubanId.toString()}`
                        }
                        target='_blank'
                        rel='noopener noreferrer'
                        className='absolute top-3 left-3'
                      >
                        <div
                          className={`${
                            bangumiDetails
                              ? 'bg-pink-500 hover:bg-pink-600'
                              : 'bg-green-500 hover:bg-green-600'
                          } text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-[1.1] transition-all duration-300 ease-out`}
                        >
                          <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          >
                            <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path>
                            <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path>
                          </svg>
                        </div>
                      </a>
                    )}
                  </>
                ) : (
                  <span className='text-gray-600 dark:text-gray-400'>
                    封面图片
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 侧边工具栏 */}
      <div className='fixed bottom-20 md:bottom-6 right-6 z-[500] flex flex-col-reverse gap-3'>
        <BackToTopButton />
      </div>
    </PageLayout>
  );
} // PlayPageClient 结束

/**
 * 播放页面组件
 */
export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
