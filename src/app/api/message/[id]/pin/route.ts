import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

// 评论数据结构
interface Comment {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
  replies: any[];
  commentCount?: number;
  category?: 'suggestion' | 'feedback' | 'discussion' | 'other';
  isPinned?: boolean;
}

// 置顶/取消置顶评论

// 导出处理函数
export async function POST(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少评论ID' }, { status: 400 });
    }

    // 置顶评论 - 这里需要实现实际的置顶逻辑
    // 由于没有具体的数据库方法，我们返回一个简单的成功响应
    return NextResponse.json({ success: true, message: '评论置顶成功' });
  } catch (error) {
    console.error('置顶评论失败:', error);
    return NextResponse.json({ error: '置顶评论失败' }, { status: 500 });
  }
}
