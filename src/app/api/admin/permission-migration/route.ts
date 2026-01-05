import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { migrateTagPermissions, validatePermissionConfig } from '@/lib/permission-migration';

export const runtime = 'nodejs';

// 权限迁移API - 仅管理员可访问
export const POST = AuthGuard.owner(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const username = user.username;

    // 获取当前配置
    const config = await getConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: '无法获取配置' },
        { status: 500 }
      );
    }

    console.log(`[权限迁移] 管理员 ${username} 发起权限迁移`);

    // 执行权限迁移
    const migrationResult = migrateTagPermissions(config);

    // 验证迁移后的配置
    const validation = validatePermissionConfig(config);

    if (migrationResult.success && validation.valid) {
      // 保存迁移后的配置
      await db.saveAdminConfig(config);
      
      // 清除缓存
      setCachedConfig(config);

      console.log(`[权限迁移] 权限迁移完成: ${migrationResult.message}`);

      return NextResponse.json({
        success: true,
        message: '权限迁移成功',
        migration: migrationResult,
        validation,
      });
    } else {
      // 迁移失败或验证不通过
      console.error(`[权限迁移] 权限迁移失败:`, {
        migration: migrationResult,
        validation,
      });

      return NextResponse.json({
        success: false,
        message: '权限迁移失败',
        migration: migrationResult,
        validation,
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[权限迁移] 迁移过程中出错:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `迁移过程中出错: ${error}` 
      },
      { status: 500 }
    );
  }
  }
);

// 获取权限迁移状态
export const GET = AuthGuard.owner(
  async (request: NextRequest, { user }: { user: any }) => {
    try {

    const config = await getConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: '无法获取配置' },
        { status: 500 }
      );
    }

    // 验证当前配置
    const validation = validatePermissionConfig(config);

    // 检查是否需要迁移
    const needsMigration = Array.isArray(config.UserConfig.Tags) && config.UserConfig.Tags.some(tag => 
      !tag.features || 
      (tag.enabledApis && (
        tag.enabledApis.includes('ai-recommend') || 
        tag.enabledApis.includes('disable-yellow-filter')
      ))
    ) || config.UserConfig.Users?.some(user =>
      !user.features ||
      (user.enabledApis && (
        user.enabledApis.includes('ai-recommend') || 
        user.enabledApis.includes('disable-yellow-filter')
      ))
    );

    return NextResponse.json({
      needsMigration,
      validation,
      configSummary: {
        tagsCount: Array.isArray(config.UserConfig.Tags) ? config.UserConfig.Tags.length : 0,
        usersCount: config.UserConfig.Users?.length || 0,
        tagsWithFeatures: Array.isArray(config.UserConfig.Tags) ? config.UserConfig.Tags.filter(tag => tag.features).length : 0,
        usersWithFeatures: config.UserConfig.Users?.filter(user => user.features).length || 0,
      }
    });

  } catch (error) {
    console.error('[权限迁移] 获取状态时出错:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `获取状态时出错: ${error}` 
      },
      { status: 500 }
    );
  }
  }
);