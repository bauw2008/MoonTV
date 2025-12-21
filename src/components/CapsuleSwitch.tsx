/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

  const activeIndex = options.findIndex((opt) => opt.value === active);

  // 更新指示器位置
  const updateIndicatorPosition = () => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current
    ) {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (button && container) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (buttonRect.width > 0) {
          setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
            opacity: 1,
          });
        }
      }
    }
  };

  // 组件挂载时立即计算初始位置
  useEffect(() => {
    const timeoutId = setTimeout(updateIndicatorPosition, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // 监听选中项变化
  useEffect(() => {
    const timeoutId = setTimeout(updateIndicatorPosition, 0);
    return () => clearTimeout(timeoutId);
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex bg-white/20 dark:bg-gray-800/30 backdrop-blur-sm rounded-full p-1 border border-white/20 shadow-lg ${
        className || ''
      }`}
    >
      {/* 玻璃质感背景层 */}
      <div className='absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full backdrop-blur-md' />

      {/* 光泽效果 */}
      <div className='absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full opacity-20' />

      {/* 滑动的指示器 - 增强渐变和阴影效果 */}
      {indicatorStyle.width > 0 && (
        <div
          className='absolute top-1.5 bottom-1.5 rounded-full transition-all duration-500 ease-out shadow-lg'
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            opacity: indicatorStyle.opacity,
            background:
              'linear-gradient(135deg, var(--home-favorites-color, #3b82f6) 0%, color-mix(in srgb, var(--home-favorites-color, #3b82f6) 70%, rgba(168, 85, 247, 0.8)) 30%, color-mix(in srgb, var(--home-favorites-color, #3b82f6) 50%, rgba(139, 92, 246, 0.9)) 70%, var(--home-favorites-color, #3b82f6) 100%)',
            boxShadow:
              '0 4px 16px color-mix(in srgb, var(--home-favorites-color, #3b82f6) 50%, transparent), 0 2px 8px rgba(168, 85, 247, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          }}
        >
          {/* 指示器光泽效果 - 增强 */}
          <div className='absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent' />

          {/* 增加内发光效果 */}
          <div
            className='absolute inset-0 rounded-full opacity-20'
            style={{
              background:
                'radial-gradient(circle at center, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 40%, transparent 70%)',
            }}
          />
        </div>
      )}

      {options.map((opt, index) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 w-16 sm:w-20 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300 cursor-pointer group overflow-hidden ${
              isActive
                ? 'text-white shadow-inner'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-white/10'
            }`}
            style={{
              color: isActive ? 'white' : '',
            }}
          >
            {/* 悬停时的微光效果 - 增强 */}
            {!isActive && (
              <div
                className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 20%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.15) 80%, transparent 100%)',
                }}
              />
            )}

            {/* 文字发光效果 - 增强 */}
            <span
              className={`relative z-10 ${
                isActive
                  ? 'drop-shadow-[0_2px_4px_rgba(255,255,255,0.3)]'
                  : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
              } transition-all duration-300`}
              style={{
                textShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none',
              }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
