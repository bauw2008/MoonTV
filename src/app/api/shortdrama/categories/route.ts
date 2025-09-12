import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export const runtime = 'nodejs'; // 避免 Edge runtime 下 AbortController 不兼容

export async function GET(_request: NextRequest) {
  const apiUrl = `${API_CONFIG.shortdrama.baseUrl}/vod/categories`;
  console.log("Requesting:", apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers || {},
    });

    if (!response.ok) {
      throw new Error(`External API failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Short drama categories API error:', error);

    // 返回 mock 数据
    return NextResponse.json({
      categories: [
        { type_id: 1, type_name: '古装' },
        { type_id: 2, type_name: '现代' },
        { type_id: 3, type_name: '都市' },
        { type_id: 4, type_name: '言情' },
        { type_id: 5, type_name: '悬疑' },
        { type_id: 6, type_name: '喜剧' },
        { type_id: 7, type_name: '其他' },
      ],
      total: 7,
    });
  }
}

