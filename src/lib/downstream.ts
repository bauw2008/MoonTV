/* eslint-disable @typescript-eslint/no-explicit-any */

import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

import { secureTvboxFetch } from './tvbox-security';

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

    const data = await secureTvboxFetch(apiUrl).then((res) => res.json());

    if (!data || !data.list || !Array.isArray(data.list)) {
      return { results: [], pageCount: 1 };
    }

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
    // eslint-disable-next-line no-console
    console.error('分类筛选失败:', error);
    return { results: [], pageCount: 1 };
  }
}

/**
 * 从API搜索视频
 * @param apiSite API站点配置
 * @param keyword 搜索关键词
 * @returns Promise<SearchResult[]> 搜索结果
 */
export async function searchFromApi(
  apiSite: ApiSite,
  keyword: string
): Promise<SearchResult[]> {
  try {
    // 构建搜索API URL
    let apiUrl = apiSite.api;

    // 添加搜索参数
    const params = new URLSearchParams();
    params.append('wd', keyword);
    params.append('ac', 'detail'); // 使用detail模式获取详细信息

    // 检查URL是否已经包含查询参数
    if (apiUrl.includes('?')) {
      apiUrl += `&${params.toString()}`;
    } else {
      apiUrl += `?${params.toString()}`;
    }

    // 发起安全的API请求
    const response = await secureTvboxFetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 检查响应数据
    if (!data || !data.list || !Array.isArray(data.list)) {
      return [];
    }

    // 处理搜索结果
    const results = data.list.map((item: ApiSearchItem) => {
      // 处理剧集信息
      let episodes: string[] = [];
      let episodes_titles: string[] = [];

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
            episodes_titles = matchTitles;
          }
        });
      }

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles,
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

    // 过滤掉没有剧集的结果
    return results.filter((result: SearchResult) => result.episodes.length > 0);
  } catch (error) {
    console.error(`搜索失败 [${apiSite.key}][${keyword}]:`, error);
    return [];
  }
}

/**
 * 从HTML页面提取视频信息（用于某些特殊站点）
 * @param apiSite API站点配置
 * @param id 视频ID
 * @returns Promise<SearchResult> 视频详情
 */
export async function extractFromHtml(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  try {
    // 构建详情页面URL
    const detailUrl = apiSite.api.replace('/api.php', `/detail/${id}.html`);

    // 发起安全的页面请求
    const response = await secureTvboxFetch(detailUrl);
    if (!response.ok) {
      throw new Error(`页面请求失败: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // 提取播放链接
    const playUrlRegex = /<li><a\s+href="([^"]+)"[^>]*>([^<]+)<\/a><\/li>/g;
    let matches: string[] = [];
    let match;

    while ((match = playUrlRegex.exec(html)) !== null) {
      const url = match[1];
      if (url.endsWith('.m3u8')) {
        matches.push(url);
      }
    }

    // 去重并清理链接前缀
    matches = Array.from(new Set(matches)).map((link: string) => {
      link = link.substring(1); // 去掉开头的 $
      const parenIndex = link.indexOf('(');
      return parenIndex > 0 ? link.substring(0, parenIndex) : link;
    });

    // 根据 matches 数量生成剧集标题
    const episodes_titles = Array.from({ length: matches.length }, (_, i) =>
      (i + 1).toString()
    );

    // 提取标题
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const titleText = titleMatch ? titleMatch[1].trim() : '';

    // 提取描述
    const descMatch = html.match(
      /<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/
    );
    const descText = descMatch ? cleanHtmlTags(descMatch[1]) : '';

    // 提取封面
    const coverMatch = html.match(/(https?:\/\/[^"'\s]+?\.jpg)/g);
    const coverUrl = coverMatch ? coverMatch[0].trim() : '';

    // 提取年份
    const yearMatch = html.match(/>(\d{4})</);
    const yearText = yearMatch ? yearMatch[1] : 'unknown';

    return {
      id,
      title: titleText,
      poster: coverUrl,
      episodes: matches,
      episodes_titles,
      source: apiSite.key,
      source_name: apiSite.name,
      class: '',
      year: yearText,
      desc: descText,
      type_name: '',
      douban_id: 0,
    };
  } catch (error) {
    console.error(`提取HTML信息失败 [${apiSite.key}][${id}]:`, error);
    throw error;
  }
}

/**
 * 从API获取视频详情
 * @param apiSite API站点配置
 * @param id 视频ID
 * @returns Promise<SearchResult> 视频详情
 */
export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  try {
    // 构建详情API URL
    let apiUrl = apiSite.api;
    
    // 添加详情参数
    const params = new URLSearchParams();
    params.append('ac', 'detail');
    params.append('ids', id);
    
    // 检查URL是否已经包含查询参数
    if (apiUrl.includes('?')) {
      apiUrl += `&${params.toString()}`;
    } else {
      apiUrl += `?${params.toString()}`;
    }

    // 发起安全的API请求
    const response = await secureTvboxFetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // 检查响应数据
    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
      throw new Error('API返回空数据');
    }

    const item = data.list[0];
    
    // 处理剧集信息
    let episodes: string[] = [];
    let episodes_titles: string[] = [];

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
          episodes_titles = matchTitles;
        }
      });
    }

    return {
      id: item.vod_id.toString(),
      title: item.vod_name.trim().replace(/\s+/g, ' '),
      poster: item.vod_pic,
      episodes,
      episodes_titles,
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
  } catch (error) {
    console.error(`获取视频详情失败 [${apiSite.key}][${id}]:`, error);
    throw error;
  }
}