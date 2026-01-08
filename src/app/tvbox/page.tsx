/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UnifiedVideoItem } from '@/lib/types';

import FloatingTools from '@/components/FloatingTools';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';
import VirtualVideoGrid from '@/components/VirtualVideoGrid';

// ==================== 类型定义 ====================
interface VideoSource {
  key: string;
  name: string;
  api: string;
  detail?: string;
}

interface VideoItem {
  id: string;
  title: string;
  poster?: string;
  episodes?: string[];
  episodes_titles?: string[];
  source?: string;
  source_name?: string;
  class?: string;
  year?: string;
  desc?: string;
  type_name?: string;
  type?: string; // 内容类型，由 TypeInferenceService 推断
  douban_id?: number;
  rate?: string;
  inferredType?: 'movie' | 'tv' | 'anime' | 'variety' | 'shortdrama';
}

interface Category {
  type_id: number;
  type_pid: number;
  type_name: string;
}

interface CategoryStructure {
  primary_categories: Category[];
  secondary_categories: Category[];
  category_map: Record<number, Category>;
}

interface ApiResponse {
  list: VideoItem[];
  categories: CategoryStructure;
  pagecount: number;
}

// ==================== 视频源选择器（带搜索） ====================
function SourceSelector({
  sources,
  selectedSource,
  onSourceChange,
  onSearch,
  loading,
}: {
  sources: VideoSource[];
  selectedSource: string;
  onSourceChange: (sourceKey: string) => void;
  onSearch: (keyword: string) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debounceId, setDebounceId] = useState<NodeJS.Timeout | null>(null);
  const selectedSourceData = sources.find((s) => s.key === selectedSource);

  // 无可用视频源提示
  if (!sources || sources.length === 0) {
    return (
      <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
        <p className='text-yellow-800 dark:text-yellow-200'>
          暂无可用视频源，请联系管理员配置权限
        </p>
      </div>
    );
  }

  const handleSearch = () => {
    if (searchKeyword.trim()) {
      onSearch(searchKeyword.trim());
      setIsSearchMode(false);
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    onSearch('');
    setIsSearchMode(false);
  };

  // 搜索防抖：500ms 后自动触发搜索
  const handleSearchInputChange = (value: string) => {
    setSearchKeyword(value);

    // 清除之前的防抖定时器
    if (debounceId) {
      clearTimeout(debounceId);
    }

    // 设置新的防抖定时器
    const newDebounceId = setTimeout(() => {
      if (value.trim()) {
        onSearch(value.trim());
      }
    }, 500);

    setDebounceId(newDebounceId);
  };

  // 组件卸载时清除防抖定时器
  useEffect(() => {
    return () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
    };
  }, [debounceId]);

  return (
    <div className='relative max-w-3xl'>
      {!isSearchMode ? (
        // 源选择模式
        <div className='flex items-center gap-3'>
          {/* 选择按钮 */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className='w-64 flex items-center justify-between px-5 py-3 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200'
          >
            <span className='text-sm font-semibold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent'>
              {selectedSourceData?.name || '选择视频源'}
            </span>
            <ChevronDown
              size={18}
              className={`text-blue-500 dark:text-blue-400 transition-transform duration-300 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* 搜索图标按钮 */}
          <button
            onClick={() => setIsSearchMode(true)}
            className='flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200'
            title='搜索'
          >
            <Search size={20} className='text-white' />
          </button>
        </div>
      ) : (
        // 搜索模式
        <div className='flex items-center gap-2'>
          {/* 返回按钮 */}
          <button
            onClick={() => {
              setIsSearchMode(false);
              setSearchKeyword('');
            }}
            className='flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0'
            title='返回'
          >
            <ChevronLeft size={20} className='text-gray-500' />
          </button>

          {/* 搜索框容器 */}
          <div className='flex-1 flex items-center gap-2'>
            {/* 输入框容器 */}
            <div className='flex-1 flex items-center bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-md overflow-hidden'>
              <div className='pl-4 text-blue-500 dark:text-blue-400 flex-shrink-0'>
                <Search size={18} />
              </div>
              <input
                type='text'
                value={searchKeyword}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                placeholder={`在 ${selectedSourceData?.name} 中搜索...`}
                className='flex-1 h-12 px-3 bg-transparent text-gray-900 dark:text-gray-100 border-0 outline-none focus:ring-0 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500'
                style={{ boxShadow: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // 回车立即搜索，清除防抖
                    if (debounceId) {
                      clearTimeout(debounceId);
                    }
                    handleSearch();
                  }
                  if (e.key === 'Escape') {
                    handleClearSearch();
                  }
                }}
                autoFocus
              />
              {searchKeyword && (
                <button
                  onClick={handleClearSearch}
                  className='px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0'
                  title='清除 (Esc)'
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 搜索按钮 - 独立 */}
            <button
              onClick={handleSearch}
              disabled={loading || !searchKeyword.trim()}
              className='h-12 px-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md transition-all text-sm font-semibold flex-shrink-0'
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>
      )}

      {/* 下拉列表 - 响应式网格布局 */}
      {isOpen && !isSearchMode && (
        <>
          <div
            className='fixed inset-0 z-10'
            onClick={() => setIsOpen(false)}
          />
          <div className='absolute top-full left-0 right-0 sm:right-auto mt-2 bg-white/80 dark:bg-gray-800/80 border border-gray-200/30 dark:border-gray-600/30 rounded-xl shadow-2xl z-20 max-h-[420px] sm:max-h-[450px] overflow-hidden backdrop-blur-2xl sm:w-auto sm:min-w-[480px] sm:max-w-[650px]'>
            <div className='overflow-y-auto max-h-[420px] sm:max-h-[450px] p-2 sm:p-2.5'>
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2'>
                {sources
                  .filter((source) => source.key && source.name)
                  .map((source) => (
                    <button
                      key={source.key}
                      onClick={() => {
                        onSourceChange(source.key);
                        setIsOpen(false);
                      }}
                      className={`relative p-2 sm:p-2.5 rounded-lg transition-all duration-200 group text-left ${
                        selectedSource === source.key
                          ? 'bg-gradient-to-br from-blue-500/90 via-indigo-500/90 to-purple-500/90 border-2 border-blue-400/80 shadow-lg shadow-blue-500/30'
                          : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gradient-to-br hover:from-blue-500/80 hover:via-indigo-500/80 hover:to-purple-500/80 hover:border-blue-400/60 hover:shadow-md'
                      }`}
                    >
                      {/* 选中角标 */}
                      {selectedSource === source.key && (
                        <div className='absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md'>
                          <svg
                            className='w-2 h-2 sm:w-2.5 sm:h-2.5 text-blue-600 dark:text-blue-400'
                            fill='currentColor'
                            viewBox='0 0 20 20'
                          >
                            <path
                              fillRule='evenodd'
                              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </div>
                      )}

                      {/* 图标和文字 */}
                      <div className='flex items-center gap-1.5 sm:gap-2'>
                        <div
                          className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center transition-all duration-200 ${
                            selectedSource === source.key
                              ? 'bg-white/30 dark:bg-gray-800/30'
                              : 'bg-gray-100 dark:bg-gray-600 group-hover:bg-white/30 dark:group-hover:bg-gray-800/30'
                          }`}
                        >
                          <svg
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                              selectedSource === source.key
                                ? 'text-white'
                                : 'text-gray-600 dark:text-gray-300 group-hover:text-white'
                            }`}
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2.5}
                              d='M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z'
                            />
                          </svg>
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div
                            className={`font-semibold text-[11px] sm:text-xs leading-tight transition-colors line-clamp-2 ${
                              selectedSource === source.key
                                ? 'text-white drop-shadow-sm'
                                : 'text-gray-800 dark:text-gray-100 group-hover:text-white group-hover:drop-shadow-sm'
                            }`}
                            title={source.name}
                          >
                            {source.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== 分类筛选器 ====================
function CategoryFilter({
  categories,
  selectedPrimary,
  selectedSecondary,
  onPrimaryChange,
  onSecondaryChange,
}: {
  categories: CategoryStructure;
  selectedPrimary: number | null;
  selectedSecondary: number | null;
  onPrimaryChange: (categoryId: number) => void;
  onSecondaryChange: (categoryId: number) => void;
}) {
  // ------------------- 主分类指示器相关 -------------------
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const primaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [primaryIndicatorStyle, setPrimaryIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // ------------------- 二级分类指示器相关 -------------------
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [secondaryIndicatorStyle, setSecondaryIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // ------------------- 更新指示器位置（优化版）-------------------
  const updateIndicatorPosition = (
    activeIndex: number,
    containerRef: React.RefObject<HTMLDivElement>,
    buttonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    setIndicatorStyle: React.Dispatch<
      React.SetStateAction<{ transform: string; width: string }>
    >,
  ) => {
    if (
      activeIndex < 0 ||
      !buttonRefs.current[activeIndex] ||
      !containerRef.current
    ) {
      return;
    }

    // 使用 requestAnimationFrame 确保在正确的时机更新
    requestAnimationFrame(() => {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (!button || !container) return;

      const buttonRect = button.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // 计算相对位置
      const left = buttonRect.left - containerRect.left;
      const width = buttonRect.width;

      // 使用 transform 代替 left，GPU加速
      setIndicatorStyle({
        transform: `translateX(${left}px)`,
        width: `${width}px`,
      });
    });
  };

  // ------------------- 渲染胶囊选择器 -------------------
  const renderCapsuleSelector = (
    options: Category[],
    activeValue: number | null,
    onChange: (value: number) => void,
    isPrimary = false,
  ) => {
    const containerRef = isPrimary
      ? primaryContainerRef
      : secondaryContainerRef;
    const buttonRefs = isPrimary ? primaryButtonRefs : secondaryButtonRefs;
    const indicatorStyle = isPrimary
      ? primaryIndicatorStyle
      : secondaryIndicatorStyle;

    return (
      <div
        ref={containerRef}
        className='relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm overflow-x-auto'
      >
        {/* 背景指示器 - 使用 transform 优化性能 */}
        {indicatorStyle.width !== '0px' && (
          <div
            className='absolute top-1 bottom-1 left-0 bg-white dark:bg-gray-600 rounded-full shadow-sm will-change-transform'
            style={{
              transform: indicatorStyle.transform,
              width: indicatorStyle.width,
              transition: 'transform 300ms ease-out, width 300ms ease-out',
            }}
          />
        )}

        {/* 分类按钮 */}
        {options.map((category, index) => {
          const isActive = activeValue === category.type_id;
          return (
            <button
              key={category.type_id}
              ref={(el) => {
                buttonRefs.current[index] = el ?? null;
              }}
              onClick={() => onChange(category.type_id)}
              className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 flex-shrink-0 ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              {category.type_name}
            </button>
          );
        })}
      </div>
    );
  };

  // ------------------- 获取二级分类 -------------------
  const getSecondaryCategories = (primaryId: number | null) => {
    if (primaryId === 0) {
      return [];
    } // “全部”不显示二级分类
    return categories.secondary_categories.filter(
      (cat) => cat.type_pid === primaryId,
    ); // 获取对应二级分类
  };

  // 如果一级分类不是"全部"，二级分类显示真实分类
  const secondaryOptions = useMemo(
    () =>
      selectedPrimary === 0 ? [] : getSecondaryCategories(selectedPrimary),
    [selectedPrimary, categories.secondary_categories, getSecondaryCategories],
  );

  // ------------------- 初始化/更新指示器 -------------------
  useEffect(() => {
    const options = categories.primary_categories;
    const activeIndex = options.findIndex(
      (cat) => cat.type_id === selectedPrimary,
    );
    updateIndicatorPosition(
      activeIndex >= 0 ? activeIndex : 0,
      primaryContainerRef,
      primaryButtonRefs,
      setPrimaryIndicatorStyle,
    );
  }, [categories.primary_categories, selectedPrimary]);

  useEffect(() => {
    const activeIndex = secondaryOptions.findIndex(
      (cat) => cat.type_id === selectedSecondary,
    );
    if (secondaryOptions.length > 0) {
      updateIndicatorPosition(
        activeIndex >= 0 ? activeIndex : 0,
        secondaryContainerRef,
        secondaryButtonRefs,
        setSecondaryIndicatorStyle,
      );
    }
  }, [secondaryOptions, selectedSecondary]);

  return (
    <div className='space-y-3 sm:space-y-4'>
      {/* 一级分类 */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
        <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
          类型
        </span>
        <div className='overflow-x-auto'>
          {renderCapsuleSelector(
            categories.primary_categories || [],
            selectedPrimary,
            onPrimaryChange,
            true,
          )}
        </div>
      </div>

      {/* 二级分类（仅一级非“全部”时显示） */}
      {secondaryOptions.length > 0 && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
            分类
          </span>
          <div className='overflow-x-auto'>
            {renderCapsuleSelector(
              secondaryOptions,
              selectedSecondary,
              onSecondaryChange,
              false,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 分页 ====================
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className='flex justify-center items-center space-x-2 mt-8'>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className='p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600'
      >
        <ChevronLeft size={20} />
      </button>

      <span className='text-sm text-gray-600 dark:text-gray-400'>
        第 {currentPage} 页 / 共 {totalPages} 页
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className='p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600'
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// ==================== 类型推断已在服务端完成 ====================
// 不再需要前端推断类型，服务端已通过 inferVideoTypeFromCategory 完成

// ==================== 视频列表 ====================
function VideoList({
  videos,
  loading,
}: {
  videos: UnifiedVideoItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className='grid grid-cols-2 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className='animate-pulse'>
            <div className='bg-gray-300 dark:bg-gray-700 rounded-lg aspect-video mb-3'></div>
            <div className='h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2'></div>
            <div className='h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3'></div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='text-gray-400 dark:text-gray-500 text-6xl mb-4'>🎬</div>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
          暂无视频内容
        </h3>
        <p className='text-gray-500 dark:text-gray-400'>
          当前分类没有可用的视频内容
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-2 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          id={video.videoId || video.id}
          title={video.title}
          poster={video.poster || ''}
          episodes={video.episodes || 0}
          from='douban'
          type={video.type}
          isAggregate={false}
          source={video.source || '未知源'}
          source_name={video.source_name || video.source || '未知源'}
          currentEpisode={0}
          douban_id={video.douban_id}
          onDelete={() => void 0}
        />
      ))}
    </div>
  );
}

// ==================== 映射函数 ====================
function toUnifiedVideoItem(v: VideoItem): UnifiedVideoItem {
  return {
    id: v.douban_id?.toString() || v.id,
    title: v.title || '',
    poster: v.poster || '',
    rate: v.rate?.toString() || '',
    year: v.year || '',
    episodes: v.episodes?.length || 0,
    type:
      (v.type as 'movie' | 'tv' | 'anime' | 'variety' | 'shortdrama') || 'tv', // 使用API推断的类型
    source: v.source,
    videoId: v.id,
    source_name: v.source_name,
    douban_id: v.douban_id, // 添加豆瓣ID
  };
}

// ==================== 主组件 ====================
export default function TVBoxPage() {
  const { siteName: _siteName } = useSite();
  const [sourceList, setSourceList] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [rawVideos, setRawVideos] = useState<VideoItem[]>([]);
  const [videos, setVideos] = useState<UnifiedVideoItem[]>([]);
  const [categories, setCategories] = useState<CategoryStructure>({
    primary_categories: [],
    secondary_categories: [],
    category_map: {},
  });
  const [selectedPrimary, setSelectedPrimary] = useState<number | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const virtualGridRef = useRef<any>(null);
  const hasMore = currentPage < totalPages;
  const lastSourceRef = useRef<string>('');
  const lastFetchAtRef = useRef<number>(0); // 记录上次加载时间，用于节流

  const [useVirtualization, setUseVirtualization] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('useTVBoxVirtualization');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const toggleVirtualization = () => {
    const newValue = !useVirtualization;
    setUseVirtualization(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('useTVBoxVirtualization', JSON.stringify(newValue));
    }
  };

  // 稳定的加载更多回调函数
  const handleLoadMore = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  // ==================== 滚动加载更多（非虚拟化模式） ====================
  useEffect(() => {
    if (useVirtualization) {
      return;
    }
    if (!hasMore || isLoadingMore || loading) {
      return;
    }
    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const now = Date.now();
          const intervalOk = now - lastFetchAtRef.current > 700; // 700ms 节流

          if (intervalOk) {
            lastFetchAtRef.current = now;
            setCurrentPage((prev) => prev + 1);
          }
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading, useVirtualization]);

  // ==================== 获取视频源 ====================
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setSourcesLoading(true);
        const res = await fetch('/api/tvbox/video-sources');
        if (!res.ok) {
          throw new Error('获取视频源失败');
        }
        const data = await res.json();
        const arraySources = Object.entries(data)
          .map(([key, value]: any) => ({
            key,
            ...value,
          }))
          .filter((source) => source.key && source.name && source.api);
        setSourceList(arraySources);

        // 从 localStorage 获取上次选择的视频源
        if (arraySources.length > 0) {
          const savedSource = localStorage.getItem('tvbox-selected-source');
          if (savedSource && arraySources.some((s) => s.key === savedSource)) {
            setSelectedSource(savedSource);
          } else {
            setSelectedSource(arraySources[0].key);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || '获取视频源失败');
      } finally {
        setSourcesLoading(false);
      }
    };
    fetchSources();
  }, []);

  // ==================== 加载视频列表 ====================
  const fetchContent = useCallback(async () => {
    if (!selectedSource) {
      return;
    }

    setIsLoadingMore(currentPage > 1);
    setLoading(currentPage === 1);

    try {
      let apiUrl: string;
      const params = new URLSearchParams({
        source: selectedSource,
        page: currentPage.toString(),
      });

      if (isSearchMode && searchKeyword) {
        // 搜索模式
        params.append('keyword', searchKeyword);
        apiUrl = `/api/tvbox/search?${params.toString()}`;
      } else {
        // 分类筛选模式 - 总是传递 category 参数
        if (selectedSecondary > 0) {
          params.append('category', selectedSecondary.toString());
        } else if (selectedPrimary && selectedPrimary > 0) {
          params.append('category', selectedPrimary.toString());
        }
        apiUrl = `/api/tvbox/videos?${params.toString()}`;
      }

      const res = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('🔴 TVBox API错误:', {
          status: res.status,
          statusText: res.statusText,
          error: errorData.error || '加载视频失败',
          apiUrl,
          errorData,
        });
        throw new Error(errorData.error || '加载视频失败');
      }

      const data: ApiResponse & { fromCache?: boolean } = await res.json();

      const newRawVideos = data.list || [];
      const newVideos = newRawVideos.map((v) => toUnifiedVideoItem(v));

      if (currentPage === 1) {
        setRawVideos(newRawVideos);
        setVideos(newVideos);
        setFromCache(!!data.fromCache);
      } else {
        setRawVideos((prev) => [...prev, ...newRawVideos]);
        setVideos((prev) => [...prev, ...newVideos]);
      }

      // 只在非搜索模式下更新分类信息
      if (!isSearchMode) {
        const newCategories = data.categories || {
          primary_categories: [],
          secondary_categories: [],
          category_map: {},
        };

        // 只在视频源切换时更新分类，避免无限循环
        if (selectedSource !== lastSourceRef.current) {
          setCategories(newCategories);
          lastSourceRef.current = selectedSource;

          // 如果还没有选中分类，或者选中的分类不在新数据中，选中第一个分类
          const shouldSelectFirst =
            selectedPrimary === null ||
            !newCategories.primary_categories.some(
              (cat) => cat.type_id === selectedPrimary,
            );

          if (
            shouldSelectFirst &&
            newCategories.primary_categories.length > 0
          ) {
            const firstCategory = newCategories.primary_categories[0];
            setSelectedPrimary(firstCategory.type_id);

            // 自动选中第一个二级分类（如果有）
            const secondaries = newCategories.secondary_categories.filter(
              (cat) => cat.type_pid === firstCategory.type_id,
            );
            setSelectedSecondary(
              secondaries.length > 0 ? secondaries[0].type_id : 0,
            );
          } else if (selectedPrimary && selectedPrimary > 0) {
            // 如果一级分类存在但二级分类不存在，重置二级分类
            const secondaries = newCategories.secondary_categories.filter(
              (cat) => cat.type_pid === selectedPrimary,
            );
            setSelectedSecondary(
              secondaries.length > 0 ? secondaries[0].type_id : 0,
            );
          }
        }
      }

      setTotalPages(data.pagecount || 1);
    } catch (err: any) {
      console.error('加载视频错误:', err);
      setError(err.message || '加载视频失败');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      // 更新最后加载时间，用于节流控制
      lastFetchAtRef.current = Date.now();
    }
  }, [
    selectedSource,
    currentPage,
    selectedPrimary,
    selectedSecondary,
    isSearchMode,
    searchKeyword,
  ]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // ==================== 事件处理 ====================
  const handleSourceChange = (key: string) => {
    setSelectedSource(key);
    setCurrentPage(1);
    setSelectedPrimary(null); // 将在选择分类时设置
    setSelectedSecondary(0);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);

    // 保存选择的视频源到 localStorage
    localStorage.setItem('tvbox-selected-source', key);
  };

  const handlePrimaryChange = (id: number) => {
    setSelectedPrimary(id);
    setCurrentPage(1);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);

    const secondaries = categories.secondary_categories.filter(
      (cat) => cat.type_pid === id,
    );
    setSelectedSecondary(secondaries.length > 0 ? secondaries[0].type_id : 0);
  };

  const handleSecondaryChange = (id: number) => {
    setSelectedSecondary(id);
    setCurrentPage(1);
    setIsSearchMode(false);
    setSearchKeyword('');
    setFromCache(false);
  };

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    setIsSearchMode(!!keyword);
    setCurrentPage(1);
    setFromCache(false);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) {
      return;
    }
    setCurrentPage(page);
    setFromCache(false);
    window.scrollTo(0, 0);
  };

  // ==================== 渲染 ====================
  if (error) {
    return (
      <PageLayout activePath='/tvbox'>
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='text-red-500 text-6xl mb-4'>⚠️</div>
            <h2 className='text-xl font-semibold mb-2'>出错了</h2>
            <p className='mb-4'>{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchContent();
              }}
              className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200'
            >
              重新加载
            </button>
            <button
              onClick={() => window.location.reload()}
              className='ml-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200'
            >
              刷新页面
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (sourcesLoading) {
    return (
      <PageLayout activePath='/tvbox'>
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-4'>加载视频源中...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/tvbox'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题 */}
        <div className='mb-4'>
          <div className='flex items-center gap-2 mb-1 sm:mb-2'>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
              TVBox 视频库
            </h1>
            <Link
              href='/tvbox/config'
              className='flex items-center justify-center w-6 h-6 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200'
              title='TVBox 配置'
            >
              <Settings className='w-4 h-4' />
            </Link>
          </div>
          <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
            来自不同视频源的内容
          </p>
        </div>

        {/* 视频源选择器（带搜索） */}
        <div className='mb-6'>
          <SourceSelector
            sources={sourceList}
            selectedSource={selectedSource}
            onSourceChange={handleSourceChange}
            onSearch={handleSearch}
            loading={loading}
          />
        </div>

        {/* 分类筛选器（搜索模式下隐藏，且只在有分类数据时显示） */}
        {!isSearchMode && categories.primary_categories.length > 0 && (
          <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
            {/* 装饰性光晕 */}
            <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
            <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

            <div className='relative'>
              <CategoryFilter
                categories={categories}
                selectedPrimary={selectedPrimary}
                selectedSecondary={selectedSecondary}
                onPrimaryChange={handlePrimaryChange}
                onSecondaryChange={handleSecondaryChange}
              />
            </div>
          </div>
        )}

        {/* 搜索模式提示 */}
        {isSearchMode && (
          <div className='bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Search
                  size={16}
                  className='text-blue-600 dark:text-blue-400'
                />
                <div>
                  <h3 className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                    搜索: "{searchKeyword}"
                  </h3>
                  <p className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                    在 "{sourceList.find((s) => s.key === selectedSource)?.name}
                    " 中的搜索结果
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSearch('')}
                className='text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1'
              >
                <X size={14} />
                清除
              </button>
            </div>
          </div>
        )}

        {/* 缓存状态提示 */}
        {fromCache && (
          <div className='bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800'>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
              <div>
                <h3 className='text-sm font-medium text-green-900 dark:text-green-100'>
                  数据来自缓存
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* 内容展示 */}
        {useVirtualization ? (
          <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
            <VirtualVideoGrid
              ref={virtualGridRef}
              videos={videos}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              loading={loading}
            />
          </div>
        ) : (
          <>
            <VideoList videos={videos} loading={loading} />
            {hasMore && (
              <div ref={loadingRef} className='flex justify-center py-4'>
                {isLoadingMore ? (
                  <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
                ) : (
                  <div className='h-6'></div>
                )}
              </div>
            )}
          </>
        )}

        {!useVirtualization && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {/* 浮动工具组 */}
      <FloatingTools
        showAI={false} // tvbox页面不显示AI
        useVirtualization={useVirtualization}
        onToggleVirtualization={toggleVirtualization}
        showBackToTop={true}
        virtualGridRef={virtualGridRef}
      />
    </PageLayout>
  );
}
