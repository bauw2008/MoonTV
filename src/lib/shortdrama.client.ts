// 短剧API客户端

export interface ShortDramaCategory {
  type_id: number;
  type_name: string;
}

export interface ShortDramaItem {
  id: string;
  vod_id: number;
  name: string;
  cover: string;
  update_time: string;
  score: number;
  total_episodes?: string;
  vod_class?: string; // 添加分类字段
  vod_tag?: string;   // 添加标签字段
}

export interface ShortDramaListResponse {
  total: number;
  totalPages: number;
  currentPage: number;
  list: ShortDramaItem[];
}

export interface ShortDramaCategoriesResponse {
  categories: ShortDramaCategory[];
  total: number;
}

export interface ShortDramaRecommendResponse {
  mode: string;
  categoryId: number;
  categoryName: string | null;
  total: number;
  items: ShortDramaItem[];
}

export interface ShortDramaSearchResponse {
  total: number;
  totalPages: number;
  currentPage: number;
  list: ShortDramaItem[];
}

// 获取分类种类
export const getShortDramaCategories = async (): Promise<ShortDramaCategoriesResponse> => {
  const response = await fetch('/api/shortdrama/categories');
  if (!response.ok) {
    throw new Error('Failed to fetch short drama categories');
  }
  return response.json();
};

// 获取随机推荐
export const getShortDramaRecommend = async (params: {
  categoryId?: string;
  size?: string;
}): Promise<ShortDramaRecommendResponse> => {
  const url = new URL('/api/shortdrama/recommend', window.location.origin);
  if (params.categoryId) url.searchParams.append('categoryId', params.categoryId);
  if (params.size) url.searchParams.append('size', params.size);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch short drama recommendations');
  }
  return response.json();
};

// 获取分类热搜
export const getShortDramaList = async (params: {
  categoryId: string;
  page?: string;
}): Promise<ShortDramaListResponse> => {
  const url = new URL('/api/shortdrama/list', window.location.origin);
  url.searchParams.append('categoryId', params.categoryId);
  if (params.page) url.searchParams.append('page', params.page);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch short drama list');
  }
  return response.json();
};

// 根据名称搜剧
export const searchShortDrama = async (params: {
  name: string;
}): Promise<ShortDramaSearchResponse> => {
  const url = new URL('/api/shortdrama/search', window.location.origin);
  url.searchParams.append('name', params.name);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to search short drama');
  }
  return response.json();
};

// 获取最新剧集
export const getShortDramaLatest = async (params: {
  page?: string;
}): Promise<ShortDramaItem[]> => {
  const url = new URL('/api/shortdrama/latest', window.location.origin);
  if (params.page) url.searchParams.append('page', params.page);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch latest short drama');
  }
  return response.json();
};

// 获取单集地址
export const getShortDramaSingleParse = async (params: {
  id: string;
  episode?: number;
}): Promise<any> => {
  const url = new URL('/api/shortdrama/parse/single', window.location.origin);
  url.searchParams.append('id', params.id);
  if (params.episode) url.searchParams.append('episode', params.episode.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to parse single episode');
  }
  return response.json();
};

// 批量获取地址
export const getShortDramaBatchParse = async (params: {
  id: number;
  episodes?: string;
}): Promise<any> => {
  const url = new URL('/api/shortdrama/parse/batch', window.location.origin);
  url.searchParams.append('id', params.id.toString());
  if (params.episodes) url.searchParams.append('episodes', params.episodes);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to parse batch episodes');
  }
  return response.json();
};

// 获取全集地址
export const getShortDramaAllParse = async (params: {
  id: number;
}): Promise<any> => {
  const url = new URL('/api/shortdrama/parse/all', window.location.origin);
  url.searchParams.append('id', params.id.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to parse all episodes');
  }
  return response.json();
};
