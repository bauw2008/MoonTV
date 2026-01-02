import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export const POST = AuthGuard.admin(
  async (request: NextRequest, { user }: { user: { username: string } }) => {
    const results = {
      timestamp: new Date().toISOString(),
      user: user.username,
      tests: [] as {
        name: string;
        success: boolean;
        message: string;
        details?: Record<string, unknown>;
      }[],
    };

    // 测试1: 检查存储实例
    try {
      const storage = (db as unknown as { storage?: unknown }).storage;
      results.tests.push({
        name: '存储实例检查',
        success: !!storage,
        message: storage ? '存储实例存在' : '存储实例为空',
        details: {
          storageType: storage?.constructor?.name || 'unknown',
        },
      });
    } catch (error) {
      results.tests.push({
        name: '存储实例检查',
        success: false,
        message: `错误: ${(error as Error).message}`,
      });
    }

    // 测试2: 尝试获取所有用户
    try {
      const users = await db.getAllUsers();
      results.tests.push({
        name: '获取用户列表',
        success: true,
        message: `成功获取 ${users.length} 个用户`,
        details: { users },
      });
    } catch (error) {
      results.tests.push({
        name: '获取用户列表',
        success: false,
        message: `错误: ${(error as Error).message}`,
        details: { error: String(error) },
      });
    }

    // 测试3: 尝试保存配置（使用测试数据）
    try {
      const testConfig = {
        ConfigSubscribtion: {
          URL: '',
          AutoUpdate: false,
          LastCheck: new Date().toISOString(),
        },
        ConfigFile: '',
        SiteConfig: {
          SiteName: 'Test',
          Announcement: '',
          SearchDownstreamMaxPage: 1,
          SiteInterfaceCacheTime: 300,
          DoubanProxyType: 'none',
          DoubanProxy: '',
          DoubanImageProxyType: 'none',
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
          Users: [],
          PendingUsers: [],
        },
        SourceConfig: [],
        CustomCategories: [],
        TestConfig: {
          timestamp: Date.now(),
          test: true,
        },
      };
      await db.saveAdminConfig(
        testConfig as Parameters<typeof db.saveAdminConfig>[0],
      );
      results.tests.push({
        name: '保存配置',
        success: true,
        message: '配置保存成功',
      });
    } catch (error) {
      results.tests.push({
        name: '保存配置',
        success: false,
        message: `错误: ${(error as Error).message}`,
        details: { error: String(error) },
      });
    }

    // 测试4: 检查环境变量
    results.tests.push({
      name: '环境变量检查',
      success: true,
      message: '环境变量检查完成',
      details: {
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        REDIS_URL: process.env.REDIS_URL ? '已设置' : '未设置',
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
          ? '已设置'
          : '未设置',
        KVROCKS_URL: process.env.KVROCKS_URL ? '已设置' : '未设置',
      },
    });

    return NextResponse.json(results);
  },
);
