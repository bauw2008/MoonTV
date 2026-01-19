import { NextRequest, NextResponse } from 'next/server';

import { getRandomUserAgent } from '@/lib/user-agent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const EXTENDED_CATEGORIES_MAP: Record<string, string[]> = {
  都市: ['都市', '神豪', '豪门', '总裁', '霸总', '职场'],
  言情: [
    '言情',
    '甜宠',
    '虐恋',
    '情感',
    '暗恋',
    '日久生情',
    '先婚后爱',
    '破镜重圆',
    '双强',
    '强取豪夺',
  ],
  玄幻: [
    '玄幻',
    '仙侠',
    '修仙',
    '仙尊',
    '奇幻',
    '脑洞',
    '志怪',
    '系统',
    '灵魂互换',
    '反转',
    '心声流',
  ],
  古装: ['古装', '年代', '历史', '宫廷', '宅斗', '民国', '权谋'],
  穿越: ['穿越', '重生', '穿书'],
  萌宝: ['萌宝', '马甲', '养成', '千金'],
  励志: ['逆袭', '成长', '复仇', '打脸'],
  女频: ['女频', '病娇'],
  男频: ['男频'],
  现代: ['现代'],
  奇幻: ['奇幻'],
};

const DEFAULT_CATEGORY_ID = 1;

async function getShortDramaListFromWwzy(
  category: number,
  page = 1,
  size = 20,
) {
  const response = await fetch(
    `https://api.wwzy.tv/api.php/provide/vod?ac=list&t=${category}&pg=${page}&pagesize=${size}`,
    {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const list = (data.list || []).map((item: any) => ({
    id: item.vod_id,
    name: item.vod_name,
    cover: item.vod_pic,
    update_time: item.vod_time || new Date().toISOString(),
    score: parseFloat(item.vod_score) || 0,
    episode_count: item.vod_total || 1,
    description: item.vod_blurb || '',
    backdrop: item.vod_pic,
    vote_average: parseFloat(item.vod_score) || 0,
  }));

  return {
    list,
    hasMore: page < data.pagecount,
  };
}

async function getShortDramaDetails(
  ids: string[],
): Promise<Record<string, { vod_class: string; vod_pic: string }>> {
  const batchSize = 50;
  const detailsMap: Record<string, { vod_class: string; vod_pic: string }> = {};

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const idsStr = batch.join(',');

    try {
      const response = await fetch(
        `https://api.wwzy.tv/api.php/provide/vod?ac=detail&ids=${idsStr}`,
        {
          headers: {
            'User-Agent': getRandomUserAgent(),
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        },
      );

      if (response.ok) {
        const items = (await response.json()).list || [];
        items.forEach((item: any) => {
          detailsMap[item.vod_id.toString()] = {
            vod_class: item.vod_class || '',
            vod_pic: item.vod_pic || '',
          };
        });
      }
    } catch (error) {
      // 忽略详情获取失败，继续处理下一批
    }
  }

  return detailsMap;
}

function matchesExtendedCategory(
  vodClass: string,
  categoryValue: string,
): boolean {
  if (!categoryValue || !vodClass) {
    return false;
  }

  const keywords = EXTENDED_CATEGORIES_MAP[categoryValue];
  if (!keywords) {
    return false;
  }

  const classes = vodClass.split(',').map((c) => c.trim());
  return classes.some((c) => keywords.includes(c));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    let categoryId = searchParams.get('categoryId');
    const page = searchParams.get('page');
    const size = searchParams.get('size');
    const extendedCategory = searchParams.get('extendedCategory');

    if (!categoryId) {
      categoryId = DEFAULT_CATEGORY_ID.toString();
    }

    const category = parseInt(categoryId);
    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(category) || isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    if (extendedCategory && extendedCategory !== 'all') {
      const fetchSize = pageSize * 10;
      const result = await getShortDramaListFromWwzy(
        category,
        pageNum,
        fetchSize,
      );

      if (result.list.length === 0) {
        return NextResponse.json({ list: [], hasMore: false });
      }

      const ids = result.list.map((item) => item.id.toString());
      const detailsMap = await getShortDramaDetails(ids);

      const filteredList = result.list.filter((item) => {
        const details = detailsMap[item.id.toString()];
        return (
          details &&
          matchesExtendedCategory(details.vod_class, extendedCategory)
        );
      });

      const finalList = filteredList
        .map((item) => {
          const details = detailsMap[item.id.toString()];
          // 必须使用详情中的海报，因为列表中的海报可能为空
          const cover = details?.vod_pic || item.cover;
          return {
            ...item,
            cover: cover || '', // 确保至少返回空字符串
          };
        })
        .slice(0, pageSize);

      const response = NextResponse.json({
        list: finalList,
        hasMore: filteredList.length > pageSize,
      });

      response.headers.set(
        'Cache-Control',
        'public, max-age=300, s-maxage=300',
      );
      return response;
    }

    // 不使用扩展分类时，也需要获取详情来获取正确的海报
    const result = await getShortDramaListFromWwzy(category, pageNum, pageSize);

    if (result.list.length > 0) {
      const ids = result.list.map((item) => item.id.toString());
      const detailsMap = await getShortDramaDetails(ids);

      const listWithCovers = result.list.map((item) => {
        const details = detailsMap[item.id.toString()];
        const cover = details?.vod_pic || item.cover;
        return {
          ...item,
          cover: cover || '',
        };
      });

      const response = NextResponse.json({
        list: listWithCovers,
        hasMore: result.hasMore,
      });
      response.headers.set(
        'Cache-Control',
        'public, max-age=300, s-maxage=300',
      );
      return response;
    }

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response;
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
