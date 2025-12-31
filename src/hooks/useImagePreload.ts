import { useEffect } from 'react';

// Type declarations for DOM APIs
declare global {
  interface HTMLLinkElement {
    rel: string;
    as: string;
    href: string;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    parentNode: ParentNode | null;
  }
}

// 全局计数器，限制403错误日志输出数量
let doubanErrorCount = 0;
const MAX_DOUBAN_ERROR_LOGS = 3; // 最多显示3个豆瓣403错误日志

/**
 * Hook to preload images for better UX
 * Adds <link rel="preload"> tags for images that are about to enter the viewport
 */

export function useImagePreload(imageUrls: string[], enabled = true) {
  useEffect(() => {
    if (!enabled || !imageUrls.length) {
      return;
    }

    const preloadLinks: HTMLLinkElement[] = [];

    // Preload first few images
    const urlsToPreload = imageUrls.slice(0, Math.min(10, imageUrls.length));

    urlsToPreload.forEach((url) => {
      if (!url) return;

      // Clean and validate URL
      const cleanUrl = url.trim().replace(/["'>]/g, '');
      if (!cleanUrl) return;

      // 检查是否已经预加载
      const existing = document.querySelector(
        `link[rel="preload"][href="${cleanUrl}"]`,
      );
      if (existing) return;

      const link = document.createElement('link') as HTMLLinkElement;
      link.rel = 'preload';
      link.as = 'image';
      link.href = cleanUrl;
      // Set fetch priority to low (not blocking visible content)
      (link as any).fetchPriority = 'low';

      // 添加错误处理，限制豆瓣403错误日志输出
      link.addEventListener('error', () => {
        // 只处理豆瓣图片的403错误
        if (cleanUrl.includes('doubanio.com')) {
          doubanErrorCount++;

          // 只在前几个错误时输出日志
          if (doubanErrorCount <= MAX_DOUBAN_ERROR_LOGS) {
            // 静默处理错误，不输出到控制台
          }

          // 静默移除失败的preload标签
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        }
      });

      document.head.appendChild(link);
      preloadLinks.push(link);
    });

    // Cleanup: remove preload links when component unmounts
    return () => {
      preloadLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [imageUrls, enabled]);
}

/**
 * 重置错误计数器（用于测试或切换页面）
 */
export function resetDoubanErrorCount() {
  doubanErrorCount = 0;
}
