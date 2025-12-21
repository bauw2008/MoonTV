import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { TypeInferenceService } from '@/lib/type-inference.service';
import {
  getAvailableApiSites,
  getConfig,
  hasSpecialFeaturePermission,
} from '@/lib/config';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import {
  getTVBoxCategoryCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
} from '@/lib/tvbox-cache';
import { getYellowWords } from '@/lib/yellow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 定义分类数据的类型
interface Category {
  type_id: number;
  type_pid: number;
  type_name: string;
}

interface CategoryData {
  class?: Category[];
}

// 获取视频源分类信息（带重试机制）
async function fetchSourceCategories(apiUrl: string): Promise<Category[]> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 构造分类信息请求URL
      let categoryUrl = apiUrl;

      // 处理不同类型API的分类请求URL
      let categoryUrlObj;
      try {
        categoryUrlObj = new URL(categoryUrl);
      } catch (error) {
        console.warn('URL解析失败，使用原始URL:', categoryUrl);
        categoryUrlObj = null;
      }

      if (categoryUrlObj) {
        // 对于MacCMS类型API，分类接口通常是基础路径 + ?ac=class
        if (categoryUrl.includes('/provide/vod')) {
          // 移除路径中的list参数
          if (categoryUrlObj.pathname.endsWith('/list')) {
            categoryUrlObj.pathname = categoryUrlObj.pathname.replace(
              '/list',
              '',
            );
          }

          // 保留原有参数，但确保ac=class存在
          const searchParams = new URLSearchParams(categoryUrlObj.search);
          searchParams.set('ac', 'class');
          categoryUrlObj.search = searchParams.toString();
        } else {
          // 对于其他类型API，保留原有参数，添加ac=class
          const searchParams = new URLSearchParams(categoryUrlObj.search);
          searchParams.set('ac', 'class');
          categoryUrlObj.search = searchParams.toString();
        }

        categoryUrl = categoryUrlObj.toString();
      } else {
        // 如果URL解析失败，使用简单方法添加参数
        const params = new URLSearchParams();
        params.append('ac', 'class');
        categoryUrl +=
          (categoryUrl.includes('?') ? '&' : '?') + params.toString();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(categoryUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TVBox/1.0.0',
          Accept: 'application/json, text/plain, */*',
          'Accept-Charset': 'utf-8',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `分类信息请求失败: ${response.status} ${response.statusText}`,
        );
      }

      // 获取响应内容类型，处理字符编码
      const contentType = response.headers.get('content-type') || '';
      let responseText;

      if (
        contentType.includes('charset=gbk') ||
        contentType.includes('charset=gb2312')
      ) {
        // 如果是GBK编码，需要转换
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('gbk');
        responseText = decoder.decode(buffer);
      } else {
        // 默认使用UTF-8
        responseText = await response.text();
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`分类数据JSON解析失败: ${errorMessage}`);
      }

      // 检查分类字段
      const categories = (data?.class || data?.list || []).filter(
        (cat: any) => cat?.type_id !== undefined && cat?.type_name,
      );

      if (categories.length > 0) {
        return categories;
      }

      throw new Error('源站返回空的分类数据');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `获取分类信息失败 (尝试 ${attempt}/${maxRetries}):`,
        lastError.message,
      );

      // 如果不是最后一次尝试，等待一段时间后重试
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // 递增等待时间
      }
    }
  }

  console.error(`获取分类信息最终失败:`, lastError?.message);
  return [];
}

// 废弃旧的分类常量，使用新的分类映射系统
// 顶级分类现在通过 CATEGORY_MAPPINGS 的 primary 字段定义

// 简化的分类映射配置
interface CategoryMapping {
  primary: string;
  secondary: string[];
}

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    primary: '电影',
    secondary: [
      '动作片',
      '喜剧片',
      '爱情片',
      '科幻片',
      '恐怖片',
      '剧情片',
      '战争片',
      '悬疑片',
      '犯罪片',
      '奇幻片',
      '邵氏电影',
      '武侠片',
      '喜剧',
      '爱情',
      '动作',
      '犯罪',
      '科幻',
      '奇幻',
      '冒险',
      '灾难',
      '恐怖',
      '惊悚',
      '剧情',
      '战争',
      '经典',
      '悬疑',
      '动画',
      '同性',
      '网络电影',
      '古装片',
      '家庭片',
      '惊悚片',
      '历史片',
    ],
  },
  {
    primary: '电视剧',
    secondary: [
      '国产剧',
      '香港剧',
      '台湾剧',
      '美国剧',
      '泰剧',
      '泰国剧',
      '韩国剧',
      '日本剧',
      '海外剧',
      '港台剧',
      '欧美剧',
      '其他剧',
      '日韩剧',
      '韩剧',
      '大陆剧',
      '日剧',
      '港澳剧',
      '台剧',
      '美剧',
    ],
  },
  {
    primary: '综艺',
    secondary: [
      '国产综艺',
      '大陆综艺',
      '港台综艺',
      '日韩综艺',
      '欧美综艺',
      '韩国综艺',
      '真人秀',
      '脱口秀',
      '选秀',
      '访谈',
      '美食',
      '旅游',
      '音乐',
      '舞蹈',
      '游戏',
      '竞技',
      '搞笑',
      '情感',
      '生活',
      '时尚',
      '健康',
      '亲子',
    ],
  },
  {
    primary: '动漫',
    secondary: [
      '国产动漫',
      '日韩动漫',
      '欧美动漫',
      '港台动漫',
      '海外动漫',
      '有声动漫',
      '动画片',
      '日本动漫',
    ],
  },
  {
    primary: '纪录片',
    secondary: [
      '人文',
      '地理',
      '自然',
      '动物',
      '历史',
      '科技',
      '社会',
      '军事',
      '探索',
      '纪实',
    ],
  },
  {
    primary: '体育',
    secondary: [
      '体育赛事',
      '足球',
      '篮球',
      '网球',
      '斯诺克',
      '乒乓球',
      '羽毛球',
      '台球',
      '拳击',
      '格斗',
      '赛车',
      '游泳',
      '田径',
      '体操',
      '电竞',
      '体育直播',
      '体育集锦',
      '体育新闻',
      '体育综艺',
    ],
  },
  {
    primary: '短剧',
    secondary: [
      '反转爽剧',
      '脑洞悬疑',
      '年代穿越',
      '古装仙侠',
      '现代都市',
      '擦边短剧',
      '女频恋爱',
      '重生民国',
      '民国剧',
      '战神',
      '神豪',
      '赘婿',
      '总裁',
      '甜宠',
      '复仇',
      '虐恋',
      '言情',
      '悬疑',
      '古风',
      '穿越',
      '重生',
      '短剧大全',
    ],
  },
  {
    primary: '教程',
    secondary: ['教学', '课程', '学习', '培训', '技能', '知识'],
  },
  {
    primary: '音乐',
    secondary: ['MV', 'KTV', '音乐现场', '音乐综艺'],
  },
  {
    primary: '游戏',
    secondary: ['游戏直播', '游戏解说', '游戏攻略', '电竞赛事'],
  },
  {
    primary: '生活',
    secondary: ['美食', '旅游', '健康', '时尚', '家居', '宠物', '亲子', '情感'],
  },
  {
    primary: '伦理片',
    secondary: ['港台三级', '韩国伦理', '西方伦理', '日本伦理', '两性课堂'],
  },
];

// 构建反向查找映射表
const SECONDARY_TO_PRIMARY_MAP = new Map<string, string>();
CATEGORY_MAPPINGS.forEach((mapping) => {
  mapping.secondary.forEach((secondary) => {
    SECONDARY_TO_PRIMARY_MAP.set(secondary.toLowerCase(), mapping.primary);
  });
});

// 简化的分类匹配函数
function findCategoryMatch(
  categoryName: string,
): { primary: string; secondary?: string } | null {
  const name = categoryName.trim();
  const nameLower = name.toLowerCase();

  // 1. 精确匹配一级分类
  for (const mapping of CATEGORY_MAPPINGS) {
    if (
      name === mapping.primary ||
      nameLower === mapping.primary.toLowerCase()
    ) {
      return { primary: mapping.primary };
    }
  }

  // 2. 精确匹配二级分类
  for (const mapping of CATEGORY_MAPPINGS) {
    for (const secondary of mapping.secondary) {
      if (name === secondary || nameLower === secondary.toLowerCase()) {
        return { primary: mapping.primary, secondary };
      }
    }
  }

  // 3. 包含匹配 - 检查分类名是否包含关键词
  for (const mapping of CATEGORY_MAPPINGS) {
    const primaryLower = mapping.primary.toLowerCase();
    if (nameLower.includes(primaryLower) || primaryLower.includes(nameLower)) {
      return { primary: mapping.primary };
    }
  }

  // 4. 二级分类包含匹配
  for (const mapping of CATEGORY_MAPPINGS) {
    for (const secondary of mapping.secondary) {
      const secondaryLower = secondary.toLowerCase();
      if (
        nameLower.includes(secondaryLower) ||
        secondaryLower.includes(nameLower)
      ) {
        return { primary: mapping.primary, secondary };
      }
    }
  }

  return null;
}

// 简化的分类层级结构构建
function buildCategoryStructure(categories: Category[]): {
  primary_categories: Category[];
  secondary_categories: Category[];
  category_map: Record<number, Category>;
} {
  const structure = {
    primary_categories: [] as Category[],
    secondary_categories: [] as Category[],
    category_map: {} as Record<number, Category>,
  };

  // 如果源站已经提供了层级信息(type_pid字段),直接使用
  if (categories.length > 0 && categories[0].type_pid !== undefined) {
    structure.primary_categories = categories.filter(
      (cat) => cat.type_pid === 0,
    );
    structure.secondary_categories = categories.filter(
      (cat) => cat.type_pid !== 0,
    );

    [
      ...structure.primary_categories,
      ...structure.secondary_categories,
    ].forEach((cat) => {
      structure.category_map[cat.type_id] = cat;
    });

    return structure;
  }

  // 源站没有层级信息,需要智能分类
  const primaryMap = new Map<string, Category>();
  const processedIds = new Set<number>();

  categories.forEach((cat) => {
    if (processedIds.has(cat.type_id)) return;

    const categoryName = cat.type_name || '';
    const match = findCategoryMatch(categoryName);

    if (!match) {
      // 无法匹配,作为独立一级分类
      structure.primary_categories.push(cat);
      processedIds.add(cat.type_id);
      return;
    }

    // 匹配到二级分类
    if (match.secondary) {
      let primaryCat = primaryMap.get(match.primary);

      if (!primaryCat) {
        // 创建虚拟一级分类
        primaryCat = {
          type_id: -(1000000 + structure.primary_categories.length),
          type_pid: 0,
          type_name: match.primary,
        };
        structure.primary_categories.push(primaryCat);
        primaryMap.set(match.primary, primaryCat);
      }

      const secondaryCat = { ...cat, type_pid: primaryCat.type_id };
      structure.secondary_categories.push(secondaryCat);
    } else {
      // 匹配到一级分类
      structure.primary_categories.push(cat);
      primaryMap.set(match.primary, cat);
    }

    processedIds.add(cat.type_id);
  });

  // 创建分类映射
  [...structure.primary_categories, ...structure.secondary_categories].forEach(
    (cat) => {
      structure.category_map[cat.type_id] = cat;
    },
  );

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
    // 统一处理category参数，可能是字符串形式的数字或空字符串
    let category: string = url.searchParams.get('category') || '0';
    if (category === '') {
      category = '0'; // 全部分类
    }
    const page = parseInt(url.searchParams.get('page') || '1');

    if (!source)
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });

    let availableSites;
    try {
      availableSites = await getAvailableApiSites(authInfo.username);
    } catch (error) {
      console.error('获取可用站点失败:', error);
      return NextResponse.json({ error: '获取可用站点失败' }, { status: 500 });
    }

    const site = availableSites.find((s) => s.key === source);
    if (!site)
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });

    // 尝试从缓存获取数据
    try {
      const videoCache = await getTVBoxVideoCache(source, category, page);
      const categoryCache = await getTVBoxCategoryCache(source);

      if (
        videoCache &&
        videoCache.list &&
        videoCache.list.length > 0 &&
        categoryCache &&
        categoryCache.primary_categories &&
        categoryCache.primary_categories.length > 0
      ) {
        // 为缓存的视频添加源名称
        const videosWithSourceName = videoCache.list.map((video: any) => ({
          ...video,
          source_name: site.name,
        }));

        return NextResponse.json({
          list: videosWithSourceName,
          categories: categoryCache,
          pagecount: videoCache.pagecount,
          fromCache: true,
        });
      }
    } catch (error) {
      // 缓存失败,继续从源站获取
    }

    // 获取视频源分类信息
    let finalCategoryStructure: {
      primary_categories: Category[];
      secondary_categories: Category[];
      category_map: Record<number, Category>;
    };

    try {
      const sourceCategories = await fetchSourceCategories(site.api);

      if (sourceCategories?.length > 0) {
        finalCategoryStructure = buildCategoryStructure(sourceCategories);

        // 获取配置以检查是否禁用18+过滤器
        const config = await getConfig();

        // 检查用户是否有禁用18+过滤的权限
        const hasYellowFilterPermission = await hasSpecialFeaturePermission(
          authInfo.username,
          'disable-yellow-filter',
          config,
        );

        // 过滤18+分类：当全局禁用18+过滤关闭时，且用户没有禁用18+过滤权限时进行过滤
        if (
          !config.SiteConfig.DisableYellowFilter &&
          !hasYellowFilterPermission
        ) {
          const yellowWords = await getYellowWords();
          finalCategoryStructure.primary_categories =
            finalCategoryStructure.primary_categories.filter((category) => {
              const categoryName = category.type_name || '';
              const shouldFilter = yellowWords.some((word) =>
                categoryName.includes(word),
              );
              return !shouldFilter;
            });

          finalCategoryStructure.secondary_categories =
            finalCategoryStructure.secondary_categories.filter((category) => {
              const categoryName = category.type_name || '';
              const shouldFilter = yellowWords.some((word) =>
                categoryName.includes(word),
              );
              return !shouldFilter;
            });

          // 从category_map中移除被过滤的分类
          Object.keys(finalCategoryStructure.category_map).forEach((typeId) => {
            const category =
              finalCategoryStructure.category_map[parseInt(typeId)];
            const shouldFilter = yellowWords.some((word) =>
              category.type_name.includes(word),
            );
            if (shouldFilter) {
              delete finalCategoryStructure.category_map[parseInt(typeId)];
            }
          });
        }

        // 屏蔽指定的分类：资讯、公告、头条
        const blockedCategories = ['资讯', '公告', '头条'];
        finalCategoryStructure.primary_categories =
          finalCategoryStructure.primary_categories.filter((category) => {
            const categoryName = category.type_name || '';
            const shouldBlock = blockedCategories.some((word) =>
              categoryName.includes(word),
            );
            return !shouldBlock;
          });

        finalCategoryStructure.secondary_categories =
          finalCategoryStructure.secondary_categories.filter((category) => {
            const categoryName = category.type_name || '';
            const shouldBlock = blockedCategories.some((word) =>
              categoryName.includes(word),
            );
            return !shouldBlock;
          });

        // 从category_map中移除被屏蔽的分类
        Object.keys(finalCategoryStructure.category_map).forEach((typeId) => {
          const category =
            finalCategoryStructure.category_map[parseInt(typeId)];
          const shouldBlock = blockedCategories.some((word) =>
            category.type_name.includes(word),
          );
          if (shouldBlock) {
            delete finalCategoryStructure.category_map[parseInt(typeId)];
          }
        });
      } else {
        // 源站返回空的分类数据，创建默认分类结构
        console.warn(`源站 ${source} 返回空的分类数据，使用默认分类`);
        finalCategoryStructure = {
          primary_categories: [
            { type_id: 1, type_pid: 0, type_name: '电影' },
            { type_id: 2, type_pid: 0, type_name: '电视剧' },
            { type_id: 3, type_pid: 0, type_name: '综艺' },
            { type_id: 4, type_pid: 0, type_name: '动漫' },
            { type_id: 5, type_pid: 0, type_name: '其他' },
          ],
          secondary_categories: [],
          category_map: {
            1: { type_id: 1, type_pid: 0, type_name: '电影' },
            2: { type_id: 2, type_pid: 0, type_name: '电视剧' },
            3: { type_id: 3, type_pid: 0, type_name: '综艺' },
            4: { type_id: 4, type_pid: 0, type_name: '动漫' },
            5: { type_id: 5, type_pid: 0, type_name: '其他' },
          },
        };
      }
    } catch (error) {
      console.error(`获取分类信息失败 (源站: ${source}):`, error);
      // 使用空分类结构，但不缓存空分类数据
      finalCategoryStructure = {
        primary_categories: [],
        secondary_categories: [],
        category_map: {},
      };
    }

    // 获取视频列表
    let results: any[] = [];
    let totalPages = 1;

    try {
      const categoryResult = await getVideosByCategory(
        site,
        category || undefined,
        page,
      );
      results = categoryResult.results;
      totalPages = categoryResult.pageCount;
    } catch (err) {
      console.error('获取视频列表失败:', err);

      // 尝试从缓存获取
      try {
        const cachedData = await getTVBoxVideoCache(source, category, page);
        if (cachedData?.list && cachedData.list.length > 0) {
          results = cachedData.list;
          totalPages = cachedData.pagecount || 1;
        }
      } catch (cacheError) {
        // 缓存也失败,返回空结果
      }
    }

    // 缓存结果
    if (results?.length > 0) {
      try {
        await setTVBoxVideoCache(
          source,
          { list: results, pagecount: totalPages },
          category,
          page,
          page <= 3,
        );
      } catch (cacheError) {
        // 缓存失败不影响主流程
      }
    }

    // 为每个视频添加源名称和统一类型推断
    const videosWithMetadata = TypeInferenceService.inferBatch(
      results.map((video) => {
        // 获取视频的分类ID（可能在 type_id 或 tid 字段）
        const videoCategoryId = video.type_id || video.tid || null;

        // 保留分类信息用于调试
        const categoryInfo = videoCategoryId
          ? finalCategoryStructure.category_map[videoCategoryId]
          : null;

        return {
          ...video,
          source_name: site.name,
          categoryInfo, // 添加分类信息用于调试
          // TypeInferenceService会处理类型推断
        };
      }),
    );

    return NextResponse.json({
      list: videosWithMetadata,
      categories: finalCategoryStructure,
      pagecount: totalPages,
      fromCache: false,
    });
  } catch (err) {
    console.error('加载视频失败:', err);
    return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
  }
}
