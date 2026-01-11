/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import fs from 'fs';
import path from 'path';

import { db } from '@/lib/db';

import { AdminConfig } from './admin.types';

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
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

// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch (e) {
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
  } catch (e) {
    cfgFile = {} as ConfigFileStruct;
  }

  // 从 default-config.json 读取站长配置（MaxUsers 等）
  let ownerConfig: any = {};
  try {
    const fs = await import('fs');
    const path = await import('path');
    const ownerConfigPath = path.join(
      process.cwd(),
      'data',
      'default-config.json',
    );
    if (fs.existsSync(ownerConfigPath)) {
      const ownerConfigContent = fs.readFileSync(ownerConfigPath, 'utf-8');
      ownerConfig = JSON.parse(ownerConfigContent);
    }
  } catch (e) {
    // 读取站长配置失败，使用默认值
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
      TMDBApiKey: process.env.TMDB_API_KEY || '',
      TMDBLanguage: 'zh-CN',
      EnableTMDBActorSearch: false, // 默认关闭，需要配置API Key后手动开启
      EnableTMDBPosters: false, // 默认关闭，需要配置API Key后手动开启
      // 从 default-config.json 读取 MaxUsers
      MaxUsers: ownerConfig.MaxUsers || 1000,
      // 添加 MenuSettings 默认值
      MenuSettings: {
        showMovies: process.env.NEXT_PUBLIC_MENU_SHOW_MOVIES === 'true',
        showTVShows: process.env.NEXT_PUBLIC_MENU_SHOW_TVSHOWS === 'true',
        showAnime: process.env.NEXT_PUBLIC_MENU_SHOW_ANIME === 'true',
        showVariety: process.env.NEXT_PUBLIC_MENU_SHOW_VARIETY === 'true',
        showLive: false, // 默认关闭，可在管理界面配置
        showTvbox: process.env.NEXT_PUBLIC_MENU_SHOW_TVBOX === 'true',
        showShortDrama: process.env.NEXT_PUBLIC_MENU_SHOW_SHORTDRAMA === 'true',
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
      '伦理',
      '福利',
      '诱惑',
      '传媒',
      '无码',
      '有码',
      'SWAG',
      '倫理',
      '三级',
      '乱伦',
    ],
  };

  // 添加默认的 TVBox 安全配置
  adminConfig.TVBoxSecurityConfig = {
    enableAuth: false,
    token: '',
    enableRateLimit: false,
    rateLimit: 30,
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
    // 获取用户列表失败，使用空数组
  }
  const allUsers = userNames
    .filter((u) => u !== process.env.USERNAME)
    .map((u) => ({
      username: u,
      role: 'user',
      banned: false,
    }));
  allUsers.unshift({
    username: process.env.USERNAME!,
    role: 'owner',
    banned: false,
  });
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
export async function getConfig(): Promise<AdminConfig> {
  // 直接使用内存缓存
  if (cachedConfig) {
    return cachedConfig;
  }

  // 读 db
  let adminConfig: AdminConfig | null = null;
  try {
    adminConfig = await db.getAdminConfig();
  } catch (e) {
    // 获取管理员配置失败
  }

  // db 中无配置，执行一次初始化
  if (!adminConfig) {
    adminConfig = await getInitConfig('');
    adminConfig = configSelfCheck(adminConfig);
    cachedConfig = adminConfig;
    // 保存初始化配置到数据库
    try {
      await db.saveAdminConfig(cachedConfig);
      // 初始化配置已保存到数据库
    } catch (error) {
      // 保存初始化配置到数据库失败
    }
  } else {
    adminConfig = configSelfCheck(adminConfig);
    cachedConfig = adminConfig;
  }
  return cachedConfig;
}

// 清除配置缓存，强制重新从数据库读取
export function clearConfigCache(): void {
  cachedConfig = null as any;
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
    // 自动将前4个可用的采集源作为默认源
    const availableSources = (adminConfig.SourceConfig || [])
      .filter((source: any) => source && !source.disabled && source.key)
      .slice(0, 4)
      .map((source: any) => source.key);

    adminConfig.UserConfig.Tags.unshift({
      name: defaultGroupName,
      videoSources: availableSources, // 默认用户组有前4个视频源权限
      aiEnabled: false, // 默认不启用AI功能
      disableYellowFilter: false, // 默认过滤18+内容
    });

    // 用户 ${username} 的 ${availableSources.length} 个采集源权限: ${availableSources.join(', ') || '无'}
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
    // 初始化 YellowWords 配置
    adminConfig.YellowWords = [
      '伦理',
      '福利',
      '诱惑',
      '传媒',
      '无码',
      '有码',
      'SWAG',
      '倫理',
      '三级',
      '乱伦',
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
        showLive: false, // 默认关闭，可在管理界面配置
        showTvbox: false,
        showShortDrama: false,
        showAI: false,
        showNetDiskSearch: false,
        showTMDBActorSearch: false,
      },
    };
  }

  // 从 default-config.json 读取 MaxUsers（站长配置）
  try {
    const ownerConfigPath = path.join(
      process.cwd(),
      'data',
      'default-config.json',
    );
    if (fs.existsSync(ownerConfigPath)) {
      const ownerConfigContent = fs.readFileSync(ownerConfigPath, 'utf-8');
      const ownerConfig = JSON.parse(ownerConfigContent);
      if (ownerConfig.MaxUsers !== undefined) {
        adminConfig.SiteConfig.MaxUsers = ownerConfig.MaxUsers;
      }
    }
  } catch (e) {
    // 读取失败，使用默认值
  }

  // 确保 MaxUsers 有默认值
  if (adminConfig.SiteConfig.MaxUsers === undefined) {
    adminConfig.SiteConfig.MaxUsers = 1000;
  }

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
  const ownerUser = process.env.USERNAME;

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
    videoSources: originOwnerCfg?.videoSources || undefined,
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
      rateLimit: 30,
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
        token: (() => {
          const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        })(),
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

  // 确保短剧配置有默认值
  if (!adminConfig.ShortDramaConfig) {
    adminConfig.ShortDramaConfig = {
      primaryApiUrl: 'https://api.r2afosne.dpdns.org',
      alternativeApiUrl: '',
      enableAlternative: false,
    };
  }

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

  // 获取默认配置
  const adminConfig = await getInitConfig(
    '', // 空配置文件
    {
      URL: '',
      AutoUpdate: false,
      LastCheck: '',
    }, // 订阅配置也清空
  );

  // 保留用户数据（用户、用户组、待审批用户）
  if (originConfig.UserConfig) {
    adminConfig.UserConfig = originConfig.UserConfig;
  }

  // 重置其他所有配置为默认值，覆盖环境变量
  adminConfig.SiteConfig = {
    SiteName: 'Vidora', // 强制使用默认值，忽略环境变量
    Announcement:
      '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
    SearchDownstreamMaxPage: 5,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'direct',
    DoubanProxy: '',
    DoubanImageProxyType: 'direct',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    TMDBApiKey: '', // 清空API Key
    TMDBLanguage: 'zh-CN',
    EnableTMDBActorSearch: false,
    EnableTMDBPosters: false,
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

  // 重置 TVBox 安全配置为默认值，但保留用户 Token
  const existingUserTokens = originConfig.TVBoxSecurityConfig?.userTokens || [];
  adminConfig.TVBoxSecurityConfig = {
    enableAuth: false,
    token: '',
    enableRateLimit: false,
    rateLimit: 30,
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
    userTokens: existingUserTokens, // 保留现有的用户 Token
  };

  // 重置 YellowWords 为默认值
  adminConfig.YellowWords = [
      '伦理',
      '福利',
      '诱惑',
      '传媒',
      '无码',
      '有码',
      'SWAG',
      '倫理',
      '三级',
      '乱伦',
  ];

  // 清空其他配置数组
  adminConfig.SourceConfig = [];
  adminConfig.CustomCategories = [];
  adminConfig.LiveConfig = [];

  cachedConfig = adminConfig;
  await db.saveAdminConfig(adminConfig);

  return;
}

// 获取缓存时间
export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

// 获取用户可用的 API 站点（采集源）
export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);

  if (!user) {
    return allApiSites;
  }

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  if (!userConfig) {
    return allApiSites;
  }

  // 优先根据用户自己的 videoSources 配置查找（专门的采集源配置）
  if (userConfig.videoSources && userConfig.videoSources.length > 0) {
    const userVideoSourcesSet = new Set(userConfig.videoSources);
    return allApiSites
      .filter((s) => userVideoSourcesSet.has(s.key))
      .map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        detail: s.detail,
      }));
  }

  // 如果没有 videoSources 配置，则根据 tags 查找
  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    const videoSourcesFromTags = new Set<string>();

    // 遍历用户的所有 tags，只收集 videoSources（采集源）
    userConfig.tags.forEach((tagName) => {
      const tagConfig = config.UserConfig.Tags?.find((t) => t.name === tagName);
      if (tagConfig && tagConfig.videoSources) {
        tagConfig.videoSources.forEach((sourceKey) => {
          videoSourcesFromTags.add(sourceKey);
        });
      }
    });

    if (videoSourcesFromTags.size > 0) {
      return allApiSites
        .filter((s) => videoSourcesFromTags.has(s.key))
        .map((s) => ({
          key: s.key,
          name: s.name,
          api: s.api,
          detail: s.detail,
        }));
    }
  }

  // 如果都没有配置，返回所有可用的 API 站点
  return allApiSites;
}

// 获取用户的功能权限
export async function getUserFeatures(user?: string): Promise<{
  aiEnabled: boolean;
  disableYellowFilter: boolean;
  specialFeatures: string[];
}> {
  const config = await getConfig();

  if (!user) {
    // 默认权限
    return {
      aiEnabled: false,
      disableYellowFilter: false,
      specialFeatures: [],
    };
  }

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  if (!userConfig) {
    return {
      aiEnabled: false,
      disableYellowFilter: false,
      specialFeatures: [],
    };
  }

  // 站长拥有所有权限
  if (userConfig.role === 'owner') {
    return {
      aiEnabled: true,
      disableYellowFilter: true,
      specialFeatures: ['all'],
    };
  }

  let aiEnabled = false;
  let disableYellowFilter = false;
  let netDiskSearchEnabled = false;
  let tmdbActorSearchEnabled = false;
  const specialFeatures: string[] = [];

  // 检查用户自己的功能配置
  if (userConfig.features) {
    if (userConfig.features.aiEnabled) aiEnabled = true;
    if (userConfig.features.disableYellowFilter) disableYellowFilter = true;
    if (userConfig.features.netDiskSearchEnabled) netDiskSearchEnabled = true;
    if (userConfig.features.tmdbActorSearchEnabled) tmdbActorSearchEnabled = true;
  }

  // 检查用户组的功能配置
  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    userConfig.tags.forEach((tagName) => {
      const tagConfig = config.UserConfig.Tags?.find((t) => t.name === tagName);
      if (tagConfig) {
        if (tagConfig.aiEnabled) aiEnabled = true;
        if (tagConfig.disableYellowFilter) disableYellowFilter = true;
        if (tagConfig.netDiskSearchEnabled) netDiskSearchEnabled = true;
        if (tagConfig.tmdbActorSearchEnabled) tmdbActorSearchEnabled = true;
      }
    });
  }

  return {
    aiEnabled,
    disableYellowFilter,
    netDiskSearchEnabled,
    tmdbActorSearchEnabled,
    specialFeatures,
  };
}

// 设置缓存配置
export async function setCachedConfig(config: AdminConfig) {
  cachedConfig = config;
}

// 特殊功能权限检查
export async function hasSpecialFeaturePermission(
  username: string,
  feature:
    | 'ai-recommend'
    | 'disable-yellow-filter'
    | 'netdisk-search'
    | 'tmdb-actor-search',
  providedConfig?: AdminConfig,
): Promise<boolean> {
  try {
    // 站长默认拥有所有权限
    if (username === process.env.USERNAME) {
      return true;
    }

    // 使用提供的配置或获取新配置
    const config = providedConfig || (await getConfig());
    const userConfig = config.UserConfig.Users.find(
      (u) => u.username === username,
    );

    // 如果用户不在配置中，检查是否是新注册用户
    if (!userConfig) {
      // 新注册用户默认无特殊功能权限，但不阻止基本访问
      // 这里返回false是正确的，因为新用户默认不应该有AI权限
      return false;
    }

    // 管理员默认拥有所有权限
    if (userConfig.role === 'admin') {
      return true;
    }

    // 普通用户需要检查特殊功能权限
    // 优先检查用户直接配置的 features
    if (userConfig.features) {
      switch (feature) {
        case 'ai-recommend':
          return userConfig.features.aiEnabled || false;
        case 'disable-yellow-filter':
          return userConfig.features.disableYellowFilter || false;
        case 'netdisk-search':
          return userConfig.features.netDiskSearchEnabled || false;
        case 'tmdb-actor-search':
          return userConfig.features.tmdbActorSearchEnabled || false;
      }
    }

    // 如果没有直接配置，检查用户组 tags 的权限
    if (
      userConfig.tags &&
      userConfig.tags.length > 0 &&
      config.UserConfig.Tags
    ) {
      for (const tagName of userConfig.tags) {
        const tagConfig = config.UserConfig.Tags.find(
          (t) => t.name === tagName,
        );
        if (tagConfig) {
          switch (feature) {
            case 'ai-recommend':
              if (tagConfig.aiEnabled) return true;
              break;
            case 'disable-yellow-filter':
              if (tagConfig.disableYellowFilter) return true;
              break;
            case 'netdisk-search':
              if (tagConfig.netDiskSearchEnabled) return true;
              break;
            case 'tmdb-actor-search':
              if (tagConfig.tmdbActorSearchEnabled) return true;
              break;
          }
        }
      }
    }

    // 默认情况下，普通用户无权使用特殊功能
    return false;
  } catch (error) {
    // 权限检查失败
    // 出错时，如果是站长则返回true，否则返回false
    return username === process.env.USERNAME;
  }
}
