'use client';

import { useState } from 'react';

interface SkipMenuProps {
  skipEnabled: boolean;
  onSkipToggle: (enabled: boolean) => void;
  onOpenSettings: () => void;
}

export default function SkipMenu({
  skipEnabled,
  onSkipToggle,
  onOpenSettings,
}: SkipMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleSkipToggle = (enabled: boolean) => {
    onSkipToggle(enabled);
    setIsOpen(false);
  };

  const handleOpenSettings = () => {
    onOpenSettings();
    setIsOpen(false);
  };

  return (
    <div className='relative inline-block'>
      {/* 主按钮 */}
      <button
        onClick={toggleMenu}
        className='flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors'
        title='跳过设置'
      >
        <svg
          className='w-4 h-4'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 5l7 7-7 7M5 5l7 7-7 7'
          />
        </svg>
        <span>跳过</span>
        <svg
          className={`w-3 h-3 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className='absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50'>
          <div className='p-2 space-y-1'>
            {/* 跳过功能开关 */}
            <div className='flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'>
              <span className='text-sm text-gray-700 dark:text-gray-300'>
                跳过功能
              </span>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  checked={skipEnabled}
                  onChange={(e) => handleSkipToggle(e.target.checked)}
                  className='sr-only peer'
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 分隔线 */}
            <div className='border-t border-gray-200 dark:border-gray-600'></div>

            {/* 设置按钮 */}
            <button
              onClick={handleOpenSettings}
              className='flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={!skipEnabled}
            >
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                />
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                />
              </svg>
              <span>跳过设置</span>
            </button>

            {/* 状态提示 */}
            <div className='px-3 py-1'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {skipEnabled ? '跳过功能已开启' : '跳过功能已关闭'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
