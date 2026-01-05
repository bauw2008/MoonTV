import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enableActorSearch } = body;

    // 获取当前配置
    const currentConfig = await getConfig();
    console.log(
      '测试：当前配置',
      currentConfig.SiteConfig.EnableTMDBActorSearch,
    );

    // 更新配置
    const updatedConfig = {
      ...currentConfig,
      SiteConfig: {
        ...currentConfig.SiteConfig,
        EnableTMDBActorSearch: enableActorSearch,
      },
    };

    // 保存到数据库
    await db.saveAdminConfig(updatedConfig);
    console.log('测试：已保存到数据库', enableActorSearch);

    // 清除缓存
    clearConfigCache();
    console.log('测试：缓存已清除');

    // 验证保存
    const verifyConfig = await getConfig();
    console.log(
      '测试：验证结果',
      verifyConfig.SiteConfig.EnableTMDBActorSearch,
    );

    return NextResponse.json({
      success: true,
      before: currentConfig.SiteConfig.EnableTMDBActorSearch,
      after: verifyConfig.SiteConfig.EnableTMDBActorSearch,
      requested: enableActorSearch,
    });
  } catch (error) {
    console.error('测试失败:', error);
    return NextResponse.json(
      { error: '测试失败', details: (error as Error).message },
      { status: 500 },
    );
  }
}
