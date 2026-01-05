import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import './globals.css';
import '../styles/webkit-scrollbar.css';

import { authFramework } from "@/lib/auth";
import { getConfig } from "@/lib/config";

import { AuthProvider } from "@/components/auth/AuthProvider";

import { NavigationConfigProvider } from "@/contexts/NavigationConfigContext";

import ClientAccessGuard from "../components/ClientAccessGuard";
import { GlobalErrorIndicator } from "../components/GlobalErrorIndicator";
import { SiteProvider } from "../components/SiteProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/Toast";
import ToastContainer from "../components/ToastContainer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});
export const dynamic = "force-dynamic";

// 动态生成 metadata，支持配置更新后的标题变化
export async function generateMetadata(): Promise<Metadata> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || "localstorage";
  const config = await getConfig();
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || "MoonTV";
  if (storageType !== "localstorage") {
    siteName = config.SiteConfig.SiteName;
  }

  return {
    title: siteName,
    description: "影视聚合",
    manifest: "/manifest.json",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// 获取运行时配置
async function getRuntimeConfig() {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || "localstorage";

  if (storageType === "localstorage") {
    return {
      STORAGE_TYPE: "localstorage",
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || "Vidora",
      MenuSettings: {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
      },
      DOUBAN_PROXY_TYPE: "direct",
      DOUBAN_PROXY: "",
      DOUBAN_IMAGE_PROXY_TYPE: "direct",
      DOUBAN_IMAGE_PROXY: "",
      FLUID_SEARCH: true,
      CUSTOM_CATEGORIES: [],
    };
  }

  const config = await getConfig();

  return {
    STORAGE_TYPE: storageType,
    SiteName:
      config.SiteConfig?.SiteName ??
      (process.env.NEXT_PUBLIC_SITE_NAME || "Vidora"),
    Announcement:
      config.SiteConfig?.Announcement ??
      (process.env.ANNOUNCEMENT ||
        "本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。"),
    MenuSettings: config.SiteConfig.MenuSettings,
    DOUBAN_PROXY_TYPE: config.SiteConfig.DoubanProxyType,
    DOUBAN_PROXY: config.SiteConfig.DoubanProxy,
    DOUBAN_IMAGE_PROXY_TYPE: config.SiteConfig.DoubanImageProxyType,
    DOUBAN_IMAGE_PROXY: config.SiteConfig.DoubanImageProxy,
    FLUID_SEARCH: config.SiteConfig.FluidSearch,
    CUSTOM_CATEGORIES:
      config.CustomCategories?.filter((cat) => !cat.disabled).map((cat) => ({
        name: cat.name,
        type: cat.type,
        query: cat.query,
      })) || [],
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeConfig = await getRuntimeConfig();

  // 确保认证框架已初始化
  if (!authFramework.getStatus().initialized) {
    try {
      await authFramework.initialize();
    } catch {
      // 认证框架初始化失败，静默处理
    }
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icons/icon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/icons/icon-16x16.png"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* 配置和访问控制 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig).replace(/</g, "\\u003c")};
              
              function checkPageAccess() {
                const pathname = window.location.pathname;
                const menuSettings = window.RUNTIME_CONFIG?.MenuSettings;
                
                if (!menuSettings) return true;
                
                // 路径访问映射
                const pathAccessMap = {
                  '/douban': {
                    check: () => {
                      const type = new URLSearchParams(window.location.search).get('type');
                      switch (type) {
                        case 'movie': return menuSettings.showMovies;
                        case 'tv': return menuSettings.showTVShows;
                        case 'anime': return menuSettings.showAnime;
                        case 'show': return menuSettings.showVariety;
                        case 'short-drama': return menuSettings.showShortDrama;
                        default: return menuSettings.showMovies;
                      }
                    }
                  },
                  '/live': { check: () => menuSettings.showLive },
                  '/tvbox': { check: () => menuSettings.showTvbox },
                };
                
                // 检查当前路径是否允许访问
                for (const [path, config] of Object.entries(pathAccessMap)) {
                  if (pathname.startsWith(path)) {
                    if (!config.check()) {
                      console.warn(\`访问被拒绝: \${pathname}\`);
                      // 显示友好的提示页面而不是直接重定向
                      document.body.innerHTML = \`
                        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: system-ui;">
                          <div style="text-align: center; padding: 2rem;">
                            <h2 style="color: #ef4444; margin-bottom: 1rem;">功能暂时不可用</h2>
                            <p style="color: #6b7280; margin-bottom: 1.5rem;">此功能已被管理员禁用，请联系管理员了解更多信息。</p>
                            <button onclick="window.location.href='/'" style="
                              background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer;
                            ">返回首页</button>
                          </div>
                        </div>
                      \`;
                      return false;
                    }
                  }
                }
                
                return true;
              }
              
              // 页面加载时检查访问权限
              checkPageAccess();
              
              // 监听配置变更事件
              window.addEventListener('nav-config-changed', checkPageAccess);
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen text-gray-900 dark:text-gray-200`}
        style={{ background: "transparent" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider
            siteName={runtimeConfig.SiteName}
            announcement={runtimeConfig.Announcement}
          >
            <AuthProvider>
              <NavigationConfigProvider>
                <ToastProvider>
                  <GlobalErrorIndicator />
                  <ToastContainer />
                  <ClientAccessGuard>{children}</ClientAccessGuard>
                </ToastProvider>
              </NavigationConfigProvider>
            </AuthProvider>
          </SiteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}