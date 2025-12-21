import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 强制动态渲染

// 普通用户也可以访问的 TVBox 配置接口
// 只返回 TVBox 安全配置，不返回完整的管理配置
export async function GET(request: NextRequest) {
  try {
    // 检查用户是否登录
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取配置
    const config = await getConfig();
    const securityConfig = config.TVBoxSecurityConfig || {
      enableAuth: false,
      token: '',
      enableIpWhitelist: false,
      allowedIPs: [],
      enableRateLimit: false,
      rateLimit: 60,
      enableDeviceBinding: false,
      maxDevices: 1,
      currentDevices: [],
      userTokens: [],
    };

    // 构建用户特定的安全配置
    const userSecurityConfig = {
      enableAuth: securityConfig.enableAuth,
      token: '', // 初始化为空，下面会根据用户设置
      enableIpWhitelist: securityConfig.enableIpWhitelist,
      allowedIPs: securityConfig.allowedIPs || [],
      enableRateLimit: securityConfig.enableRateLimit,
      rateLimit: securityConfig.rateLimit || 60,
      enableDeviceBinding: securityConfig.enableDeviceBinding || false,
      maxDevices: securityConfig.maxDevices || 1,
      userTokens: securityConfig.userTokens || [], // 添加userTokens数据
    };

    // 如果启用了设备绑定，返回当前用户的Token
    if (
      securityConfig.enableDeviceBinding &&
      securityConfig.userTokens &&
      Array.isArray(securityConfig.userTokens)
    ) {
      const userTokenInfo = securityConfig.userTokens.find(
        (t) => t.username === authInfo.username,
      );
      console.log('[TVBoxConfig] 查找用户Token:', {
        username: authInfo.username,
        userTokens: securityConfig.userTokens.map((t) => ({
          username: t.username,
          enabled: t.enabled,
        })),
        foundUser: userTokenInfo ? userTokenInfo.username : '未找到',
        tokenEnabled: userTokenInfo?.enabled,
        hasToken: !!userTokenInfo?.token,
      });
      if (userTokenInfo && userTokenInfo.enabled && userTokenInfo.token) {
        userSecurityConfig.token = userTokenInfo.token;
        // 为了向后兼容，同时设置enableAuth为true
        userSecurityConfig.enableAuth = true;
      } else {
        // 如果用户没有对应的Token，返回空（禁止访问）
        userSecurityConfig.token = '';
        userSecurityConfig.enableAuth = false;
      }
    } else {
      // 未启用设备绑定，不使用Token验证
      userSecurityConfig.token = '';
      userSecurityConfig.enableAuth = false;
    }

    // 只返回用户特定的 TVBox 安全配置和站点名称
    return NextResponse.json({
      securityConfig: userSecurityConfig,
      siteName: config.SiteConfig?.SiteName || 'Vidora',
    });
  } catch (error) {
    console.error('获取 TVBox 配置失败:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
