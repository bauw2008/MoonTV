/**
 * 统一的类型推断服务
 * 解决多源数据类型不一致的问题
 */

export interface TypeInferenceResult {
  type: string;
  confidence: number; // 置信度 0-1
  source: 'api' | 'inferred' | 'fallback';
}

export class TypeInferenceService {
  // 有效的类型列表
  private static readonly VALID_TYPES = [
    'movie',
    'tv',
    'anime',
    'variety',
    'shortdrama',
    'documentary',
    'live',
  ];

  /**
   * 检查类型是否有效
   */
  private static isValidType(type: string): boolean {
    return this.VALID_TYPES.includes(type);
  }

  /**
   * 基于多维度推断内容类型
   */
  private static multiDimensionInference(item: {
    type_name?: string;
    source?: string;
    title: string;
    episodes?: number | string[];
    type?: string;
  }): TypeInferenceResult {
    const sources = ['tvbox', 'douban', 'search', 'live'];
    const lowerTitle = item.title.toLowerCase();
    const lowerTypeName = item.type_name?.toLowerCase() || '';
    const lowerSource = item.source?.toLowerCase() || '';
    const episodesCount = Array.isArray(item.episodes)
      ? item.episodes.length
      : parseInt(String(item.episodes || '0'));

    let confidence = 0;
    let inferredType = '';

    // 1. 基于源名称的特殊处理
    if (lowerSource === 'live') {
      return { type: 'live', confidence: 0.9, source: 'inferred' };
    }

    if (lowerSource === 'shortdrama' || lowerSource === 'moonshortdrama') {
      return { type: 'shortdrama', confidence: 0.9, source: 'inferred' };
    }

    // 2. 基于type_name的关键词匹配
    const keywordMap = [
      {
        keywords: [
          '综艺',
          '真人秀',
          '娱乐',
          '脱口秀',
          '选秀',
          '访谈',
          '晚会',
          '相声',
          '小品',
          'variety',
          'show',
        ],
        type: 'variety',
        weight: 0.9,
      },
      {
        keywords: ['电影', '影片', '院线', 'movie'],
        type: 'movie',
        weight: 0.9,
      },
      {
        keywords: [
          '动漫',
          '动画',
          '番剧',
          '国漫',
          '日漫',
          '动画片',
          'anime',
          'cartoon',
          'acg',
        ],
        type: 'anime',
        weight: 0.9,
      },
      {
        keywords: ['纪录片', 'documentary', '纪录'],
        type: 'documentary',
        weight: 0.9,
      },
      {
        keywords: ['短剧', '短片', '小剧场', '微剧'],
        type: 'shortdrama',
        weight: 0.9,
      },
      {
        keywords: ['电视剧', '连续剧', '剧集', 'tv', 'series'],
        type: 'tv',
        weight: 0.8,
      },
      { keywords: ['电视电影'], type: 'movie', weight: 0.8 }, // 电视电影归类为电影
    ];

    for (const { keywords, type, weight } of keywordMap) {
      if (keywords.some((keyword) => lowerTypeName.includes(keyword))) {
        inferredType = type;
        confidence = weight;
        break;
      }
    }

    // 3. 基于标题的关键词匹配（置信度稍低）
    if (confidence < 0.8) {
      const titleKeywordMap = [
        { keywords: ['电影', '片', '院线'], type: 'movie', weight: 0.7 },
        {
          keywords: ['剧集', '连续剧', '第', '季', '集'],
          type: 'tv',
          weight: 0.7,
        },
        { keywords: ['动漫', '动画', '番'], type: 'anime', weight: 0.7 },
        { keywords: ['综艺', '秀', '节目'], type: 'variety', weight: 0.7 },
        { keywords: ['纪录', '纪录片'], type: 'documentary', weight: 0.7 },
        { keywords: ['短剧', '微剧'], type: 'shortdrama', weight: 0.7 },
      ];

      for (const { keywords, type, weight } of titleKeywordMap) {
        if (keywords.some((keyword) => lowerTitle.includes(keyword))) {
          if (confidence < weight) {
            inferredType = type;
            confidence = weight;
          }
        }
      }
    }

    // 4. 基于集数的兜底判断
    if (confidence < 0.5 && episodesCount > 0) {
      inferredType = episodesCount === 1 ? 'movie' : 'tv';
      confidence = 0.3;
    }

    return {
      type: inferredType || 'tv',
      confidence: confidence,
      source: 'inferred',
    };
  }

  /**
   * 统一的类型推断入口
   */
  static infer(item: {
    type?: string;
    type_name?: string;
    source?: string;
    title: string;
    episodes?: number | string[];
  }): TypeInferenceResult {
    // 优先级1：API已提供有效类型
    if (item.type && this.isValidType(item.type)) {
      return {
        type: item.type,
        confidence: 1.0,
        source: 'api',
      };
    }

    // 优先级2：多维度推断
    const inferred = this.multiDimensionInference(item);

    // 如果推断置信度太低，使用默认值
    if (inferred.confidence < 0.3) {
      return {
        type: 'tv', // 默认为剧集
        confidence: 0.1,
        source: 'fallback',
      };
    }

    return inferred;
  }

  /**
   * 批量推断类型（用于搜索结果预处理）
   */
  static inferBatch(items: any[]): any[] {
    const results = items.map((item) => {
      const inference = this.infer(item);

      return {
        ...item,
        type: inference.type,
        typeConfidence: inference.confidence,
        typeSource: inference.source,
        // 保留原始信息用于调试
        originalTypeName: item.type_name,
        originalType: item.type,
      };
    });

    return results;
  }

  /**
   * 获取类型统计信息（用于调试）
   */
  static getTypeStatistics(items: any[]): { [key: string]: number } {
    const stats: { [key: string]: number } = {};

    for (const item of items) {
      const type = item.type || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * 验证类型推断质量
   */
  static validateInference(items: any[]): {
    total: number;
    highConfidence: number; // confidence >= 0.8
    mediumConfidence: number; // 0.5 <= confidence < 0.8
    lowConfidence: number; // confidence < 0.5
    unknown: number; // confidence === 0
    errors: Array<{ index: number; issue: string }>;
  } {
    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;
    let unknown = 0;
    const errors: Array<{ index: number; issue: string }> = [];

    items.forEach((item, index) => {
      const confidence = item.typeConfidence || 0;

      if (confidence === 0) {
        unknown++;
        errors.push({
          index,
          issue: 'No type information available',
        });
      } else if (confidence >= 0.8) {
        highConfidence++;
      } else if (confidence >= 0.5) {
        mediumConfidence++;
      } else {
        lowConfidence++;
      }
    });

    return {
      total: items.length,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      unknown,
      errors,
    };
  }
}
