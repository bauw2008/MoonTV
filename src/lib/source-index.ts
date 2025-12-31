/**
 * 源配置索引系统
 * 用于高性能获取用户视频源，避免重复查询配置
 */

import { getConfig, ApiSite } from './config';

// 源索引接口
interface SourceIndex {
  byKey: Map<string, ApiSite>;
  enabledSources: ApiSite[];
  lastUpdateTime: number;
}

// 用户组索引接口
interface UserGroupIndex {
  byTag: Map<string, string[]>;
  lastUpdateTime: number;
}

// 全局索引实例
let sourceIndex: SourceIndex = {
  byKey: new Map(),
  enabledSources: [],
  lastUpdateTime: 0
};

let userGroupIndex: UserGroupIndex = {
  byTag: new Map(),
  lastUpdateTime: 0
};

// 自动初始化标志
let isInitialized = false;

/**
 * 确保索引已初始化
 */
async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    console.log('[索引系统] 首次初始化...');
    await rebuildAllIndexes();
    isInitialized = true;
  }
}

/**
 * 重建源索引
 * 在配置变更时调用
 */
export async function rebuildSourceIndex(): Promise<void> {
  try {
    const config = await getConfig();
    
    // 清空现有索引
    sourceIndex.byKey.clear();
    sourceIndex.enabledSources = [];
    
    // 重建索引
    if (config.SourceConfig && Array.isArray(config.SourceConfig)) {
      config.SourceConfig.forEach(source => {
        // 存储到key索引
        sourceIndex.byKey.set(source.key, source);
        
        // 存储到可用源索引（只包含未禁用的源）
        if (!source.disabled) {
          sourceIndex.enabledSources.push(source);
        }
      });
    }
    
    sourceIndex.lastUpdateTime = Date.now();
    console.log(`[源索引] 重建完成，总计 ${sourceIndex.byKey.size} 个源，其中 ${sourceIndex.enabledSources.length} 个可用`);
    
  } catch (error) {
    console.error('[源索引] 重建失败:', error);
    throw error;
  }
}

/**
 * 重建用户组索引
 * 在用户组配置变更时调用
 */
export async function rebuildUserGroupIndex(): Promise<void> {
  try {
    const config = await getConfig();
    
    // 清空现有索引
    userGroupIndex.byTag.clear();
    
    // 重建索引
    if (config.UserConfig?.Tags && Array.isArray(config.UserConfig.Tags)) {
      config.UserConfig.Tags.forEach(tag => {
        if (tag.videoSources && Array.isArray(tag.videoSources)) {
          userGroupIndex.byTag.set(tag.name, [...tag.videoSources]);
        }
      });
    }
    
    userGroupIndex.lastUpdateTime = Date.now();
    console.log(`[用户组索引] 重建完成，总计 ${userGroupIndex.byTag.size} 个用户组`);
    
  } catch (error) {
    console.error('[用户组索引] 重建失败:', error);
    throw error;
  }
}

/**
 * 重建所有索引
 * 系统启动时调用
 */
export async function rebuildAllIndexes(): Promise<void> {
  console.log('[索引系统] 开始重建所有索引...');
  await rebuildSourceIndex();
  await rebuildUserGroupIndex();
  console.log('[索引系统] 所有索引重建完成');
}

/**
 * 获取用户可用的视频源
 * 高性能O(1)查询
 */
export async function getUserVideoSources(username: string): Promise<ApiSite[]> {
  // 确保索引已构建
  await ensureInitialized();
  
  console.log(`[索引查询] 查询用户: ${username}`);
  
  const config = await getConfig();
  const userConfig = config.UserConfig?.Users?.find(u => u.username === username);
  
  console.log(`[索引查询] 用户配置:`, userConfig ? {
    username: userConfig.username,
    tags: userConfig.tags,
    role: userConfig.role
  } : '未找到');
  
  if (!userConfig?.tags || userConfig.tags.length === 0) {
    console.log(`[索引查询] 用户 ${username} 没有标签，返回空数组`);
    return [];
  }
  
  // 收集用户所有源key
  const sourceKeys = new Set<string>();
  
  for (const tagName of userConfig.tags) {
    const tagSources = userGroupIndex.byTag.get(tagName);
    if (tagSources) {
      tagSources.forEach(key => sourceKeys.add(key));
    }
  }
  
  // 从源索引获取详细信息
  const availableSources: ApiSite[] = [];
  
  for (const sourceKey of sourceKeys) {
    const source = sourceIndex.byKey.get(sourceKey);
    if (source && !source.disabled) {
      availableSources.push(source);
    }
  }
  
  console.log(`[索引查询] 用户 ${username} 获取到 ${availableSources.length} 个可用源`);
  return availableSources;
}

/**
 * 根据key获取源信息
 */
export function getSourceByKey(key: string): ApiSite | undefined {
  return sourceIndex.byKey.get(key);
}

/**
 * 获取所有可用源
 */
export function getAllEnabledSources(): ApiSite[] {
  return [...sourceIndex.enabledSources];
}

/**
 * 检查源是否可用
 */
export function isSourceEnabled(key: string): boolean {
  const source = sourceIndex.byKey.get(key);
  return source ? !source.disabled : false;
}

/**
 * 获取索引统计信息
 */
export function getIndexStats() {
  return {
    sourceIndex: {
      totalSources: sourceIndex.byKey.size,
      enabledSources: sourceIndex.enabledSources.length,
      lastUpdateTime: sourceIndex.lastUpdateTime
    },
    userGroupIndex: {
      totalGroups: userGroupIndex.byTag.size,
      lastUpdateTime: userGroupIndex.lastUpdateTime
    }
  };
}

/**
 * 清空所有索引（测试用）
 */
export function clearAllIndexes(): void {
  sourceIndex.byKey.clear();
  sourceIndex.enabledSources = [];
  sourceIndex.lastUpdateTime = 0;
  
  userGroupIndex.byTag.clear();
  userGroupIndex.lastUpdateTime = 0;
  
  console.log('[索引系统] 所有索引已清空');
}