'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface CollapsibleTabProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isExpanded?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: () => void;
  fullWidth?: boolean; // 新增：是否全宽显示
  theme?: 'blue' | 'green' | 'purple' | 'orange' | 'red'; // 新增：颜色主题
}

export function CollapsibleTab({
  title,
  icon,
  children,
  isExpanded: controlledExpanded,
  defaultCollapsed = false,
  onToggle,
  fullWidth = false,
  theme = 'blue',
}: CollapsibleTabProps) {
  const [internalExpanded, setInternalExpanded] = useState(!defaultCollapsed);

  // 支持受控和非受控模式
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  // 主题配置
  const themeConfig = {
    blue: {
      bg: 'from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      titleGradient: 'from-blue-600 to-purple-600',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      hoverBg: 'hover:bg-blue-50/50 dark:hover:bg-blue-900/30',
    },
    green: {
      bg: 'from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20',
      border: 'border-green-200 dark:border-green-800',
      titleGradient: 'from-green-600 to-emerald-600',
      iconBg: 'bg-green-100 dark:bg-green-900/50',
      iconColor: 'text-green-600 dark:text-green-400',
      hoverBg: 'hover:bg-green-50/50 dark:hover:bg-green-900/30',
    },
    purple: {
      bg: 'from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      titleGradient: 'from-purple-600 to-indigo-600',
      iconBg: 'bg-purple-100 dark:bg-purple-900/50',
      iconColor: 'text-purple-600 dark:text-purple-400',
      hoverBg: 'hover:bg-purple-50/50 dark:hover:bg-purple-900/30',
    },
    orange: {
      bg: 'from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      titleGradient: 'from-orange-600 to-red-600',
      iconBg: 'bg-orange-100 dark:bg-orange-900/50',
      iconColor: 'text-orange-600 dark:text-orange-400',
      hoverBg: 'hover:bg-orange-50/50 dark:hover:bg-orange-900/30',
    },
    red: {
      bg: 'from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/20',
      border: 'border-red-200 dark:border-red-800',
      titleGradient: 'from-red-600 to-pink-600',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      iconColor: 'text-red-600 dark:text-red-400',
      hoverBg: 'hover:bg-red-50/50 dark:hover:bg-red-900/30',
    },
  };

  const currentTheme = themeConfig[theme];

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`${isExpanded ? 'lg:col-span-full' : ''} bg-gradient-to-br ${currentTheme.bg} rounded-2xl shadow-xl backdrop-blur-sm border ${currentTheme.border}`}
    >
      <div
        className={`px-6 py-4 border-b ${currentTheme.border.replace('border-', 'border-b-')} cursor-pointer ${currentTheme.hoverBg} transition-all duration-200 rounded-t-2xl hover:shadow-2xl hover:scale-[1.01]`}
        onClick={handleToggle}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            {icon}
            <h3
              className={`text-lg font-bold bg-gradient-to-r ${currentTheme.titleGradient} bg-clip-text text-transparent`}
            >
              {title}
            </h3>
          </div>
          <div className='flex items-center'>
            <div
              className={`p-1 rounded-full transition-all duration-300 ${isExpanded ? currentTheme.iconBg : 'bg-gray-100 dark:bg-gray-700/50'}`}
            >
              {isExpanded ? (
                <ChevronUp className={`w-4 h-4 ${currentTheme.iconColor}`} />
              ) : (
                <ChevronDown className='w-4 h-4 text-gray-600 dark:text-gray-400' />
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className='p-6 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-b-2xl'>
          {children}
        </div>
      )}
    </div>
  );
}
