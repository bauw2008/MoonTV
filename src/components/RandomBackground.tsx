import Image from 'next/image';
import { useEffect, useState } from 'react';

interface RandomBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

const CACHE_KEY = 'cached-background-url';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

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
      'https://edgeone-picture.edgeone.app/api/random',
    ];

    // 备用图片地址
    const fallbackImageUrl =
      'https://raw.githubusercontent.com/bauw2008/bauw/main/Pictures/login.webp';

    // 检查缓存
    const checkCache = () => {
      if (typeof window === 'undefined') return null;
      
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { url, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // 缓存未过期
      if (now - timestamp < CACHE_EXPIRY) {
        return url;
      }
      
      // 缓存过期，清除
      localStorage.removeItem(CACHE_KEY);
      return null;
    };

    // 保存到缓存
    const saveCache = (url: string) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ url, timestamp: Date.now() })
      );
    };

    // 尝试从缓存获取
    const cachedUrl = checkCache();
    if (cachedUrl) {
      setImageUrl(cachedUrl);
      setImageLoaded(true);
      return;
    }

    // 缓存未命中，请求新图片
    const randomApi =
      randomImageApis[Math.floor(Math.random() * randomImageApis.length)];

    const imgElement = new globalThis.Image();

    const handleImageLoad = () => {
      setImageUrl(randomApi);
      setImageLoaded(true);
      setImageError(false);
      saveCache(randomApi);
    };

    const handleImageError = () => {
      if (!imageError) {
        const fallbackImgElement = new globalThis.Image();
        fallbackImgElement.onload = () => {
          setImageUrl(fallbackImageUrl);
          setImageLoaded(true);
          saveCache(fallbackImageUrl);
        };
        fallbackImgElement.onerror = () => {
          setImageLoaded(true);
        };
        fallbackImgElement.src = fallbackImageUrl;
        setImageError(true);
      }
    };

    imgElement.onload = handleImageLoad;
    imgElement.onerror = handleImageError;
    imgElement.src = randomApi;

    return () => {
      imgElement.onload = null;
      imgElement.onerror = null;
    };
  }, [imageError]);

  return (
    <div className={`absolute inset-0 ${className}`}>
      {imageLoaded && imageUrl && (
        <Image
          src={imageUrl}
          alt='Random background'
          fill
          className='absolute inset-0 w-full h-full object-cover'
          style={{ filter: 'brightness(0.7)' }}
          unoptimized
        />
      )}
      {children}
    </div>
  );
};
