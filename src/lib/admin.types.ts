import { MenuSettings } from '@/types/menu';

export interface AdminConfig {
  ConfigSubscribtion: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  ConfigFile: string;
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    DoubanProxyType: string;
    DoubanProxy: string;
    DoubanImageProxyType: string;
    DoubanImageProxy: string;
    DisableYellowFilter: boolean;
    FluidSearch: boolean;
    // TMDB配置
    TMDBApiKey?: string;
    TMDBLanguage?: string;
    EnableTMDBActorSearch?: boolean;
    EnableTMDBPosters?: boolean;
    MenuSettings: MenuSettings;
  };
  YellowWords?: string[]; // 18+内容过滤词
  UserConfig: {
    AllowRegister?: boolean; // 是否允许用户注册，默认 true
    AutoCleanupInactiveUsers?: boolean; // 是否自动清理非活跃用户，默认 false
    InactiveUserDays?: number; // 非活跃用户保留天数，默认 7
    RequireApproval?: boolean; // 是否需要注册审核，默认 false
    PendingUsers?: {
      username: string;
      reason?: string;
      encryptedPassword?: string; // 加密后的密码，审批通过时解密
      appliedAt: string; // ISO 时间
    }[]; // 待审核用户队列
    Users: {
      username: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
      enabledApis?: string[]; // 优先级高于tags限制（保留兼容性）
      videoSources?: string[]; // 新增：用户直接配置的源
      features?: {
        // 新增：用户直接配置的功能开关
        aiRecommend: boolean;
        disableYellowFilter: boolean;
        // 可扩展其他功能
      };
      tags?: string[]; // 多 tags 取并集限制
      createdAt?: number; // 创建时间（可选）
      permissionVersion?: number; // 权限版本号，用于缓存失效
    }[];
    Tags?: Array<{
      name: string;
      enabledApis: string[]; // 向后兼容：保留enabledApis字段
      disableYellowFilter?: boolean;
      aiEnabled?: boolean;
      videoSources?: string[]; // 新增：纯采集源配置
      features?: {
        // 新增：功能开关配置
        aiRecommend: boolean;
        // 可扩展其他功能
      };
    }>;
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
    requiresAuth?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: {
    key: string;
    name: string;
    url: string; // m3u 地址
    ua?: string;
    epg?: string; // 节目单
    from: 'config' | 'custom';
    channelNumber?: number;
    disabled?: boolean;
  }[];
  NetDiskConfig?: {
    enabled: boolean; // 是否启用网盘搜索
    pansouUrl: string; // PanSou服务地址
    timeout: number; // 请求超时时间(秒)
    enabledCloudTypes: string[]; // 启用的网盘类型
  };
  AIRecommendConfig?: {
    enabled: boolean; // 是否启用AI推荐功能
    apiUrl: string; // OpenAI兼容API地址
    apiKey: string; // API密钥
    model: string; // 模型名称
    temperature: number; // 温度参数 0-2
    maxTokens: number; // 最大token数
  };
  TVBoxSecurityConfig?: {
    enableAuth: boolean;
    token?: string;
    enableRateLimit: boolean;
    rateLimit: number;
    enableDeviceBinding: boolean;
    maxDevices: number;
    enableUserAgentWhitelist: boolean;
    allowedUserAgents: string[];
    defaultUserGroup?: string;
    currentDevices?: Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
    }>;
    userTokens?: Array<{
      username: string;
      token: string;
      enabled: boolean;
      devices: Array<{
        deviceId: string;
        deviceInfo: string;
        bindTime: number;
      }>;
    }>;
  };
}
