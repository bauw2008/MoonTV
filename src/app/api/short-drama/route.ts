import { NextRequest, NextResponse } from 'next/server';

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

/** 爬取豆瓣短剧标签页 */
async function fetchDoubanShortDrama(
  start: number,
  limit: number,
): Promise<ShortDramaItem[]> {
  const url = `https://www.douban.com/tag/%E7%9F%AD%E5%89%A7/movie?start=${start}`;

  // 请求限流 - 与其他API保持一致
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest),
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
    /<dl[^>]*>\s*<dt>\s*<a href="https?:\/\/movie\.douban\.com\/subject\/(\d+)\/[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>\s*<\/a>\s*<\/dt>\s*<dd>\s*<a href="https?:\/\/movie\.douban\.com\/subject\/\d+\/[^"]*"[^>]*class="title"[^>]*>([^<]+)<\/a>[\s\S]*?<div class="desc">\s*([^<]*?)\s*<\/div>\s*(?:<div class="rating">\s*<span class="allstar\d+"><\/span>\s*<span class="rating_nums">([^<]*)<\/span>\s*<\/div>)?/g;

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
  if (!year) {
    return false;
  }

  const filterYearNum = parseInt(filterYear);
  if (!isNaN(filterYearNum)) {
    return year === filterYearNum;
  }

  return true;
}

// 导出处理函数
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');

    // 如果有keyword参数，执行搜索逻辑（暂时返回空数组）
    if (keyword) {
      // TODO: 实现短剧搜索逻辑
      return NextResponse.json([]);
    }

    // 没有keyword参数，返回短剧列表数据
    const start = parseInt(searchParams.get('start') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const region = searchParams.get('region');
    const year = searchParams.get('year');

    // 获取短剧数据
    let shortDramaItems = await fetchDoubanShortDrama(start, limit);

    // 应用过滤条件
    if (type && type !== 'all') {
      shortDramaItems = shortDramaItems.filter((item) =>
        item.types.some((t) => t.toLowerCase().includes(type.toLowerCase())),
      );
    }

    if (region && region !== 'all') {
      shortDramaItems = shortDramaItems.filter((item) =>
        item.region.toLowerCase().includes(region.toLowerCase()),
      );
    }

    if (year && year !== 'all') {
      shortDramaItems = shortDramaItems.filter((item) =>
        matchYear(item.year, year),
      );
    }

    // 返回标准格式的DoubanResult
    const result: DoubanResult = {
      code: 200,
      message: 'success',
      list: shortDramaItems.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster,
        rate: item.rate,
        year: item.year,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取短剧数据失败:', error);

    // 如果是网络错误，返回空数据而不是错误状态
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json({
        code: 200,
        message: 'success',
        list: [],
      });
    }

    return NextResponse.json({ error: '获取短剧数据失败' }, { status: 500 });
  }
}
