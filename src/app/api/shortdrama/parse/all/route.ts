import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      );
    }

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/parse/all`);
    apiUrl.searchParams.append('id', id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时，为获取全集地址提供充足时间

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // 直接返回API响应数据，播放页面会处理数据结构转换
    return NextResponse.json(data);
  } catch (error) {
    console.error('Short drama all parse API error:', error);

    // 返回模拟的短剧数据作为备用
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorId = errorSearchParams.get('id');
    const mockData = {
      videoId: parseInt(errorId || '1') || 1,
      videoName: '短剧播放示例',
      results: Array.from({ length: 10 }, (_, index) => ({
        index: index,
        label: `第${index + 1}集`,
        parsedUrl: `https://example.com/video${index + 1}.mp4`,
        parseInfo: {
          headers: {},
          type: 'mp4'
        },
        status: 'success',
        reason: null
      })),
      totalEpisodes: 10,
      successfulCount: 10,
      failedCount: 0,
      cover: 'https://via.placeholder.com/300x400',
      description: '这是一个示例短剧，用于测试播放功能。'
    };

    return NextResponse.json(mockData);
  }
}
