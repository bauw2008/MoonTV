'use client';

import React, { useEffect, useState } from 'react';

import { getShortDramaCategories } from '@/lib/shortdrama.client';

import { CapsuleSelector } from './CapsuleSelector';

interface SelectorOption {
  label: string;
  value: string;
}

interface ShortDramaSelectorProps {
  primarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
}

const ShortDramaSelector: React.FC<ShortDramaSelectorProps> = ({
  primarySelection,
  onPrimaryChange,
}) => {
  // 短剧分类数据
  const [shortDramaCategories, setShortDramaCategories] = useState<
    SelectorOption[]
  >([]);

  const [, setLoadingCategories] = useState(false);

  // 加载短剧分类
  useEffect(() => {
    // 使用 requestAnimationFrame 来延迟 setState 调用
    requestAnimationFrame(() => {
      setLoadingCategories(true);
    });
    getShortDramaCategories()
      .then((categories) => {
        // 转换为 SelectorOption 格式
        const options = categories.map((cat) => ({
          label: cat.type_name,
          value:
            (cat as { type_id: number; value?: string }).value ||
            cat.type_id.toString(),
        }));
        setShortDramaCategories(options);
      })
      .catch(() => {
        // 忽略错误
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, []);

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 分类选择器 */}
      <CapsuleSelector
        label='分类'
        options={shortDramaCategories}
        value={primarySelection || shortDramaCategories[0]?.value || ''}
        onChange={onPrimaryChange}
        enableVirtualScroll={true}
      />
    </div>
  );
};

export default ShortDramaSelector;
