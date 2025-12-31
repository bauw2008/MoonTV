// 权限类型定义
export enum PermissionType {
  VIDEO_SOURCE = 'video_source', // 视频源权限
  AI_RECOMMEND = 'ai_recommend', // AI推荐功能
  DISABLE_YELLOW_FILTER = 'disable_yellow_filter', // 禁用18禁过滤
}

// 权限显示名称映射
export const PermissionLabels = {
  [PermissionType.VIDEO_SOURCE]: '视频源',
  [PermissionType.AI_RECOMMEND]: 'AI推荐',
  [PermissionType.DISABLE_YELLOW_FILTER]: '18+内容',
};

// 默认权限配置
export const DefaultPermissions = {
  [PermissionType.VIDEO_SOURCE]: ['default'], // 默认视频源
  [PermissionType.AI_RECOMMEND]: [], // 默认无AI权限
  [PermissionType.DISABLE_YELLOW_FILTER]: false, // 默认启用18+过滤
};
