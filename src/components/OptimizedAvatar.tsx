'use client';

import { User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface OptimizedAvatarProps {
  onClick?: () => void;
  className?: string;
  size?: 'nav' | 'menu' | 'large';
  avatarUrl?: string; // 允许外部传入头像URL
  selectedImage?: string; // 用于修改头像面板的预览
}

// 清除服务器中的头像
export const clearAvatarFromLocalStorage = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/avatar', { method: 'DELETE' });
  } catch (error) {
    // 忽略错误
  }
};

export const OptimizedAvatar: React.FC<OptimizedAvatarProps> = ({
  onClick,
  className = '',
  size = 'nav',
  avatarUrl: externalAvatarUrl,
  selectedImage,
}) => {
  // 根据尺寸设置样式
  const getSizeClasses = () => {
    switch (size) {
      case 'menu':
        return {
          container: 'w-14 h-14',
          icon: 'w-8 h-8',
          imageWidth: 56,
          imageHeight: 56,
        };
      case 'large':
        return {
          container: 'w-32 h-32',
          icon: 'w-16 h-16',
          imageWidth: 128,
          imageHeight: 128,
        };
      case 'nav':
      default:
        return {
          container: 'w-9 h-9 sm:w-12 sm:h-12',
          icon: 'w-5 h-5 sm:w-7 sm:h-7',
          imageWidth: 36,
          imageHeight: 36,
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const [internalAvatarUrl, setInternalAvatarUrl] = useState('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // 使用外部传入的头像URL或内部获取的
  const avatarUrl = externalAvatarUrl || internalAvatarUrl;

  // 从 API 读取头像（仅在没有外部传入时）
  useEffect(() => {
    if (!externalAvatarUrl) {
      fetch('/api/avatar')
        .then((res) => res.json())
        .then((data) => {
          if (data.avatar) {
            setInternalAvatarUrl(`data:image/jpeg;base64,${data.avatar}`);
          }
        })
        .catch(() => {
          // 忽略错误，使用默认头像
        });
    }
  }, [externalAvatarUrl]);

  // 判断显示哪个图片
  const displayImage = selectedImage || avatarUrl;

  return (
    <div className={`relative ${className}`}>
      {/* 占位符头像 - 始终存在 */}
      <div
        className={`${sizeClasses.container} p-0.5 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-all duration-300 hover:scale-105 overflow-hidden group ${size === 'menu' ? 'ring-2 ring-white/50 dark:ring-gray-700/50 shadow-lg' : ''} ${size === 'large' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
      >
        <div
          className={`w-full h-full rounded-full ${size === 'large' ? '' : 'bg-gradient-to-br from-blue-400/20 to-blue-600/20 dark:from-blue-600/20 dark:to-blue-800/20'} flex items-center justify-center ring-2 ring-transparent group-hover:ring-blue-400/50 transition-all duration-300`}
        >
          <User
            className={`${sizeClasses.icon} text-blue-500 dark:text-blue-400`}
          />
        </div>
      </div>

      {/* 真实头像或预览图片 - 叠加在上方 */}
      {displayImage && (
        <div
          className={`absolute inset-0 ${sizeClasses.container} p-0.5 rounded-full overflow-hidden transition-opacity duration-300 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            ref={imageRef}
            src={
              displayImage.startsWith('data:')
                ? displayImage
                : `data:image/jpeg;base64,${displayImage}`
            }
            alt='用户头像'
            width={sizeClasses.imageWidth}
            height={sizeClasses.imageHeight}
            className='w-full h-full object-cover rounded-full'
            onLoad={() => setIsImageLoaded(true)}
            style={{
              display: isImageLoaded ? 'block' : 'none',
              // 提前加载图片以减少闪动
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          />
        </div>
      )}

      {/* 点击区域 */}
      {onClick && (
        <button
          onClick={onClick}
          className='absolute inset-0 w-full h-full rounded-full'
          aria-label='用户菜单'
        />
      )}
    </div>
  );
};
