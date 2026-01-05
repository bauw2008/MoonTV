import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 获取TMDB配置
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();

    return NextResponse.json({
      success: true,
      data: config.SiteConfig,
    });
  } catch (error) {
    console.error('获取TMDB配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 },
    );
  }
}

// 更新TMDB配置
export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 },
    );
  }

  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    const tmdbSettings = await request.json();

    // 参数验证
    const {
      TMDBApiKey,
      TMDBLanguage,
      EnableTMDBActorSearch,
      EnableTMDBPosters,
    } = tmdbSettings as {
      TMDBApiKey?: string;
      TMDBLanguage?: string;
      EnableTMDBActorSearch?: boolean;
      EnableTMDBPosters?: boolean;
    };

    if (
      (TMDBApiKey !== undefined && typeof TMDBApiKey !== 'string') ||
      (TMDBLanguage !== undefined && typeof TMDBLanguage !== 'string') ||
      (EnableTMDBActorSearch !== undefined &&
        typeof EnableTMDBActorSearch !== 'boolean') ||
      (EnableTMDBPosters !== undefined &&
        typeof EnableTMDBPosters !== 'boolean')
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 权限验证
    const adminConfig = await getConfig();
    if (username !== process.env.USERNAME) {
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 获取当前配置
    const currentConfig = await getConfig();

    // 调试日志
    console.log('TMDB API 接收到的配置:', {
      EnableTMDBActorSearch,
      类型: typeof EnableTMDBActorSearch,
      当前值: currentConfig.SiteConfig.EnableTMDBActorSearch,
    });

    // 更新TMDB相关配置
    const updatedConfig = {
      ...currentConfig,
      SiteConfig: {
        ...currentConfig.SiteConfig,
        TMDBApiKey: TMDBApiKey ?? currentConfig.SiteConfig.TMDBApiKey,
        TMDBLanguage: TMDBLanguage ?? currentConfig.SiteConfig.TMDBLanguage,
        EnableTMDBActorSearch:
          EnableTMDBActorSearch ??
          currentConfig.SiteConfig.EnableTMDBActorSearch,
        EnableTMDBPosters:
          EnableTMDBPosters ?? currentConfig.SiteConfig.EnableTMDBPosters,
      },
    };

    console.log('TMDB API 保存的配置:', {
      EnableTMDBActorSearch: updatedConfig.SiteConfig.EnableTMDBActorSearch,
      类型: typeof updatedConfig.SiteConfig.EnableTMDBActorSearch,
    });

    // 写入数据库
    console.log('正在保存到数据库...');
    await db.saveAdminConfig(updatedConfig);
    console.log('数据库保存完成');

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();
    console.log('配置缓存已清除');

    // 验证保存后的配置
    const verifyConfig = await getConfig();
    console.log('验证保存后的配置:', {
      EnableTMDBActorSearch: verifyConfig.SiteConfig.EnableTMDBActorSearch,
      EnableTMDBPosters: verifyConfig.SiteConfig.EnableTMDBPosters,
    });

    return NextResponse.json({
      success: true,
      message: 'TMDB配置更新成功',
    });
  } catch (error) {
    console.error('更新TMDB配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败' },
      { status: 500 },
    );
  }
}
