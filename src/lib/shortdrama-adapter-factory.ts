'use client';

import { logger } from '@/lib/logger';

import {
  IShortDramaAdapter,
  ShortDramaCategory,
  ShortDramaDetail,
  ShortDramaItem,
  ShortDramaParseResult,
} from './shortdrama-adapter';
// 导入适配器实现
import { WwzyAdapter } from './shortdrama-adapter';

/**
 * 短剧适配器工厂
 * 根据配置创建相应的适配器实例
 */
export class ShortDramaAdapterFactory {
  /**
   * 创建适配器实例
   * @param config 短剧配置
   * @returns 适配器实例
   */
  static create(config: {
    adapterType?: 'wwzy' | 'custom';
    adapterConfigs?: {
      wwzy?: { baseUrl: string; enabled: boolean };
      custom?: { baseUrl: string; enabled: boolean; adapterName: string };
    };
  }): IShortDramaAdapter {
    const { adapterType = 'wwzy', adapterConfigs } = config;

    switch (adapterType) {
      case 'wwzy':
        if (!adapterConfigs?.wwzy?.enabled) {
          logger.warn('WWZY 适配器未启用');
        }
        return new WwzyAdapter(adapterConfigs?.wwzy?.baseUrl);

      case 'custom':
        // 自定义适配器暂未实现
        logger.warn('自定义适配器暂未实现，返回默认实现');
        return new DefaultAdapter();

      default:
        logger.warn(`未知的适配器类型: ${adapterType}，返回默认实现`);
        return new DefaultAdapter();
    }
  }

  /**
   * 创建备用适配器实例
   * @param config 短剧配置
   * @param excludeAdapterType 要排除的适配器类型
   * @returns 备用适配器实例
   */
  static createFallback(
    config: {
      adapterType?: 'wwzy' | 'custom';
      adapterConfigs?: {
        wwzy?: { baseUrl: string; enabled: boolean };
        custom?: { baseUrl: string; enabled: boolean; adapterName: string };
      };
    },
    excludeAdapterType?: string,
  ): IShortDramaAdapter | null {
    const { adapterConfigs } = config;

    // 查找可用的备用适配器
    if (adapterConfigs?.wwzy?.enabled && excludeAdapterType !== 'wwzy') {
      return new WwzyAdapter(adapterConfigs.wwzy.baseUrl);
    }

    // 没有可用的备用适配器
    return null;
  }
}

/**
 * 默认适配器实现
 * 用于未实现的适配器类型
 */
class DefaultAdapter implements IShortDramaAdapter {
  async getCategories(): Promise<ShortDramaCategory[]> {
    logger.warn('默认适配器：getCategories 未实现');
    return [];
  }

  async getList(
    _categoryId: number,
    _page: number,
    _size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
    logger.warn('默认适配器：getList 未实现');
    return { list: [], hasMore: false };
  }

  async search(
    _query: string,
    _page: number,
    _size: number,
  ): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
    logger.warn('默认适配器：search 未实现');
    return { list: [], hasMore: false };
  }

  async getDetail(_id: string): Promise<ShortDramaDetail> {
    logger.warn('默认适配器：getDetail 未实现');
    throw new Error('Default adapter: getDetail not implemented');
  }

  async parseEpisode(
    _id: string,
    _episode: number,
  ): Promise<ShortDramaParseResult> {
    logger.warn('默认适配器：parseEpisode 未实现');
    return {
      code: 1,
      msg: 'Default adapter: parseEpisode not implemented',
    };
  }

  async getEpisodeCount(_id: string): Promise<number> {
    logger.warn('默认适配器：getEpisodeCount 未实现');
    return 0;
  }
}
