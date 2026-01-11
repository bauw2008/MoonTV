import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
  }

  try {
    // 获取配置
    const config = await getConfig();

    // 检查网盘搜索是否启用
    if (!config.NetDiskConfig?.enabled) {
      console.log('[NetDisk Search] 网盘搜索功能未启用');
      return NextResponse.json(
        { error: '网盘搜索功能未启用' },
        { status: 403 },
      );
    }

    const pansouUrl =
      config.NetDiskConfig?.pansouUrl || 'https://so.252035.xyz';
    const timeout = config.NetDiskConfig?.timeout || 30;
    const enabledCloudTypes = config.NetDiskConfig?.enabledCloudTypes || [
      'baidu',
      'aliyun',
      'quark',
      'tianyi',
      'uc',
    ];

    console.log('=== 网盘搜索调试 ===');
    console.log('搜索关键词:', query);
    console.log('PanSou服务地址:', pansouUrl);
    console.log('网盘搜索启用状态:', config.NetDiskConfig?.enabled);
    console.log('启用的网盘类型:', enabledCloudTypes);

    // 调用PanSou搜索API
    const searchUrl = `${pansouUrl}/api/search`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const requestBody = {
      kw: query,
      res: 'merge',
      cloud_types: enabledCloudTypes,
    };

    console.log('PanSou请求详情:', {
      url: searchUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LunaTV/1.0',
      },
      body: requestBody,
    });

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LunaTV/1.0',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        'PanSou服务响应错误:',
        response.status,
        response.statusText,
      );
      // 尝试读取错误响应体
      try {
        const errorText = await response.text();
        console.error('错误响应内容:', errorText);
      } catch (e) {
        console.error('无法读取错误响应内容');
      }
      return NextResponse.json(
        { error: `网盘搜索服务暂时不可用 (${response.status})` },
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
}
