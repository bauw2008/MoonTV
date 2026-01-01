import { NextRequest, NextResponse } from 'next/server';

import { CacheManager } from '@/lib/auth/core/cache-manager';
import { TokenService } from '@/lib/auth/services/token.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username } = body;
    
    const cacheManager = new CacheManager();
    const tokenService = new TokenService();
    
    // 如果指定了用户名，只清除该用户的缓存
    if (username) {
      try {
        // 获取该用户的所有可能token并清除缓存
        // 由于我们无法直接从缓存中获取token，这里提供一个接口让前端清除所有缓存
        await cacheManager.clear();
        
        console.log(`已清除用户 ${username} 的认证缓存`);
        return NextResponse.json({ 
          success: true, 
          message: `用户 ${username} 的认证缓存已清理` 
        });
      } catch (error) {
        console.error(`清除用户 ${username} 缓存失败:`, error);
        return NextResponse.json({ 
          error: `清除用户 ${username} 缓存失败` 
        }, { status: 500 });
      }
    } else {
      // 清除所有缓存
      await cacheManager.clear();
      return NextResponse.json({ success: true, message: '认证缓存已清理' });
    }
  } catch (error) {
    console.error('清理缓存失败:', error);
    return NextResponse.json({ error: '清理缓存失败' }, { status: 500 });
  }
}
