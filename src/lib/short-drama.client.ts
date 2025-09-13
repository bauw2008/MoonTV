/**
 * 短剧数据获取相关的客户端函数
 */

export interface ShortDramaSearchParams {
  type?: string;
  region?: string;
  year?: string;
  page?: number;
  limit?: number;
}

export interface ShortDramaResponse {
  results: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 获取短剧数据
 */
export async function getShortDramaData(
  params: ShortDramaSearchParams = {}
): Promise<ShortDramaResponse> {
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
  if (params.page) {
    searchParams.append('page', params.page.toString());
  }
  if (params.limit) {
    searchParams.append('limit', params.limit.toString());
  }

  const url = `/api/short-drama${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`获取短剧数据失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 短剧类型选项
 */
export const shortDramaTypeOptions = [
  { label: '全部', value: 'all' },
  { label: '爱情', value: 'romance' },
  { label: '家庭', value: 'family' },
  { label: '现代', value: 'modern' },
  { label: '都市', value: 'urban' },
  { label: '古装', value: 'costume' },
  { label: '穿越', value: 'time_travel' },
  { label: '商战', value: 'business' },
  { label: '悬疑', value: 'suspense' },
  { label: '喜剧', value: 'comedy' },
  { label: '青春', value: 'youth' },
];

/**
 * 短剧地区选项
 */
export const shortDramaRegionOptions = [
  { label: '全部', value: 'all' },
  { label: '华语', value: 'chinese' },
  { label: '中国大陆', value: 'mainland_china' },
  { label: '韩国', value: 'korean' },
  { label: '日本', value: 'japanese' },
  { label: '美国', value: 'usa' },
  { label: '英国', value: 'uk' },
  { label: '泰国', value: 'thailand' },
];