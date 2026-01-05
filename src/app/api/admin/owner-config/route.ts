import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { getAuthInfoFromCookie } from '@/lib/auth';

// 获取站长配置
export const GET = async (request: NextRequest) => {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || authInfo.role !== 'owner') {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  try {
    // 从配置文件读取站长配置
    const configPath = path.join(process.cwd(), 'data', 'default-config.json');
    let config = {
      siteMaintenance: false,
      debugMode: false,
      maxUsers: 1000,
    };

    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        config = {
          siteMaintenance: fileConfig.SiteMaintenance || false,
          debugMode: fileConfig.DebugMode || false,
          maxUsers: fileConfig.MaxUsers || 1000,
        };
      }
    } catch (fileError) {
      console.error('读取配置文件失败:', fileError);
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('获取站长配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
};

// 保存站长配置
export const POST = async (request: NextRequest) => {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || authInfo.role !== 'owner') {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }

  try {
    const config = await request.json();

    // 验证配置数据
    const { siteMaintenance, debugMode, maxUsers } = config;

    if (typeof maxUsers !== 'number' || maxUsers < 1 || maxUsers > 10000) {
      return NextResponse.json(
        { error: '最大用户数必须在1-10000之间' },
        { status: 400 },
      );
    }

    // 读取现有配置文件
    const configPath = path.join(process.cwd(), 'data', 'default-config.json');
    let existingConfig = {};

    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        existingConfig = JSON.parse(fileContent);
      }
    } catch (fileError) {
      console.error('读取现有配置失败:', fileError);
    }

    // 更新站长配置
    const updatedConfig = {
      ...existingConfig,
      SiteMaintenance: siteMaintenance,
      DebugMode: debugMode,
      MaxUsers: maxUsers,
    };

    // 保存到配置文件
    try {
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      console.log('站长配置已更新:', {
        siteMaintenance,
        debugMode,
        maxUsers,
        updatedBy: 'owner',
        timestamp: new Date().toISOString(),
      });
    } catch (saveError) {
      console.error('保存配置文件失败:', saveError);
      throw new Error('保存配置文件失败');
    }

    return NextResponse.json({
      success: true,
      message: '站长配置保存成功',
    });
  } catch (error) {
    console.error('保存站长配置失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
};
