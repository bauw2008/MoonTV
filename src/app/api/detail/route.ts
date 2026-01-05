import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { getDetailFromApi } from '@/lib/downstream';
import { getUserVideoSourcesSimple } from '@/lib/config';

export const runtime = 'nodejs';

export const GET = AuthGuard.user(
  async (request: NextRequest, { user }: { user: any }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sourceCode = searchParams.get('source');

    if (!id || !sourceCode) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ error: '无效的视频ID格式' }, { status: 400 });
    }

    try {
      const apiSites = await getUserVideoSourcesSimple(user.username);
      console.log(
        '可用API站点:',
        apiSites.map((s) => s.key),
      );

      const apiSite = apiSites.find((site) => site.key === sourceCode);

      if (!apiSite) {
        console.error(
          `未找到API来源: ${sourceCode}，可用来源:`,
          apiSites.map((s) => s.key),
        );
        return NextResponse.json(
          {
            error: `无效的API来源: ${sourceCode}，请检查视频源配置`,
          },
          { status: 400 },
        );
      }

      console.log(
        `正在获取视频详情: source=${sourceCode}, id=${id}, api=${apiSite.api}`,
      );
      
      let detailData;
      try {
        detailData = await getDetailFromApi(apiSite, id);
      } catch (error) {
        console.error(`获取详情失败 (源: ${sourceCode}):`, error);
        
        // 尝试其他可用源
        const otherSources = apiSites.filter(site => site.key !== sourceCode);
        if (otherSources.length > 0) {
          console.log(`尝试备用源: ${otherSources[0].key}`);
          try {
            detailData = await getDetailFromApi(otherSources[0], id);
            console.log(`备用源 ${otherSources[0].key} 成功获取详情`);
          } catch (fallbackError) {
            console.error(`备用源也失败:`, fallbackError);
            throw new Error(`所有源都无法获取视频详情: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          throw error;
        }
      }
      
      return NextResponse.json(detailData);
    } catch (error) {
      console.error('获取视频详情失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      // 根据错误类型返回不同的错误信息
      if (errorMessage.includes('超时')) {
        return NextResponse.json(
          {
            error: '视频源响应超时，请稍后重试或尝试其他视频源',
          },
          { status: 408 },
        );
      } else if (errorMessage.includes('详情请求失败')) {
        return NextResponse.json(
          {
            error: '视频源暂时不可用，请稍后重试或尝试其他视频源',
          },
          { status: 503 },
        );
      } else if (errorMessage.includes('无效的视频ID格式')) {
        return NextResponse.json(
          {
            error: '视频ID格式无效，请联系管理员',
          },
          { status: 400 },
        );
      } else {
        return NextResponse.json(
          {
            error: `获取视频详情失败: ${errorMessage}`,
          },
          { status: 500 },
        );
      }
    }
  },
);
