// 功能设置类型定义 - 独立功能的配置
export interface FeatureSettings {
  showAI: boolean;
  showNetDiskSearch: boolean;
  showTMDBActorSearch: boolean;
}

// 默认功能设置
export const defaultFeatureSettings: FeatureSettings = {
  showAI: false,
  showNetDiskSearch: false,
  showTMDBActorSearch: false,
};
