import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式 - 推荐API通常和分类热搜格式相同
function transformExternalData(externalItem: any) {
  return {
    id: externalItem.vod_id ? externalItem.vod_id.toString() : (externalItem.id?.toString() || ''),
    vod_id: externalItem.vod_id, // 推荐API返回的是vod_id
    name: externalItem.vod_name || '未知短剧', // 推荐API返回的是vod_name
    cover: externalItem.vod_pic || 'https://via.placeholder.com/300x400', // 推荐API返回的是vod_pic
    update_time: externalItem.vod_time || new Date().toISOString(), // 推荐API可能不返回时间，使用当前时间
    score: externalItem.vod_score || 0, // 推荐API返回的是vod_score
    total_episodes: externalItem.vod_remarks?.replace(/[^0-9]/g, '') || '1', // 从vod_remarks提取集数
    vod_class: externalItem.vod_class || '', // 添加分类字段映射
    vod_tag: externalItem.vod_tag || '', // 添加标签字段映射
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');
  const size = searchParams.get('size') || '25';

  try {

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/recommend`);
    if (categoryId) apiUrl.searchParams.append('categoryId', categoryId);
    apiUrl.searchParams.append('size', size);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const externalData = await response.json();

    // 处理外部API响应格式 - 推荐API返回的是带有items数组的对象
    if (externalData && externalData.items && Array.isArray(externalData.items)) {
      const transformedItems = externalData.items.map(transformExternalData);
      const recommendResponse = {
        mode: externalData.mode || 'random',
        categoryId: externalData.categoryId || 0,
        categoryName: externalData.categoryName || null,
        total: externalData.total || transformedItems.length,
        items: transformedItems,
      };
      return NextResponse.json(recommendResponse);
    } else {
      throw new Error('Invalid response format from external API');
    }
  } catch (error) {
    console.error('Short drama recommend API error:', error);

    // 返回默认推荐数据作为备用（格式与真实推荐API一致）
    const mockItems = Array.from({ length: 5 }, (_, index) => ({
      id: (index + 500).toString(),
      vod_id: index + 500,
      name: `推荐短剧 ${index + 1}`,
      cover: 'https://via.placeholder.com/300x400',
      update_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      score: Math.floor(Math.random() * 3) + 8, // 8-10的随机分数
      total_episodes: `${Math.floor(Math.random() * 50) + 10}`,
      vod_class: '都市情感',
      vod_tag: '甜宠,霸总,现代',
    }));

    const mockResponse = {
      mode: 'random',
      categoryId: parseInt(categoryId || '0'),
      categoryName: null,
      total: 5,
      items: mockItems,
    };

    return NextResponse.json(mockResponse);
  }
}
