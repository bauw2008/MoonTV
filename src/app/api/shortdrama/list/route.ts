import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式 - 分类热搜API直接使用id作为视频ID
function transformExternalData(externalItem: any) {
  return {
    id: externalItem.id ? externalItem.id.toString() : '', // 分类热搜API返回的id就是唯一标识
    vod_id: externalItem.id, // 分类热搜API返回的id就是视频ID，用于获取全集地址
    name: externalItem.name || '未知短剧', // 分类热搜API返回的是name
    cover: externalItem.cover || 'https://via.placeholder.com/300x400', // 分类热搜API返回的是cover
    update_time: externalItem.update_time || new Date().toISOString(), // 分类热搜API返回的是update_time
    score: externalItem.score || 0, // 分类热搜API返回的是score
    total_episodes: '1', // 分类热搜API通常不返回总集数，设为默认值
    vod_class: externalItem.vod_class || '', // 添加分类字段映射
    vod_tag: externalItem.vod_tag || '', // 添加标签字段映射
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const page = searchParams.get('page') || '1';

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/list`);
    apiUrl.searchParams.append('categoryId', categoryId);
    apiUrl.searchParams.append('page', page);

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

    // 处理外部API响应格式
    if (externalData && externalData.list && Array.isArray(externalData.list)) {
      const transformedList = externalData.list.map(transformExternalData);
      return NextResponse.json({
        total: externalData.total || 0,
        totalPages: externalData.totalPages || externalData.pagecount || 1,
        currentPage: externalData.currentPage || externalData.page || 1,
        list: transformedList,
      });
    } else {
      throw new Error('Invalid response format from external API');
    }
  } catch (error) {
    console.error('Short drama list API error:', error);

    // 返回默认列表数据作为备用（格式与真实分类热搜API一致）
    const mockData = Array.from({ length: 25 }, (_, index) => {
      const classOptions = ['都市情感', '古装宫廷', '现代言情', '豪门世家', '职场励志'];
      const tagOptions = [
        '甜宠,霸总,现代',
        '穿越,古装,宫斗',
        '复仇,虐渣,打脸',
        '重生,逆袭,强者归来',
        '家庭,伦理,现实'
      ];

      return {
        id: index + 1000, // 直接使用数字ID，与分类热搜API一致，这个ID就是视频ID
        name: `短剧示例 ${index + 1}`,
        cover: 'https://via.placeholder.com/300x400',
        update_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        score: Math.floor(Math.random() * 5) + 6, // 6-10的随机分数
        vod_class: classOptions[index % classOptions.length], // 模拟分类
        vod_tag: tagOptions[index % tagOptions.length], // 模拟标签
      };
    });

    return NextResponse.json({
      total: 100,
      totalPages: 4,
      currentPage: parseInt(request.nextUrl.searchParams.get('page') || '1'),
      list: mockData,
    });
  }
}
