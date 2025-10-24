'use client';

import { useEffect, useState } from 'react';

interface RandomBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

export const RandomBackground: React.FC<RandomBackgroundProps> = ({
  className = '',
  children,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    // 随机图片API列表
    const randomImageApis = [
      'https://cdn.seovx.com/?mom=302', // 美图
      'https://cdn.seovx.com/ha/?mom=302', // 古风
      'https://cdn.seovx.com/d/?mom=302', // 二次元
      //'https://picsum.photos/1920/1080?random=1',
      //'https://source.unsplash.com/random/1920x1080/?nature,landscape',
      //'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
      //'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920&h=1080&fit=crop',
    ];

    // 备用图片地址
    const fallbackImageUrl =
      'https://raw.githubusercontent.com/bauw2008/bauw/main/Pictures/login.webp';

    // 随机选择一个API
    const randomApi =
      randomImageApis[Math.floor(Math.random() * randomImageApis.length)];

    // 预加载图片
    const img = new Image();

    const handleImageLoad = () => {
      setImageUrl(randomApi);
      setImageLoaded(true);
      setImageError(false);
    };

    const handleImageError = () => {
      // 如果随机API失败，使用备用图片
      if (!imageError) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          setImageUrl(fallbackImageUrl);
          setImageLoaded(true);
        };
        fallbackImg.onerror = () => {
          // 如果备用图片也失败，使用空字符串
          setImageLoaded(true);
        };
        fallbackImg.src = fallbackImageUrl;
        setImageError(true);
      }
    };

    img.onload = handleImageLoad;
    img.onerror = handleImageError;
    img.src = randomApi;

    // 清理函数
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []); // 移除了 imageError 依赖，避免无限循环

  return (
    <>
      {!imageLoaded && (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse ${className}`}
        >
          {/* 加载中的占位符 */}
          <div className='flex items-center justify-center h-full'>
            <div className='text-gray-500'>图片加载中...</div>
          </div>
        </div>
      )}

      {imageLoaded && imageUrl && (
        <div
          className={`absolute inset-0 ${className}`}
          style={{
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {children}
    </>
  );
};
