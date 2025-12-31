import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

// TMDB API 配置
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// 缓存时长配置
const TRENDING_CACHE_DURATION = 30 * 60; // 30分钟缓存（热门内容）
const SEARCH_CACHE_DURATION = 24 * 60 * 60; // 24小时缓存（搜索结果）

/**
 * 获取TMDB热门内容的第一张横屏海报
 */
async function getTMDBPoster(
  category: 'movie' | 'tv',
  apiKey: string,
  language: string = 'zh-CN',
) {
  const cacheKey = `trending:${category}-${language}`;

  try {
    // 检查缓存
    const cached = await db.getCache(cacheKey);
    if (cached) {
      console.log(`[TMDB海报API] 缓存命中: ${category}`);
      return cached;
    }

    console.log(`[TMDB海报API] 获取${category}热门内容...`);

    // 获取热门内容
    const trendingUrl = `${TMDB_BASE_URL}/trending/${category}/week`;
    const response = await fetch(
      `${trendingUrl}?api_key=${apiKey}&language=${language}&page=1`,
    );

    if (!response.ok) {
      throw new Error(`TMDB API错误: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`没有找到${category}内容`);
    }

    // 获取第一个有backdrop_path的内容
    const firstItemWithBackdrop = data.results.find(
      (item: any) => item.backdrop_path,
    );

    if (!firstItemWithBackdrop) {
      throw new Error(`没有找到${category}内容的横屏海报`);
    }

    const posterData = {
      id: firstItemWithBackdrop.id,
      title:
        category === 'movie'
          ? firstItemWithBackdrop.title
          : firstItemWithBackdrop.name,
      backdrop: `https://image.tmdb.org/t/p/original${firstItemWithBackdrop.backdrop_path}`,
      poster: firstItemWithBackdrop.poster_path
        ? `https://image.tmdb.org/t/p/w780${firstItemWithBackdrop.poster_path}`
        : '',
      rate: firstItemWithBackdrop.vote_average?.toFixed(1) || '',
      year:
        category === 'movie'
          ? firstItemWithBackdrop.release_date?.split('-')[0] || ''
          : firstItemWithBackdrop.first_air_date?.split('-')[0] || '',
      category: category === 'movie' ? '电影' : '剧集',
      overview: firstItemWithBackdrop.overview || '',
    };

    // 缓存结果到统一存储系统
    await db.setCache(cacheKey, posterData, TRENDING_CACHE_DURATION);
    console.log(`[TMDB海报API] 成功获取${category}海报并缓存到统一存储`);

    return posterData;
  } catch (error) {
    console.error(`[TMDB海报API] 获取${category}海报失败:`, error);
    throw error;
  }
}

/**
 * 按名称搜索TMDB内容的海报
 */
async function searchTMDBPoster(
  title: string,
  category: 'movie' | 'tv',
  apiKey: string,
  language: string = 'zh-CN',
  year?: string,
) {
  // 创建缓存键，包含标题、分类、年份和语言
  const cacheKey = `search:${category}-${title}-${year || 'no-year'}-${language}`;

  try {
    // 检查缓存
    const cached = await db.getCache(cacheKey);
    if (cached) {
      console.log(`[TMDB海报API] 搜索缓存命中: ${title} (${category})`);
      return cached;
    }

    console.log(`[TMDB海报API] 搜索${category}: ${title}`);

    // 构建搜索查询
    const searchUrl = `${TMDB_BASE_URL}/search/${category}`;
    const searchParams = new URLSearchParams({
      api_key: apiKey,
      language: language,
      query: title,
      page: '1',
    });

    // 如果有年份，添加到搜索参数中
    if (year && year.length === 4) {
      searchParams.append('year', year);
    }

    const response = await fetch(`${searchUrl}?${searchParams}`);

    if (!response.ok) {
      throw new Error(`TMDB搜索API错误: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log(`[TMDB海报API] 没有找到匹配的${category}: ${title}`);
      return null;
    }

    // 优先选择有backdrop_path的结果
    let bestMatch = data.results.find((item: any) => item.backdrop_path);

    // 如果没有backdrop_path，选择第一个结果
    if (!bestMatch) {
      bestMatch = data.results[0];
    }

    const posterData = {
      id: bestMatch.id,
      title: category === 'movie' ? bestMatch.title : bestMatch.name,
      backdrop: bestMatch.backdrop_path
        ? `https://image.tmdb.org/t/p/original${bestMatch.backdrop_path}`
        : '',
      poster: bestMatch.poster_path
        ? `https://image.tmdb.org/t/p/w1280${bestMatch.poster_path}`
        : '', // 提升到1280px
      rate: bestMatch.vote_average?.toFixed(1) || '',
      year:
        category === 'movie'
          ? bestMatch.release_date?.split('-')[0] || ''
          : bestMatch.first_air_date?.split('-')[0] || '',
      category: category === 'movie' ? '剧集' : '电影',
      overview: bestMatch.overview || '',
    };

    // 缓存结果到统一存储系统 - 24小时
    await db.setCache(cacheKey, posterData, SEARCH_CACHE_DURATION);
    console.log(
      `[TMDB海报API] 成功搜索${category}海报并缓存到统一存储: ${title}`,
    );

    return posterData;
  } catch (error) {
    console.error(`[TMDB海报API] 搜索${category}海报失败: ${title}`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[TMDB海报API] 开始处理请求');
    console.log('[TMDB海报API] 获取配置中...');

    // 检查TMDB是否启用
    const config = await getConfig();
    console.log('[TMDB海报API] 配置获取完成，SiteConfig:', {
      TMDBApiKey: config.SiteConfig?.TMDBApiKey ? '已配置' : '未配置',
      TMDBLanguage: config.SiteConfig?.TMDBLanguage,
      EnableTMDBActorSearch: config.SiteConfig?.EnableTMDBActorSearch,
      EnableTMDBPosters: config.SiteConfig?.EnableTMDBPosters,
    });

    if (!config.SiteConfig?.TMDBApiKey) {
      console.log('[TMDB海报API] TMDB API Key 未配置');
      return NextResponse.json(
        {
          error: 'TMDB API Key 未配置',
          message: '请在管理后台配置TMDB API Key',
        },
        { status: 400 },
      );
    }

    // 检查TMDB横屏海报功能是否启用
    if (!config.SiteConfig.EnableTMDBPosters) {
      console.log(
        '[TMDB海报API] TMDB横屏海报功能未启用，当前值:',
        config.SiteConfig.EnableTMDBPosters,
      );
      return NextResponse.json(
        {
          error: 'TMDB横屏海报功能未启用',
          message: '请在管理后台启用TMDB横屏海报功能',
          debug: {
            EnableTMDBPosters: config.SiteConfig.EnableTMDBPosters,
            allConfig: Object.keys(config.SiteConfig || {}),
          },
        },
        { status: 403 },
      );
    }

    console.log('[TMDB海报API] TMDB横屏海报功能已启用，继续处理...');

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const category =
      (searchParams.get('category') as 'movie' | 'tv') || 'movie';
    const language =
      searchParams.get('language') || config.SiteConfig.TMDBLanguage || 'zh-CN';
    const searchTitle = searchParams.get('title'); // 新增：搜索标题
    const searchYear = searchParams.get('year'); // 新增：搜索年份

    // 验证分类参数
    if (!['movie', 'tv'].includes(category)) {
      return NextResponse.json(
        {
          error: '无效的分类参数',
          message: '分类只能是 movie 或 tv',
        },
        { status: 400 },
      );
    }

    let posterData;

    // 如果提供了标题，进行搜索；否则获取热门内容
    if (searchTitle && searchTitle.trim()) {
      console.log(
        `[TMDB海报API] 搜索${category}: ${searchTitle} (${searchYear || '不限年份'})`,
      );
      posterData = await searchTMDBPoster(
        searchTitle.trim(),
        category,
        config.SiteConfig.TMDBApiKey,
        language,
        searchYear || undefined,
      );

      if (!posterData) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到匹配内容',
            message: `没有找到标题为"${searchTitle}"的${category === 'movie' ? '电影' : '剧集'}`,
          },
          { status: 404 },
        );
      }
    } else {
      console.log(`[TMDB海报API] 获取${category}热门海报，语言: ${language}`);
      posterData = await getTMDBPoster(
        category,
        config.SiteConfig.TMDBApiKey,
        language,
      );
    }

    return NextResponse.json({
      success: true,
      data: posterData,
      message: searchTitle
        ? `成功搜索${category}海报: ${searchTitle}`
        : `成功获取${category}海报`,
    });
  } catch (error) {
    console.error('[TMDB海报API] 请求处理失败:', error);
    return NextResponse.json(
      {
        error: '获取海报失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  }
}
