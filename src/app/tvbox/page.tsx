/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';
import VirtualDoubanGrid from '@/components/VirtualDoubanGrid';

import { DoubanItem } from '@/lib/types';

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
  douban_id?: number;
  rate?: string;
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

// ==================== 视频源选择器 ====================
function SourceSelector({
  sources,
  selectedSource,
  onSourceChange,
}: {
  sources: VideoSource[];
  selectedSource: string;
  onSourceChange: (sourceKey: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedSourceData = sources.find((s) => s.key === selectedSource);

  // 无可用视频源提示
  if (!sources || sources.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-yellow-800 dark:text-yellow-200">
          暂无可用视频源，请联系管理员配置权限
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 选择按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-64 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {selectedSourceData?.name || '选择视频源'}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉列表 */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
            {sources.map((source) => (
              <button
                key={source.key}
                onClick={() => {
                  onSourceChange(source.key);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  selectedSource === source.key
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="font-medium">{source.name}</div>
                {source.detail && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{source.detail}</div>
                )}
              </button>
            ))}
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
  selectedPrimary: number;
  selectedSecondary: number;
  onPrimaryChange: (categoryId: number) => void;
  onSecondaryChange: (categoryId: number) => void;
}) {
  // ------------------- 主分类指示器相关 -------------------
  const primaryContainerRef = useRef<HTMLDivElement>(null); // 主分类容器 ref
  const primaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]); // 每个主分类按钮 ref
  const [primaryIndicatorStyle, setPrimaryIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 8 });

  // ------------------- 二级分类指示器相关 -------------------
  const secondaryContainerRef = useRef<HTMLDivElement>(null); // 二级分类容器 ref
  const secondaryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]); // 每个二级分类按钮 ref
  const [secondaryIndicatorStyle, setSecondaryIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 8 });

  // ------------------- 更新指示器位置 -------------------
  const updateIndicatorPosition = (
    activeIndex: number,
    containerRef: React.RefObject<HTMLDivElement>,
    buttonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    setIndicatorStyle: React.Dispatch<React.SetStateAction<{ left: number; width: number }>>
  ) => {
    if (activeIndex >= 0 && buttonRefs.current[activeIndex] && containerRef.current) {
      // 延迟执行，保证 DOM 更新完成
      setTimeout(() => {
        const button = buttonRefs.current[activeIndex];
        const container = containerRef.current;
        if (button && container) {
          const buttonRect = button.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          // 设置指示器 left 和 width，实现滑动动画效果
          setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
          });
        }
      }, 0);
    }
  };

  // ------------------- 渲染胶囊选择器 -------------------
  const renderCapsuleSelector = (
    options: Category[],
    activeValue: number,
    onChange: (value: number) => void,
    isPrimary = false
  ) => {
    const containerRef = isPrimary ? primaryContainerRef : secondaryContainerRef;
    const buttonRefs = isPrimary ? primaryButtonRefs : secondaryButtonRefs;
    const indicatorStyle = isPrimary ? primaryIndicatorStyle : secondaryIndicatorStyle;

    return (
      <div
        ref={containerRef}
        className="relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm overflow-x-auto"
      >
        {/* 背景指示器 */}
        {indicatorStyle.width > 0 && (
          <div
            className="absolute top-1 bottom-1 bg-white dark:bg-gray-600 rounded-full shadow-sm transition-all duration-300 ease-out"
            style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
          />
        )}

        {/* 分类按钮 */}
        {options.map((category, index) => {
          const isActive = activeValue === category.type_id;
          return (
            <button
              key={category.type_id}
              ref={(el) => { buttonRefs.current[index] = el ?? null; }}
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
  const getSecondaryCategories = (primaryId: number) => {
    if (primaryId === 0) return []; // “全部”不显示二级分类
    return categories.secondary_categories.filter(cat => cat.type_pid === primaryId); // 获取对应二级分类
  };

  // 如果一级分类不是“全部”，二级分类显示真实分类
  const secondaryOptions = selectedPrimary === 0
    ? []
    : getSecondaryCategories(selectedPrimary);

  // ------------------- 初始化/更新指示器 -------------------
  useEffect(() => {
    const options = [{ type_id: 0, type_pid: 0, type_name: '全部' }, ...categories.primary_categories];
    const activeIndex = options.findIndex(cat => cat.type_id === selectedPrimary);
    updateIndicatorPosition(activeIndex >= 0 ? activeIndex : 0, primaryContainerRef, primaryButtonRefs, setPrimaryIndicatorStyle);
  }, [categories.primary_categories, selectedPrimary]);

  useEffect(() => {
    const activeIndex = secondaryOptions.findIndex(cat => cat.type_id === selectedSecondary);
    if (secondaryOptions.length > 0) {
      updateIndicatorPosition(activeIndex >= 0 ? activeIndex : 0, secondaryContainerRef, secondaryButtonRefs, setSecondaryIndicatorStyle);
    }
  }, [secondaryOptions, selectedSecondary]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 一级分类 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]">类型</span>
        {renderCapsuleSelector(
          [{ type_id: 0, type_pid: 0, type_name: '全部' }, ...categories.primary_categories],
          selectedPrimary,
          onPrimaryChange,
          true
        )}
      </div>

      {/* 二级分类（仅一级非“全部”时显示） */}
      {secondaryOptions.length > 0 && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]">分类</span>
          {renderCapsuleSelector(
            secondaryOptions,
            selectedSecondary,
            onSecondaryChange,
            false
          )}
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
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center space-x-2 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600"
      >
        <ChevronLeft size={20} />
      </button>

      <span className="text-sm text-gray-600 dark:text-gray-400">
        第 {currentPage} 页 / 共 {totalPages} 页
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-600"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// ==================== 视频列表 ====================
function VideoList({ videos, loading }: { videos: VideoItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-gray-300 dark:bg-gray-700 rounded-lg aspect-video mb-3"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">🎬</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无视频内容</h3>
        <p className="text-gray-500 dark:text-gray-400">当前分类没有可用的视频内容</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => {
        const episodes = video.episodes?.length || 0;
        return (
          <VideoCard
            key={video.id}
            id={video.id}
            title={video.title}
            poster={video.poster || ''}
            episodes={episodes}
            from="search"
            type={episodes === 1 ? 'movie' : 'tv'}
            isAggregate={episodes > 1}
            source={video.source || '未知源'}
            source_name={video.source_name || video.source || '未知源'}
            source_names={episodes > 1 ? video.episodes : undefined}
            currentEpisode={0}
            douban_id={video.douban_id}
            onDelete={() => void 0}
          />
        );
      })}
    </div>
  );
}

// ==================== 映射函数 ====================
function toDoubanItem(v: VideoItem): DoubanItem {
  return {
    id: v.douban_id?.toString() || v.id,
    title: v.title || '',
    poster: v.poster || '',
    rate: v.rate?.toString() || '0',
    year: v.year || '',
  };
}

// ==================== 主组件 ====================
export default function TVBoxPage() {
  const { siteName } = useSite();
  const [sourceList, setSourceList] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [categories, setCategories] = useState<CategoryStructure>({
    primary_categories: [],
    secondary_categories: [],
    category_map: {}
  });
  const [selectedPrimary, setSelectedPrimary] = useState(0);
  const [selectedSecondary, setSelectedSecondary] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasMore = currentPage < totalPages;

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

  // ==================== 滚动加载更多（非虚拟化模式） ====================
  useEffect(() => {
    if (useVirtualization) return;
    if (!hasMore || isLoadingMore || loading) return;
    if (!loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoadingMore, loading, useVirtualization]);

  // ==================== 获取视频源 ====================
  useEffect(() => {
    const fetchSources = async () => {
      try {
        setSourcesLoading(true);
        const res = await fetch('/api/tvbox/video-sources');
        if (!res.ok) throw new Error('获取视频源失败');
        const data = await res.json();
        const arraySources = Object.entries(data).map(([key, value]: any) => ({
          key,
          ...value,
        }));
        setSourceList(arraySources);
        if (arraySources.length > 0) setSelectedSource(arraySources[0].key);
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
  useEffect(() => {
    if (!selectedSource) return;

    const fetchVideos = async () => {
      setIsLoadingMore(currentPage > 1);
      setLoading(currentPage === 1);

      try {
        // 构建请求参数
        const params = new URLSearchParams({ 
          source: selectedSource, 
          page: currentPage.toString(),
        });

        // 分类筛选逻辑
        if (selectedSecondary > 0) {
          params.append('category', selectedSecondary.toString());
        } else if (selectedPrimary > 0) {
          params.append('category', selectedPrimary.toString());
        }

        const res = await fetch(`/api/tvbox/videos?${params.toString()}`);
        if (!res.ok) throw new Error('加载视频失败');

        const data: ApiResponse = await res.json();

        const newVideos = data.list || [];
        const newDoubanData = newVideos.map(toDoubanItem);

        if (currentPage === 1) {
          setVideos(newVideos);
          setDoubanData(newDoubanData);
        } else {
          setVideos(prev => [...prev, ...newVideos]);
          setDoubanData(prev => [...prev, ...newDoubanData]);
        }

        setCategories(data.categories || { primary_categories: [], secondary_categories: [], category_map: {} });
        setTotalPages(data.pagecount || 1);
      } catch (err: any) {
        console.error('加载视频错误:', err);
        setError(err.message || '加载视频失败');
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };

    fetchVideos();
  }, [selectedSource, currentPage, selectedPrimary, selectedSecondary]);

  // ==================== 事件处理 ====================
  const handleSourceChange = (key: string) => {
    setSelectedSource(key);
    setCurrentPage(1);
    setSelectedPrimary(0);
    setSelectedSecondary(0);
  };

  const handlePrimaryChange = (id: number) => {
    setSelectedPrimary(id);
    setCurrentPage(1);

  const secondaries = id === 0 ? [] : categories.secondary_categories.filter(cat => cat.type_pid === id);
  setSelectedSecondary(secondaries.length > 0 ? secondaries[0].type_id : 0);
  };

  const handleSecondaryChange = (id: number) => {
    setSelectedSecondary(id);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo(0, 0); 
  };

  // ==================== 渲染 ====================
  if (error) {
    return (
      <PageLayout activePath="/tvbox">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">出错了</h2>
            <p className="mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              重新加载
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (sourcesLoading) {
    return (
      <PageLayout activePath="/tvbox">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4">加载视频源中...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath="/tvbox">
      <div className="px-4 sm:px-10 py-4 sm:py-8 overflow-visible">
        {/* 页面标题 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200">TVBox 视频库</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          来自不同视频源的内容
        </p>

        {/* 视频源选择器 */}
        <div className="mb-6">
          <SourceSelector
            sources={sourceList}
            selectedSource={selectedSource}
            onSourceChange={handleSourceChange}
          />
        </div>

        {/* 分类筛选器 */}
        <div className="bg-white/60 dark:bg-gray-800/40 rounded-2xl p-4 sm:p-6 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm">
          <CategoryFilter
            categories={categories}
            selectedPrimary={selectedPrimary}
            selectedSecondary={selectedSecondary}
            onPrimaryChange={handlePrimaryChange}
            onSecondaryChange={handleSecondaryChange}
          />
        </div>

        {/* 虚拟化开关 */}
        <div className="flex justify-end mb-6 mt-5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">虚拟滑动</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useVirtualization}
                onChange={toggleVirtualization}
              />
              <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-500 transition-colors dark:bg-gray-600"></div>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
          </label>
        </div>

        {/* 内容展示 */}
        {useVirtualization ? (
          <div className="max-w-[95%] mx-auto mt-8 overflow-visible">
            <VirtualDoubanGrid
              doubanData={doubanData}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={() => setCurrentPage(prev => prev + 1)}
              loading={loading}
              type={videos.length > 0 ? (videos[0].episodes?.length === 1 ? 'movie' : 'tv') : 'tv'}
            />
          </div>
        ) : (
          <>
            <VideoList videos={videos} loading={loading} />
            {hasMore && (
              <div ref={loadingRef} className="flex justify-center py-4">
                {isLoadingMore ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                ) : (
                  <div className="h-6"></div>
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
    </PageLayout>
  );
}

