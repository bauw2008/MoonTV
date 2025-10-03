/* eslint-disable @typescript-eslint/no-explicit-any */

import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';
import { extractEpisodesFromPlayUrl } from '@/lib/tvbox-episode-utils';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

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

/**
 * 通用的带缓存搜索函数
 */
async function searchWithCache(
  apiSite: ApiSite,
  query: string,
  page: number,
  url: string,
  timeoutMs = 8000
): Promise<{ results: SearchResult[]; pageCount?: number }> {
  // 先查缓存
  const cached = getCachedSearchPage(apiSite.key, query, page);
  if (cached) {
    if (cached.status === 'ok') {
      return { results: cached.data, pageCount: cached.pageCount };
    } else {
      return { results: [] };
    }
  }

  // 缓存未命中，发起网络请求
  let response;
  let timeoutId: NodeJS.Timeout | null = null;
  const controller = new AbortController();

  try {
    // 设置超时
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 对于TVBox源使用特殊处理
    if (apiSite.key.startsWith('tvbox_') || apiSite.key === 'dyttzy') {
      // 使用标准fetch，但添加适当的超时控制
      response = await fetch(url, {
        signal: controller.signal,
      });
    } else {
      response = await fetch(url, {
        headers: API_CONFIG.search.headers,
        signal: controller.signal,
      });
    }

    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 403) {
        setCachedSearchPage(apiSite.key, query, page, 'forbidden', []);
      }
      return { results: [] };
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      // 空结果不做负缓存要求，这里不写入缓存
      return { results: [] };
    }

    // 处理结果数据
    const allResults = data.list.map((item: ApiSearchItem) => {
      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      const { episodes, titles } = extractEpisodesFromPlayUrl(
        item.vod_play_url
      );

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
    const results = allResults.filter(
      (result: SearchResult) => result.episodes.length > 0
    );

    const pageCount = page === 1 ? data.pagecount || 1 : undefined;
    // 写入缓存（成功）
    setCachedSearchPage(apiSite.key, query, page, 'ok', results, pageCount);
    return { results, pageCount };
  } catch (error: any) {
    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 识别被 AbortController 中止（超时）
    const aborted =
      error?.name === 'AbortError' ||
      error?.code === 20 ||
      error?.message?.includes('aborted');
    if (aborted) {
      setCachedSearchPage(apiSite.key, query, page, 'timeout', []);
    }
    return { results: [] };
  }
}

export async function searchFromApi(
  apiSite: ApiSite,
  query: string
): Promise<SearchResult[]> {
  try {
    const apiBaseUrl = apiSite.api;

    // 优化：首先尝试原始查询，避免不必要的变体搜索
    const searchVariants = generateSearchVariants(query);
    let results: SearchResult[] = [];
    let pageCountFromFirst = 0;

    // 优先尝试原始查询
    const originalVariant = searchVariants[0]; // 第一个总是原始查询
    const originalUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(originalVariant);

    try {
      const firstPageResult = await searchWithCache(
        apiSite,
        originalVariant,
        1,
        originalUrl,
        8000
      );

      if (firstPageResult.results.length > 0) {
        results = firstPageResult.results;
        query = originalVariant;
        pageCountFromFirst = firstPageResult.pageCount || 1;
      }
    } catch (error) {
      // 忽略原始查询错误，
    }

    // 如果原始查询没有结果，再尝试其他变体
    if (results.length === 0 && searchVariants.length > 1) {
      const allVariantResults: Array<{
        variant: string;
        results: SearchResult[];
        relevanceScore: number;
      }> = [];

      // 跳过原始查询（已经试过）
      for (let i = 1; i < searchVariants.length; i++) {
        const variant = searchVariants[i];
        const apiUrl =
          apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(variant);

        try {
          const firstPageResult = await searchWithCache(
            apiSite,
            variant,
            1,
            apiUrl,
            8000
          );

          if (firstPageResult.results.length > 0) {
            const relevanceScore = calculateRelevanceScore(
              query,
              variant,
              firstPageResult.results
            );

            allVariantResults.push({
              variant,
              results: firstPageResult.results,
              relevanceScore,
            });
          }
        } catch (error) {
          // 忽略单个变体错误，
        }
      }

      if (allVariantResults.length > 0) {
        // 选择相关性分数最高的结果
        const bestResult = allVariantResults.reduce((best, current) =>
          current.relevanceScore > best.relevanceScore ? current : best
        );

        results = bestResult.results;
        query = bestResult.variant;
        pageCountFromFirst = 1;
      }
    }

    // 如果所有查询都没有结果，返回空数组
    if (results.length === 0) {
      return [];
    }

    const config = await getConfig();
    const MAX_SEARCH_PAGES: number = config.SiteConfig.SearchDownstreamMaxPage;

    // 获取总页数
    const pageCount = pageCountFromFirst || 1;
    // 确定需要获取的额外页数
    const pagesToFetch = Math.min(pageCount - 1, MAX_SEARCH_PAGES - 1);

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      // 优化：限制并发请求数量，避免过多并发请求
      const MAX_CONCURRENT_REQUESTS = 3;
      const additionalResults: SearchResult[][] = [];

      for (
        let page = 2;
        page <= pagesToFetch + 1;
        page += MAX_CONCURRENT_REQUESTS
      ) {
        const batchPages = Array.from(
          {
            length: Math.min(MAX_CONCURRENT_REQUESTS, pagesToFetch + 1 - page),
          },
          (_, i) => page + i
        );

        const batchPromises = batchPages.map((pageNum) => {
          const pageUrl =
            apiBaseUrl +
            API_CONFIG.search.pagePath
              .replace('{query}', encodeURIComponent(query))
              .replace('{page}', pageNum.toString());

          return searchWithCache(apiSite, query, pageNum, pageUrl, 8000)
            .then((result) => result.results)
            .catch(() => []); // 单个页面失败不影响其他页面
        });

        const batchResults = await Promise.all(batchPromises);
        additionalResults.push(...batchResults);
      }

      // 合并所有页的结果
      for (const pageResults of additionalResults) {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}

/**
 * 计算搜索结果的相关性分数
 * @param originalQuery 原始查询
 * @param variant 搜索变体
 * @param results 搜索结果
 * @returns 相关性分数（越高越相关）
 */
function calculateRelevanceScore(
  originalQuery: string,
  variant: string,
  results: SearchResult[]
): number {
  let score = 0;

  // 基础分数：结果数量（越多越好，但有上限）
  score += Math.min(results.length * 10, 100);

  // 变体质量分数：越接近原始查询越好
  if (variant === originalQuery) {
    score += 1000; // 完全匹配最高分
  } else if (variant.includes('：') && originalQuery.includes(' ')) {
    score += 500; // 空格变冒号的变体较高分
  } else if (variant.includes(':') && originalQuery.includes(' ')) {
    score += 400; // 空格变英文冒号
  }
  // 移除数字变体加分逻辑，依赖智能匹配处理数字差异

  // 结果质量分数：检查结果标题的匹配程度
  const originalWords = originalQuery
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  results.forEach((result) => {
    const title = result.title.toLowerCase();
    let titleScore = 0;

    // 检查原始查询中的每个词是否在标题中
    let matchedWords = 0;
    originalWords.forEach((word) => {
      if (title.includes(word)) {
        // 较长的词（如"血脉诅咒"）给予更高权重
        const wordWeight = word.length > 2 ? 100 : 50;
        titleScore += wordWeight;
        matchedWords++;
      }
    });

    // 完全匹配奖励：所有词都匹配时给予巨大奖励
    if (matchedWords === originalWords.length && originalWords.length > 1) {
      titleScore += 500; // 大幅提高完全匹配的奖励
    }

    // 部分匹配惩罚：如果只匹配了部分词，降低分数
    if (matchedWords < originalWords.length && originalWords.length > 1) {
      titleScore -= 100; // 惩罚不完整匹配
    }

    // 标题长度惩罚：过长的标题降低优先级（可能不够精确）
    if (title.length > 50) {
      titleScore -= 20;
    }

    // 年份奖励：较新的年份获得更高分数
    if (result.year && result.year !== 'unknown') {
      const year = parseInt(result.year);
      if (year >= 2020) {
        titleScore += 30;
      } else if (year >= 2010) {
        titleScore += 10;
      }
    }

    score += titleScore;
  });

  return score;
}

// 匹配 m3u8 链接的正则
const M3U8_PATTERN = /(https?:\/\/[^"'\s]+?\.m3u8)/g;

/**
 * 生成搜索查询的多种变体，提高搜索命中率
 * @param originalQuery 原始查询
 * @returns 按优先级排序的搜索变体数组
 */
function generateSearchVariants(originalQuery: string): string[] {
  const trimmed = originalQuery.trim();

  // 优化：使用Set避免重复，限制变体数量
  const variants = new Set<string>([trimmed]);

  // 处理中文标点符号变体（限制为前3个最有用的变体）
  const chinesePunctuationVariants =
    generateChinesePunctuationVariants(trimmed);
  for (let i = 0; i < Math.min(3, chinesePunctuationVariants.length); i++) {
    variants.add(chinesePunctuationVariants[i]);
  }

  // 如果包含空格，生成额外变体
  if (trimmed.includes(' ')) {
    const keywords = trimmed.split(/\s+/);

    // 1. 去除所有空格（高优先级）
    const noSpaces = trimmed.replace(/\s+/g, '');
    if (noSpaces !== trimmed) {
      variants.add(noSpaces);
    }

    // 2. 空格变冒号的变体（重要！针对"死神来了 血脉诅咒" -> "死神来了：血脉诅咒"）
    const withColon = trimmed.replace(/\s+/g, '：');
    variants.add(withColon);

    // 3. 仅使用主关键词搜索（过滤无意义的词）
    const mainKeyword = keywords[0];
    const meaninglessWords = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'of',
      'in',
      'on',
      'at',
      'to',
      'for',
      'with',
      'by',
    ];
    if (
      mainKeyword.length > 2 &&
      !meaninglessWords.includes(mainKeyword.toLowerCase())
    ) {
      variants.add(mainKeyword);
    }

    // 4. 如果包含季/集信息，生成组合变体
    const lastKeyword = keywords[keywords.length - 1];
    if (/第|季|集|部|篇|章/.test(lastKeyword)) {
      const combined = mainKeyword + lastKeyword;
      variants.add(combined);
    }
  }

  // 限制最多返回5个变体，避免过多网络请求
  return Array.from(variants).slice(0, 5);
}

/**
 * 生成中文标点符号的搜索变体
 * @param query 原始查询
 * @returns 标点符号变体数组
 */
function generateChinesePunctuationVariants(query: string): string[] {
  const variants: string[] = [];

  // 检查是否包含中文标点符号
  const chinesePunctuation = /[：；，。！？、""''（）【】《》]/;
  if (!chinesePunctuation.test(query)) {
    return variants;
  }

  // 中文冒号变体 (针对"死神来了：血脉诅咒"这种情况)
  if (query.includes('：')) {
    // 优先级1: 替换为空格 (最可能匹配，如"死神来了 血脉诅咒" 能匹配到 "死神来了6：血脉诅咒")
    const withSpace = query.replace(/：/g, ' ');
    variants.push(withSpace);

    // 优先级2: 完全去除冒号
    const noColon = query.replace(/：/g, '');
    variants.push(noColon);

    // 优先级3: 替换为英文冒号
    const englishColon = query.replace(/：/g, ':');
    variants.push(englishColon);

    // 优先级4: 提取冒号前的主标题 (降低优先级，避免匹配到错误的系列)
    const beforeColon = query.split('：')[0].trim();
    if (beforeColon && beforeColon !== query) {
      variants.push(beforeColon);
    }

    // 优先级5: 提取冒号后的副标题
    const afterColon = query.split('：')[1]?.trim();
    if (afterColon) {
      variants.push(afterColon);
    }
  }

  // 其他中文标点符号处理
  let cleanedQuery = query;

  // 替换中文标点为对应英文标点
  cleanedQuery = cleanedQuery.replace(/；/g, ';');
  cleanedQuery = cleanedQuery.replace(/，/g, ',');
  cleanedQuery = cleanedQuery.replace(/。/g, '.');
  cleanedQuery = cleanedQuery.replace(/！/g, '!');
  cleanedQuery = cleanedQuery.replace(/？/g, '?');
  cleanedQuery = cleanedQuery.replace(/"/g, '"');
  cleanedQuery = cleanedQuery.replace(/"/g, '"');
  cleanedQuery = cleanedQuery.replace(/'/g, "'");
  cleanedQuery = cleanedQuery.replace(/'/g, "'");
  cleanedQuery = cleanedQuery.replace(/（/g, '(');
  cleanedQuery = cleanedQuery.replace(/）/g, ')');
  cleanedQuery = cleanedQuery.replace(/【/g, '[');
  cleanedQuery = cleanedQuery.replace(/】/g, ']');
  cleanedQuery = cleanedQuery.replace(/《/g, '<');
  cleanedQuery = cleanedQuery.replace(/》/g, '>');

  if (cleanedQuery !== query) {
    variants.push(cleanedQuery);
  }

  // 完全去除所有标点符号
  const noPunctuation = query.replace(
    /[：；，。！？、""''（）【】《》:;,.!?"'()[\]<>]/g,
    ''
  );
  if (noPunctuation !== query && noPunctuation.trim()) {
    variants.push(noPunctuation);
  }

  return variants;
}

/**
 * 按分类获取视频列表（专用于分类筛选）
 */
export async function getVideosByCategory(
  apiSite: ApiSite,
  category?: string,
  page = 1
): Promise<{ results: SearchResult[]; pageCount: number }> {
  let timeoutId: NodeJS.Timeout | null = null;
  const controller = new AbortController();

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

    // 设置8秒超时
    timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

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
    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // eslint-disable-next-line no-console
    console.error('分类筛选失败:', error);
    return { results: [], pageCount: 1 };
  }
}

export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  if (apiSite.detail) {
    return handleSpecialSourceDetail(id, apiSite);
  }

  const detailUrl = `${apiSite.api}${API_CONFIG.detail.path}${id}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (
    !data ||
    !data.list ||
    !Array.isArray(data.list) ||
    data.list.length === 0
  ) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  let episodes: string[] = [];
  let titles: string[] = [];

  // 处理播放源拆分
  if (videoDetail.vod_play_url) {
    const result = extractEpisodesFromPlayUrl(videoDetail.vod_play_url);
    episodes = result.episodes;
    titles = result.titles;
  }

  // 如果播放源为空，则尝试从内容中解析 m3u8
  if (episodes.length === 0 && videoDetail.vod_content) {
    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
    episodes = matches.map((link: string) => link.replace(/^\$/, ''));
  }

  return {
    id: id.toString(),
    title: videoDetail.vod_name,
    poster: videoDetail.vod_pic,
    episodes,
    episodes_titles: titles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: videoDetail.vod_class,
    year: videoDetail.vod_year
      ? videoDetail.vod_year.match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(videoDetail.vod_content),
    type_name: videoDetail.type_name,
    douban_id: videoDetail.vod_douban_id,
  };
}

async function handleSpecialSourceDetail(
  id: string,
  apiSite: ApiSite
): Promise<SearchResult> {
  const detailUrl = `${apiSite.detail}/index.php/vod/detail/id/${id}.html`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (apiSite.key === 'ffzy') {
    const ffzyPattern =
      /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = html.match(ffzyPattern) || [];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = html.match(generalPattern) || [];
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
}
