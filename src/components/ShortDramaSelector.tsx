/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react';
import { getShortDramaCategories, ShortDramaCategory } from '@/lib/shortdrama.client';

interface ShortDramaSelectorProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const ShortDramaSelector = ({
  selectedCategory,
  onCategoryChange,
}: ShortDramaSelectorProps) => {
  const [categories, setCategories] = useState<ShortDramaCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // 胶囊选择器相关状态
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  // 获取分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await getShortDramaCategories();
        setCategories([
          { type_id: 0, type_name: '全部' },
          ...response.categories
        ]);
      } catch (error) {
        console.error('获取短剧分类失败:', error);
        // 设置默认分类
        setCategories([
          { type_id: 0, type_name: '全部' },
          { type_id: 1, type_name: '古装' },
          { type_id: 2, type_name: '现代' },
          { type_id: 3, type_name: '都市' },
          { type_id: 4, type_name: '言情' },
          { type_id: 5, type_name: '悬疑' },
          { type_id: 6, type_name: '喜剧' },
          { type_id: 7, type_name: '其他' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 更新指示器位置
  const updateIndicatorPosition = () => {
    const activeIndex = categories.findIndex(
      (cat) => cat.type_id.toString() === selectedCategory
    );

    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current
    ) {
      const timeoutId = setTimeout(() => {
        const button = buttonRefs.current[activeIndex];
        const container = containerRef.current;
        if (button && container) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          if (buttonRect.width > 0) {
            setIndicatorStyle({
              left: buttonRect.left - containerRect.left,
              width: buttonRect.width,
            });
          }
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  };

  // 当分类数据加载完成或选中项变化时更新指示器位置
  useEffect(() => {
    if (!loading && categories.length > 0) {
      updateIndicatorPosition();
    }
  }, [loading, categories, selectedCategory]);

  // 渲染胶囊式选择器
  const renderCapsuleSelector = () => {
    if (loading) {
      return (
        <div className='flex flex-wrap gap-2'>
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className='h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse'
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className='relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm'
      >
        {/* 滑动的白色背景指示器 */}
        {indicatorStyle.width > 0 && (
          <div
            className='absolute top-0.5 bottom-0.5 sm:top-1 sm:bottom-1 bg-white dark:bg-gray-500 rounded-full shadow-sm transition-all duration-300 ease-out'
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}

        {categories.map((category, index) => {
          const isActive = selectedCategory === category.type_id.toString();
          return (
            <button
              key={category.type_id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onCategoryChange(category.type_id.toString())}
              className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${isActive
                ? 'text-gray-900 dark:text-gray-100 cursor-default'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer'
                }`}
            >
              {category.type_name}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 分类选择 */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
        <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
          分类
        </span>
        <div className='overflow-x-auto'>
          {renderCapsuleSelector()}
        </div>
      </div>
    </div>
  );
};

export default ShortDramaSelector;
