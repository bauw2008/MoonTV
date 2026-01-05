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
    version: '1.0.0',
    date: '2025-09-18',
    added: [
      '🚀【导航菜单】动态构建灵活开启/隐藏',
      '📝【配置管理】移除默认主窗口/tvbox配置，转至管理员配置项集中管理',
      '📊【分类配置】菜单结构优化，操作更便捷',
      '🔗【主题配置】多种渐变色自定义背景+图片背景，整体模糊透明，背景可动态调节',
      '🎯【接口管理】live/Tvbox 默认关闭访问将无效，tvbox 为配置源播放窗口',
      '🔍【搜索页】网盘搜索菜单默认隐藏',
      '⚡【AI推荐】默认隐藏',
      '📺【播放器】弹幕发射器负优化，控制栏菜单CSS样式调整',
      '🎯【网盘搜索】... ',
      '🎮【其他】虚拟滑动显示异常修复，增加头像显示，统计ip登陆记录，用户注册审核等...',
    ],
    changed: ['📐 ...'],
    fixed: ['🎮 ...'],
  },
];

export default changelog;
