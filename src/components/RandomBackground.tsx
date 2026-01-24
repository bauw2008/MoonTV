import Image from 'next/image';
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
      //'https://cdn.seovx.com/?mom=302', // 美图
      //'https://cdn.seovx.com/ha/?mom=302', // 古风
      //'https://cdn.seovx.com/d/?mom=302', // 二次元
      'https://edgeone-picture.edgeone.app/api/random',
    ];

    // 备用图片地址
    const fallbackImageUrl =
      'https://raw.githubusercontent.com/bauw2008/bauw/main/Pictures/login.webp';

    // 随机选择一个API
    const randomApi =
      randomImageApis[Math.floor(Math.random() * randomImageApis.length)];

    // 预加载图片
    const imgElement = new globalThis.Image();

    const handleImageLoad = () => {
      setImageUrl(randomApi);
      setImageLoaded(true);
      setImageError(false);
    };

    const handleImageError = () => {
      // 如果随机API失败，使用备用图片
      if (!imageError) {
        const fallbackImgElement = new globalThis.Image();
        fallbackImgElement.onload = () => {
          setImageUrl(fallbackImageUrl);
          setImageLoaded(true);
        };
        fallbackImgElement.onerror = () => {
          // 如果备用图片也失败，使用纯色背景
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
