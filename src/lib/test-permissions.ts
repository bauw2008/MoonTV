/* eslint-disable no-console */

import { AdminConfig } from './admin.types';
import { canUseAIRecommend,shouldApplyYellowFilter } from './config-separation';

/**
 * 权限系统测试脚本
 * 用于验证18禁和AI推荐权限检查是否正常工作
 */

// 创建测试配置
const createTestConfig = (): AdminConfig => ({
  ConfigSubscribtion: {
    URL: '',
    AutoUpdate: false,
    LastCheck: '',
  },
  ConfigFile: '',
  SiteConfig: {
    SiteName: '测试站点',
    Announcement: '',
    SearchDownstreamMaxPage: 5,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'direct',
    DoubanProxy: '',
    DoubanImageProxyType: 'direct',
    DoubanImageProxy: '',
    DisableYellowFilter: false, // 全局开启18+过滤
    FluidSearch: false,
    TMDBApiKey: '',
    TMDBLanguage: 'zh-CN',
    EnableTMDBActorSearch: false,
    EnableTMDBPosters: true,
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
  },
  UserConfig: {
    AllowRegister: true,
    AutoCleanupInactiveUsers: false,
    InactiveUserDays: 7,
    RequireApproval: false,
    PendingUsers: [],
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
    enabledCloudTypes: ['baidu'],
  },
  AIRecommendConfig: {
    enabled: true,
    apiUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 3000,
  },
  TVBoxSecurityConfig: {
    enableAuth: false,
    token: '',
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
const testCases: Array<{
  user: string;
  feature: 'ai-recommend' | 'disable-yellow-filter';
  expected: boolean;
  description: string;
}> = [
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

      let result: boolean;
      
      // 根据功能类型使用新的函数
      if (testCase.feature === 'disable-yellow-filter') {
        // shouldApplyYellowFilter返回true表示需要过滤，false表示豁免
        // 所以我们需要取反值来匹配旧的逻辑
        result = !shouldApplyYellowFilter(testConfig, testCase.user);
      } else if (testCase.feature === 'ai-recommend') {
        result = canUseAIRecommend(testConfig, testCase.user);
      } else {
        throw new Error(`未知的功能类型: ${testCase.feature}`);
      }

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

// 测试权限迁移功能
async function testPermissionMigration() {
  console.log('\n🔄 测试权限迁移功能...\n');
  
  try {
    const { migrateTagPermissions, validatePermissionConfig } = await import('../lib/permission-migration');
    
    // 创建需要迁移的配置
    const configToMigrate: AdminConfig = {
      ConfigSubscribtion: { URL: '', AutoUpdate: false, LastCheck: '' },
      ConfigFile: '',
      SiteConfig: {
        SiteName: '测试站点',
        Announcement: '',
        SearchDownstreamMaxPage: 5,
        SiteInterfaceCacheTime: 7200,
        DoubanProxyType: 'direct',
        DoubanProxy: '',
        DoubanImageProxyType: 'direct',
        DoubanImageProxy: '',
        DisableYellowFilter: false,
        FluidSearch: false,
        TMDBApiKey: '',
        TMDBLanguage: 'zh-CN',
        EnableTMDBActorSearch: false,
        EnableTMDBPosters: true,
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
      },
      UserConfig: {
        AllowRegister: true,
        AutoCleanupInactiveUsers: false,
        InactiveUserDays: 7,
        RequireApproval: false,
        PendingUsers: [],
        Users: [],
        Tags: [
          {
            name: 'test-tag',
            enabledApis: ['api1', 'api2', 'ai-recommend', 'disable-yellow-filter'],
            videoSources: ['api1', 'api2'],
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
        enabledCloudTypes: ['baidu'],
      },
    };

    // 执行迁移
    const migrationResult = migrateTagPermissions(configToMigrate);
    
    if (migrationResult.success) {
      console.log(`✅ 权限迁移成功: ${migrationResult.message}`);
      
      // 验证迁移结果
      const migratedTag = configToMigrate.UserConfig.Tags?.[0];
      if (migratedTag) {
        console.log(`   迁移后的用户组配置:`);
        console.log(`   - enabledApis: ${migratedTag.enabledApis}`);
        console.log(`   - videoSources: ${migratedTag.videoSources}`);
        console.log(`   - features: ${JSON.stringify(migratedTag.features)}`);
      }
      
      // 验证配置完整性
      const validation = validatePermissionConfig(configToMigrate);
      if (validation.valid) {
        console.log(`✅ 配置验证通过`);
      } else {
        console.log(`❌ 配置验证失败: ${validation.issues.join(', ')}`);
      }
    } else {
      console.log(`❌ 权限迁移失败: ${migrationResult.message}`);
      if (migrationResult.errors) {
        console.log(`   错误详情: ${migrationResult.errors.join(', ')}`);
      }
    }
  } catch (error) {
    console.log(`❌ 权限迁移测试出错: ${error}`);
  }
}

// 主测试函数
export async function testPermissionSystem() {
  console.log('🧪 权限系统测试开始\n');
  console.log('='.repeat(50));
  
  const permissionTestsPassed = await runPermissionTests();
  await testPermissionMigration();
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 权限系统测试完成');
  
  return permissionTestsPassed;
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testPermissionSystem().catch(console.error);
}