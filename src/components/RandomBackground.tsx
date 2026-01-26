import Image from 'next/image';
import { useEffect, useState } from 'react';

interface RandomBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

const CACHE_KEY = 'cached-background-url';

export const RandomBackground: React.FC<RandomBackgroundProps> = ({
  className = '',
  children,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  useEffect(() => {
    // 随机图片API列表
    const randomImageApis = ['https://edgeone-picture.edgeone.app/api/random'];

    // 备用图片地址
    const fallbackImageUrl =
      'https://raw.githubusercontent.com/bauw2008/bauw/main/Pictures/login.webp';

    // 缓存未命中，请求新图片
    const randomApi =
      randomImageApis[Math.floor(Math.random() * randomImageApis.length)];

    const imgElement = new globalThis.Image();

    const handleImageLoad = () => {
      setImageUrl(randomApi);
      setImageLoaded(true);

      // 更新缓存
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            url: randomApi,
            timestamp: Date.now(),
          }),
        );
      } catch {
        // 忽略缓存错误
      }
    };

    const handleImageError = () => {
      setImageUrl(fallbackImageUrl);
      setImageLoaded(true);
    };

    imgElement.onload = handleImageLoad;
    imgElement.onerror = handleImageError;
    imgElement.src = randomApi;

    return () => {
      imgElement.onload = null;
      imgElement.onerror = null;
    };
  }, []);

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
