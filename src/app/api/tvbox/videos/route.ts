import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites } from '@/lib/config';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import { secureTvboxData } from '@/lib/tvbox-security';
import { searchFromApi } from '@/lib/downstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定义分类数据的类型
interface CategoryData {
  class?: Array<{
    type_id: number;
    type_pid: number;
    type_name: string;
  }>;
}

// 获取视频源分类信息
async function fetchSourceCategories(apiUrl: string): Promise<any[]> {
  try {
    const data = await secureTvboxData<CategoryData>(apiUrl);

    if (data && data.class && Array.isArray(data.class)) {
      return data.class;
    }

    return [];
  } catch (error) {
    console.error('获取分类信息失败:', error);
    return [];
  }
}

// 构建分类层级结构
function buildCategoryStructure(categories: any[]): any {
  const structure = {
    primary_categories: [] as any[], // 一级分类
    secondary_categories: [] as any[], // 二级分类
    category_map: {} as Record<number, any>, // 分类映射
  };

  // 获取所有一级分类 (type_pid === 0)
  structure.primary_categories = categories.filter((cat) => cat.type_pid === 0);

  // 获取所有二级分类 (type_pid !== 0)
  structure.secondary_categories = categories.filter(
    (cat) => cat.type_pid !== 0
  );

  // 创建分类映射，便于查找
  categories.forEach((cat) => {
    structure.category_map[cat.type_id] = cat;
  });

  return structure;
}

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const category = url.searchParams.get('category') || '';
    const page = parseInt(url.searchParams.get('page') || '1');

    if (!source)
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });

    const availableSites = await getAvailableApiSites(authInfo.username);
    const site = availableSites.find((s) => s.key === source);
    if (!site)
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });

    // 获取视频源分类信息
    const sourceCategories = await fetchSourceCategories(site.api);

    // 构建分类结构
    const categoryStructure = buildCategoryStructure(sourceCategories);

    // 使用新的分类筛选函数
    let results: any[] = [];
    let totalPages = 1;

    try {
      const categoryResult = await getVideosByCategory(
        site,
        category || undefined,
        page
      );
      results = categoryResult.results;
      totalPages = categoryResult.pageCount;
    } catch (err) {
      console.error('分类筛选失败，使用备用方案:', err);
      // fallback: 使用搜索函数但传入空关键词获取所有视频
      const searchResults = await searchFromApi(site, '');
      // 如果有分类参数，手动过滤结果
      if (category) {
        results = searchResults.filter(
          (item: any) =>
            item.type_id === parseInt(category) ||
            (item.class && item.class.includes(category))
        );
      } else {
        results = searchResults;
      }

      // 计算分页
      const PAGE_SIZE = 24;
      totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      results = results.slice(start, end);
    }

    return NextResponse.json({
      list: results,
      categories: categoryStructure,
      pagecount: totalPages,
    });
  } catch (err) {
    console.error('加载视频失败:', err);
    return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
  }
}
