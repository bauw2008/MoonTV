/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const meta = document.createElement('meta') as HTMLMetaElement;
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#0c111c' : '#f9fbfe';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#0c111c' : '#f9fbfe');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听主题变化和路由变化，确保主题色始终同步
  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [mounted, resolvedTheme, pathname]);

  if (!mounted) {
    // 渲染一个占位符以避免布局偏移
    return <div className='w-10 h-10' />;
  }

  const toggleTheme = () => {
    // 检查浏览器是否支持 View Transitions API
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeColor(targetTheme);
    if (!(document as any).startViewTransition) {
      setTheme(targetTheme);
      return;
    }

    (document as any).startViewTransition(() => {
      setTheme(targetTheme);
    });
  };

  return (
    <div className='relative group'>
      {/* 粒子效果 */}

      <div className='absolute -inset-1 pointer-events-none'>
        <div className='absolute top-0 left-0 w-1.5 h-1.5 bg-amber-400 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-300'></div>

        <div className='absolute bottom-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500'></div>
      </div>

      <button
        onClick={toggleTheme}
        className='relative transition-all duration-300 hover:scale-110 group'
        aria-label='Toggle theme'
        title='切换主题'
      >
        {/* 微光背景效果 */}

        <div className='absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/0 to-amber-600/0 group-hover:from-amber-400/20 group-hover:to-amber-600/20 dark:group-hover:from-amber-300/20 dark:group-hover:to-amber-500/20 transition-all duration-300'></div>

        {resolvedTheme === 'dark' ? (
          <Sun className='w-5 h-5 relative z-10 group-hover:rotate-180 transition-transform duration-500 text-amber-500 dark:text-amber-400' />
        ) : (
          <Moon className='w-5 h-5 relative z-10 group-hover:rotate-180 transition-transform duration-500 text-amber-500 dark:text-amber-400' />
        )}
      </button>
    </div>
  );
}
