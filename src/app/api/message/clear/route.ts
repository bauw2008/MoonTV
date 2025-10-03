import { NextRequest } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

// 清空所有评论（仅管理员和站长）
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo?.username) {
      return new Response(JSON.stringify({ success: false, error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查权限（仅站长和管理员可以清空）
    if (authInfo.role !== 'owner' && authInfo.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: '权限不足' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 清空所有评论
    await db.setCache('message_board_comments', [], 7 * 24 * 60 * 60);

    return new Response(
      JSON.stringify({ success: true, message: '清空成功' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('清空评论失败:', error);
    return new Response(
      JSON.stringify({ success: false, error: '清空评论失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
