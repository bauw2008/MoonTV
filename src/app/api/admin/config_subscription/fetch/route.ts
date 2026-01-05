/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  try {
    // 权限检查：仅站长可以拉取配置订阅
    // AuthGuard已经处理了基础认证，这里检查站长权限

    // 额外验证：确保是环境变量定义的站长用户

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 });
    }

    // 直接 fetch URL 获取配置内容
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `请求失败: ${response.status} ${response.statusText}` },
        { status: response.status },
      );
    }

    const configContent = await response.text();

    // 对 configContent 进行 base58 解码
    let decodedContent;
    try {
      const bs58 = (await import('bs58')).default;
      const decodedBytes = bs58.decode(configContent);
      decodedContent = new TextDecoder().decode(decodedBytes);
    } catch (decodeError) {
      console.warn('Base58 解码失败', decodeError);
      throw decodeError;
    }

    return NextResponse.json({
      success: true,
      configContent: decodedContent,
      message: '配置拉取成功',
    });
  } catch (error) {
    console.error('拉取配置失败:', error);
    return NextResponse.json({ error: '拉取配置失败' }, { status: 500 });
  }
}

export const POST = AuthGuard.owner(POSTHandler);
