'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { getShortDramaCategories } from '@/lib/shortdrama.client';

import { CapsuleSelector } from './CapsuleSelector';

interface SelectorOption {
  label: string;
  value: string;
}

interface ShortDramaSelectorProps {
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string | number) => void;
  onSecondaryChange: (value: string | number) => void;
}

const ShortDramaSelector: React.FC<ShortDramaSelectorProps> = ({
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 短剧分类数据
  const [shortDramaCategories, setShortDramaCategories] = useState<
    SelectorOption[]
  >([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 加载短剧分类
  useEffect(() => {
    // 使用 requestAnimationFrame 来延迟 setState 调用
    requestAnimationFrame(() => {
      setLoadingCategories(true);
    });
    getShortDramaCategories()
      .then((categories) => {
        const options = categories.map((cat) => ({
          label: cat.type_name,
          value: cat.type_id.toString(),
        }));
        setShortDramaCategories(options);
      })
      .catch((error) => {
        console.error('加载短剧分类失败:', error);
      })
      .finally(() => {
        setLoadingCategories(false);
      });
  }, []);

  // 短剧一级选择器选项（分类）- 使用 useMemo 缓存
  const primaryOptions: SelectorOption[] = useMemo(
    () => [
      { label: '全部', value: '全部' },
      { label: '随机推荐', value: '随机推荐' },
    ],
    [],
  );

  // 短剧二级选择器选项（类型）- 根据分类动态生成
  const secondaryOptions: SelectorOption[] = useMemo(() => {
    // 如果是"全部"，显示所有分类（不包含"全部"）
    if (primarySelection === '全部') {
      return shortDramaCategories;
    }
    // 如果是"随机推荐"，只显示"全部"
    if (primarySelection === '随机推荐') {
      return [{ label: '全部', value: 'all' }];
    }
    // 其他情况，只显示"全部"
    return [{ label: '全部', value: 'all' }];
  }, [primarySelection, shortDramaCategories]);

  // 是否显示类型选择器（当分类为"随机推荐"时不显示）
  const showTypeSelector = primarySelection !== '随机推荐';

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* 一级选择器（分类） */}
      <CapsuleSelector
        label='分类'
        options={primaryOptions}
        value={primarySelection || primaryOptions[0].value}
        onChange={onPrimaryChange}
        enableVirtualScroll={true}
      />

      {/* 二级选择器（类型）- 当分类为"随机推荐"时不显示 */}
      {showTypeSelector && (
        <CapsuleSelector
          label='类型'
          options={secondaryOptions}
          value={secondarySelection || secondaryOptions[0]?.value || 'all'}
          onChange={onSecondaryChange}
          enableVirtualScroll={true}
        />
      )}
    </div>
  );
};

export default ShortDramaSelector;
