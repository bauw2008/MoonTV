import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 获取用户头像
export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const requestedUser = searchParams.get('user');

      // 如果是管理员或站长，且提供了user参数，则获取指定用户的头像
      if ((user.role === 'admin' || user.role === 'owner') && requestedUser) {
        const avatarData = await db.getUserAvatar(requestedUser);
        return NextResponse.json({ avatar: avatarData });
      }

      // 默认返回当前用户的头像
      const username = user.username;
      const avatarData = await db.getUserAvatar(username);
      return NextResponse.json({ avatar: avatarData });
    } catch (error) {
      console.error('获取头像失败:', error);
      return NextResponse.json({ error: '获取头像失败' }, { status: 500 });
    }
  },
);

// 上传用户头像
export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const username = user.username;
      const formData = await request.formData();
      const file = formData.get('avatar') as File;

      if (!file) {
        return NextResponse.json(
          { error: '没有提供头像文件' },
          { status: 400 },
        );
      }

      // 保存头像
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      await db.setUserAvatar(username, base64);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('上传头像失败:', error);
      return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
    }
  },
);

// 删除用户头像
export const DELETE = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const username = user.username;
      await db.setUserAvatar(username, '');
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除头像失败:', error);
      return NextResponse.json({ error: '删除头像失败' }, { status: 500 });
    }
  },
);
