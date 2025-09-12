import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式 - 最新剧集API使用vod_id作为实际视频ID
function transformExternalData(externalItem: any) {
  return {
    id: externalItem.id ? externalItem.id.toString() : (externalItem.vod_id?.toString() || ''), // 保持原有id作为唯一标识
    vod_id: externalItem.vod_id, // 使用vod_id作为实际的视频ID，用于获取全集地址
    name: externalItem.vod_name || '未知短剧', // 最新剧集API返回的是vod_name
    cover: externalItem.vod_pic || 'https://via.placeholder.com/300x400', // 最新剧集API返回的是vod_pic
    update_time: externalItem.vod_time || new Date().toISOString(), // 最新剧集API返回的是vod_time
    score: externalItem.vod_score || externalItem.vod_douban_score || 0, // 最新剧集API返回的是vod_score
    total_episodes: externalItem.vod_total || '1', // 最新剧集API返回的是vod_total
    vod_class: externalItem.vod_class || '', // 添加分类字段映射
    vod_tag: externalItem.vod_tag || '', // 添加标签字段映射
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/latest`);
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
      const transformedData = externalData.list.map(transformExternalData);
      return NextResponse.json(transformedData);
    } else {
      throw new Error('Invalid response format from external API');
    }
  } catch (error) {
    console.error('Short drama latest API error:', error);

    // 返回默认最新数据作为备用（格式与真实API一致）
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
        id: `mock_id_${index + 100}`, // 模拟字符串ID
        vod_id: index + 100, // 模拟数字vod_id，用于获取全集地址
        vod_name: `最新短剧 ${index + 1}`,
        vod_pic: 'https://via.placeholder.com/300x400',
        vod_time: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
        vod_score: Math.floor(Math.random() * 4) + 7, // 7-10的随机分数
        vod_total: `${Math.floor(Math.random() * 30) + 10}`, // 模拟总集数
        vod_class: classOptions[index % classOptions.length], // 模拟分类
        vod_tag: tagOptions[index % tagOptions.length], // 模拟标签
      };
    });

    // 确保返回数组
    return NextResponse.json(mockData);
  }
}
