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
          // 如果备用图片也失败，使用纯色背景
          setImageLoaded(true);
        };
        fallbackImg.src = fallbackImageUrl;
        setImageError(true);
      }
    };

    img.onload = handleImageLoad;
    img.onerror = handleImageError;
    img.src = randomApi;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageError]);

  return (
    <div className={`absolute inset-0 ${className}`}>
      {imageLoaded && imageUrl && (
        <img
          src={imageUrl}
          alt='Random background'
          className='absolute inset-0 w-full h-full object-cover'
          style={{ filter: 'brightness(0.7)' }}
        />
      )}
      {children}
    </div>
  );
};
