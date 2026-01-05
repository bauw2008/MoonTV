/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const body = await request.json();

    // 权限校验：仅站长可以修改站点配置
    if (user.role !== 'owner') {
      return NextResponse.json(
        { error: '权限不足，只有站长可以修改站点配置' },
        { status: 403 },
      );
    }

    let adminConfig = await getConfig();

    // 保存旧配置用于对比
    const oldConfig = JSON.parse(JSON.stringify(adminConfig.SiteConfig));

    // 更新缓存中的站点设置
    adminConfig.SiteConfig = {
      SiteName:
        body.SiteName ??
        adminConfig.SiteConfig.SiteName ??
        (process.env.NEXT_PUBLIC_SITE_NAME || 'Vidora'),
      Announcement:
        body.Announcement ??
        adminConfig.SiteConfig.Announcement ??
        (process.env.ANNOUNCEMENT ||
          '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。'),
      SearchDownstreamMaxPage:
        body.SearchDownstreamMaxPage ??
        adminConfig.SiteConfig.SearchDownstreamMaxPage,
      SiteInterfaceCacheTime:
        body.SiteInterfaceCacheTime ??
        adminConfig.SiteConfig.SiteInterfaceCacheTime,
      DoubanProxyType:
        body.DoubanProxyType ?? adminConfig.SiteConfig.DoubanProxyType,
      DoubanProxy: body.DoubanProxy ?? adminConfig.SiteConfig.DoubanProxy,
      DoubanImageProxyType:
        body.DoubanImageProxyType ??
        adminConfig.SiteConfig.DoubanImageProxyType,
      DoubanImageProxy:
        body.DoubanImageProxy ?? adminConfig.SiteConfig.DoubanImageProxy,
      DisableYellowFilter:
        body.DisableYellowFilter ?? adminConfig.SiteConfig.DisableYellowFilter,
      FluidSearch: body.FluidSearch ?? adminConfig.SiteConfig.FluidSearch,
      // TMDB配置
      TMDBApiKey: body.TMDBApiKey ?? adminConfig.SiteConfig.TMDBApiKey,
      TMDBLanguage: body.TMDBLanguage ?? adminConfig.SiteConfig.TMDBLanguage,
      EnableTMDBActorSearch:
        body.EnableTMDBActorSearch ??
        adminConfig.SiteConfig.EnableTMDBActorSearch,
      EnableTMDBPosters:
        body.EnableTMDBPosters ?? adminConfig.SiteConfig.EnableTMDBPosters,
      MenuSettings: body.MenuSettings ?? adminConfig.SiteConfig.MenuSettings,
    };

    adminConfig = refineConfig(adminConfig);

    // 更新配置文件
    await db.saveAdminConfig(adminConfig);

    // 清理配置缓存确保立即生效
    clearConfigCache();

    // 检测哪些配置发生了变化
    const changes = detectConfigChanges(oldConfig, adminConfig.SiteConfig);

    console.log('站点配置更新:', changes);
    console.log('TMDB配置状态:', {
      TMDBApiKey: adminConfig.SiteConfig.TMDBApiKey ? '已配置' : '未配置',
      TMDBLanguage: adminConfig.SiteConfig.TMDBLanguage,
      EnableTMDBActorSearch: adminConfig.SiteConfig.EnableTMDBActorSearch,
      EnableTMDBPosters: adminConfig.SiteConfig.EnableTMDBPosters,
    });

    return NextResponse.json({
      success: true,
      message: '配置已保存并立即生效',
      changes, // 返回变更信息，便于前端处理
      config: adminConfig.SiteConfig, // 返回最新配置
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('更新站点配置失败:', error);
    return NextResponse.json(
      {
        error: '更新站点配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

// GET处理器：获取站点配置
async function GETHandler(request: NextRequest, { user }: { user: any }) {
  try {
    const config = await getConfig();
    return NextResponse.json({
      config: config.SiteConfig,
      success: true,
    });
  } catch (error) {
    console.error('获取站点配置失败:', error);
    return NextResponse.json({ error: '获取站点配置失败' }, { status: 500 });
  }
}

// 辅助函数：清理配置数据
function refineConfig(config: any): any {
  // 这里可以添加配置数据的清理和验证逻辑
  return config;
}

// 辅助函数：检测配置变更
function detectConfigChanges(oldConfig: any, newConfig: any): any {
  const changes: any = {};

  // 检测各个字段的变更
  const checkField = (field: string, label: string) => {
    if (oldConfig[field] !== newConfig[field]) {
      changes[field] = {
        label,
        old: oldConfig[field],
        new: newConfig[field],
      };
    }
  };

  // 检测基本字段变更
  checkField('SiteName', '站点名称');
  checkField('Announcement', '站点公告');
  checkField('SearchDownstreamMaxPage', '搜索最大页数');
  checkField('SiteInterfaceCacheTime', '接口缓存时间');
  checkField('DoubanProxyType', '豆瓣数据源');
  checkField('DoubanProxy', '豆瓣代理地址');
  checkField('DoubanImageProxyType', '豆瓣图片代理');
  checkField('DoubanImageProxy', '豆瓣图片代理地址');
  checkField('DisableYellowFilter', '禁用黄词过滤');
  checkField('FluidSearch', '流体搜索');

  // 检测菜单设置变更
  if (
    JSON.stringify(oldConfig.MenuSettings) !==
    JSON.stringify(newConfig.MenuSettings)
  ) {
    changes.MenuSettings = {
      label: '菜单显示设置',
      old: oldConfig.MenuSettings,
      new: newConfig.MenuSettings,
    };
  }

  return changes;
}

export const GET = AuthGuard.owner(GETHandler);
export const POST = AuthGuard.owner(POSTHandler);
