/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import { db } from '@/lib/db';

import { AdminConfig } from './admin.types';

// 生成随机Token
function generateToken() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
  categories?: any;
  ext?: any;
  jar?: any;
  disabled?: boolean;
  requiresAuth?: boolean;
  token?: string;
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string; // 节目单
}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  };
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

// 在模块加载时根据环境决定配置来源
let cachedConfig: AdminConfig;
let cacheTimestamp = 0;
let cacheVersion = 0; // 版本号，用于强制刷新缓存

// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch {
    fileConfig = {} as ConfigFileStruct;
  }

  // 合并文件中的源信息
  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s]),
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    if (existingSource) {
      // 如果已存在，只覆盖 name、api、detail 和 from
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.from = 'config';
    } else {
      // 如果不存在，创建新条目
      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有源是否在 fileConfig.api_site 中，如果不在则标记为 custom
  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.SourceConfig = Array.from(currentApiSites.values());

  // 覆盖 CustomCategories
  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c]),
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = 'config';
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 CustomCategories 是否在 fileConfig.custom_category 中，如果不在则标记为 custom
  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type),
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.CustomCategories = Array.from(currentCustomCategories.values());

  // 合并直播源配置
  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l]),
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      // 如果不存在，创建新条目
      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: 'config',
        disabled: false,
      });
    }
  });

  // 检查现有 LiveConfig 是否在 fileConfig.lives 中，如果不在则标记为 custom
  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = 'custom';
    }
  });

  // 将 Map 转换回数组
  adminConfig.LiveConfig = Array.from(currentLives.values());

  return adminConfig;
}

// 初始化配置
async function getInitConfig(
  configFile: string,
  subConfig: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  } = {
    URL: '',
    AutoUpdate: false,
    LastCheck: '',
  },
): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;
  try {
    cfgFile = JSON.parse(configFile) as ConfigFileStruct;
  } catch {
    cfgFile = {} as ConfigFileStruct;
  }
  const adminConfig: AdminConfig = {
    ConfigFile: configFile,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Vidora',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType: process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'direct',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'direct',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch: process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      // TMDB配置默认值
      TMDBApiKey: '', // 默认为空，可在管理界面配置
      TMDBLanguage: 'zh-CN',
      EnableTMDBActorSearch: false, // 默认关闭，需要配置API Key后手动开启
      EnableTMDBPosters: false, // 默认关闭，需要配置API Key后手动开启
      // 添加 MenuSettings 默认值
      MenuSettings: {
        showMovies: true, // 默认显示，可在管理界面配置
        showTVShows: true, // 默认显示，可在管理界面配置
        showAnime: true, // 默认显示，可在管理界面配置
        showVariety: true, // 默认显示，可在管理界面配置
        showLive: false, // 默认隐藏，可在管理界面配置
        showTvbox: false, // 默认隐藏，可在管理界面配置
        showShortDrama: false, // 默认隐藏，可在管理界面配置
        showAI: false, // 默认隐藏，可在管理界面配置
        showNetDiskSearch: false, // 默认隐藏，可在管理界面配置
        showTMDBActorSearch: false, // 默认隐藏，可在管理界面配置
      },
    },
    UserConfig: {
      AllowRegister: false, // 默认禁止注册
      RequireApproval: false,
      PendingUsers: [],
      Users: [],
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
    // 添加默认过滤词
    YellowWords: [
      '伦理片',
      '福利',
      '制服诱惑',
      '国产传媒',
      '黑丝诱惑',
      '无码',
      '日本无码',
      '有码',
      '日本有码',
      'SWAG',
      '色情片',
      '同性片',
      '福利视频',
      '福利片',
      '倫理片',
      '理论片',
      '韩国伦理',
      '港台三级',
      '伦理',
      '日本伦理',
    ],
  };

  // 添加默认的 TVBox 安全配置
  adminConfig.TVBoxSecurityConfig = {
    enableAuth: false,
    token: '',
    enableRateLimit: false,
    rateLimit: 60,
    enableDeviceBinding: false,
    maxDevices: 1,
    enableUserAgentWhitelist: false,
    allowedUserAgents: [
      'okHttp/Mod-1.4.0.0',
      'TVBox',
      'OKHTTP',
      'Dalvik',
      'Java',
    ],
    currentDevices: [],
    userTokens: [],
  };

  // 补充用户信息
  let userNames: string[] = [];
  try {
    userNames = await db.getAllUsers();
  } catch (e) {
    console.error('获取用户列表失败:', e);
  }
  const allUsers = userNames
    .filter((u) => !process.env.USERNAME || u !== process.env.USERNAME)
    .map((u) => ({
      username: u,
      role: 'user',
      banned: false,
    }));
  if (process.env.USERNAME) {
    allUsers.unshift({
      username: process.env.USERNAME,
      role: 'owner',
      banned: false,
    });
  }
  adminConfig.UserConfig.Users = allUsers as any;

  // 从配置文件中补充源信息
  Object.entries(cfgFile.api_site || []).forEach(([key, site]) => {
    adminConfig.SourceConfig.push({
      key: key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充自定义分类信息
  cfgFile.custom_category?.forEach((category) => {
    adminConfig.CustomCategories.push({
      name: category.name || category.query,
      type: category.type,
      query: category.query,
      from: 'config',
      disabled: false,
    });
  });

  // 从配置文件中补充直播源信息
  Object.entries(cfgFile.lives || []).forEach(([key, live]) => {
    if (!adminConfig.LiveConfig) {
      adminConfig.LiveConfig = [];
    }
    adminConfig.LiveConfig.push({
      key,
      name: live.name,
      url: live.url,
      ua: live.ua,
      epg: live.epg,
      channelNumber: 0,
      from: 'config',
      disabled: false,
    });
  });

  return adminConfig;
}

// 读取配置
export async function getConfig(forceRefresh = false): Promise<AdminConfig> {
  // 检查缓存是否有效
  const now = Date.now();

  // 检查缓存是否有效

  // 智能缓存策略：
  // - 如果强制刷新，跳过缓存
  // - 检查缓存是否有效（管理相关配置30秒，其他配置5分钟）
  let CACHE_TTL = 5 * 60 * 1000; // 默认5分钟

  // 如果是最近有配置变更（通过cacheVersion判断），使用较短TTL
  if (cacheVersion > 0 && now - cacheTimestamp < 30 * 1000) {
    CACHE_TTL = 30 * 1000; // 配置变更后30秒内使用短缓存
  }

  if (!forceRefresh && cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  // 读 db
  let adminConfig: AdminConfig | null = null;
  try {
    adminConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失败:', e);
  }

  // db 中无配置，执行一次初始化
  if (!adminConfig) {
    adminConfig = await getInitConfig('');
    adminConfig = configSelfCheck(adminConfig);
    cachedConfig = adminConfig;
    // 保存初始化配置到数据库
    try {
      await db.saveAdminConfig(cachedConfig);
      console.log('初始化配置已保存到数据库');
    } catch (error) {
      console.error('保存初始化配置到数据库失败:', error);
    }
  } else {
    console.log('getConfig - 使用数据库配置，执行自检');
    adminConfig = configSelfCheck(adminConfig);
    cachedConfig = adminConfig;
  }

  // 更新缓存时间戳
  cacheTimestamp = Date.now();
  console.log('配置已缓存，时间戳:', cacheTimestamp);

  return cachedConfig;
}

// 清除配置缓存，强制重新从数据库读取
export function clearConfigCache(): void {
  cachedConfig = null as any;
  cacheTimestamp = 0;
  cacheVersion++; // 增加版本号，强制刷新所有缓存

  // localStorage模式：也清除localStorage中的缓存
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vidora_admin_config');
  }
}

// 强制刷新配置（用于配置更新后）
export async function forceRefreshConfig(): Promise<AdminConfig> {
  clearConfigCache();
  return getConfig();
}

// 管理界面专用配置获取（立即生效）
export async function getAdminConfig(): Promise<AdminConfig> {
  return getConfig(true); // 强制刷新，确保管理界面看到最新配置
}

// 配置自检
export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  // 确保必要的属性存在和初始化
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = {
      AllowRegister: true,
      RequireApproval: false,
      PendingUsers: [],
      Users: [],
    } as any;
  }
  if (
    !adminConfig.UserConfig.Users ||
    !Array.isArray(adminConfig.UserConfig.Users)
  ) {
    adminConfig.UserConfig.Users = [];
  }
  // 确保 AllowRegister 有默认值
  if (adminConfig.UserConfig.AllowRegister === undefined) {
    adminConfig.UserConfig.AllowRegister = true;
  }
  // 新增：审核相关默认值
  if ((adminConfig.UserConfig as any).RequireApproval === undefined) {
    (adminConfig.UserConfig as any).RequireApproval = false;
  }
  if (!(adminConfig.UserConfig as any).PendingUsers) {
    (adminConfig.UserConfig as any).PendingUsers = [];
  }
  // 确保用户组配置存在
  if (
    !adminConfig.UserConfig.Tags ||
    !Array.isArray(adminConfig.UserConfig.Tags)
  ) {
    adminConfig.UserConfig.Tags = [];
  }

  // 创建默认用户组（如果不存在）
  const defaultGroupName = '默认';
  const defaultGroupExists = adminConfig.UserConfig.Tags.some(
    (tag) => tag.name === defaultGroupName,
  );

  if (!defaultGroupExists) {
    // 动态获取前4个视频源的key，确保SourceConfig存在且不为空
    const availableSources = (adminConfig.SourceConfig || [])
      .filter((source: any) => source && !source.disabled && source.key)
      .slice(0, 4)
      .map((source: any) => source.key);

    adminConfig.UserConfig.Tags.unshift({
      name: defaultGroupName,
      enabledApis: availableSources, // 默认用户组有前4个视频源权限
    });
    console.log(
      `[Config] 已创建默认用户组，包含 ${
        availableSources.length
      } 个视频源权限: ${availableSources.join(', ') || '无'}`,
    );
  }

  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (
    !adminConfig.CustomCategories ||
    !Array.isArray(adminConfig.CustomCategories)
  ) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }
  // 确保过滤词配置存在
  if (!adminConfig.YellowWords || !Array.isArray(adminConfig.YellowWords)) {
    console.log('初始化 YellowWords 配置');
    adminConfig.YellowWords = [
      '伦理片',
      '福利',
      '里番动漫',
      '门事件',
      '萝莉少女',
      '制服诱惑',
      '国产传媒',
      'cosplay',
      '黑丝诱惑',
      '无码',
      '日本无码',
      '有码',
      '日本有码',
      'SWAG',
      '网红主播',
      '色情片',
      '同性片',
      '福利视频',
      '福利片',
      '写真热舞',
      '倫理片',
      '理论片',
      '韩国伦理',
      '港台三级',
      '伦理',
      '日本伦理',
    ];
  }

  // 确保网盘搜索配置有默认值
  if (!adminConfig.NetDiskConfig) {
    adminConfig.NetDiskConfig = {
      enabled: false, // 默认关闭
      pansouUrl: 'https://so.252035.xyz', // 默认公益服务
      timeout: 30, // 默认30秒超时
      enabledCloudTypes: ['baidu', 'aliyun', 'quark'], // 默认只启用百度、阿里、夸克三大主流网盘
    };
  }

  // 确保 MenuSettings 存在并有完整默认值
  const defaultMenuSettings = {
    showMovies: true,
    showTVShows: true,
    showAnime: true,
    showVariety: true,
    showLive: false,
    showTvbox: false,
    showShortDrama: false,
    showAI: false,
    showNetDiskSearch: false,
    showTMDBActorSearch: false,
  };

  // 确保 SiteConfig 存在
  if (!adminConfig.SiteConfig) {
    adminConfig.SiteConfig = {
      SiteName: 'Vidora',
      Announcement: '',
      SearchDownstreamMaxPage: 5,
      SiteInterfaceCacheTime: 300,
      DoubanProxyType: 'direct',
      DoubanProxy: '',
      DoubanImageProxyType: 'direct',
      DoubanImageProxy: '',
      TMDBLanguage: 'zh-CN',
      EnableTMDBActorSearch: false,
      EnableTMDBPosters: true,
      DisableYellowFilter: false,
      FluidSearch: false,
      MenuSettings: {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
        showAI: false,
        showNetDiskSearch: false,
        showTMDBActorSearch: false,
      },
    };
  }

  adminConfig.SiteConfig.MenuSettings = {
    ...defaultMenuSettings,
    ...(adminConfig.SiteConfig.MenuSettings || {}),
  };

  // 确保AI推荐配置有默认值
  if (!adminConfig.AIRecommendConfig) {
    adminConfig.AIRecommendConfig = {
      enabled: false, // 默认关闭
      apiUrl: 'https://api.openai.com/v1', // 默认OpenAI API
      apiKey: '', // 默认为空，需要管理员配置
      model: 'gpt-3.5-turbo', // 默认模型
      temperature: 0.7, // 默认温度
      maxTokens: 3000, // 默认最大token数
    };
  }

  // 站长变更自检
  const ownerUser = process.env.USERNAME || null;

  // 去重
  const seenUsernames = new Set<string>();
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => {
    if (seenUsernames.has(user.username)) {
      return false;
    }
    seenUsernames.add(user.username);
    return true;
  });
  // 过滤站长
  const originOwnerCfg = adminConfig.UserConfig.Users.find(
    (u) => u.username === ownerUser,
  );
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter(
    (user) => user.username !== ownerUser,
  );
  // 其他用户不得拥有 owner 权限
  adminConfig.UserConfig.Users.forEach((user) => {
    if (user.role === 'owner') {
      user.role = 'user';
    }
  });
  // 重新添加回站长
  adminConfig.UserConfig.Users.unshift({
    username: ownerUser!,
    role: 'owner',
    banned: false,
    enabledApis: originOwnerCfg?.enabledApis || undefined,
    tags: originOwnerCfg?.tags || undefined,
  });

  // 采集源去重
  const seenSourceKeys = new Set<string>();
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((source) => {
    if (seenSourceKeys.has(source.key)) {
      return false;
    }
    seenSourceKeys.add(source.key);
    return true;
  });

  // 自定义分类去重
  const seenCustomCategoryKeys = new Set<string>();
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter(
    (category) => {
      if (seenCustomCategoryKeys.has(category.query + category.type)) {
        return false;
      }
      seenCustomCategoryKeys.add(category.query + category.type);
      return true;
    },
  );

  // 直播源去重
  const seenLiveKeys = new Set<string>();
  adminConfig.LiveConfig = adminConfig.LiveConfig.filter((live) => {
    if (seenLiveKeys.has(live.key)) {
      return false;
    }
    seenLiveKeys.add(live.key);
    return true;
  });

  // 确保TVBox安全配置有默认值
  if (!adminConfig.TVBoxSecurityConfig) {
    adminConfig.TVBoxSecurityConfig = {
      enableAuth: false,
      token: '',
      enableRateLimit: false,
      rateLimit: 60,
      enableDeviceBinding: false,
      maxDevices: 1,
      enableUserAgentWhitelist: false,
      allowedUserAgents: [
        'okHttp/Mod-1.4.0.0',
        'TVBox',
        'OKHTTP',
        'Dalvik',
        'Java',
      ],
      currentDevices: [],
      userTokens: [],
    };
  }

  // 确保用户Token配置存在并为每个用户创建Token
  if (!adminConfig.TVBoxSecurityConfig.userTokens) {
    adminConfig.TVBoxSecurityConfig.userTokens = [];
  }

  // 为每个用户创建独立的Token（如果不存在），保证Token长期有效
  const existingUsernames = new Set(
    adminConfig.TVBoxSecurityConfig.userTokens.map((t) => t.username),
  );
  adminConfig.UserConfig.Users.forEach((user) => {
    if (!existingUsernames.has(user.username)) {
      // 为新用户生成Token
      const newToken = {
        username: user.username,
        token: generateToken(),
        enabled: true,
        devices: [],
      };
      adminConfig.TVBoxSecurityConfig!.userTokens!.push(newToken);
    } else {
      // 如果用户已存在，保持其现有Token不变
      // 只更新禁用状态和用户信息，不重新生成Token
      const existingToken = adminConfig.TVBoxSecurityConfig?.userTokens?.find(
        (t) => t.username === user.username,
      );
      if (existingToken) {
        // 保持Token不变，只确保enabled状态正确
        existingToken.enabled = existingToken.enabled ?? true;
      }
    }
  });

  // 清理不存在的用户的Token
  adminConfig.TVBoxSecurityConfig.userTokens =
    adminConfig.TVBoxSecurityConfig.userTokens.filter((token) =>
      adminConfig.UserConfig.Users.some(
        (user) => user.username === token.username,
      ),
    );

  return adminConfig;
}

// 重置配置
export async function resetConfig() {
  clearConfigCache();
  let originConfig: AdminConfig | null = null;
  try {
    originConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失败:', e);
  }
  if (!originConfig) {
    originConfig = {} as AdminConfig;
  }
  const adminConfig = await getInitConfig(
    '', // 空配置文件
    {
      URL: '',
      AutoUpdate: false,
      LastCheck: '',
    }, // 订阅配置也清空
  );
  cachedConfig = adminConfig;
  await db.saveAdminConfig(adminConfig);



  return;
}

// 获取缓存时间
export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

/**
 * 获取用户可用的视频源 - 简化版本
 * 替代索引系统的getUserVideoSources
 */
export async function getUserVideoSourcesSimple(username: string): Promise<ApiSite[]> {
  try {
    const config = await getConfig();
    
    // 获取用户配置
    const user = config.UserConfig?.Users?.find(u => u.username === username);
    if (!user) {
      return [];
    }

    // 权限过滤逻辑
    const filteredSources = config.SourceConfig.filter(source => {
      // 1. 基础过滤：禁用的源
      if (source.disabled) return false;

      // 2. 用户直接权限优先
      if (user.enabledApis && user.enabledApis.length > 0) {
        return user.enabledApis.includes(source.key);
      }

      // 3. 用户组权限
      if (user.tags && user.tags.length > 0) {
        const allowedApis = new Set<string>();
        
        user.tags.forEach(tagName => {
          const tag = config.UserConfig?.Tags?.find(t => t.name === tagName);
          if (tag?.enabledApis) {
            tag.enabledApis.forEach(api => allowedApis.add(api));
          }
        });

        return allowedApis.has(source.key);
      }

      // 4. 默认允许（站长或无权限限制）
      return true;
    });

    // 5. 认证源处理
    const authSources = filteredSources.map(source => {
      if (source.requiresAuth) {
        const userToken = config.TVBoxSecurityConfig?.userTokens?.find(
          t => t.username === username && t.enabled
        );
        
        if (userToken) {
          return { ...source, token: userToken.token };
        } else {
          return null; // 没有有效token的认证源不返回
        }
      }
      return source;
    }).filter(Boolean);

    return authSources as ApiSite[];
  } catch (error) {
    console.error('获取用户视频源失败:', error);
    return [];
  }
}

/**
 * 获取用户可用的视频源（带18+过滤）
 * 用于需要18+内容过滤的场景
 */
export async function getUserVideoSourcesWithFilter(username: string): Promise<ApiSite[]> {
  const sources = await getUserVideoSourcesSimple(username);
  const config = await getConfig();
  const user = config.UserConfig?.Users?.find(u => u.username === username);
  
  // 检查是否需要18+过滤
  if (!config.YellowWords?.length) return sources;
  if (user?.role === 'owner') return sources;
  
  let shouldFilter = false;
  
  // 检查用户组过滤设置
  if (user?.tags?.length > 0 && config.UserConfig.Tags) {
    for (const tagName of user.tags) {
      const tagConfig = config.UserConfig.Tags.find(t => t.name === tagName);
      if (tagConfig?.disableYellowFilter === true) {
        shouldFilter = true;
        break;
      }
    }
  }
  
  if (!shouldFilter) return sources;
  
  // 应用18+过滤
  return sources.map(source => {
    if (!source.categories) return source;
    
    const filteredCategories = source.categories.filter((category: string) => {
      const lowerCategory = category.toLowerCase();
      return !config.YellowWords.some((word: string) =>
        lowerCategory.includes(word.toLowerCase())
      );
    });
    
    return { ...source, categories: filteredCategories };
  });
}

// 获取可用的 API 站点
export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  if (user) {
    return await getUserVideoSourcesSimple(user);
  }

  // 如果没有用户名，返回所有未禁用的源
  const config = await getConfig();
  return config.SourceConfig.filter((s) => !s.disabled);
}

// 设置缓存配置
export async function setCachedConfig(config: AdminConfig) {
  cachedConfig = config;
}
