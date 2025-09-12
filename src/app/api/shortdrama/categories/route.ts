import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export async function GET(_request: NextRequest) {
  try {
    // 先尝试调用外部API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch(`${API_CONFIG.shortdrama.baseUrl}/vod/categories`, {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`External API failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Short drama categories API error:', error);

    // 如果外部API失败，返回默认分类数据作为备用
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
