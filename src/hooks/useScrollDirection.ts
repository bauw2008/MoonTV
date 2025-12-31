'use client';

import { useEffect, useState } from 'react';

interface ScrollDirectionOptions {
  threshold?: number;
  hideOnScrollDown?: boolean;
  autoShowAfterDelay?: number;
}

export const useScrollDirection = (options: ScrollDirectionOptions = {}) => {
  const {
    threshold = 100,
    hideOnScrollDown = true,
    autoShowAfterDelay = 1500,
  } = options;

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDelta = Math.abs(currentScrollY - lastScrollY);

          // 清除之前的timeout
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }

          // 只有滚动距离超过5px才触发隐藏/显示，避免微小滚动
          if (scrollDelta > 5) {
            if (hideOnScrollDown) {
              // 向下滚动超过阈值时隐藏
              if (currentScrollY > lastScrollY && currentScrollY > threshold) {
                setIsVisible(false);
              }
              // 向上滚动时显示
              else if (currentScrollY < lastScrollY) {
                setIsVisible(true);
              }
            }
          }

          // 设置新的timeout，停止滚动一段时间后显示
          if (autoShowAfterDelay > 0) {
            const timeoutId = setTimeout(() => {
              setIsVisible(true);
            }, autoShowAfterDelay);
            setScrollTimeout(timeoutId);
          }

          setLastScrollY(currentScrollY);
          ticking = false;
        });

        ticking = true;
      }
    };

    // 添加滚动监听
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [
    lastScrollY,
    scrollTimeout,
    threshold,
    hideOnScrollDown,
    autoShowAfterDelay,
  ]);

  return { isVisible };
};
