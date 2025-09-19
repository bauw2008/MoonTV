import { type ApiSite, API_CONFIG } from '@/lib/config';
import type { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';
import { secureTvboxData } from './tvbox-security';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

// 定义API响应数据的类型
interface ApiResponseData {
  list?: ApiSearchItem[];
  pagecount?: number;
  total?: number;
  totalPages?: number;
}

/**
 * 按分类获取视频列表（专用于分类筛选）
 */
export async function getVideosByCategory(
  apiSite: ApiSite,
  category?: string,
  page = 1
): Promise<{ results: SearchResult[]; pageCount: number }> {
  try {
    let apiUrl = apiSite.api;

    // 根据视频源key调整API端点
    if (apiSite.key === 'dyttzy') {
      // 视频列表端点
      if (apiUrl.includes('/provide/vod')) {
        // 将分类信息端点转换为视频列表端点
        apiUrl = apiUrl.replace('/provide/vod', '/provide/vod/list');
      }

      // 添加查询参数
      const params = new URLSearchParams();
      params.append('ac', 'videolist');
      params.append('pg', page.toString());

      if (category) {
        params.append('t', category);
      }

      apiUrl += `?${params.toString()}`;
    } else {
      // 其他视频源的默认逻辑
      const params = new URLSearchParams();
      params.append('ac', 'videolist');
      params.append('pg', page.toString());

      if (category) {
        params.append('t', category);
      }

      apiUrl += `?${params.toString()}`;
    }

    console.log('分类筛选请求URL:', apiUrl);

    const data = await secureTvboxData<ApiResponseData>(apiUrl);
    console.log('API响应数据:', {
      hasList: !!data.list,
      listLength: data.list?.length || 0,
      pagecount: data.pagecount,
      total: data.total,
    });

    if (!data || !data.list || !Array.isArray(data.list)) {
      console.log('API返回数据格式异常或无列表数据');
      return { results: [], pageCount: 1 };
    }

    console.log('获取到视频数量:', data.list.length);

    // 处理结果数据（复用现有的映射逻辑）
    const results = data.list.map((item: ApiSearchItem) => {
      let episodes: string[] = [];
      let titles: string[] = [];

      if (item.vod_play_url) {
        const vod_play_url_array = item.vod_play_url.split('$$$');
        vod_play_url_array.forEach((url: string) => {
          const matchEpisodes: string[] = [];
          const matchTitles: string[] = [];
          const title_url_array = url.split('#');
          title_url_array.forEach((title_url: string) => {
            const episode_title_url = title_url.split('$');
            if (
              episode_title_url.length === 2 &&
              episode_title_url[1].endsWith('.m3u8')
            ) {
              matchTitles.push(episode_title_url[0]);
              matchEpisodes.push(episode_title_url[1]);
            }
          });
          if (matchEpisodes.length > episodes.length) {
            episodes = matchEpisodes;
            titles = matchTitles;
          }
        });
      }

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles: titles,
        source: apiSite.key,
        source_name: apiSite.name,
        class: item.vod_class,
        year: item.vod_year
          ? item.vod_year.match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name,
        douban_id: item.vod_douban_id,
      };
    });

    // 过滤掉集数为 0 的结果
    const filteredResults = results.filter(
      (result: SearchResult) => result.episodes.length > 0
    );

    // 获取总页数
    const pageCount = data.pagecount || data.totalPages || 1;

    return { results: filteredResults, pageCount };
  } catch (error) {
    console.error('分类筛选失败:', error);
    return { results: [], pageCount: 1 };
  }
}
