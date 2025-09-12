import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// 获取用户头像
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUser = searchParams.get('user') || authInfo.username;

    // 只允许获取自己的头像，管理员和站长可以获取任何用户的头像
    const canAccess = targetUser === authInfo.username ||
      authInfo.role === 'admin' ||
      authInfo.role === 'owner';

    if (!canAccess) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const avatar = await db.getUserAvatar(targetUser);

    if (!avatar) {
      return NextResponse.json({ avatar: null });
    }

    return NextResponse.json({ avatar });
  } catch (error) {
    console.error('获取头像失败:', error);
    return NextResponse.json({ error: '获取头像失败' }, { status: 500 });
  }
}

// 上传用户头像
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { avatar, targetUser } = body;

    if (!avatar) {
      return NextResponse.json({ error: '头像数据不能为空' }, { status: 400 });
    }

    // 验证Base64格式
    if (!avatar.startsWith('data:image/')) {
      return NextResponse.json({ error: '无效的图片格式' }, { status: 400 });
    }

    // 检查文件大小（Base64编码后大约增加33%，2MB的限制）
    const base64Data = avatar.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > 2 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过2MB' }, { status: 400 });
    }

    const userToUpdate = targetUser || authInfo.username;

    // 只允许更新自己的头像，管理员和站长可以更新任何用户的头像
    const canUpdate = userToUpdate === authInfo.username ||
      authInfo.role === 'admin' ||
      authInfo.role === 'owner';

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await db.setUserAvatar(userToUpdate, avatar);

    return NextResponse.json({ success: true, message: '头像上传成功' });
  } catch (error) {
    console.error('上传头像失败:', error);
    return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
  }
}

// 删除用户头像
export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUser = searchParams.get('user') || authInfo.username;

    // 只允许删除自己的头像，管理员和站长可以删除任何用户的头像
    const canDelete = targetUser === authInfo.username ||
      authInfo.role === 'admin' ||
      authInfo.role === 'owner';

    if (!canDelete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await db.deleteUserAvatar(targetUser);

    return NextResponse.json({ success: true, message: '头像删除成功' });
  } catch (error) {
    console.error('删除头像失败:', error);
    return NextResponse.json({ error: '删除头像失败' }, { status: 500 });
  }
}
