import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET 请求：获取短剧API配置
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 检查权限：只有管理员或站长可以查看短剧API配置
  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const config = await getConfig();
    const defaultShortDramaConfig = {
      primaryApiUrl: 'https://api.wwzy.tv/api.php/provide/vod',
      alternativeApiUrl: '',
      enableAlternative: false,
    };

    // 合并默认配置和实际配置
    const shortDramaConfig = {
      ...defaultShortDramaConfig,
      ...(config.ShortDramaConfig || {}),
    };

    return NextResponse.json(shortDramaConfig);
  } catch (error) {
    logger.error('获取短剧API配置失败:', error);
    return NextResponse.json({ error: '获取短剧API配置失败' }, { status: 500 });
  }
}

// POST 请求：保存短剧API配置
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 检查权限：只有管理员或站长可以修改短剧API配置
  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const shortDramaSettings = await request.json();

    // 获取完整配置
    const config = await getConfig();

    // 更新或创建 ShortDramaConfig
    config.ShortDramaConfig = {
      primaryApiUrl:
        shortDramaSettings.primaryApiUrl ||
        'https://api.wwzy.tv/api.php/provide/vod',
      alternativeApiUrl: shortDramaSettings.alternativeApiUrl || '',
      enableAlternative: shortDramaSettings.enableAlternative ?? false,
    };

    // 保存完整配置
    await db.saveAdminConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存短剧API配置失败:', error);
    return NextResponse.json({ error: '保存短剧API配置失败' }, { status: 500 });
  }
}
