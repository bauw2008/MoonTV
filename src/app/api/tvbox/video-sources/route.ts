import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';
import { getConfig } from '@/lib/config';
import { getUserVideoSourcesWithFilter } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const authResult = await authManager.authenticate(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const username = authResult.user.username;
    
    // 使用简化的权限查询
    const availableSites = await getUserVideoSourcesWithFilter(username);
    
    // 获取配置
    const config = await getConfig();
    
    // 正确的18禁过滤逻辑
    let shouldFilter = false;
    
    if (config.YellowWords && config.YellowWords.length > 0) {
      // 检查用户是否需要过滤
      const userConfig = config.UserConfig.Users?.find(u => u.username === username);
      
      // 1. 检查全局开关（主开关）
      if (config.SiteConfig.DisableYellowFilter) {
        shouldFilter = false;
      }
      // 2. 全局开关开启，检查具体设置
      else {
        // 站长永远不过滤
        if (userConfig?.role === 'owner') {
          shouldFilter = false;
        }
        // 检查用户组设置
        else if (userConfig?.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
          for (const tagName of userConfig.tags) {
            const tagConfig = (config.UserConfig.Tags as any)?.find((t: any) => t.name === tagName);
            // disableYellowFilter = true 表示用户组开启过滤
            if ((tagConfig as any)?.disableYellowFilter === true) {
              shouldFilter = true;
              break;
            }
          }
          // 如果用户组没有开启过滤，则不过滤
          if (!shouldFilter) {
            shouldFilter = false;
          }
        }
        // 默认情况：没有用户组设置，不过滤
        else {
          shouldFilter = false;
        }
      }
    }
    
    // 转换为TVBox需要的格式，并应用18+分类过滤
    const tvboxSources = availableSites.map(site => {
      let filteredCategories = site.categories || [];
      
      // 应用过滤（如果需要过滤）
      if (shouldFilter && config.YellowWords && config.YellowWords.length > 0) {
        filteredCategories = filteredCategories.filter((category: string) => {
          const lowerCategory = category.toLowerCase();
          return !config.YellowWords.some((word: string) =>
            lowerCategory.includes(word.toLowerCase())
          );
        });
      }
      
      return {
        key: site.key,
        name: site.name,
        api: site.api,
        searchable: 1,
        quickSearch: 1,
        filterable: 1,
        changeable: 1,
        ext: site.ext || '',
        jar: site.jar,
        playerUrl: '',
        hide: 0,
        categories: filteredCategories,
      };
    });

    return NextResponse.json(tvboxSources);
  } catch (error) {
    console.error('获取视频源失败:', error);
    return NextResponse.json({ error: '获取视频源失败' }, { status: 500 });
  }
}