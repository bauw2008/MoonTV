// 此文件由 scripts/convert-changelog.js 自动生成
// 请勿手动编辑

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "5.3.0",
    date: "2025-09-10",
    added: [
      "🎥 YouTube集成: 完整的YouTube搜索和直播播放功能",
      "集成YouTube Data API v3搜索功能",
      "支持iframe直接播放YouTube视频",
      "管理后台YouTube API配置面板",
      "YouTube缓存管理系统（参考网盘实现）",
      "YouTube搜索结果缓存统计和管理",
      "🔧 AI推荐系统: 增强的AI内容推荐功能",
      "动态提示词和模型管理优化",
      "支持GPT-5/o系列模型的max_completion_tokens",
      "改进推荐UI和卡片显示计数器",
      "优化推理模型空响应处理",
      "📱 TVBox安全配置: 全面的TVBox集成",
      "通过管理后台完整配置TVBox安全设置",
      "API优化和安全性增强",
      "配置面板移动端UI优化",
      "🎬 iPad/iOS视频播放优化: 全面的移动端播放改进",
      "基于ArtPlayer兼容性模式的智能设备检测",
      "iOS特定自动播放策略（静音启动+音量恢复）",
      "基于官方源码优化的HLS.js配置",
      "多重尝试自动播放重试机制，提升成功率",
      "移动设备内存管理优化"
    ],
    changed: [
      "🚀 搜索性能: 智能搜索优化和状态管理",
      "切换搜索类型时清除网盘搜索状态",
      "功能切换时的缓存绕过改进",
      "防止功能禁用时的无限重试循环",
      "🎯 移动端UI: 响应式设计改进",
      "TVBox配置移动端显示优化（token复制/重新生成按钮）",
      "配置面板移动端布局改进",
      "💾 缓存管理: 统一缓存系统增强",
      "管理员端点缺失的配置缓存清理",
      "YouTube集成到完整缓存管理基础设施",
      "所有搜索类型的数据库缓存统计（YouTube、网盘、豆瓣、弹幕）",
      "🏗️ HLS.js优化: 基于官方源码的移动设备流媒体改进",
      "缓冲策略：iOS13+ 8秒，iOS 10秒，桌面30秒",
      "内存管理：iOS13+ 20MB，iOS 30MB缓冲大小",
      "加载策略：移动端优化的超时和重试策略",
      "ABR优化：移动设备更快的码率切换",
      "🔧 代码质量: 增强的TypeScript支持和错误处理",
      "EventListener API兼容性改进",
      "复杂函数中的变量作用域管理优化",
      "改进错误边界和回退机制",
      "📦 架构: 遵循现有模式的模块化YouTube集成",
      "与其他搜索功能一致的API端点结构",
      "跨所有搜索类型的统一缓存管理",
      "遵循既定模式的配置管理"
    ],
    fixed: [
      "🔄 修复功能禁用时网盘搜索卡死问题",
      "🛠️ 解决功能禁用场景下的无限重试循环",
      "🔧 修复TVBox安全配置移动端UI截断问题",
      "📱 修正AI推荐卡片显示并防止无效链接点击",
      "🎵 修复GPT-5/推理模型因token限制导致的空响应",
      "🔨 解决EventListenerOptions的TypeScript编译错误",
      "📊 修复管理面板中YouTube缓存统计显示问题",
      "🎭 改进配置缓存管理的错误处理"
    ]
  }
];

export default changelog;

