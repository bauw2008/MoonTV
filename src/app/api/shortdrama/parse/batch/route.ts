import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const episodes = searchParams.get('episodes');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      );
    }

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/parse/batch`);
    apiUrl.searchParams.append('id', id);
    if (episodes) apiUrl.searchParams.append('episodes', episodes);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Short drama batch parse API error:', error);

    // 返回默认数据作为备用
    return NextResponse.json({
      code: 500,
      message: 'Failed to parse episodes',
      data: null,
    });
  }
}
