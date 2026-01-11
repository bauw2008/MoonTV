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

    console.log('=== 网盘搜索调试 ===');
    console.log('搜索关键词:', query);
    console.log('PanSou服务地址:', pansouUrl);
    console.log('网盘搜索启用状态:', config.NetDiskConfig?.enabled);

    // 调用PanSou搜索API
    const searchUrl = `${pansouUrl}/api/search`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vidora-NetDisk-Search/1.0',
      },
      body: JSON.stringify({
        q: query,
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

    // 根据后台配置的启用网盘类型过滤结果
    const enabledCloudTypes = config.NetDiskConfig?.enabledCloudTypes || [];
    const mergedByType = data.data?.merged_by_type || {};
    let filteredMergedByType = mergedByType;
    let filteredTotal = data.data?.total || 0;

    // 如果配置了启用的网盘类型，则过滤结果
    if (enabledCloudTypes.length > 0) {
      filteredMergedByType = {};
      filteredTotal = 0;

      for (const [cloudType, links] of Object.entries(mergedByType)) {
        // 检查当前网盘类型是否在启用列表中
        if (enabledCloudTypes.includes(cloudType)) {
          filteredMergedByType[cloudType] = links;
          filteredTotal += (links as any[]).length;
        }
      }

      console.log('过滤后的网盘搜索结果:', {
        enabledCloudTypes,
        filteredTypes: Object.keys(filteredMergedByType),
        filteredTotal,
      });
    }

    // 返回符合前端期望的数据格式
    return NextResponse.json({
      success: true,
      data: {
        merged_by_type: filteredMergedByType,
        total: filteredTotal,
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
