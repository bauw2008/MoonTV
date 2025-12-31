const DoubanCardSkeleton = () => {
  return (
    <div className='w-full'>
      <div className='group relative w-full rounded-lg bg-transparent shadow-none flex flex-col'>
        {/* 图片占位符 - 骨架屏效果 */}
        <div className='skeleton-shine aspect-[2/3] w-full rounded-lg' />

        {/* 信息层骨架 */}
        <div className='absolute top-[calc(100%+0.5rem)] left-0 right-0'>
          <div className='flex flex-col items-center justify-center'>
            <div className='h-4 w-24 sm:w-32 bg-gray-200 rounded animate-pulse mb-2'></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubanCardSkeleton;
