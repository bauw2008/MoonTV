import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { resetConfig } from '@/lib/config';

export const runtime = 'nodejs';

async function GETHandler(request: NextRequest, { user }: { user: any }) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 },
    );
  }

  // 检查是否为站长权限

  // 额外验证：确保是环境变量定义的站长用户

  try {
    await resetConfig();

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 管理员配置不缓存
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: '重置管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const GET = AuthGuard.owner(GETHandler);
