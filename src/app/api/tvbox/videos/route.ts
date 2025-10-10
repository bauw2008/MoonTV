import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import {
  getAvailableApiSites,
  getConfig,
  hasSpecialFeaturePermission,
} from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import {
  getTVBoxCategoryCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
} from '@/lib/tvbox-cache';
import { calculatePagination } from '@/lib/tvbox-utils';
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
              ''
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
          `分类信息请求失败: ${response.status} ${response.statusText}`
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

      // 调试日志：输出分类请求的URL和响应
      if (process.env.NODE_ENV === 'development') {
        console.log(`分类请求URL: ${categoryUrl}`);
        console.log(`分类响应状态: ${response.status}`);
        console.log(`分类响应内容类型: ${contentType}`);
        console.log(`分类响应内容: ${responseText.substring(0, 200)}...`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        console.error('分类数据JSON解析失败:', errorMessage);
        console.error('原始响应内容:', responseText.substring(0, 500));
        throw new Error(`分类数据JSON解析失败: ${errorMessage}`);
      }

      // 检查分类字段名，先检查class字段，再检查list字段
      let categories = [];

      if (data && data.class && Array.isArray(data.class)) {
        categories = data.class.filter(
          (cat: any) => cat && cat.type_id !== undefined && cat.type_name
        );
      } else if (data && data.list && Array.isArray(data.list)) {
        // 有些API可能使用list字段返回分类
        categories = data.list.filter(
          (cat: any) => cat && cat.type_id !== undefined && cat.type_name
        );
      }

      if (categories.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`成功获取分类数据: ${categories.length} 个分类`);
          console.log(`分类获取结果:`, {
            source: apiUrl,
            categoriesCount: categories.length,
            categories: categories.map((cat: Category) => ({
              id: cat.type_id,
              name: cat.type_name,
            })),
          });
        }
        return categories;
      } else {
        throw new Error('源站返回空的分类数据');
      }

      throw new Error(
        `分类数据格式无效，期望class或list字段，实际响应: ${JSON.stringify(
          data
        ).substring(0, 200)}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `获取分类信息失败 (尝试 ${attempt}/${maxRetries}):`,
        lastError.message
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

// 分类映射配置 - 支持模糊匹配和智能映射
interface CategoryMapping {
  primary: string;
  secondary: string[];
  keywords: string[]; // 匹配关键词
  priority: number; // 优先级，数字越大优先级越高
}

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    primary: '电影',
    secondary: [
      '电影',
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
      '武侠片',
    ],
    keywords: ['电影', '影片', '影院', 'Movie', 'movie'],
    priority: 10,
  },
  {
    primary: '电视剧',
    secondary: [
      '国产剧',
      '香港剧',
      '台湾剧',
      '美国剧',
      '泰剧',
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
    keywords: ['电视剧', '剧集', '连续剧', 'TV', 'tv', 'TV Series', 'TVShow'],
    priority: 10,
  },
  {
    primary: '综艺',
    secondary: [
      '国产综艺',
      '大陆综艺',
      '港台综艺',
      '日韩综艺',
      '欧美综艺',
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
    keywords: ['综艺', '娱乐节目', '综艺节目', 'Variety', 'variety'],
    priority: 9,
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
    keywords: ['动漫', '动画', '卡通', 'Anime', 'anime', 'Cartoon', 'cartoon'],
    priority: 9,
  },
  {
    primary: '纪录片',
    secondary: [
      '纪录片',
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
    keywords: ['纪录片', '纪录', '纪实', 'Documentary', 'documentary'],
    priority: 8,
  },
  {
    primary: '体育',
    secondary: [
      '体育',
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
    keywords: [
      '体育',
      '运动',
      '比赛',
      'Sports',
      'sports',
      'Sport',
      '赛事',
      '球赛',
      '足球',
      '篮球',
      '网球',
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
    ],
    priority: 8,
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
    ],
    keywords: ['短剧', '微短剧', '短篇剧', 'Short', 'short', 'Mini', 'mini'],
    priority: 7,
  },
  {
    primary: '教程',
    secondary: ['教程', '教学', '课程', '学习', '培训', '技能', '知识'],
    keywords: [
      '教程',
      '教学',
      '课程',
      '学习',
      '培训',
      'Tutorial',
      'tutorial',
      'Course',
      'course',
    ],
    priority: 6,
  },
  {
    primary: '音乐',
    secondary: ['音乐', 'MV', 'KTV', '音乐现场', '音乐综艺'],
    keywords: ['音乐', '歌曲', '歌手', 'Music', 'music', 'MV', 'mv'],
    priority: 6,
  },
  {
    primary: '游戏',
    secondary: ['游戏', '游戏直播', '游戏解说', '游戏攻略', '电竞赛事'],
    keywords: ['游戏', '游戏直播', '电竞', 'Game', 'game', 'Gaming', 'gaming'],
    priority: 6,
  },
  {
    primary: '生活',
    secondary: [
      '生活',
      '美食',
      '旅游',
      '健康',
      '时尚',
      '家居',
      '宠物',
      '亲子',
      '情感',
    ],
    keywords: [
      '生活',
      '美食',
      '旅游',
      '健康',
      '时尚',
      '家居',
      '宠物',
      '亲子',
      '情感',
      'Life',
      'life',
      'Food',
      'food',
      'Travel',
      'travel',
    ],
    priority: 5,
  },
  {
    primary: '伦理片',
    secondary: ['港台三级', '韩国伦理', '西方伦理', '日本伦理', '两性课堂'],
    keywords: ['伦理', '三级', '情色', 'Adult', 'adult', 'Erotic', 'erotic'],
    priority: 1,
  },
  {
    primary: '资讯',
    secondary: ['影视资讯', '明星资讯', '娱乐新闻', '新闻资讯'],
    keywords: [
      '资讯',
      '新闻',
      '消息',
      'News',
      'news',
      'Information',
      'information',
    ],
    priority: 3,
  },
];

// 创建快速查找表
const PRIMARY_CATEGORIES = CATEGORY_MAPPINGS.map((mapping) => mapping.primary);
const SECONDARY_CATEGORIES = CATEGORY_MAPPINGS.flatMap(
  (mapping) => mapping.secondary
);
const CATEGORY_KEYWORDS = new Map<string, CategoryMapping>();
CATEGORY_MAPPINGS.forEach((mapping) => {
  mapping.keywords.forEach((keyword) => {
    CATEGORY_KEYWORDS.set(keyword.toLowerCase(), mapping);
  });
});

// 分类层级关系现在通过 CATEGORY_MAPPINGS 配置管理

// 计算字符串相似度（Levenshtein距离）
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 计算编辑距离
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 删除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }

  // 转换为相似度（0-1）
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

// 查找最佳匹配分类
function findBestCategoryMatch(
  categoryName: string
): { primary: string; secondary?: string } | null {
  const normalizedName = categoryName.toLowerCase().trim();

  // 1. 精确匹配
  for (const mapping of CATEGORY_MAPPINGS) {
    if (normalizedName === mapping.primary.toLowerCase()) {
      return { primary: mapping.primary };
    }

    for (const secondary of mapping.secondary) {
      if (normalizedName === secondary.toLowerCase()) {
        return { primary: mapping.primary, secondary };
      }
    }
  }

  // 2. 关键词匹配
  let keywordMatch: { primary: string; secondary?: string } | null = null;
  CATEGORY_KEYWORDS.forEach((mapping, keyword) => {
    if (normalizedName.includes(keyword) && !keywordMatch) {
      // 尝试匹配二级分类
      for (const secondary of mapping.secondary) {
        if (normalizedName === secondary.toLowerCase()) {
          keywordMatch = { primary: mapping.primary, secondary };
          return;
        }
      }
      // 如果没有精确匹配的二级分类，检查是否应该作为二级分类
      const isSecondary = mapping.secondary.some((sec) =>
        normalizedName.includes(sec.toLowerCase())
      );
      if (isSecondary) {
        // 如果名称包含某个二级分类关键词，但没精确匹配，使用第一个匹配的二级分类
        const matchedSecondary = mapping.secondary.find((sec) =>
          normalizedName.includes(sec.toLowerCase())
        );
        keywordMatch = {
          primary: mapping.primary,
          secondary: matchedSecondary,
        };
      } else {
        keywordMatch = { primary: mapping.primary };
      }
    }
  });

  if (keywordMatch) {
    return keywordMatch;
  }

  // 3. 相似度匹配
  let bestMatch: { primary: string; secondary?: string; score: number } | null =
    null;

  for (const mapping of CATEGORY_MAPPINGS) {
    // 匹配一级分类
    const primaryScore = calculateSimilarity(
      normalizedName,
      mapping.primary.toLowerCase()
    );
    if (primaryScore > 0.7 && (!bestMatch || primaryScore > bestMatch.score)) {
      bestMatch = { primary: mapping.primary, score: primaryScore };
    }

    // 匹配二级分类
    for (const secondary of mapping.secondary) {
      const secondaryScore = calculateSimilarity(
        normalizedName,
        secondary.toLowerCase()
      );
      if (
        secondaryScore > 0.7 &&
        (!bestMatch || secondaryScore > bestMatch.score)
      ) {
        bestMatch = {
          primary: mapping.primary,
          secondary,
          score: secondaryScore,
        };
      }
    }
  }

  return bestMatch
    ? { primary: bestMatch.primary, secondary: bestMatch.secondary }
    : null;
}

// 构建分类层级结构
function buildCategoryStructure(
  categories: Category[],
  sourceKey?: string
): {
  primary_categories: Category[];
  secondary_categories: Category[];
  category_map: Record<number, Category>;
} {
  const structure = {
    primary_categories: [] as Category[],
    secondary_categories: [] as Category[],
    category_map: {} as Record<number, Category>,
  };

  // 调试：输出原始分类数据
  if (process.env.NODE_ENV === 'development') {
    console.log('原始分类数据:', categories);
  }

  // 如果分类没有type_pid字段，需要智能分类
  if (categories.length > 0 && categories[0].type_pid === undefined) {
    const primaryCategories: Category[] = [];
    const secondaryCategories: Category[] = [];
    const processedIds = new Set<number>();
    const primaryMap = new Map<string, Category>();

    // 第一遍：处理所有分类
    categories.forEach((cat) => {
      if (processedIds.has(cat.type_id)) return;

      const categoryName = cat.type_name || '';

      // 特别处理：体育相关分类强制作为二级分类
      const sportsKeywords = [
        '体育赛事',
        '篮球',
        '足球',
        '网球',
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
      ];
      if (sportsKeywords.includes(categoryName)) {
        let primaryCat = primaryMap.get('体育');
        if (!primaryCat) {
          // 如果体育一级分类不存在，创建一个
          primaryCat = {
            type_id: -999999, // 使用固定负值避免冲突
            type_pid: 0,
            type_name: '体育',
          };
          primaryCategories.push(primaryCat);
          primaryMap.set('体育', primaryCat);

          // 调试信息
          if (process.env.NODE_ENV === 'development') {
            console.log('创建体育一级分类:', primaryCat);
          }
        }
        const secondaryCat = { ...cat, type_pid: primaryCat.type_id };
        secondaryCategories.push(secondaryCat);
        processedIds.add(cat.type_id);

        // 调试信息
        if (process.env.NODE_ENV === 'development') {
          console.log(`将分类 "${categoryName}" 归类为体育的二级分类`);
        }
        return;
      }

      // 特别处理：电影相关分类强制作为二级分类
      const movieKeywords = [
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
        '武侠片',
      ];
      if (movieKeywords.includes(categoryName)) {
        let primaryCat = primaryMap.get('电影');
        if (!primaryCat) {
          // 如果电影一级分类不存在，创建一个
          primaryCat = {
            type_id: -999998, // 使用固定负值避免冲突
            type_pid: 0,
            type_name: '电影',
          };
          primaryCategories.push(primaryCat);
          primaryMap.set('电影', primaryCat);

          // 调试信息
          if (process.env.NODE_ENV === 'development') {
            console.log('创建电影一级分类:', primaryCat);
          }
        }
        const secondaryCat = { ...cat, type_pid: primaryCat.type_id };
        secondaryCategories.push(secondaryCat);
        processedIds.add(cat.type_id);

        // 调试信息
        if (process.env.NODE_ENV === 'development') {
          console.log(`将分类 "${categoryName}" 归类为电影的二级分类`);
        }
        return;
      }

      const match = findBestCategoryMatch(categoryName);

      if (match) {
        // 如果是匹配到的一级分类
        if (!match.secondary || categoryName === match.primary) {
          // 这是一级分类
          primaryCategories.push(cat);
          primaryMap.set(match.primary, cat);
          processedIds.add(cat.type_id);
        } else {
          // 这是二级分类，需要找到对应的一级分类
          let primaryCat = primaryMap.get(match.primary);
          if (!primaryCat) {
            // 如果对应的一级分类不存在，创建一个虚拟的一级分类
            primaryCat = {
              type_id: -Date.now(), // 使用负值避免冲突
              type_pid: 0,
              type_name: match.primary,
            };
            primaryCategories.push(primaryCat);
            primaryMap.set(match.primary, primaryCat);
          }

          const secondaryCat = { ...cat, type_pid: primaryCat.type_id };
          secondaryCategories.push(secondaryCat);
          processedIds.add(cat.type_id);
        }
      } else {
        // 无法匹配到已知分类，作为独立的一级分类
        primaryCategories.push(cat);
        processedIds.add(cat.type_id);
      }
    });

    // 第二遍：处理剩余的未分类项
    categories.forEach((cat) => {
      if (!processedIds.has(cat.type_id)) {
        const categoryName = cat.type_name || '';

        // 根据名称特征判断
        if (
          categoryName.endsWith('片') ||
          categoryName.endsWith('剧') ||
          categoryName.endsWith('综艺') ||
          categoryName.endsWith('动漫') ||
          categoryName.endsWith('资讯') ||
          categoryName.length <= 4
        ) {
          // 可能是一级分类
          primaryCategories.push(cat);
        } else {
          // 可能是二级分类，关联到第一个一级分类
          if (primaryCategories.length > 0) {
            const newCategory = {
              ...cat,
              type_pid: primaryCategories[0].type_id,
            };
            secondaryCategories.push(newCategory);
          } else {
            // 没有一级分类可用，作为一级分类
            primaryCategories.push(cat);
          }
        }
        processedIds.add(cat.type_id);
      }
    });

    structure.primary_categories = primaryCategories;
    structure.secondary_categories = secondaryCategories;
  } else {
    // 按照type_pid区分一级和二级分类（源站已有层级信息）
    structure.primary_categories = categories.filter(
      (cat) => cat.type_pid === 0
    );
    structure.secondary_categories = categories.filter(
      (cat) => cat.type_pid !== 0
    );
  }

  // 创建分类映射，便于查找
  [...structure.primary_categories, ...structure.secondary_categories].forEach(
    (cat) => {
      structure.category_map[cat.type_id] = cat;
    }
  );

  // 调试：输出构建后的分类结构
  if (process.env.NODE_ENV === 'development') {
    console.log('构建后的分类结构:', {
      primaryCount: structure.primary_categories.length,
      secondaryCount: structure.secondary_categories.length,
      primaryCategories: structure.primary_categories.map((c) => ({
        id: c.type_id,
        name: c.type_name,
      })),
      secondaryCategories: structure.secondary_categories.map((c) => ({
        id: c.type_id,
        name: c.type_name,
        pid: c.type_pid,
      })),
    });
  }

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

    // 只在开发环境输出调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `TVBox API请求: source=${source}, category=${category}, page=${page}`
      );
    }

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

    // 尝试从缓存分别获取视频列表和分类结构
    let videoCache, categoryCache;
    try {
      videoCache = await getTVBoxVideoCache(source, category, page);
      // 只有在视频缓存存在时，才尝试获取分类缓存，减少不必要的IO
      if (videoCache && videoCache.list && videoCache.list.length > 0) {
        categoryCache = await getTVBoxCategoryCache(source);
        // 只有当分类缓存也存在时才返回缓存数据
        if (
          categoryCache &&
          categoryCache.primary_categories &&
          categoryCache.primary_categories.length > 0
        ) {
          return NextResponse.json({
            list: videoCache.list,
            categories: categoryCache,
            pagecount: videoCache.pagecount,
            fromCache: true,
          });
        }
        // 如果分类缓存不存在或为空，继续从数据源获取
      }
    } catch (error) {
      // 缓存获取失败，继续从数据源获取
    }

    // 移除备用缓存逻辑，确保数据隔离性
    // 每个分类应该独立处理，不使用其他分类的数据作为备用
    // 这样可以避免分类之间的数据污染问题

    // 获取视频源分类信息（每次请求都获取最新的分类信息，确保准确性）
    let finalCategoryStructure: {
      primary_categories: Category[];
      secondary_categories: Category[];
      category_map: Record<number, Category>;
    };

    let categoriesFetchSuccess = false;
    try {
      const sourceCategories = await fetchSourceCategories(site.api);

      // 调试日志：输出获取到的分类数据
      if (process.env.NODE_ENV === 'development') {
        console.log(`分类获取结果:`, {
          source: site.api,
          categoriesCount: sourceCategories?.length || 0,
          categories: sourceCategories?.map((cat) => ({
            id: cat.type_id,
            name: cat.type_name,
          })),
        });
      }

      // 只有当成功获取到分类数据时才继续处理
      if (
        sourceCategories &&
        Array.isArray(sourceCategories) &&
        sourceCategories.length > 0
      ) {
        finalCategoryStructure = buildCategoryStructure(
          sourceCategories,
          source
        );
        categoriesFetchSuccess = true;

        // 获取配置以检查是否禁用18+过滤器
        const config = await getConfig();

        // 检查用户是否有禁用18+过滤的权限
        const hasYellowFilterPermission = await hasSpecialFeaturePermission(
          authInfo.username,
          'disable-yellow-filter',
          config
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
                categoryName.includes(word)
              );
              return !shouldFilter;
            });

          finalCategoryStructure.secondary_categories =
            finalCategoryStructure.secondary_categories.filter((category) => {
              const categoryName = category.type_name || '';
              const shouldFilter = yellowWords.some((word) =>
                categoryName.includes(word)
              );
              return !shouldFilter;
            });

          // 从category_map中移除被过滤的分类
          Object.keys(finalCategoryStructure.category_map).forEach((typeId) => {
            const category =
              finalCategoryStructure.category_map[parseInt(typeId)];
            const shouldFilter = yellowWords.some((word) =>
              category.type_name.includes(word)
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
              categoryName.includes(word)
            );
            return !shouldBlock;
          });

        finalCategoryStructure.secondary_categories =
          finalCategoryStructure.secondary_categories.filter((category) => {
            const categoryName = category.type_name || '';
            const shouldBlock = blockedCategories.some((word) =>
              categoryName.includes(word)
            );
            return !shouldBlock;
          });

        // 从category_map中移除被屏蔽的分类
        Object.keys(finalCategoryStructure.category_map).forEach((typeId) => {
          const category =
            finalCategoryStructure.category_map[parseInt(typeId)];
          const shouldBlock = blockedCategories.some((word) =>
            category.type_name.includes(word)
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
      console.error(`分类请求URL: ${site.api}?ac=class`);
      // 使用空分类结构，但不缓存空分类数据
      finalCategoryStructure = {
        primary_categories: [],
        secondary_categories: [],
        category_map: {},
      };
    }

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
      // 检查是否是频率限制错误
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRateLimitError =
        errorMessage.includes('请求过于频繁') ||
        errorMessage.includes('频率限制') ||
        errorMessage.includes('rate limit');

      if (isRateLimitError) {
        // 尝试从缓存获取数据，但只使用当前分类的缓存，避免数据污染
        try {
          // 首先尝试当前分类和页码的缓存
          const cachedData = await getTVBoxVideoCache(source, category, page);
          if (cachedData && cachedData.list && cachedData.list.length > 0) {
            results = cachedData.list;
            totalPages = cachedData.pagecount || 1;
          } else {
            // 如果当前页没有缓存，尝试当前分类的第1页缓存
            const firstPageCache = await getTVBoxVideoCache(
              source,
              category,
              1
            );
            if (
              firstPageCache &&
              firstPageCache.list &&
              firstPageCache.list.length > 0
            ) {
              results = firstPageCache.list;
              totalPages = firstPageCache.pagecount || 1;
            } else {
              results = [];
              totalPages = 1;
            }
          }
        } catch (cacheError) {
          results = [];
          totalPages = 1;
        }
      } else {
        // 其他错误，尝试备用方案
        try {
          const searchResults = await searchFromApi(site, '');
          // 如果有分类参数，手动过滤结果
          if (category && category !== '0') {
            results = searchResults.filter(
              (item: any) =>
                item.type_id === parseInt(category, 10) ||
                (item.class && item.class.includes(category))
            );
          } else {
            results = searchResults;
          }

          // 计算分页
          const {
            totalPages: calcTotalPages,
            start,
            end,
          } = calculatePagination(results.length, page);
          totalPages = calcTotalPages;
          results = results.slice(start, end);

          // 备用方案成功，缓存结果
          if (results.length > 0) {
            try {
              await setTVBoxVideoCache(
                source,
                { list: results, pagecount: totalPages },
                category,
                page,
                page <= 3
              );
            } catch (cacheError) {
              console.error('缓存备用方案结果失败:', cacheError);
            }
          }
        } catch (fallbackError) {
          console.error('备用方案也失败:', fallbackError);
          results = [];
          totalPages = 1;
        }
      }
    }

    // 分别缓存视频列表和分类结构
    if (results && results.length > 0) {
      // 判断是否为热点数据（前3页）
      const isHotData = page <= 3;

      // 缓存视频列表
      try {
        await setTVBoxVideoCache(
          source,
          { list: results, pagecount: totalPages },
          category,
          page,
          isHotData
        );
      } catch (cacheError) {
        console.error('缓存视频列表失败:', cacheError);
        // 缓存失败不影响主流程
      }

      // 分类结构已经在前面缓存过了，这里不需要重复缓存
    }

    return NextResponse.json({
      list: results,
      categories: finalCategoryStructure,
      pagecount: totalPages,
      fromCache: false,
    });
  } catch (err) {
    console.error('加载视频失败:', err);
    return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
  }
}
