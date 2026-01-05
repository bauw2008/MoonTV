import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // 测试设置一个TVBox缓存
    const testKey = 'tvbox:test:videos:source:filter:cat-1:pg-1';
    const testData = {
      list: [
        { id: '1', title: '测试视频1', source_name: '测试源' },
        { id: '2', title: '测试视频2', source_name: '测试源' }
      ],
      pagecount: 1,
      timestamp: Date.now()
    };

    // 设置测试缓存
    await db.setCache(testKey, testData, 60 * 60); // 1小时

    // 立即读取测试
    const cached = await db.getCache(testKey);
    
    // 获取所有TVBox相关的键
    const allKeys = await (db as any).client?.keys('tvbox:*') || [];
    
    return NextResponse.json({
      success: true,
      testSet: !!cached,
      testData: cached,
      allTVBoxKeys: allKeys,
      totalKeys: allKeys.length
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}