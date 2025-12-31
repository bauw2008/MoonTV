/* eslint-disable no-console */
import { AdminConfig } from './admin.types';

/**
 * 权限迁移工具
 * 将旧的用户组配置迁移到新的权限结构
 * 确保向后兼容性
 */

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedTags: string[];
  migratedUsers: string[];
  errors?: string[];
}

/**
 * 迁移用户组权限到新的结构
 */
export function migrateTagPermissions(config: AdminConfig): MigrationResult {
  const result: MigrationResult = {
    success: true,
    message: '',
    migratedTags: [],
    migratedUsers: [],
    errors: [],
  };

  try {
    if (!config.UserConfig.Tags) {
      config.UserConfig.Tags = [];
    }

    // 迁移用户组权限
    config.UserConfig.Tags.forEach((tag) => {
      try {
        // 如果没有features字段，创建默认的features配置
        if (!tag.features) {
          tag.features = {
            aiRecommend: false,
          };
        }

        // 从enabledApis中提取特殊功能权限
        if (tag.enabledApis && Array.isArray(tag.enabledApis)) {
          const features = tag.features;
          
          // 检查AI推荐权限
          if (tag.enabledApis.includes('ai-recommend')) {
            features.aiRecommend = true;
            console.log(`[迁移] 用户组 ${tag.name} 的 AI推荐权限已迁移到 features`);
          }

          // 检查18禁过滤权限
          if (tag.enabledApis.includes('disable-yellow-filter')) {
            tag.disableYellowFilter = true;
            console.log(`[迁移] 用户组 ${tag.name} 的 18禁过滤权限已迁移到 tag`);
          }

          // 保留enabledApis以确保向后兼容
          // 但移除特殊功能权限，避免重复
          tag.enabledApis = tag.enabledApis.filter(
            (api) => api !== 'ai-recommend' && api !== 'disable-yellow-filter'
          );
        }

        // 确保videoSources字段存在
        if (!tag.videoSources && tag.enabledApis) {
          // 如果没有videoSources但有enabledApis，将enabledApis复制到videoSources
          tag.videoSources = [...tag.enabledApis];
        }

        result.migratedTags.push(tag.name);
      } catch (error) {
        result.errors?.push(`迁移用户组 ${tag.name} 时出错: ${error}`);
      }
    });

    // 迁移用户权限
    if (config.UserConfig.Users) {
      config.UserConfig.Users.forEach((user) => {
        try {
          // 如果没有features字段，创建默认的features配置
          if (!user.features) {
            user.features = {
              aiRecommend: false,
              disableYellowFilter: false,
            };
          }

          // 从enabledApis中提取特殊功能权限
          if (user.enabledApis && Array.isArray(user.enabledApis)) {
            const features = user.features;
            
            // 检查AI推荐权限
            if (user.enabledApis.includes('ai-recommend')) {
              features.aiRecommend = true;
              console.log(`[迁移] 用户 ${user.username} 的 AI推荐权限已迁移到 features`);
            }

            // 检查18禁过滤权限
            if (user.enabledApis.includes('disable-yellow-filter')) {
              features.disableYellowFilter = true;
              console.log(`[迁移] 用户 ${user.username} 的 18禁过滤权限已迁移到 features`);
            }

            // 保留enabledApis以确保向后兼容
            // 但移除特殊功能权限，避免重复
            user.enabledApis = user.enabledApis.filter(
              (api) => api !== 'ai-recommend' && api !== 'disable-yellow-filter'
            );
          }

          // 确保videoSources字段存在
          if (!user.videoSources && user.enabledApis) {
            user.videoSources = [...user.enabledApis];
          }

          result.migratedUsers.push(user.username);
        } catch (error) {
          result.errors?.push(`迁移用户 ${user.username} 时出错: ${error}`);
        }
      });
    }

    result.message = `成功迁移 ${result.migratedTags.length} 个用户组和 ${result.migratedUsers.length} 个用户的权限配置`;
    
    if (result.errors && result.errors.length > 0) {
      result.success = false;
      result.message += `，但遇到 ${result.errors.length} 个错误`;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: `权限迁移失败: ${error}`,
      migratedTags: [],
      migratedUsers: [],
      errors: [String(error)],
    };
  }
}

/**
 * 验证权限配置的完整性
 */
export function validatePermissionConfig(config: AdminConfig): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 检查用户组配置
  if (config.UserConfig.Tags) {
    config.UserConfig.Tags.forEach((tag, index) => {
      if (!tag.name) {
        issues.push(`用户组 ${index} 缺少名称`);
      }

      if (!tag.features) {
        issues.push(`用户组 ${tag.name} 缺少 features 配置`);
      } else {
        if (typeof tag.features.aiRecommend !== 'boolean') {
          issues.push(`用户组 ${tag.name} 的 aiRecommend 配置不是布尔值`);
        }
        if (typeof tag.disableYellowFilter !== 'boolean') {
          issues.push(`用户组 ${tag.name} 的 disableYellowFilter 配置不是布尔值`);
        }
      }

      if (!tag.videoSources && !tag.enabledApis) {
        issues.push(`用户组 ${tag.name} 既没有 videoSources 也没有 enabledApis 配置`);
      }
    });
  }

  // 检查用户配置
  if (config.UserConfig.Users) {
    config.UserConfig.Users.forEach((user, index) => {
      if (!user.username) {
        issues.push(`用户 ${index} 缺少用户名`);
      }

      if (user.features) {
        if (typeof user.features.aiRecommend !== 'boolean') {
          issues.push(`用户 ${user.username} 的 aiRecommend 配置不是布尔值`);
        }
        if (typeof user.features.disableYellowFilter !== 'boolean') {
          issues.push(`用户 ${user.username} 的 disableYellowFilter 配置不是布尔值`);
        }
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}