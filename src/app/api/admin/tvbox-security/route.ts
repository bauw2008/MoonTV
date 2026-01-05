import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 验证配置数据的辅助函数
function validateConfig(config: any) {
  const errors: string[] = [];

  // 基础字段验证
  if (typeof config.enableRateLimit !== 'boolean') {
    errors.push('enableRateLimit 必须是布尔值');
  }
  
  if (config.enableRateLimit && (!Number.isInteger(config.rateLimit) || config.rateLimit < 1 || config.rateLimit > 1000)) {
    errors.push('频率限制应在1-1000之间');
  }

  if (typeof config.enableDeviceBinding !== 'boolean') {
    errors.push('enableDeviceBinding 必须是布尔值');
  }

  if (typeof config.enableUserAgentWhitelist !== 'boolean') {
    errors.push('enableUserAgentWhitelist 必须是布尔值');
  }

  // 设备绑定验证
  if (config.enableDeviceBinding) {
    if (!config.maxDevices || config.maxDevices < 1) {
      errors.push('最大设备数量必须大于0');
    }

    if (!Array.isArray(config.userTokens)) {
      errors.push('用户Token配置必须是数组');
    } else {
      const enabledTokens = config.userTokens.filter((t: any) => t.enabled);
      if (enabledTokens.length === 0) {
        errors.push('至少需要一个启用的用户Token');
      }

      // 验证每个Token
      for (const token of enabledTokens) {
        if (!token.token || typeof token.token !== 'string' || token.token.length < 8) {
          errors.push(`用户 ${token.username} 的Token长度至少8位`);
        }
      }
    }
  }

  // User-Agent白名单验证
  if (config.enableUserAgentWhitelist) {
    if (!Array.isArray(config.allowedUserAgents)) {
      errors.push('allowedUserAgents必须是数组');
    } else {
      for (const ua of config.allowedUserAgents) {
        if (typeof ua !== 'string' || ua.trim().length === 0) {
          errors.push(`无效的User-Agent格式: ${ua}`);
        }
      }
    }
  }

  return errors;
}

// 清理userTokens数据的辅助函数
function cleanUserTokens(userTokens: any[] = []) {
  return userTokens.map(token => ({
    username: token.username,
    token: token.token,
    enabled: token.enabled,
    devices: token.devices || []
  }));
}

export async function POST(request: NextRequest) {
  // 检查存储类型
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 }
    );
  }

  // 验证用户权限
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const username = authInfo.username;

  try {
    // 获取请求数据
    const tvboxSecurityConfig = await request.json();

    // 验证配置数据
    const validationErrors = validateConfig(tvboxSecurityConfig);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0] },
        { status: 400 }
      );
    }

    // 获取当前配置
    const adminConfig = await getConfig();

    // 权限校验 - 只有站长或管理员可以修改
    if (username !== process.env.USERNAME) {
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 清理userTokens数据
    const cleanedUserTokens = cleanUserTokens(tvboxSecurityConfig.userTokens);

    // 更新TVBox安全配置
    adminConfig.TVBoxSecurityConfig = {
      enableAuth: tvboxSecurityConfig.enableDeviceBinding || tvboxSecurityConfig.enableAuth,
      token: tvboxSecurityConfig.token?.trim() || '',
      enableRateLimit: tvboxSecurityConfig.enableRateLimit,
      rateLimit: tvboxSecurityConfig.rateLimit || 30,
      enableDeviceBinding: tvboxSecurityConfig.enableDeviceBinding || false,
      maxDevices: tvboxSecurityConfig.maxDevices || 1,
      enableUserAgentWhitelist: tvboxSecurityConfig.enableUserAgentWhitelist || false,
      allowedUserAgents: tvboxSecurityConfig.allowedUserAgents || [],
      currentDevices: cleanedUserTokens.flatMap(user => user.devices),
      userTokens: cleanedUserTokens,
      defaultUserGroup: tvboxSecurityConfig.defaultUserGroup,
    };

    // 保存配置到数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存
    clearConfigCache();

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Save TVBox security config error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}