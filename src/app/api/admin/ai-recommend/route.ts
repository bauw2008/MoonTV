import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';
import { AuthGuard } from '@/lib/auth/guards';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 },
    );
  }

  // AuthGuard已处理权限检查
  const authManager = AuthManager.getInstance();
  const authResult = await authManager.authenticate(request);
  const username = authResult.user?.username;

  try {
    const aiRecommendConfig = await request.json();

    // 验证配置数据
    if (typeof aiRecommendConfig.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid enabled value' },
        { status: 400 },
      );
    }

    if (aiRecommendConfig.enabled) {
      if (!aiRecommendConfig.apiUrl || !aiRecommendConfig.apiKey) {
        return NextResponse.json(
          { error: 'API地址和密钥不能为空' },
          { status: 400 },
        );
      }
    }

    // 获取当前配置并更新AI推荐部分
    const currentConfig = await getConfig();
    currentConfig.AIRecommendConfig = aiRecommendConfig;

    // 保存完整配置
    await db.saveAdminConfig(currentConfig);
    clearConfigCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存AI推荐配置失败:', error);
    return NextResponse.json(
      {
        error: '保存配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

async function GETHandler(request: NextRequest) {
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
    const config = await getConfig();
    return NextResponse.json({
      enabled: config.AIRecommendConfig?.enabled || false,
      apiUrl: config.AIRecommendConfig?.apiUrl || '',
      apiKey: config.AIRecommendConfig?.apiKey || '',
    });
  } catch (error) {
    console.error('获取AI推荐配置失败:', error);
    return NextResponse.json(
      {
        error: '获取配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const POST = AuthGuard.admin(POSTHandler);
export const GET = AuthGuard.admin(GETHandler);
