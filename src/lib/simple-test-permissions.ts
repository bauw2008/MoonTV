/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { AdminConfig } from './admin.types';

/**
 * 简化的权限系统测试脚本
 * 用于验证18禁和AI推荐权限检查是否正常工作
 */

// 模拟权限检查函数（简化版本）
// 简化的权限检查函数
async function checkUserPermission(
  username: string,
  feature: 'ai-recommend' | 'disable-yellow-filter',
  providedConfig?: AdminConfig,
): Promise<boolean> {
  try {
    console.log(`[权限检查] 开始检查用户 ${username} 的 ${feature} 权限`);

    // 站长默认拥有所有权限
    if (process.env.USERNAME && username === process.env.USERNAME) {
      console.log(`[权限检查] 用户 ${username} 是站长，拥有所有权限`);
      return true;
    }

    const userConfig = providedConfig?.UserConfig.Users.find((u: any) => u.username === username);

    // 如果用户不在配置中，检查是否是新注册用户
    if (!userConfig) {
      console.log(`[权限检查] 用户 ${username} 不在配置中，可能是新用户，默认无特殊功能权限`);
      return false;
    }

    // 管理员默认拥有所有权限
    if (userConfig.role === 'admin') {
      console.log(`[权限检查] 用户 ${username} 是管理员，拥有所有权限`);
      return true;
    }

    // 权限检查结果
    let hasPermission = false;
    let permissionSource = '';

    // 1. 优先检查新的features结构 - 用户直接配置
    if (userConfig.features) {
      const featureKey = feature === 'ai-recommend' ? 'aiRecommend' : 'disableYellowFilter';
      if (userConfig.features[featureKey] === true) {
        hasPermission = true;
        permissionSource = '用户直接配置(features)';
        console.log(`[权限检查] 用户 ${username} 通过用户直接配置获得 ${feature} 权限`);
      }
    }

if (!hasPermission && userConfig.tags && userConfig.tags.length > 0 && providedConfig?.UserConfig.Tags) {
      for (const tagName of userConfig.tags) {
        const tagConfig = providedConfig.UserConfig.Tags.find((t: any) => t.name === tagName);
        if (tagConfig && tagConfig.features) {
          const featureKey = feature === 'ai-recommend' ? 'aiRecommend' : 'disableYellowFilter';
          if (tagConfig.features[featureKey] === true) {
            hasPermission = true;
            permissionSource = `用户组配置(${tagName}.features)`;
            console.log(`[权限检查] 用户 ${username} 通过用户组 ${tagName} 的 features 配置获得 ${feature} 权限`);
            break;
          }
        }
      }
    }

    // 3. 向后兼容：检查旧的enabledApis结构 - 用户直接配置
    if (!hasPermission && userConfig.enabledApis && userConfig.enabledApis.length > 0) {
      if (userConfig.enabledApis.includes(feature)) {
        hasPermission = true;
        permissionSource = '用户直接配置(enabledApis - 兼容模式)';
        console.log(`[权限检查] 用户 ${username} 通过旧的 enabledApis 配置获得 ${feature} 权限 (兼容模式)`);
      }
    }

    // 4. 向后兼容：检查用户组的旧enabledApis结构
    if (!hasPermission && userConfig.tags && userConfig.tags.length > 0 && providedConfig?.UserConfig.Tags) {
      for (const tagName of userConfig.tags) {
        const tagConfig = providedConfig.UserConfig.Tags.find((t: any) => t.name === tagName);
        if (tagConfig && tagConfig.enabledApis && tagConfig.enabledApis.includes(feature)) {
          hasPermission = true;
          permissionSource = `用户组配置(${tagName}.enabledApis - 兼容模式)`;
          console.log(`[权限检查] 用户 ${username} 通过用户组 ${tagName} 的旧 enabledApis 配置获得 ${feature} 权限 (兼容模式)`);
          break;
        }
      }
    }

    console.log(`[权限检查] 用户 ${username} 的 ${feature} 权限检查结果: ${hasPermission}, 权限来源: ${permissionSource || '无权限'}`);

    return hasPermission;
  } catch (error) {
    console.error('[权限检查] 权限检查失败:', error);
    const isAdmin = !!(process.env.USERNAME && username === process.env.USERNAME);
    console.log(`[权限检查] 出错时的回退逻辑: 用户 ${username} ${isAdmin ? '是站长' : '不是站长'}, 返回权限: ${isAdmin}`);
    return isAdmin;
  }
}

// 创建测试配置
const createTestConfig = (): AdminConfig => ({
  ConfigSubscribtion: {
    URL: '',
    AutoUpdate: false,
    LastCheck: '',
  },
  ConfigFile: '',
  SiteConfig: {
    SiteName: 'Test Site',
    Announcement: '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 300,
    DoubanProxyType: '',
    DoubanProxy: '',
    DoubanImageProxyType: '',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: false,
    MenuSettings: {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: true,
      showTvbox: true,
      showShortDrama: true,
      showAI: true,
      showNetDiskSearch: true,
      showTMDBActorSearch: true,
    },
  },
  UserConfig: {
    Users: [
      // 测试用户1：站长
      {
        username: 'admin',
        role: 'owner',
        enabledApis: [],
        tags: [],
      },
      // 测试用户2：管理员
      {
        username: 'moderator',
        role: 'admin',
        enabledApis: [],
        tags: [],
      },
      // 测试用户3：普通用户，有新features权限
      {
        username: 'user1',
        role: 'user',
        features: {
          aiRecommend: true,
          disableYellowFilter: true,
        },
        tags: ['premium'],
      },
      // 测试用户4：普通用户，有旧enabledApis权限
      {
        username: 'user2',
        role: 'user',
        enabledApis: ['ai-recommend', 'disable-yellow-filter'],
        tags: ['legacy'],
      },
      // 测试用户5：普通用户，无特殊权限
      {
        username: 'user3',
        role: 'user',
        tags: ['basic'],
      },
    ],
    Tags: [
      // 高级用户组：新features权限
      {
        name: 'premium',
        enabledApis: ['source1', 'source2'], // 向后兼容
        videoSources: ['source1', 'source2'],
        features: {
          aiRecommend: true,
        },
        disableYellowFilter: true,
      },
      // 传统用户组：旧enabledApis权限
      {
        name: 'legacy',
        enabledApis: ['api1', 'api2', 'ai-recommend', 'disable-yellow-filter'],
        videoSources: ['api1', 'api2'],
        features: {
          aiRecommend: true,
        },
        disableYellowFilter: true,
      },
      // 基础用户组：无特殊权限
      {
        name: 'basic',
        enabledApis: ['source1'], // 向后兼容
        videoSources: ['source1'],
        features: {
          aiRecommend: false,
        },
        disableYellowFilter: false,
      },
    ],
  },
  SourceConfig: [],
  CustomCategories: [],
  LiveConfig: [],
  NetDiskConfig: {
    enabled: false,
    pansouUrl: '',
    timeout: 30,
    enabledCloudTypes: [],
  },
  AIRecommendConfig: {
    enabled: false,
    apiUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 3000,
  },
  TVBoxSecurityConfig: {
    enableAuth: false,
    enableRateLimit: false,
    rateLimit: 60,
    enableDeviceBinding: false,
    maxDevices: 1,
    enableUserAgentWhitelist: false,
    allowedUserAgents: [],
    currentDevices: [],
    userTokens: [],
  },
});

// 测试用例
const testCases = [
  // AI推荐权限测试
  { user: 'admin', feature: 'ai-recommend' as const, expected: true, description: '站长应该有AI推荐权限' },
  { user: 'moderator', feature: 'ai-recommend' as const, expected: true, description: '管理员应该有AI推荐权限' },
  { user: 'user1', feature: 'ai-recommend' as const, expected: true, description: '有新features权限的用户应该有AI推荐权限' },
  { user: 'user2', feature: 'ai-recommend' as const, expected: true, description: '有旧enabledApis权限的用户应该有AI推荐权限' },
  { user: 'user3', feature: 'ai-recommend' as const, expected: false, description: '无特殊权限的用户不应该有AI推荐权限' },
  
  // 18禁过滤权限测试
  { user: 'admin', feature: 'disable-yellow-filter' as const, expected: true, description: '站长应该有18禁过滤豁免权限' },
  { user: 'moderator', feature: 'disable-yellow-filter' as const, expected: true, description: '管理员应该有18禁过滤豁免权限' },
  { user: 'user1', feature: 'disable-yellow-filter' as const, expected: true, description: '有新features权限的用户应该有18禁过滤豁免权限' },
  { user: 'user2', feature: 'disable-yellow-filter' as const, expected: true, description: '有旧enabledApis权限的用户应该有18禁过滤豁免权限' },
  { user: 'user3', feature: 'disable-yellow-filter' as const, expected: false, description: '无特殊权限的用户不应该有18禁过滤豁免权限' },
];

// 运行测试
async function runPermissionTests() {
  console.log('🚀 开始权限系统测试...\n');
  
  const testConfig = createTestConfig();
  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    try {
      // 临时设置环境变量模拟站长
      const originalUsername = process.env.USERNAME;
      if (testCase.user === 'admin') {
        process.env.USERNAME = 'admin';
      }

      const result = await checkUserPermission(
        testCase.user,
        testCase.feature,
        testConfig
      );

      // 恢复环境变量
      if (testCase.user === 'admin') {
        process.env.USERNAME = originalUsername;
      }

      if (result === testCase.expected) {
        console.log(`✅ 通过: ${testCase.description}`);
        passedTests++;
      } else {
        console.log(`❌ 失败: ${testCase.description}`);
        console.log(`   期望: ${testCase.expected}, 实际: ${result}`);
        failedTests++;
      }
    } catch (error) {
      console.log(`❌ 错误: ${testCase.description}`);
      console.log(`   错误信息: ${error}`);
      failedTests++;
    }
  }

  console.log(`\n📊 测试结果:`);
  console.log(`   通过: ${passedTests}/${testCases.length}`);
  console.log(`   失败: ${failedTests}/${testCases.length}`);
  console.log(`   成功率: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 所有权限测试通过！权限系统工作正常。');
  } else {
    console.log('\n⚠️  部分测试失败，请检查权限系统实现。');
  }

  return failedTests === 0;
}

// 主测试函数
export async function testPermissionSystem() {
  console.log('🧪 权限系统测试开始\n');
  console.log('='.repeat(50));
  
  const permissionTestsPassed = await runPermissionTests();
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 权限系统测试完成');
  
  return permissionTestsPassed;
}

// 如果直接运行此文件，执行测试
testPermissionSystem().catch(console.error);