import Image from 'next/image';

interface RandomBackgroundProps {
  className?: string;
  imageUrl: string;
}

export const RandomBackground: React.FC<RandomBackgroundProps> = ({
  className = '',
  imageUrl,
}) => {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <Image
        src={imageUrl}
        alt='Random background'
        fill
        className='absolute inset-0 w-full h-full object-cover'
        style={{ filter: 'brightness(0.7)' }}
        priority
        unoptimized
        onLoad={() => {
          // 图片加载成功
        }}
        onError={() => {
          // 图片加载失败，保持默认背景
        }}
      />
    </div>
  );
};
