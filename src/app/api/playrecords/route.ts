/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';
import type { PlayRecord } from '@/lib/types';

export const runtime = 'nodejs';

// GET 方法：获取播放记录
export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const key = searchParams.get('key');

      if (key) {
        // 获取单条播放记录
        // key 格式通常是 source+id，需要解析
        const source = key.substring(0, key.indexOf('_'));
        const id = key.substring(key.indexOf('_') + 1);
        const record = await db.getPlayRecord(user.username, source, id);
        return NextResponse.json(record || null);
      } else {
        // 获取所有播放记录
        const records = await db.getAllPlayRecords(user.username);
        return NextResponse.json(records);
      }
    } catch (error) {
      console.error('获取播放记录失败:', error);
      return NextResponse.json({ error: '获取播放记录失败' }, { status: 500 });
    }
  },
);

// POST 方法：保存播放记录
export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const requestData = await request.json();

      // 客户端发送的格式可能是 { key, record } 或直接的 record
      let record: PlayRecord;

      if (requestData.record && requestData.key) {
        record = requestData.record;
      } else {
        record = requestData;
      }

      // 验证必要字段
      if (!record || !record.source || !record.id) {
        return NextResponse.json(
          {
            error: '播放记录缺少必要字段',
          },
          { status: 400 },
        );
      }

      // 保存播放记录
      await db.savePlayRecord(user.username, record.source, record.id, record);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('保存播放记录失败:', error);
      return NextResponse.json({ error: '保存播放记录失败' }, { status: 500 });
    }
  },
);

// DELETE 方法：删除播放记录
export const DELETE = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const key = searchParams.get('key');

      if (key) {
        // 删除单条播放记录
        const [source, id] = key.split('+');
        if (!source || !id) {
          return NextResponse.json(
            { error: 'Invalid key format' },
            { status: 400 },
          );
        }
        await db.deletePlayRecord(user.username, source, id);
      } else {
        // 清空所有播放记录
        const records = await db.getAllPlayRecords(user.username);
        await Promise.all(
          Object.keys(records).map(async (key) => {
            const [source, id] = key.split('+');
            if (source && id) {
              await db.deletePlayRecord(user.username, source, id);
            }
          }),
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除播放记录失败:', error);
      return NextResponse.json({ error: '删除播放记录失败' }, { status: 500 });
    }
  },
);
