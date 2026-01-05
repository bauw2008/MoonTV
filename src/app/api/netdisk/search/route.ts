import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const { searchParams } = new URL(request.url);
      const keyword = searchParams.get('q') || searchParams.get('keyword');

      if (!keyword) {
        return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
      }

      // 获取配置
      const config = await getConfig();
      const pansouUrl =
        config.NetDiskConfig?.pansouUrl || 'https://so.252035.xyz';
      const timeout = config.NetDiskConfig?.timeout || 30;

      console.log('=== 网盘搜索调试 ===');
      console.log('搜索关键词:', keyword);
      console.log('PanSou服务地址:', pansouUrl);

      // 调用PanSou搜索API
      const searchUrl = `${pansouUrl}/api/search`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

      try {
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Vidora-NetDisk-Search/1.0',
          },
          body: JSON.stringify({
            q: keyword,
            page: 1,
            size: 50,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            'PanSou服务响应错误:',
            response.status,
            response.statusText,
          );
          return NextResponse.json(
            { error: '网盘搜索服务暂时不可用' },
            { status: 502 },
          );
        }

        const data = await response.json();
        console.log('PanSou搜索结果:', {
          success: data.success,
          total: data.data?.total || 0,
          types: Object.keys(data.data?.merged_by_type || {}),
        });

        // 返回符合前端期望的数据格式
        return NextResponse.json({
          success: true,
          data: {
            merged_by_type: data.data?.merged_by_type || {},
            total: data.data?.total || 0,
          },
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('网盘搜索请求超时');
          return NextResponse.json(
            { error: '网盘搜索请求超时，请稍后重试' },
            { status: 408 },
          );
        }

        console.error('网盘搜索请求失败:', fetchError);
        return NextResponse.json(
          { error: '网盘搜索服务连接失败' },
          { status: 502 },
        );
      }
    } catch (error) {
      console.error('网盘搜索失败:', error);
      return NextResponse.json({ error: '网盘搜索失败' }, { status: 500 });
    }
  },
);
