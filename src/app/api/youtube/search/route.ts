import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, hasSpecialFeaturePermission } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// YouTube Data API v3 配置
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// 内容类型到搜索关键词的映射
const getContentTypeQuery = (
  originalQuery: string,
  contentType: string,
): string => {
  if (contentType === 'all') return originalQuery;

  const typeKeywords = {
    music: ['music', 'song', 'audio', 'MV', 'cover', 'live'],
    movie: ['movie', 'film', 'trailer', 'cinema', 'full movie'],
    educational: [
      'tutorial',
      'education',
      'learn',
      'how to',
      'guide',
      'course',
    ],
    gaming: ['gaming', 'gameplay', 'game', 'walkthrough', 'review'],
    sports: ['sports', 'football', 'basketball', 'soccer', 'match', 'game'],
    news: ['news', 'breaking', 'report', 'today', 'latest'],
  };

  const keywords = typeKeywords[contentType as keyof typeof typeKeywords] || [];
  if (keywords.length > 0) {
    // 随机选择一个关键词添加到搜索中
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    return `${originalQuery} ${randomKeyword}`;
  }

  return originalQuery;
};

// 模拟搜索数据（当没有真实API Key时使用）
const mockSearchResults = [
  {
    id: { videoId: 'dQw4w9WgXcQ' },
    snippet: {
      title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
      description:
        'The official video for "Never Gonna Give You Up" by Rick Astley',
      thumbnails: {
        medium: {
          url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          width: 320,
          height: 180,
        },
      },
      channelTitle: 'Rick Astley',
      publishedAt: '2009-10-25T06:57:33Z',
      channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
    },
  },
  {
    id: { videoId: '9bZkp7q19f0' },
    snippet: {
      title: 'PSY - GANGNAM STYLE(강남스타일) M/V',
      description: 'PSY - GANGNAM STYLE(강남스타일) M/V',
      thumbnails: {
        medium: {
          url: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg',
          width: 320,
          height: 180,
        },
      },
      channelTitle: 'officialpsy',
      publishedAt: '2012-07-15T08:34:21Z',
      channelId: 'UCrDkAvF9ZRMyvALrOFqOZ5A',
    },
  },
  {
    id: { videoId: 'kJQP7kiw5Fk' },
    snippet: {
      title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
      description: 'Luis Fonsi - Despacito ft. Daddy Yankee',
      thumbnails: {
        medium: {
          url: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
          width: 320,
          height: 180,
        },
      },
      channelTitle: 'LuisFonsiVEVO',
      publishedAt: '2017-01-12T19:06:32Z',
      channelId: 'UCAxjGjCSj8wLGhcMQTKgxNw',
    },
  },
  {
    id: { videoId: 'fJ9rUzIMcZQ' },
    snippet: {
      title: 'Queen – Bohemian Rhapsody (Official Video Remastered)',
      description: 'Queen – Bohemian Rhapsody (Official Video Remastered)',
      thumbnails: {
        medium: {
          url: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
          width: 320,
          height: 180,
        },
      },
      channelTitle: 'Queen Official',
      publishedAt: '2008-08-01T14:54:09Z',
      channelId: 'UCwK2Grm574W1u-sBzLikldQ',
    },
  },
];

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const username = authInfo.username;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const contentType = searchParams.get('contentType') || 'all';
  const order = searchParams.get('order') || 'relevance';

  if (!query) {
    return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });
  }

  try {
    // 获取YouTube配置
    const config = await getConfig();

    // 检查用户是否有YouTube搜索功能权限（传入已获取的配置避免重复调用）
    const hasPermission = await hasSpecialFeaturePermission(
      username,
      'youtube-search',
      config,
    );
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: '您无权使用YouTube搜索功能，请联系管理员开通权限',
        },
        {
          status: 403,
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            Expires: '0',
            Pragma: 'no-cache',
            'Surrogate-Control': 'no-store',
          },
        },
      );
    }
    const youtubeConfig = config.YouTubeConfig;

    // 检查YouTube功能是否启用
    if (!youtubeConfig?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube搜索功能未启用',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            Expires: '0',
            Pragma: 'no-cache',
            'Surrogate-Control': 'no-store',
          },
        },
      );
    }

    const maxResults = Math.min(
      parseInt(
        searchParams.get('maxResults') ||
          String(youtubeConfig.maxResults || 25),
      ),
      50,
    );

    // YouTube搜索缓存：60分钟（因为YouTube内容更新频率相对较低）
    const YOUTUBE_CACHE_TIME = 60 * 60; // 60分钟（秒）
    const enabledRegionsStr =
      (youtubeConfig.enabledRegions || []).sort().join(',') || 'none';
    const enabledCategoriesStr =
      (youtubeConfig.enabledCategories || []).sort().join(',') || 'none';
    // 缓存key包含功能状态、演示模式、最大结果数、内容类型、排序，确保配置变化时缓存隔离
    const cacheKey = `youtube-search-${youtubeConfig.enabled}-${
      youtubeConfig.enableDemo
    }-${maxResults}-${encodeURIComponent(
      query,
    )}-${contentType}-${order}-${enabledRegionsStr}-${enabledCategoriesStr}`;

    console.log(`🔍 检查YouTube搜索缓存: ${cacheKey}`);

    // 服务端直接调用数据库（不用ClientCache，避免HTTP循环调用）
    try {
      const cached = await db.getCache(cacheKey);
      if (cached) {
        console.log(`✅ YouTube搜索缓存命中(数据库): "${query}"`);
        return NextResponse.json({
          ...cached,
          fromCache: true,
          cacheSource: 'database',
          cacheTimestamp: new Date().toISOString(),
        });
      }

      console.log(`❌ YouTube搜索缓存未命中: "${query}"`);
    } catch (cacheError) {
      console.warn('YouTube搜索缓存读取失败:', cacheError);
      // 缓存失败不影响主流程，继续执行
    }

    // 如果启用演示模式或没有配置API Key，返回模拟数据
    if (youtubeConfig.enableDemo || !youtubeConfig.apiKey) {
      // 根据内容类型过滤模拟结果
      let filteredResults = [...mockSearchResults];

      if (contentType !== 'all') {
        // 简单的内容类型过滤逻辑（基于标题关键词）
        const typeFilters = {
          music: ['music', 'song', 'MV', 'audio'],
          movie: ['movie', 'film', 'video'],
          educational: ['tutorial', 'guide', 'how'],
          gaming: ['game', 'gaming'],
          sports: ['sports', 'match'],
          news: ['news', 'report'],
        };

        const filterKeywords =
          typeFilters[contentType as keyof typeof typeFilters] || [];
        if (filterKeywords.length > 0) {
          filteredResults = filteredResults.filter((video) =>
            filterKeywords.some((keyword) =>
              video.snippet.title.toLowerCase().includes(keyword),
            ),
          );
        }
      }

      const finalResults = filteredResults
        .slice(0, maxResults)
        .map((video) => ({
          ...video,
          snippet: {
            ...video.snippet,
            title: `${query} - ${video.snippet.title}`, // 模拟搜索匹配
          },
        }));

      const responseData = {
        success: true,
        videos: finalResults,
        total: finalResults.length,
        query: query,
        source: 'demo',
        warning: youtubeConfig.enableDemo
          ? '当前为演示模式，显示模拟数据'
          : 'API Key未配置，显示模拟数据。请在管理后台配置YouTube API Key以获取真实搜索结果',
      };

      // 服务端直接保存到数据库（不用ClientCache，避免HTTP循环调用）
      try {
        await db.setCache(cacheKey, responseData, YOUTUBE_CACHE_TIME);
        console.log(
          `💾 YouTube搜索演示结果已缓存(数据库): "${query}" - ${responseData.videos.length} 个结果, TTL: ${YOUTUBE_CACHE_TIME}s`,
        );
      } catch (cacheError) {
        console.warn('YouTube搜索缓存保存失败:', cacheError);
      }

      return NextResponse.json(responseData);
    }

    // 使用真实的YouTube API
    const enhancedQuery = getContentTypeQuery(query.trim(), contentType);
    const searchUrl =
      `${YOUTUBE_API_BASE}/search?` +
      `key=${youtubeConfig.apiKey}&` +
      `q=${encodeURIComponent(enhancedQuery)}&` +
      `part=snippet&` +
      `type=video&` +
      `maxResults=${maxResults}&` +
      `order=${order}`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      // 获取错误详细信息
      const errorData = await response.json().catch(() => ({}));
      console.log('YouTube API错误详情:', errorData);

      let errorMessage = '';

      // 检查具体的错误状态
      if (response.status === 400) {
        const reason = errorData.error?.errors?.[0]?.reason;
        const message = errorData.error?.message || '';

        if (reason === 'keyInvalid' || message.includes('API key not valid')) {
          errorMessage = 'YouTube API Key无效，请在管理后台检查配置';
        } else if (reason === 'badRequest') {
          if (message.includes('API key')) {
            errorMessage = 'YouTube API Key格式错误，请在管理后台重新配置';
          } else {
            errorMessage = `YouTube API请求参数错误: ${message}`;
          }
        } else {
          errorMessage = `YouTube API请求错误: ${message || 'Bad Request'}`;
        }
      } else if (response.status === 403) {
        const reason = errorData.error?.errors?.[0]?.reason;
        const message = errorData.error?.message || '';

        if (reason === 'quotaExceeded' || message.includes('quota')) {
          errorMessage = 'YouTube API配额已用完，请稍后重试';
        } else if (
          message.includes('not been used') ||
          message.includes('disabled')
        ) {
          errorMessage =
            'YouTube Data API v3未启用，请在Google Cloud Console中启用该API';
        } else if (
          message.includes('blocked') ||
          message.includes('restricted')
        ) {
          errorMessage =
            'API Key被限制访问，请检查Google Cloud Console中的API Key限制设置';
        } else {
          errorMessage = 'YouTube API访问被拒绝，请检查API Key权限配置';
        }
      } else if (response.status === 401) {
        errorMessage = 'YouTube API认证失败，请检查API Key是否正确';
      } else {
        errorMessage = `YouTube API请求失败 (${response.status})，请检查API Key配置`;
      }

      // 返回错误响应而不是抛出异常
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 400 },
      );
    }

    const data = await response.json();

    const responseData = {
      success: true,
      videos: data.items || [],
      total: data.pageInfo?.totalResults || 0,
      query: query,
      source: 'youtube',
    };

    // 服务端直接保存到数据库（不用ClientCache，避免HTTP循环调用）
    try {
      await db.setCache(cacheKey, responseData, YOUTUBE_CACHE_TIME);
      console.log(
        `💾 YouTube搜索API结果已缓存(数据库): "${query}" - ${responseData.videos.length} 个结果, TTL: ${YOUTUBE_CACHE_TIME}s`,
      );
    } catch (cacheError) {
      console.warn('YouTube搜索缓存保存失败:', cacheError);
    }

    console.log(
      `✅ YouTube搜索完成: "${query}" - ${responseData.videos.length} 个结果`,
    );
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('YouTube搜索失败:', error);

    // API失败时返回模拟数据作为备用
    const fallbackResults = mockSearchResults.slice(0, 10).map((video) => ({
      ...video,
      snippet: {
        ...video.snippet,
        title: `${query} - ${video.snippet.title}`,
      },
    }));

    const fallbackData = {
      success: true,
      videos: fallbackResults,
      total: fallbackResults.length,
      query: query,
      source: 'fallback',
    };

    // 失败情况的缓存时间设短一点，避免长时间缓存错误状态
    try {
      // 在catch块中重新构建简化的cacheKey
      const fallbackCacheKey = `youtube-search-fallback-${query}`;
      await db.setCache(fallbackCacheKey, fallbackData, 5 * 60); // 5分钟
      console.log(
        `💾 YouTube搜索备用结果已缓存(数据库): "${query}" - ${fallbackData.videos.length} 个结果, TTL: 5分钟`,
      );
    } catch (cacheError) {
      console.warn('YouTube搜索备用缓存保存失败:', cacheError);
    }

    return NextResponse.json(fallbackData);
  }
}
