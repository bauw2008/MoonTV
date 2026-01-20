/**
 * 短剧 API 适配器接口
 * 统一不同短剧 API 的访问方式
 */

import { logger } from '@/lib/logger';

export interface ShortDramaCategory {
  type_id: number;
  type_name: string;
  type_pid?: number;
}

export interface ShortDramaItem {
  id: string;
  name: string;
  cover: string;
  rate?: string;
  year?: string;
  update_time?: string;
  vod_remarks?: string;
  vod_total?: number;
  vod_play_url?: string;
  vod_pic?: string;
  vod_blurb?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_year?: string;
  vod_score?: string;
}

export interface ShortDramaDetail extends ShortDramaItem {
  vod_play_from?: string;
  vod_play_url?: string;
  vod_content?: string;
}

export interface ShortDramaParseResult {
  code: number;
  msg?: string;
  data?: {
    videoId: string;
    videoName: string;
    currentEpisode: number;
    totalEpisodes: number;
    parsedUrl: string;
    proxyUrl: string;
    cover: string;
    description: string;
    episode?: {
      index: number;
      label: string;
      parsedUrl: string;
      proxyUrl: string;
      title: string;
    };
  };
}

/**
 * 短剧 API 适配器接口
 */
export interface IShortDramaAdapter {
  /**
   * 获取分类列表
   */
  getCategories(): Promise<ShortDramaCategory[]>;

  /**
   * 获取短剧列表
   * @param categoryId 分类ID
   * @param page 页码（从1开始）
   * @param size 每页数量
   */
  getList(
    categoryId: number,
    page: number,
    size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }>;

  /**
   * 搜索短剧
   * @param query 搜索关键词
   * @param page 页码（从1开始）
   * @param size 每页数量
   */
  search(
    query: string,
    page: number,
    size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }>;

  /**
   * 获取短剧详情
   * @param id 短剧ID
   */
  getDetail(id: string): Promise<ShortDramaDetail>;

  /**
   * 解析播放地址
   * @param id 短剧ID
   * @param episode 集数（从1开始）
   */
  parseEpisode(id: string, episode: number): Promise<ShortDramaParseResult>;

  /**
   * 获取集数
   * @param id 短剧ID
   */
  getEpisodeCount(id: string): Promise<number>;
}

/**
 * wwzy.tv API 适配器
 * API 文档：https://wwzy.tv/api.php/provide/vod
 */
export class WwzyAdapter implements IShortDramaAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://wwzy.tv/api.php/provide/vod') {
    this.baseUrl = baseUrl;
  }

  /**
   * 发送 API 请求
   */
  private async fetchApi(
    params: Record<string, string>,
  ): Promise<{ code: number; msg?: string; [key: string]: unknown }> {
    const url = new URL(this.baseUrl);
    Object.keys(params).forEach((key) => {
      url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 1) {
      throw new Error(`API error: ${data.msg || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * 获取分类列表
   */
  async getCategories(): Promise<ShortDramaCategory[]> {
    try {
      const data = await this.fetchApi({ ac: 'list' });
      const categories = (data.class as unknown[]) || [];

      // 只返回一级分类（type_pid === 0）
      return categories
        .filter(
          (cat: unknown) =>
            typeof cat === 'object' &&
            cat !== null &&
            (cat as { type_pid: number }).type_pid === 0,
        )
        .map((cat: unknown) => {
          const c = cat as {
            type_id: number;
            type_name: string;
            type_pid: number;
          };
          return {
            type_id: c.type_id,
            type_name: c.type_name,
            type_pid: c.type_pid,
          };
        });
    } catch (error) {
      logger.error('[WwzyAdapter] 获取分类列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取短剧列表
   */
  async getList(
    categoryId: number,
    page: number,
    size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
    try {
      const data = await this.fetchApi({
        ac: 'list',
        t: categoryId.toString(),
        pg: page.toString(),
        limit: size.toString(),
      });

      const list = ((data.list as unknown[]) || []).map((item: unknown) => {
        const vod = item as Record<string, unknown>;
        return {
          id: String(vod.vod_id),
          name: String(vod.vod_name),
          cover: String(vod.vod_pic),
          rate: String(vod.vod_score || ''),
          year: String(vod.vod_year || ''),
          update_time: String(vod.vod_time || ''),
          vod_remarks: String(vod.vod_remarks || ''),
          vod_total: Number(vod.vod_total || 0),
          vod_play_url: String(vod.vod_play_url || ''),
          vod_pic: String(vod.vod_pic),
          vod_blurb: String(vod.vod_blurb || ''),
          vod_actor: String(vod.vod_actor || ''),
          vod_director: String(vod.vod_director || ''),
          vod_area: String(vod.vod_area || ''),
          vod_lang: String(vod.vod_lang || ''),
          vod_year: String(vod.vod_year),
          vod_score: String(vod.vod_score),
        };
      });

      return {
        list,
        hasMore: page < (data.pagecount as number),
      };
    } catch (error) {
      logger.error('[WwzyAdapter] 获取短剧列表失败:', error);
      throw error;
    }
  }

  /**
   * 搜索短剧
   */
  async search(
    query: string,
    page: number,
    size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
    try {
      const data = await this.fetchApi({
        ac: 'list',
        wd: query,
        pg: page.toString(),
        limit: size.toString(),
      });

      const list = ((data.list as unknown[]) || []).map((item: unknown) => {
        const vod = item as Record<string, unknown>;
        return {
          id: String(vod.vod_id),
          name: String(vod.vod_name),
          cover: String(vod.vod_pic),
          rate: String(vod.vod_score || ''),
          year: String(vod.vod_year || ''),
          update_time: String(vod.vod_time || ''),
          vod_remarks: String(vod.vod_remarks || ''),
          vod_total: Number(vod.vod_total || 0),
          vod_play_url: String(vod.vod_play_url || ''),
          vod_pic: String(vod.vod_pic),
          vod_blurb: String(vod.vod_blurb || ''),
          vod_actor: String(vod.vod_actor || ''),
          vod_director: String(vod.vod_director || ''),
          vod_area: String(vod.vod_area || ''),
          vod_lang: String(vod.vod_lang || ''),
          vod_year: String(vod.vod_year),
          vod_score: String(vod.vod_score),
        };
      });

      return {
        list,
        hasMore: page < (data.pagecount as number),
      };
    } catch (error) {
      logger.error('[WwzyAdapter] 搜索短剧失败:', error);
      throw error;
    }
  }

  /**
   * 获取短剧详情
   */
  async getDetail(id: string): Promise<ShortDramaDetail> {
    try {
      const data = await this.fetchApi({
        ac: 'detail',
        ids: id,
      });

      if (!data.list || (data.list as unknown[]).length === 0) {
        throw new Error('Short drama not found');
      }

      const item = data.list[0];

      return {
        id: item.vod_id.toString(),
        name: item.vod_name,
        cover: item.vod_pic,
        rate: item.vod_score || '',
        year: item.vod_year || '',
        update_time: item.vod_time || '',
        vod_remarks: item.vod_remarks,
        vod_total: item.vod_total,
        vod_play_url: item.vod_play_url,
        vod_pic: item.vod_pic,
        vod_blurb: item.vod_blurb,
        vod_actor: item.vod_actor,
        vod_director: item.vod_director,
        vod_area: item.vod_area,
        vod_lang: item.vod_lang,
        vod_year: item.vod_year,
        vod_score: item.vod_score,
        vod_play_from: item.vod_play_from,
        vod_content: item.vod_content,
      };
    } catch (error) {
      logger.error('[WwzyAdapter] 获取短剧详情失败:', error);
      throw error;
    }
  }

  /**
   * 解析播放地址
   * wwzy.tv 的播放链接格式：01$https://...#02$https://...#03$https://...
   */
  async parseEpisode(
    id: string,
    episode: number,
  ): Promise<ShortDramaParseResult> {
    try {
      const detail = await this.getDetail(id);

      if (!detail.vod_play_url) {
        throw new Error('No play URL found');
      }

      // 解析播放链接
      const episodes = detail.vod_play_url.split('#');
      const episodeIndex = episode - 1; // 集数从1开始，数组从0开始

      if (episodeIndex < 0 || episodeIndex >= episodes.length) {
        throw new Error(
          `Episode ${episode} not found (total: ${episodes.length})`,
        );
      }

      const episodeData = episodes[episodeIndex];
      const [, url] = episodeData.split('$');

      if (!url) {
        throw new Error(`Invalid episode data: ${episodeData}`);
      }

      return {
        code: 0,
        data: {
          videoId: id,
          videoName: detail.name,
          currentEpisode: episode,
          totalEpisodes: episodes.length,
          parsedUrl: url,
          proxyUrl: `/api/proxy/shortdrama?url=${encodeURIComponent(url)}`,
          cover: detail.cover,
          description: detail.vod_blurb || detail.vod_content || '',
          episode: {
            index: episode,
            label: `第${episode}集`,
            parsedUrl: url,
            proxyUrl: `/api/proxy/shortdrama?url=${encodeURIComponent(url)}`,
            title: `${detail.name} 第${episode}集`,
          },
        },
      };
    } catch (error) {
      logger.error('[WwzyAdapter] 解析播放地址失败:', error);
      return {
        code: 1,
        msg: error instanceof Error ? error.message : '解析失败',
      };
    }
  }

  /**
   * 获取集数
   */
  async getEpisodeCount(id: string): Promise<number> {
    try {
      const detail = await this.getDetail(id);

      if (!detail.vod_play_url) {
        return 0;
      }

      // 解析播放链接，计算集数
      const episodes = detail.vod_play_url.split('#');
      return episodes.length;
    } catch (error) {
      logger.error('[WwzyAdapter] 获取集数失败:', error);
      return 0;
    }
  }
}

/**
 * 短剧适配器工厂
 */
export class ShortDramaAdapterFactory {
  /**
   * 创建适配器实例
   * @param adapterType 适配器类型
   * @param config 配置参数
   */
  static create(
    adapterType: 'wwzy' | 'custom',
    config?: { baseUrl?: string },
  ): IShortDramaAdapter {
    switch (adapterType) {
      case 'wwzy':
        return new WwzyAdapter(config?.baseUrl);

      case 'custom':
        // TODO: 实现自定义适配器
        throw new Error('Custom adapter not implemented yet');

      default:
        throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }
}
