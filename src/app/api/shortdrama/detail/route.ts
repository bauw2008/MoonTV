/* @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { parseShortDramaEpisode } from '@/lib/shortdrama.client';

// 标记为动态路由
export const dynamic = 'force-dynamic';

interface VideoDetailResponse {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  episodes_titles: string[];
  source: string;
  source_name: string;
  year: string;
  description?: string;
  desc?: string;
  type_name?: string;
  drama_name?: string;
  metadata?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const episode = searchParams.get('episode');
    const name = searchParams.get('name'); // 可选：用于备用API

    if (!id) {
      return NextResponse.json({ error: '缺少必要参数: id' }, { status: 400 });
    }

    const videoId = parseInt(id);
    const episodeNum = episode ? parseInt(episode) : 1;

    if (isNaN(videoId) || isNaN(episodeNum)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 读取配置以获取备用API地址
    let alternativeApiUrl: string | undefined;
    try {
      const config = await getConfig();
      const shortDramaConfig = config.ShortDramaConfig;
      alternativeApiUrl = shortDramaConfig?.enableAlternative
        ? shortDramaConfig.alternativeApiUrl
        : undefined;
    } catch (configError) {
      logger.error('读取短剧配置失败:', configError);
      // 配置读取失败时，不使用备用API
      alternativeApiUrl = undefined;
    }

    // 先尝试指定集数，如果提供了剧名且配置了备用API则自动fallback
    let result = await parseShortDramaEpisode(
      videoId,
      episodeNum,
      true,
      name || undefined,
      alternativeApiUrl,
    );

    // 如果失败，尝试其他集数（仅重试1次）
    if (result.code !== 0 || !result.data || !result.data.totalEpisodes) {
      result = await parseShortDramaEpisode(
        videoId,
        episodeNum === 1 ? 2 : 1,
        true,
        name || undefined,
        alternativeApiUrl,
      );
    }

    // 2次失败后不再重试，让播放器自己搜索资源
    if (result.code !== 0 || !result.data) {
      return NextResponse.json(
        { error: result.msg || '解析失败，请尝试其他播放源' },
        { status: 400 },
      );
    }

    const totalEpisodes = Math.max(result.data.totalEpisodes || 1, 1);

    // 转换为兼容格式
    // 注意：始终使用请求的原始ID（主API的ID），不使用result.data.videoId（可能是备用API的ID）
    const response: VideoDetailResponse = {
      id: id, // 使用原始请求ID，保持一致性
      title: result.data.videoName,
      poster: result.data.cover,
      episodes: Array.from(
        { length: totalEpisodes },
        (_, i) => `shortdrama:${id}:${i}`, // 使用原始请求ID
      ),
      episodes_titles: Array.from(
        { length: totalEpisodes },
        (_, i) => `第${i + 1}集`,
      ),
      source: 'shortdrama',
      source_name: '短剧',
      year: new Date().getFullYear().toString(),
      desc: result.data.description,
      type_name: '短剧',
      drama_name: result.data.videoName, // 添加剧名，用于备用API fallback
    };

    // 如果备用API返回了元数据，添加到响应中
    if (result.metadata) {
      response.metadata = result.metadata;
    }

    // 设置与豆瓣一致的缓存策略
    const cacheTime = await getCacheTime();
    const finalResponse = NextResponse.json(response);
    finalResponse.headers.set(
      'Cache-Control',
      `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
    );
    finalResponse.headers.set(
      'CDN-Cache-Control',
      `public, s-maxage=${cacheTime}`,
    );
    finalResponse.headers.set(
      'Vercel-CDN-Cache-Control',
      `public, s-maxage=${cacheTime}`,
    );
    finalResponse.headers.set('Netlify-Vary', 'query');

    return finalResponse;
  } catch (error) {
    logger.error('短剧详情获取失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
