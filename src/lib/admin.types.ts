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
    MenuSettings: {
      showMovies: boolean;
      showTVShows: boolean;
      showAnime: boolean;
      showVariety: boolean;
      showLive: boolean;
      showTvbox: boolean;
      showShortDrama: boolean;
    };
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
      enabledApis?: string[]; // 优先级高于tags限制
      tags?: string[]; // 多 tags 取并集限制
      createdAt?: number; // 创建时间（可选）
    }[];
    Tags?: {
      name: string;
      enabledApis: string[];
      disableYellowFilter?: boolean; // 是否禁用18+过滤器
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
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
  YouTubeConfig?: {
    enabled: boolean; // 是否启用YouTube搜索功能
    apiKey: string; // YouTube Data API v3密钥
    enableDemo: boolean; // 是否启用演示模式
    maxResults: number; // 每页最大搜索结果数
    enabledRegions: string[]; // 启用的地区代码列表
    enabledCategories: string[]; // 启用的视频分类列表
  };
  TVBoxSecurityConfig?: {
    enableAuth: boolean; // 是否启用Token验证
    token: string; // 访问Token（兼容旧版本）
    enableIpWhitelist: boolean; // 是否启用IP白名单
    allowedIPs: string[]; // 允许的IP地址列表
    enableRateLimit: boolean; // 是否启用频率限制
    rateLimit: number; // 每分钟允许的请求次数
    // 设备绑定相关配置
    enableDeviceBinding?: boolean; // 是否启用设备绑定
    maxDevices?: number; // 每个用户最大设备数量
    currentDevices?: Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
      username?: string;
      ipAddress?: string;
    }>; // 当前绑定的设备列表（兼容旧版本）
    userTokens?: Array<{
      username: string;
      token: string;
      enabled: boolean;
      devices: Array<{
        deviceId: string;
        deviceInfo: string;
        bindTime: number;
        ipAddress?: string;
      }>;
    }>; // 用户Token和设备绑定信息
  };
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
}
