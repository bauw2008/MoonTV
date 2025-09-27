'use client';

import { useEffect, useState } from 'react';

export default function TransparencyTest() {
  const [currentOpacity, setCurrentOpacity] = useState(60);

  useEffect(() => {
    // 监听CSS变量变化
    const updateOpacity = () => {
      const root = document.documentElement;
      const opacity = root.style.getPropertyValue('--bg-opacity');
      if (opacity) {
        setCurrentOpacity(parseInt(opacity));
      }
    };

    // 初始更新
    updateOpacity();

    // 监听变化
    const observer = new MutationObserver(updateOpacity);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className='fixed bottom-4 right-4 z-50 p-4 max-w-xs'>
      <div className='glass dark:glass-dark rounded-lg p-4 mb-4'>
        <h3 className='text-sm font-medium mb-2'>透明度测试面板</h3>
        <p className='text-xs opacity-80'>当前透明度: {currentOpacity}%</p>
      </div>

      <div className='glass-button rounded-lg p-3 mb-4'>
        <p className='text-xs text-center'>玻璃按钮测试</p>
      </div>

      <div className='modern-card rounded-lg p-3 mb-4'>
        <p className='text-xs text-center'>现代卡片测试</p>
      </div>

      <div className='glass-ultra rounded-lg p-3'>
        <p className='text-xs text-center'>超级透明玻璃测试</p>
      </div>
    </div>
  );
}
