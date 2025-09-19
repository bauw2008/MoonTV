import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ScrollableRowProps {
  children: React.ReactNode;
  scrollDistance?: number;
}

export default function ScrollableRow({
  children,
  scrollDistance = 1000,
}: ScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    // 标记组件已在客户端挂载
    setIsClient(true);

    // 初始检测
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // 在客户端执行检测
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;

      // 计算是否需要左右滚动按钮
      const threshold = 1; // 容差值，避免浮点误差
      const canScrollRight =
        scrollWidth - (scrollLeft + clientWidth) > threshold;
      const canScrollLeft = scrollLeft > threshold;

      setShowRightScroll(canScrollRight);
      setShowLeftScroll(canScrollLeft);
    }
  };

  useEffect(() => {
    // 多次延迟检查，确保内容已完全渲染
    checkScroll();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScroll);

    // 创建一个 ResizeObserver 来监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 延迟执行检查
      checkScroll();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [children]); // 依赖 children，当子组件变化时重新检查

  // 添加一个额外的效果来监听子组件的变化
  useEffect(() => {
    if (containerRef.current) {
      // 监听 DOM 变化
      const observer = new MutationObserver(() => {
        setTimeout(checkScroll, 100);
      });

      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      return () => observer.disconnect();
    }
  }, []);

  const handleScrollRightClick = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: scrollDistance,
        behavior: 'smooth',
      });
    }
  };

  const handleScrollLeftClick = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: -scrollDistance,
        behavior: 'smooth',
      });
    }
  };

  // 移动端触摸滑动处理 - 简化版本，只提供视觉反馈
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !containerRef.current) return;

    setIsDragging(true);

    // 添加抓取光标样式
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
      containerRef.current.style.userSelect = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !containerRef.current) return;

    setIsDragging(false);

    // 恢复光标样式
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.userSelect = '';
    }
  };

  // 鼠标拖动处理（桌面端）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);

    // 添加抓取光标样式
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
      containerRef.current.style.userSelect = 'none';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // 滑动速度系数
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    if (!containerRef.current) return;

    setIsDragging(false);

    // 恢复光标样式
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.userSelect = '';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging && containerRef.current) {
      setIsDragging(false);
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.userSelect = '';
    }
  };

  return (
    <div
      className='relative'
      onMouseEnter={() => {
        setIsHovered(true);
        // 当鼠标进入时重新检查一次
        checkScroll();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        handleMouseLeave();
      }}
    >
      <div
        ref={containerRef}
        className={`flex space-x-6 overflow-x-auto scrollbar-hide py-1 sm:py-2 pb-12 sm:pb-14 px-4 sm:px-6 ${
          isClient && isMobile ? 'cursor-grab' : ''
        } ${isDragging ? 'cursor-grabbing' : ''}`}
        onScroll={checkScroll}
        onTouchStart={isClient && isMobile ? handleTouchStart : undefined}
        onTouchEnd={isClient && isMobile ? handleTouchEnd : undefined}
        onMouseDown={isClient && isMobile ? undefined : handleMouseDown}
        onMouseMove={isClient && isMobile ? undefined : handleMouseMove}
        onMouseUp={isClient && isMobile ? undefined : handleMouseUp}
        onMouseLeave={isClient && isMobile ? undefined : handleMouseLeave}
        style={{
          WebkitOverflowScrolling: isClient && isMobile ? 'touch' : 'auto', // 在 iOS 上提供平滑滚动
          scrollSnapType: isClient && isMobile ? 'x mandatory' : 'none', // 移动端启用滚动吸附
          scrollBehavior: 'smooth',
          touchAction: isClient && isMobile ? 'pan-x' : 'auto', // 明确告诉浏览器只处理水平方向的触摸滑动
        }}
      >
        {children}
      </div>

      {/* 移动端滑动指示器 */}
      {isClient && isMobile && (
        <div className='flex justify-center space-x-1 mt-2 sm:hidden'>
          <div className='w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
          <div className='w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
          <div className='w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
        </div>
      )}

      {/* 桌面端滚动按钮 */}
      {showLeftScroll && (
        <div
          className={`hidden sm:flex absolute left-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: 'transparent',
            pointerEvents: 'none', // 允许点击穿透
          }}
        >
          <div
            className='absolute inset-0 flex items-center justify-center'
            style={{
              top: '40%',
              bottom: '60%',
              left: '-4.5rem',
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={handleScrollLeftClick}
              className='w-12 h-12 bg-white/95 rounded-full shadow-lg flex items-center justify-center hover:bg-white border border-gray-200 transition-transform hover:scale-105 dark:bg-gray-800/90 dark:hover:bg-gray-700 dark:border-gray-600'
            >
              <ChevronLeft className='w-6 h-6 text-gray-600 dark:text-gray-300' />
            </button>
          </div>
        </div>
      )}

      {showRightScroll && (
        <div
          className={`hidden sm:flex absolute right-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: 'transparent',
            pointerEvents: 'none', // 允许点击穿透
          }}
        >
          <div
            className='absolute inset-0 flex items-center justify-center'
            style={{
              top: '40%',
              bottom: '60%',
              right: '-4.5rem',
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={handleScrollRightClick}
              className='w-12 h-12 bg-white/95 rounded-full shadow-lg flex items-center justify-center hover:bg-white border border-gray-200 transition-transform hover:scale-105 dark:bg-gray-800/90 dark:hover:bg-gray-700 dark:border-gray-600'
            >
              <ChevronRight className='w-6 h-6 text-gray-600 dark:text-gray-300' />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
