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

      {/* 滑动的指示器 - 带有渐变和阴影 */}
      {indicatorStyle.width > 0 && (
        <div
          className='absolute top-1 bottom-1 rounded-full transition-all duration-500 ease-out shadow-lg'
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            opacity: indicatorStyle.opacity,
            background: `linear-gradient(135deg, var(--home-favorites-color, #3b82f6) 0%, color-mix(in srgb, var(--home-favorites-color, #3b82f6) 70%, rgba(168, 85, 247, 0.8)) 100%)`,
            boxShadow:
              '0 4px 12px color-mix(in srgb, var(--home-favorites-color, #3b82f6) 30%, transparent), 0 2px 4px rgba(168, 85, 247, 0.2)',
          }}
        >
          {/* 指示器光泽效果 */}
          <div className='absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent' />
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
            className={`relative z-10 w-20 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 cursor-pointer group overflow-hidden ${
              isActive
                ? 'text-white shadow-inner'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-white/10'
            }`}
            style={{
              color: isActive ? 'white' : '',
            }}
          >
            {/* 悬停时的微光效果 */}
            {!isActive && (
              <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
            )}

            {/* 文字发光效果 */}
            <span
              className={`relative z-10 ${
                isActive
                  ? 'drop-shadow-sm'
                  : 'group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              } transition-all duration-300`}
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
