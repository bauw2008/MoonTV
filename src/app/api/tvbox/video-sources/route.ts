import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

// 根据用户权限过滤源站
function filterSourcesByUserPermissions(
  sources: any[],
  user: { enabledApis?: string[]; tags?: string[] },
  tagsConfig: any[],
): any[] {
  // 如果用户有直接指定的enabledApis，优先使用
  if (user.enabledApis && user.enabledApis.length > 0) {
    return sources.filter(
      (source) => !source.disabled && user.enabledApis!.includes(source.key),
    );
  }

  // 如果用户有用户组标签，根据用户组权限过滤
  if (
    user.tags &&
    user.tags.length > 0 &&
    tagsConfig &&
    tagsConfig.length > 0
  ) {
    // 获取用户所有标签的权限并集
    const allowedApis = new Set<string>();

    user.tags.forEach((tagName) => {
      const tag = tagsConfig.find((t) => t.name === tagName);
      if (tag?.enabledApis) {
        tag.enabledApis.forEach((api: string) => allowedApis.add(api));
      }
    });

    // 如果用户组有权限限制，则过滤源站
    if (allowedApis.size > 0) {
      return sources.filter(
        (source) => !source.disabled && allowedApis.has(source.key),
      );
    }
  }

  // 如果没有权限限制，返回所有未禁用的源站
  return sources.filter((source) => !source.disabled);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取配置
    const config = await getConfig();

    // 获取用户信息
    const user = config.UserConfig.Users.find(
      (u) => u.username === authInfo.username,
    );

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 根据用户权限过滤源站
    const availableSites = filterSourcesByUserPermissions(
      config.SourceConfig || [],
      user,
      config.UserConfig.Tags || [],
    );

    // 如果没有可用源站，返回空结果
    if (availableSites.length === 0) {
      return NextResponse.json({
        fromCache: false,
        message: '没有可用的视频源，请联系管理员配置权限',
      });
    }

    const sources = availableSites.reduce(
      (acc, site) => {
        acc[site.key] = {
          api: site.api,
          name: site.name,
          detail: site.detail,
        };
        return acc;
      },
      {} as Record<string, { api: string; name: string; detail?: string }>,
    );

    return NextResponse.json({
      ...sources,
      fromCache: false,
    });
  } catch (error) {
    console.error('获取视频源失败:', error);
    return NextResponse.json({ error: '获取视频源失败' }, { status: 500 });
  }
}
