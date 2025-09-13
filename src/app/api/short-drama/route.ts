/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import { NextRequest, NextResponse } from 'next/server';
import { getCacheTime } from '@/lib/config';
import { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
];

/** 随机延迟 1-3 秒 */
async function delayRandom() {
  const ms = 1000 + Math.floor(Math.random() * 2000);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 获取随机 UA */
function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const region = searchParams.get('region') || 'all';
  const year = searchParams.get('year') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');
  const pagesToFetch = parseInt(searchParams.get('pages') || '1'); // 支持多页抓取

  try {
    let allResults: SearchResult[] = [];

    for (let p = 0; p < pagesToFetch; p++) {
      const results = await fetchDoubanShortDrama(page + p, limit);
      allResults.push(...results);
      await delayRandom(); // 延迟，避免封 IP
    }

    // 类型/地区/年份筛选
    const filteredResults = allResults.filter((result) => {
      if (type !== 'all' && getShortDramaType(result.type_name, result.title) !== type) return false;
      if (region !== 'all' && getContentRegion(result.title, result.desc) !== region) return false;
      if (year !== 'all' && result.year && !matchYear(result.year, year)) return false;
      return true;
    });

    // 去重
    const seenTitles = new Set<string>();
    const uniqueResults: SearchResult[] = [];
    for (const r of filteredResults) {
      if (!seenTitles.has(r.title)) {
        seenTitles.add(r.title);
        uniqueResults.push(r);
      }
    }

    // 排序
    const sortedResults = uniqueResults.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      if (yearA !== yearB) return yearB - yearA;
      return a.title.length - b.title.length;
    });

    const startIndex = 0;
    const endIndex = Math.min(limit, sortedResults.length);
    const paginatedResults = sortedResults.slice(startIndex, endIndex);

    const cacheTime = await getCacheTime();
    return NextResponse.json(
      {
        results: paginatedResults,
        total: sortedResults.length,
        page,
        limit,
        totalPages: Math.ceil(sortedResults.length / limit),
      },
      {
        headers: { 'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}` },
      }
    );
  } catch (error) {
    console.error('获取豆瓣短剧数据失败:', error);
    return NextResponse.json({ error: '获取豆瓣短剧数据失败' }, { status: 500 });
  }
}

/** 爬取豆瓣短剧标签页，每页 15 条 */
async function fetchDoubanShortDrama(page: number, limit: number): Promise<SearchResult[]> {
  const start = (page - 1) * limit;
  const url = `https://www.douban.com/tag/%E7%9F%AD%E5%89%A7/movie?start=${start}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': getRandomUA() },
  });
  if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
  const html = await res.text();

  const dlPattern =
    /<dl>[\s\S]*?<a href="https?:\/\/movie\.douban\.com\/subject\/(\d+)\/[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<a[^>]+class="title"[^>]*>([^<]+)<\/a>[\s\S]*?<div class="desc">([\s\S]*?)<\/div>[\s\S]*?(?:<span class="rating_nums">([\d.]+)<\/span>)?/g;

  const results: SearchResult[] = [];
  let match;
  while ((match = dlPattern.exec(html)) !== null) {
    const id = match[1];
    const poster = match[2].replace(/^http:/, 'https:');
    const title = match[3].trim();
    const desc = match[4].trim().replace(/\s+/g, ' ');
    const rate = match[5] || '';
    const year = extractYear(desc);

  results.push({
    id,
    title,
    poster,
    desc,
    year,
    // rate,  // 评分，如果后面需要可启用
    region: extractRegion(desc),
    type_name: '短剧',
  });
}


  return results;
}

function extractYear(desc: string) {
  const match = desc.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function extractRegion(desc: string) {
  const text = desc.toLowerCase();
  if (text.includes('韩国')) return 'korean';
  if (text.includes('日本')) return 'japanese';
  if (text.includes('美国')) return 'usa';
  if (text.includes('英国')) return 'uk';
  if (text.includes('泰国')) return 'thailand';
  if (text.includes('中国') || text.includes('国产')) return 'mainland_china';
  return 'all';
}

function getShortDramaType(typeName?: string, title?: string): string {
  const content = `${typeName || ''} ${title || ''}`.toLowerCase();
  if (content.includes('爱情') || content.includes('romance')) return 'romance';
  if (content.includes('家庭') || content.includes('family')) return 'family';
  if (content.includes('古装') || content.includes('costume')) return 'costume';
  if (content.includes('现代') || content.includes('modern')) return 'modern';
  if (content.includes('都市') || content.includes('urban')) return 'urban';
  if (content.includes('穿越') || content.includes('time')) return 'time_travel';
  if (content.includes('喜剧') || content.includes('comedy')) return 'comedy';
  if (content.includes('悬疑') || content.includes('suspense')) return 'suspense';
  return 'all';
}

function getContentRegion(title?: string, desc?: string) {
  const content = `${title || ''} ${desc || ''}`.toLowerCase();
  if (content.includes('韩国')) return 'korean';
  if (content.includes('日本')) return 'japanese';
  if (content.includes('美国')) return 'usa';
  if (content.includes('英国')) return 'uk';
  if (content.includes('泰国')) return 'thailand';
  if (content.includes('中国') || content.includes('国产')) return 'mainland_china';
  return 'all';
}

function matchYear(resultYear: string, filterYear: string): boolean {
  const year = parseInt(resultYear);
  if (!year) return false;
  switch (filterYear) {
    case '2025': return year === 2025;
    case '2024': return year === 2024;
    case '2023': return year === 2023;
    case '2022': return year === 2022;
    case '2021': return year === 2021;
    case '2020s': return year >= 2020 && year <= 2029;
    case '2010s': return year >= 2010 && year <= 2019;
    default: return true;
  }
}

