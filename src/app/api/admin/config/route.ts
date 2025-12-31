/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfig } from '@/lib/admin.types';
import { AuthGuard } from '@/lib/auth';
import { clearConfigCache, getAdminConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

async function getConfigHandler(request: NextRequest, { user }: { user: any }) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const config = await getAdminConfig();

    if (config?.UserConfig) {
      console.log('UserConfig详情:', config.UserConfig);
    }

    const result = {
      Config: config, // 修复：使用大写的 Config
      storageType,
      canSave: true,
      Role: user.role as 'owner' | 'admin',
    };
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

async function saveConfigHandler(
  request: NextRequest,
  { user }: { user: any },
) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    console.log('=== 保存配置 API ===');
    console.log('存储类型:', storageType);
    console.log('当前用户:', user);
    console.log('用户角色:', user.role);

    const newConfig: AdminConfig = await request.json();

    console.log('=== 保存配置 API ===');
    console.log('完整配置:', JSON.stringify(newConfig, null, 2));

    // 处理两种可能的配置结构
    const userConfig =
      newConfig.UserConfig || (newConfig as any).config?.UserConfig;
    if (userConfig) {
      console.log('UserConfig:', JSON.stringify(userConfig, null, 2));
      console.log('UserConfig.Users数量:', userConfig.Users?.length || 0);
      console.log('UserConfig.Tags数量:', userConfig.Tags?.length || 0);

      // 检查每个用户的详细信息
      if (userConfig.Users) {
        userConfig.Users.forEach((user: any, index: number) => {
          console.log(`用户 ${index + 1}:`, {
            username: user.username,
            role: user.role,
            enabled: user.enabled,
            tags: user.tags,
            enabledApis: user.enabledApis,
            enabledApisCount: user.enabledApis?.length || 0,
          });
        });
      }

      // 检查每个用户组的详细信息
      if (userConfig.Tags) {
        userConfig.Tags.forEach((tag: any, index: number) => {
          console.log(`用户组 ${index + 1}:`, {
            name: tag.name,
            enabledApis: tag.enabledApis,
            enabledApisCount: tag.enabledApis?.length || 0,
            videoSources: tag.videoSources,
            videoSourcesCount: tag.videoSources?.length || 0,
          });
        });
      }
    }

    // 保存新配置
    await db.saveAdminConfig(newConfig);
    console.log('数据库保存完成');

    // 清除缓存，强制下次重新从数据库读取
    clearConfigCache();
    console.log('缓存已清除');

    // 验证保存是否成功
    const verifyConfig = await getAdminConfig();
    console.log(
      '验证保存后的配置 - Users数量:',
      verifyConfig.UserConfig?.Users?.length || 0,
    );
    console.log(
      '验证保存后的配置 - Tags数量:',
      Array.isArray(verifyConfig.UserConfig?.Tags) ? verifyConfig.UserConfig.Tags.length : 0,
    );

    console.log('配置保存成功');
    return NextResponse.json(
      {
        success: true,
        message: '配置保存成功',
        verified: {
          usersCount: verifyConfig.UserConfig?.Users?.length || 0,
          tagsCount: Array.isArray(verifyConfig.UserConfig?.Tags) ? verifyConfig.UserConfig.Tags.length : 0,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error) {
    console.error('保存管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '保存配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const GET = AuthGuard.admin(getConfigHandler);
export const POST = AuthGuard.admin(saveConfigHandler);
