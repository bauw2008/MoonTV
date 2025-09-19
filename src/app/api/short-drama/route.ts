/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { DoubanItem, DoubanResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 扩展 DoubanItem，增加短剧特定字段
export interface ShortDramaItem extends DoubanItem {
  region: string;
  types: string[];
  desc: string;
}

// 用户代理池 - 使用与其他API相同的UA
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

// 请求限制器 - 与其他API保持一致
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000;

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 统一参数命名 - 使用与其他API相同的参数名
  const type = searchParams.get('type') || 'all';
  const region = searchParams.get('region') || 'all';
  const year = searchParams.get('year') || 'all';
  const pageStart = parseInt(searchParams.get('start') || '0');
  const pageLimit = parseInt(searchParams.get('limit') || '25');
  const pages = parseInt(searchParams.get('pages') || '1');

  // 参数验证 - 与其他API保持一致的验证风格
  if (pageLimit < 1 || pageLimit > 100) {
    return NextResponse.json(
      { error: 'limit 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (pageStart < 0) {
    return NextResponse.json({ error: 'start 不能小于 0' }, { status: 400 });
  }

  try {
    const allResults: ShortDramaItem[] = [];

    for (let p = 0; p < pages; p++) {
      const results = await fetchDoubanShortDrama(
        pageStart + p * pageLimit,
        pageLimit
      );
      allResults.push(...results);

      // 使用统一的延时逻辑
      if (p < pages - 1) {
        await randomDelay(1000, 2000);
      }
    }

    // 筛选逻辑
    const filteredResults = allResults.filter((result) => {
      if (type !== 'all' && !result.types.includes(type)) return false;
      if (region !== 'all' && result.region !== region) return false;
      if (year !== 'all' && result.year && !matchYear(result.year, year))
        return false;
      return true;
    });

    // 去重
    const seenIds = new Set<string>();
    const uniqueResults = filteredResults.filter((result) => {
      if (seenIds.has(result.id)) return false;
      seenIds.add(result.id);
      return true;
    });

    // 排序 - 按年份降序
    const sortedResults = uniqueResults.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return yearB - yearA;
    });

    // 分页
    const total = sortedResults.length;
    const totalPages = Math.ceil(total / pageLimit);
    const list = sortedResults.slice(0, pageLimit);

    // 统一的响应格式
    const response: DoubanResult = {
      code: 200,
      message: '获取成功',
      list: list.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster,
        rate: item.rate,
        year: item.year,
        // 保持与其他API字段的一致性
        region: item.region,
        desc: item.desc,
        type_name: item.types.join(', '),
      })),
    };

    const cacheTime = await getCacheTime();
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Netlify-Vary': 'query',
      },
    });
  } catch (error) {
    console.error('获取豆瓣短剧数据失败:', error);
    return NextResponse.json(
      {
        error: '获取豆瓣短剧数据失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/** 爬取豆瓣短剧标签页 */
async function fetchDoubanShortDrama(
  start: number,
  limit: number
): Promise<ShortDramaItem[]> {
  const url = `https://www.douban.com/tag/%E7%9F%AD%E5%89%A7/movie?start=${start}`;

  // 请求限流 - 与其他API保持一致
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  // 随机延时
  await randomDelay(500, 1500);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        Referer: 'https://movie.douban.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const html = await response.text();
    return parseShortDramaHtml(html);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/** 解析HTML内容 - 修改为保持中文数据 */
function parseShortDramaHtml(html: string): ShortDramaItem[] {
  const dlPattern =
    /<dl[^>]*>[\s\S]*?<a href="https?:\/\/movie\.douban\.com\/subject\/(\d+)\/[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<a[^>]+class="title"[^>]*>([^<]+)<\/a>[\s\S]*?<div class="desc">([\s\S]*?)<\/div>[\s\S]*?(?:<span class="rating_nums">([^<]+)<\/span>)?/g;

  const results: ShortDramaItem[] = [];
  let match;

  while ((match = dlPattern.exec(html)) !== null) {
    const id = match[1];
    const poster = match[2].replace(/^http:/, 'https:');
    const title = match[3].trim();
    const desc = match[4].trim().replace(/\s+/g, ' ');
    const rate = match[5] ? match[5].trim() : '';

    // 正确解析 desc 字段，保持中文
    const descParts = desc.split(' / ').filter((part) => part.trim() !== '');

    let region = '其他';
    let year = '';
    const types: string[] = [];

    if (descParts.length > 0) {
      // 第一个部分是地区，保持中文
      region = descParts[0];

      // 从第二个部分开始是类型，直到遇到年份数字
      for (let i = 1; i < descParts.length; i++) {
        const part = descParts[i];

        // 检查是否是年份（4位数字）
        if (/^\d{4}$/.test(part)) {
          year = part;
          break; // 年份后面的部分是导演和演员
        }

        // 类型字段保持中文
        if (part && !types.includes(part)) {
          types.push(part);
        }
      }

      // 如果没有找到年份，尝试从其他位置查找
      if (!year) {
        for (let i = descParts.length - 1; i >= 0; i--) {
          if (/^\d{4}$/.test(descParts[i])) {
            year = descParts[i];
            break;
          }
        }
      }
    }

    results.push({
      id,
      title,
      poster,
      rate,
      year,
      region,
      types: types.length > 0 ? types : ['剧情'], // 默认类型为"剧情"
      desc,
    });
  }

  return results;
}

// 简化 matchYear 函数
function matchYear(resultYear: string, filterYear: string): boolean {
  const year = parseInt(resultYear);
  if (!year) return false;

  const filterYearNum = parseInt(filterYear);
  if (!isNaN(filterYearNum)) {
    return year === filterYearNum;
  }

  return true;
}
