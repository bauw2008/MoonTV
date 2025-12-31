
/**
 * 检查用户是否有18+过滤豁免权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有豁免权限（不过滤），false=需要过滤
 */
export function shouldApplyYellowFilter(config: any, username: string): boolean {
  // 1. 检查全局开关（优先级最高）
  if (config.SiteConfig?.DisableYellowFilter) {
    return false;
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig.Users?.find(u => u.username === username);
  if (!userConfig) {
    return true; // 新用户默认过滤
  }

  // 3. 站长和管理员有豁免权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return false;
  }

  // 4. 检查用户直接权限
  if (userConfig.enabledApis?.includes('disable-yellow-filter')) {
    return false;
  }

  // 4.5. 检查用户features权限
  if (userConfig.features?.disableYellowFilter) {
    return false;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig.Tags?.find(t => t.name === tagName);
      if (tagConfig?.enabledApis?.includes('disable-yellow-filter')) {
        return false;
      }
      // 5.5. 检查用户组features权限
      if (tagConfig?.features?.disableYellowFilter) {
        return false;
      }
    }
  }

  // 6. 默认需要过滤
  return true;
}

/**
 * 检查用户是否有AI推荐权限
 * @param config 配置对象
 * @param username 用户名
 * @returns true=有权限，false=无权限
 */
export function canUseAIRecommend(config: any, username: string): boolean {
  // 1. 检查全局开关
  if (!config.AIRecommendConfig?.enabled) {
    return false;
  }

  // 2. 检查用户配置
  const userConfig = config.UserConfig.Users?.find(u => u.username === username);
  if (!userConfig) {
    return false; // 新用户无权限
  }

  // 3. 站长和管理员有权限
  if (userConfig.role === 'owner' || userConfig.role === 'admin') {
    return true;
  }

  // 4. 检查用户直接权限
  if (userConfig.enabledApis?.includes('ai-recommend')) {
    return true;
  }

  // 4.5. 检查用户features权限
  if (userConfig.features?.aiRecommend) {
    return true;
  }

  // 5. 检查用户组权限
  if (userConfig.tags) {
    for (const tagName of userConfig.tags) {
      const tagConfig = config.UserConfig.Tags?.find(t => t.name === tagName);
      if (tagConfig?.enabledApis?.includes('ai-recommend')) {
        return true;
      }
      // 5.5. 检查用户组features权限
      if (tagConfig?.features?.aiRecommend) {
        return true;
      }
    }
  }

  // 6. 默认无权限
  return false;
}