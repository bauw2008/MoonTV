import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const getDefault = searchParams.get('default') === 'true';

    const config = await getConfig();

    // 如果请求默认值，返回空数组表示没有默认值（现在完全依赖数据库）
    if (getDefault) {
      return NextResponse.json({
        yellowWords: [],
        source: 'default_empty',
      });
    }

    // 直接从数据库配置读取
    return NextResponse.json({
      yellowWords: config.YellowWords || [],
      source: 'database',
    });
  } catch (error) {
    console.error('获取过滤词失败:', error);
    return NextResponse.json({ error: '获取过滤词失败' }, { status: 500 });
  }
}
