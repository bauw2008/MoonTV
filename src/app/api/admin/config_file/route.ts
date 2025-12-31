/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig, refineConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
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

  try {
    // 检查用户权限
    let adminConfig = await getConfig();

    // 仅站长可以修改配置管理

    // 额外验证：确保是环境变量定义的站长用户

    // 获取请求体
    const body = await request.json();
    const { configFile, subscriptionUrl, autoUpdate, lastCheckTime } = body;

    if (!configFile || typeof configFile !== 'string') {
      return NextResponse.json(
        { error: '配置管理内容不能为空' },
        { status: 400 },
      );
    }

    // 验证 JSON 格式
    try {
      JSON.parse(configFile);
    } catch {
      return NextResponse.json(
        { error: '配置管理格式错误，请检查 JSON 语法' },
        { status: 400 },
      );
    }

    adminConfig.ConfigFile = configFile;
    if (!adminConfig.ConfigSubscribtion) {
      adminConfig.ConfigSubscribtion = {
        URL: '',
        AutoUpdate: false,
        LastCheck: '',
      };
    }

    // 更新订阅配置
    if (subscriptionUrl !== undefined) {
      adminConfig.ConfigSubscribtion.URL = subscriptionUrl;
    }
    if (autoUpdate !== undefined) {
      adminConfig.ConfigSubscribtion.AutoUpdate = autoUpdate;
    }
    adminConfig.ConfigSubscribtion.LastCheck = lastCheckTime || '';

    adminConfig = refineConfig(adminConfig);
    // 更新配置文件
    await db.saveAdminConfig(adminConfig);
    return NextResponse.json({
      success: true,
      message: '配置管理更新成功',
    });
  } catch (error) {
    console.error('更新配置管理失败:', error);
    return NextResponse.json(
      {
        error: '更新配置管理失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const POST = AuthGuard.owner(POSTHandler);
