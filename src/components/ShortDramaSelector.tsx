/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { getShortDramaCategories } from '@/lib/shortdrama.client';

interface SelectorOption {
  label: string;
  value: string;
}

interface ShortDramaSelectorProps {
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}

const ShortDramaSelector: React.FC<ShortDramaSelectorProps> = ({
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 为不同的选择器创建独立的refs和状态
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const primaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [primaryIndicatorStyle, setPrimaryIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [secondaryIndicatorStyle, setSecondaryIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // 短剧分类数据
  const [shortDramaCategories, setShortDramaCategories] = useState<
    SelectorOption[]
  >([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 加载短剧分类
  useEffect(() => {
    setLoadingCategories(true);
    getShortDramaCategories()
      .then((categories) => {
        const options = categories.map((cat) => ({
          label: cat.type_name,
          value: cat.type_id.toString(),
        }));
        setShortDramaCategories(options);
      })
      .catch((error) => {
        console.error('加载短剧分类失败:', error);
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, []);

  // 短剧一级选择器选项（分类）- 使用 useMemo 缓存
  const primaryOptions: SelectorOption[] = useMemo(
    () => [
      { label: '全部', value: '全部' },
      { label: '随机推荐', value: '随机推荐' },
    ],
    [],
  );

  // 短剧二级选择器选项（类型）- 根据分类动态生成
  const secondaryOptions: SelectorOption[] = useMemo(() => {
    // 如果是"全部"，显示所有分类（不包含"全部"）
    if (primarySelection === '全部') {
      return shortDramaCategories;
    }
    // 如果是"随机推荐"，只显示"全部"
    if (primarySelection === '随机推荐') {
      return [{ label: '全部', value: 'all' }];
    }
    // 其他情况，只显示"全部"
    return [{ label: '全部', value: 'all' }];
  }, [primarySelection, shortDramaCategories]);

  // 是否显示类型选择器（当分类为"随机推荐"时不显示）
  const showTypeSelector = primarySelection !== '随机推荐';

  // 更新一级选择器指示器位置
  useEffect(() => {
    const index = primaryOptions.findIndex(
      (opt) => opt.value === primarySelection,
    );
    if (index !== -1 && primaryButtonRefs.current[index]) {
      const button = primaryButtonRefs.current[index];
      if (button && primaryContainerRef.current) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect =
          primaryContainerRef.current.getBoundingClientRect();
        setPrimaryIndicatorStyle({
          transform: `translateX(${buttonRect.left - containerRect.left}px)`,
          width: `${buttonRect.width}px`,
        });
      }
    }
  }, [primarySelection, primaryOptions]); // 添加 primaryOptions 依赖

  // 初始化二级选择器指示器（在 shortDramaCategories 加载完成后）
  useEffect(() => {
    if (shortDramaCategories.length > 0 && showTypeSelector) {
      const index = secondaryOptions.findIndex(
        (opt) => opt.value === secondarySelection,
      );
      if (index !== -1 && secondaryButtonRefs.current[index]) {
        const button = secondaryButtonRefs.current[index];
        if (button && secondaryContainerRef.current) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect =
            secondaryContainerRef.current.getBoundingClientRect();
          setSecondaryIndicatorStyle({
            transform: `translateX(${buttonRect.left - containerRect.left}px)`,
            width: `${buttonRect.width}px`,
          });
        }
      }
    }
  }, [
    shortDramaCategories,
    secondaryOptions,
    secondarySelection,
    showTypeSelector,
  ]);

  // 更新二级选择器指示器位置
  useEffect(() => {
    const index = secondaryOptions.findIndex(
      (opt) => opt.value === secondarySelection,
    );
    if (index !== -1 && secondaryButtonRefs.current[index]) {
      const button = secondaryButtonRefs.current[index];
      if (button && secondaryContainerRef.current) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect =
          secondaryContainerRef.current.getBoundingClientRect();
        setSecondaryIndicatorStyle({
          transform: `translateX(${buttonRect.left - containerRect.left}px)`,
          width: `${buttonRect.width}px`,
        });
      }
    }
  }, [secondarySelection, secondaryOptions]); // 保留 secondaryOptions 依赖，因为它会根据 primarySelection 变化

  // 渲染胶囊式选择器
  const renderCapsuleSelector = (
    options: SelectorOption[],
    activeValue: string | undefined,
    onChange: (value: string) => void,
  ) => {
    const containerRef =
      primaryOptions === options ? primaryContainerRef : secondaryContainerRef;
    const buttonRefs =
      primaryOptions === options ? primaryButtonRefs : secondaryButtonRefs;
    const indicatorStyle =
      primaryOptions === options
        ? primaryIndicatorStyle
        : secondaryIndicatorStyle;

    return (
      <div
        ref={containerRef}
        className='relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm'
      >
        {/* 滑动的白色背景指示器 - 使用 transform 优化性能 */}
        {indicatorStyle.width !== '0px' && (
          <div
            className='absolute top-0.5 bottom-0.5 sm:top-1 sm:bottom-1 left-0 bg-white dark:bg-gray-500 rounded-full shadow-sm will-change-transform'
            style={{
              transform: indicatorStyle.transform,
              width: indicatorStyle.width,
              transition: 'transform 300ms ease-out, width 300ms ease-out',
            }}
          />
        )}

        {loadingCategories && options === secondaryOptions ? (
          <div className='flex items-center justify-center px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-400'>
            加载中...
          </div>
        ) : (
          options.map((option, index) => {
            const isActive = activeValue === option.value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                onClick={() => onChange(option.value)}
                className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'text-gray-900 dark:text-gray-100 cursor-default'
                    : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer'
                }`}
              >
                {option.label}
              </button>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 一级选择器（分类） */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
        <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
          分类
        </span>
        <div className='overflow-x-auto'>
          {renderCapsuleSelector(
            primaryOptions,
            primarySelection || primaryOptions[0].value,
            onPrimaryChange,
          )}
        </div>
      </div>

      {/* 二级选择器（类型）- 当分类为"随机推荐"时不显示 */}
      {showTypeSelector && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
            类型
          </span>
          <div className='overflow-x-auto'>
            {renderCapsuleSelector(
              secondaryOptions,
              secondarySelection || secondaryOptions[0]?.value || 'all',
              onSecondaryChange,
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShortDramaSelector;
