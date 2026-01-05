/**
 * 修改密码API - 使用新的认证框架
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export const POST = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { oldPassword, newPassword } = await request.json();

      // 基础验证
      if (!oldPassword || !newPassword) {
        return NextResponse.json(
          { error: '旧密码和新密码不能为空' },
          { status: 400 },
        );
      }

      if (newPassword.length < 3) {
        return NextResponse.json(
          { error: '新密码至少3个字符' },
          { status: 400 },
        );
      }

      // 验证旧密码
      const isValidOldPassword = await db.verifyUser(
        user.username,
        oldPassword,
      );

      if (!isValidOldPassword) {
        return NextResponse.json({ error: '旧密码不正确' }, { status: 401 });
      }

      // 更新密码
      await db.changePassword(user.username, newPassword);

      return NextResponse.json({
        success: true,
        message: '密码修改成功',
      });
    } catch (error) {
      console.error('修改密码失败:', error);
      return NextResponse.json(
        {
          error: '修改密码失败，请稍后重试',
        },
        { status: 500 },
      );
    }
  },
);
