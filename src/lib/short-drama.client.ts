/**
 * 短剧数据获取相关的客户端函数
 */

import { DoubanResult } from './types';

export interface ShortDramaSearchParams {
  type?: string;
  region?: string;
  year?: string;
  start?: number;
  limit?: number;
}

/**
 * 获取短剧数据
 * 现在返回标准的 DoubanResult 格式
 */
export async function getShortDramaData(
  params: ShortDramaSearchParams = {},
): Promise<DoubanResult> {
  const searchParams = new URLSearchParams();

  if (params.type && params.type !== 'all') {
    searchParams.append('type', params.type);
  }
  if (params.region && params.region !== 'all') {
    searchParams.append('region', params.region);
  }
  if (params.year && params.year !== 'all') {
    searchParams.append('year', params.year);
  }
  if (params.start !== undefined) {
    searchParams.append('start', params.start.toString());
  }
  if (params.limit) {
    searchParams.append('limit', params.limit.toString());
  }

  const url = `/api/short-drama${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`获取短剧数据失败: ${response.status}`);
  }

  return response.json();
}
