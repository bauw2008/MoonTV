import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import {
  parseShortDramaEpisode,
  parseWwzyEpisode,
} from '@/lib/shortdrama.client';

// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const episode = searchParams.get('episode');
    const name = searchParams.get('name'); // 可选：用于备用API
    const source = searchParams.get('source'); // 可选：指定数据源（wwzy 或默认）

    if (!id || !episode) {
      return NextResponse.json(
        { error: '缺少必要参数: id, episode' },
        { status: 400 },
      );
    }

    const episodeNum = parseInt(episode);

    if (isNaN(episodeNum)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    let result;

    // 如果指定了数据源为 wwzy，使用 wwzy API 解析
    if (source === 'wwzy') {
      result = await parseWwzyEpisode(id, episodeNum);
    } else {
      // 否则使用原来的主 API 和备用 API 机制
      const videoId = parseInt(id);

      if (isNaN(videoId)) {
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

      // 解析视频，默认使用代理，如果提供了剧名且配置了备用API则自动fallback
      result = await parseShortDramaEpisode(
        videoId,
        episodeNum,
        true,
        name || undefined,
        alternativeApiUrl,
      );
    }

    if (result.code !== 0 || !result.data) {
      return NextResponse.json(
        { error: result.msg || '解析失败' },
        { status: 400 },
      );
    }

    // 返回视频URL，优先使用代理URL避免CORS问题
    const episodeData = result.data.episode;
    const parsedUrl = episodeData?.parsedUrl || result.data.parsedUrl || '';
    const proxyUrl = result.data.proxyUrl || '';

    const response = {
      url: proxyUrl || parsedUrl, // 优先使用代理URL
      originalUrl: parsedUrl,
      proxyUrl: proxyUrl,
      title: result.data.videoName || '',
      episode: result.data.currentEpisode || episodeNum,
      totalEpisodes: result.data.totalEpisodes || 1,
    };

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
    logger.error('短剧解析失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
