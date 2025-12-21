import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

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

  const authInfo = getAuthInfoFromCookie(request);

  // 检查用户权限
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const username = authInfo.username;

  try {
    const tvboxSecurityConfig = await request.json();

    // 验证配置数据
    if (typeof tvboxSecurityConfig.enableAuth !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid enableAuth value' },
        { status: 400 },
      );
    }

    if (typeof tvboxSecurityConfig.enableIpWhitelist !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid enableIpWhitelist value' },
        { status: 400 },
      );
    }

    if (typeof tvboxSecurityConfig.enableRateLimit !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid enableRateLimit value' },
        { status: 400 },
      );
    }

    // 验证Token - 如果启用了设备绑定，检查用户Token
    if (tvboxSecurityConfig.enableDeviceBinding) {
      if (
        !tvboxSecurityConfig.userTokens ||
        !Array.isArray(tvboxSecurityConfig.userTokens) ||
        tvboxSecurityConfig.userTokens.length === 0
      ) {
        return NextResponse.json(
          { error: '启用设备绑定需要配置用户Token' },
          { status: 400 },
        );
      }

      // 检查至少有一个启用的用户Token
      const enabledTokens = tvboxSecurityConfig.userTokens.filter(
        (t: any) => t.enabled,
      );
      if (enabledTokens.length === 0) {
        return NextResponse.json(
          { error: '至少需要一个启用的用户Token' },
          { status: 400 },
        );
      }

      // 验证每个启用的Token
      for (const token of enabledTokens) {
        if (
          !token.token ||
          typeof token.token !== 'string' ||
          token.token.length < 8
        ) {
          return NextResponse.json(
            { error: `用户 ${token.username} 的Token长度至少8位` },
            { status: 400 },
          );
        }
      }
    }

    // 验证设备绑定配置
    if (tvboxSecurityConfig.enableDeviceBinding) {
      if (
        !tvboxSecurityConfig.maxDevices ||
        tvboxSecurityConfig.maxDevices < 1
      ) {
        return NextResponse.json(
          { error: '最大设备数量必须大于0' },
          { status: 400 },
        );
      }

      // 验证用户Token配置
      if (
        tvboxSecurityConfig.userTokens &&
        !Array.isArray(tvboxSecurityConfig.userTokens)
      ) {
        return NextResponse.json(
          { error: '用户Token配置必须是数组' },
          { status: 400 },
        );
      }
    }

    // 验证IP白名单
    if (tvboxSecurityConfig.enableIpWhitelist) {
      if (!Array.isArray(tvboxSecurityConfig.allowedIPs)) {
        return NextResponse.json(
          { error: 'allowedIPs必须是数组' },
          { status: 400 },
        );
      }

      // 验证每个IP格式
      for (const ip of tvboxSecurityConfig.allowedIPs) {
        if (typeof ip !== 'string' || !isValidIPOrCIDR(ip.trim())) {
          return NextResponse.json(
            { error: `无效的IP地址格式: ${ip}` },
            { status: 400 },
          );
        }
      }
    }

    // 验证频率限制
    if (tvboxSecurityConfig.enableRateLimit) {
      const rateLimit = tvboxSecurityConfig.rateLimit;
      if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 1000) {
        return NextResponse.json(
          { error: '频率限制应在1-1000之间' },
          { status: 400 },
        );
      }
    }

    // 获取当前配置
    const adminConfig = await getConfig();

    // 权限校验
    if (username !== process.env.USERNAME) {
      // 管理员
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 更新TVBox安全配置
    adminConfig.TVBoxSecurityConfig = {
      // 为了向后兼容，当启用设备绑定时也启用Token验证
      enableAuth:
        tvboxSecurityConfig.enableDeviceBinding ||
        tvboxSecurityConfig.enableAuth,
      token: tvboxSecurityConfig.token?.trim() || '',
      enableIpWhitelist: tvboxSecurityConfig.enableIpWhitelist,
      allowedIPs: tvboxSecurityConfig.allowedIPs || [],
      enableRateLimit: tvboxSecurityConfig.enableRateLimit,
      rateLimit: tvboxSecurityConfig.rateLimit || 60,
      // 设备绑定相关配置
      enableDeviceBinding: tvboxSecurityConfig.enableDeviceBinding || false,
      maxDevices: tvboxSecurityConfig.maxDevices || 1,
      currentDevices: tvboxSecurityConfig.currentDevices || [],
      userTokens: tvboxSecurityConfig.userTokens || [],
    };

    // 保存配置到数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 不缓存结果
        },
      },
    );
  } catch (error) {
    console.error('Save TVBox security config error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

// 验证IP地址或CIDR格式的辅助函数
function isValidIPOrCIDR(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // 允许通配符
  if (ip.trim() === '*') return true;

  // 基本的IP地址正则表达式
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

  if (!ipRegex.test(ip)) return false;

  const [ipPart, maskPart] = ip.split('/');
  const parts = ipPart.split('.');

  // 验证IP地址的每个部分是否在0-255范围内
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return false;
    }
  }

  // 验证子网掩码位数
  if (maskPart) {
    const mask = parseInt(maskPart, 10);
    if (isNaN(mask) || mask < 0 || mask > 32) {
      return false;
    }
  }

  return true;
}
