/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { refreshLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  try {
    // 权限检查
    // 使用AuthGuard自动处理认证
    const username = user?.username;
    const config = await getConfig();

    // 并发刷新所有启用的直播源
    const refreshPromises = (config.LiveConfig || [])
      .filter((liveInfo) => !liveInfo.disabled)
      .map(async (liveInfo) => {
        try {
          const nums = await refreshLiveChannels(liveInfo);
          liveInfo.channelNumber = nums;
        } catch {
          liveInfo.channelNumber = 0;
        }
      });

    // 等待所有刷新任务完成
    await Promise.all(refreshPromises);

    // 保存配置
    await db.saveAdminConfig(config);

    return NextResponse.json({
      success: true,
      message: '直播源刷新成功',
    });
  } catch (error) {
    console.error('直播源刷新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刷新失败' },
      { status: 500 },
    );
  }
}

export const POST = AuthGuard.admin(POSTHandler);
