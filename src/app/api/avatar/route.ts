import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 获取用户头像
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUser = searchParams.get('user');

    // 如果是管理员或站长，且提供了user参数，则获取指定用户的头像
    if (
      (authInfo.role === 'admin' || authInfo.role === 'owner') &&
      requestedUser
    ) {
      const avatarData = await db.getUserAvatar(requestedUser);
      return NextResponse.json({ avatar: avatarData });
    }

    // 默认返回当前用户的头像
    const username = authInfo.username;
    const avatarData = await db.getUserAvatar(username);
    return NextResponse.json({ avatar: avatarData });
  } catch (error) {
    console.error('获取头像失败:', error);
    return NextResponse.json({ error: '获取头像失败' }, { status: 500 });
  }
}

// 上传用户头像
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const username = authInfo.username;
    const body = await request.json();
    const { avatar, targetUser } = body;

    // 如果是管理员或站长，且提供了targetUser参数，则为指定用户设置头像
    const targetUsername =
      (authInfo.role === 'admin' || authInfo.role === 'owner') && targetUser
        ? targetUser
        : username;

    if (!avatar) {
      return NextResponse.json({ error: '没有提供头像数据' }, { status: 400 });
    }

    // 处理base64数据
    let base64Data = avatar;
    if (avatar.startsWith('data:')) {
      // 移除data:image/jpeg;base64,前缀
      base64Data = avatar.split(',')[1];
    }

    // 保存头像
    await db.setUserAvatar(targetUsername, base64Data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('上传头像失败:', error);
    return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
  }
}

// 删除用户头像
export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const username = authInfo.username;
    await db.setUserAvatar(username, '');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除头像失败:', error);
    return NextResponse.json({ error: '删除头像失败' }, { status: 500 });
  }
}
