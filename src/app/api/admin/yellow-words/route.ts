/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { clearYellowWordsCache } from '@/lib/yellow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yellowWords } = body as {
      yellowWords?: string[];
    };

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    // 参数校验
    if (
      !Array.isArray(yellowWords) ||
      !yellowWords.every((word) => typeof word === 'string')
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const adminConfig = await getConfig();

    // 权限校验
    if (username !== process.env.USERNAME) {
      // 管理员
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (user?.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 只更新数据库配置
    adminConfig.YellowWords = yellowWords;
    try {
      await db.saveAdminConfig(adminConfig);
      console.log('18+词汇配置已保存到数据库');
    } catch (error) {
      console.error('保存18+词汇配置到数据库失败:', error);
      return NextResponse.json(
        { error: '保存配置到数据库失败' },
        { status: 500 },
      );
    }
    clearConfigCache(); // 清除配置缓存
    clearYellowWordsCache(); // 清除18+词汇缓存

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 不缓存结果
        },
      },
    );
  } catch (error) {
    console.error('更新过滤词配置失败:', error);
    return NextResponse.json(
      {
        error: '更新过滤词配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
