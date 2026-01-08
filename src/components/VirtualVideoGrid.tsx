/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import dynamic from 'next/dynamic';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

const Grid = dynamic(
  () => import('react-window').then((mod) => ({ default: mod.Grid })),
  {
    ssr: false,
    loading: () => (
      <div className='animate-pulse h-96 bg-gray-200 dark:bg-gray-800 rounded-lg' />
    ),
  },
);

import { UnifiedVideoItem } from '@/lib/types';
import { useImagePreload } from '@/hooks/useImagePreload';
import { useResponsiveGrid } from '@/hooks/useResponsiveGrid';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import VideoCard from '@/components/VideoCard';

export interface VirtualVideoGridRef {
  scrollToTop: () => void;
}

interface VirtualVideoGridProps {
  videos: UnifiedVideoItem[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
  isBangumi?: boolean;
}

const INITIAL_BATCH_SIZE = 25;
const LOAD_MORE_BATCH_SIZE = 25;
const LOAD_MORE_THRESHOLD = 3;

export const VirtualVideoGrid = React.forwardRef<
  VirtualVideoGridRef,
  VirtualVideoGridProps
>(
  (
    { videos, hasMore, isLoadingMore, onLoadMore, loading, isBangumi = false },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<any>(null);
    const { columnCount, itemWidth, itemHeight, containerWidth } =
      useResponsiveGrid(containerRef);

    const [visibleItemCount, setVisibleItemCount] =
      useState(INITIAL_BATCH_SIZE);
    const [isVirtualLoadingMore, setIsVirtualLoadingMore] = useState(false);

    const totalItemCount = videos.length;
    const displayItemCount = Math.min(visibleItemCount, totalItemCount);
    const displayData = videos.slice(0, displayItemCount);

    const imagesToPreload = useMemo(() => {
      const urls: string[] = [];
      const itemsToPreload = videos.slice(
        displayItemCount,
        Math.min(displayItemCount + 20, totalItemCount),
      );

      itemsToPreload.forEach((item) => {
        if (item.poster) {
          urls.push(item.poster);
        }
      });

      return urls;
    }, [videos, displayItemCount, totalItemCount]);

    useImagePreload(imagesToPreload, totalItemCount > 0);

    useEffect(() => {
      setVisibleItemCount(INITIAL_BATCH_SIZE);
      setIsVirtualLoadingMore(false);
    }, [videos]);

    useEffect(() => {
      if (gridRef.current?.scrollToCell && totalItemCount > 0 && !loading) {
        try {
          gridRef.current.scrollToCell({
            columnIndex: 0,
            rowIndex: 0,
            align: 'start',
            behavior: 'smooth',
          });
        } catch (error) {
          console.debug('Grid scroll error (safe to ignore):', error);
        }
      }
    }, [totalItemCount, loading]);

    useEffect(() => {
      if (containerRef.current) {
        // 触发响应式网格重新计算
      }
    }, [containerWidth]);

    const hasNextVirtualPage = displayItemCount < totalItemCount;
    const needsServerData =
      displayItemCount >= totalItemCount * 0.8 && hasMore && !isLoadingMore;

    const lastLoadMoreCallRef = useRef<number>(0);

    const loadMoreVirtualItems = useCallback(() => {
      if (isVirtualLoadingMore) {
        return;
      }

      setIsVirtualLoadingMore(true);

      setTimeout(() => {
        setVisibleItemCount((prev) => {
          const newCount = Math.min(
            prev + LOAD_MORE_BATCH_SIZE,
            totalItemCount,
          );

          if (newCount >= totalItemCount * 0.8 && hasMore && !isLoadingMore) {
            setTimeout(() => onLoadMore(), 0);
          }

          return newCount;
        });
        setIsVirtualLoadingMore(false);
      }, 100);
    }, [
      isVirtualLoadingMore,
      totalItemCount,
      hasMore,
      isLoadingMore,
      onLoadMore,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToTop: () => {
          if (gridRef.current?.scrollToCell) {
            try {
              gridRef.current.scrollToCell({
                columnIndex: 0,
                rowIndex: 0,
                align: 'start',
                behavior: 'smooth',
              });
            } catch (error) {
              console.debug(
                'Grid scroll to top error (safe to ignore):',
                error,
              );
            }
          }
        },
      }),
      [],
    );

    const rowCount = Math.ceil(displayItemCount / columnCount);
    const isSingleRow = rowCount === 1;

    const CellComponent = useCallback(
      ({
        ariaAttributes,
        columnIndex,
        rowIndex,
        style,
        displayData: cellDisplayData,
        isBangumi: cellIsBangumi,
        columnCount: cellColumnCount,
        displayItemCount: cellDisplayItemCount,
      }: any) => {
        const index = rowIndex * cellColumnCount + columnIndex;

        if (index >= cellDisplayItemCount) {
          return <div style={{ ...style, visibility: 'hidden' }} />;
        }

        const item = cellDisplayData[index];

        if (!item) {
          return <div style={{ ...style, visibility: 'hidden' }} />;
        }

        return (
          <div style={{ ...style, padding: '8px' }} {...ariaAttributes}>
            <VideoCard
              //from={item.source && item.videoId ? 'search' : 'douban'}
              from='douban'
              source={item.source || 'douban'}
              id={item.videoId || item.id}
              source_name={item.source_name || '豆瓣'}
              title={item.title}
              poster={item.poster}
              douban_id={item.douban_id}
              rate={item.rate}
              year={item.year}
              type={item.type}
              isBangumi={cellIsBangumi}
              episodes={item.episodes}
              isAggregate={false}
            />
          </div>
        );
      },
      [],
    );

    const skeletonData = Array.from({ length: 25 }, (_, index) => index);

    return (
      <div ref={containerRef} className='w-full'>
        {loading ? (
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
            {skeletonData.map((index) => (
              <DoubanCardSkeleton key={index} />
            ))}
          </div>
        ) : totalItemCount === 0 ? (
          <div className='flex justify-center py-16'>
            <div className='relative px-12 py-10 rounded-3xl bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800/40 dark:via-slate-800/40 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-sm overflow-hidden max-w-md'>
              <div className='absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl'></div>
              <div className='absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-200/20 to-orange-200/20 rounded-full blur-3xl'></div>

              <div className='relative flex flex-col items-center gap-4'>
                <div className='relative'>
                  <div className='w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-slate-200 dark:from-gray-700 dark:to-slate-700 flex items-center justify-center shadow-lg'>
                    <svg
                      className='w-12 h-12 text-gray-400 dark:text-gray-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='1.5'
                        d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
                      ></path>
                    </svg>
                  </div>
                  <div className='absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping'></div>
                  <div className='absolute -bottom-1 -left-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse'></div>
                </div>

                <div className='text-center space-y-2'>
                  <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    暂无相关内容
                  </h3>
                  <p className='text-sm text-gray-600 dark:text-gray-400 max-w-xs'>
                    尝试调整筛选条件或切换其他分类查看更多内容
                  </p>
                </div>

                <div className='w-16 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600 rounded-full'></div>
              </div>
            </div>
          </div>
        ) : containerWidth <= 100 ? (
          <div className='flex justify-center items-center h-40'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
            <span className='ml-2 text-sm text-gray-500'>
              初始化虚拟滑动... ({Math.round(containerWidth)}px)
            </span>
          </div>
        ) : (
          <Grid
            key={`grid-${containerWidth}-${columnCount}`}
            gridRef={gridRef}
            cellComponent={CellComponent}
            cellProps={{
              displayData,
              isBangumi,
              columnCount,
              displayItemCount,
            }}
            columnCount={columnCount}
            columnWidth={itemWidth}
            rowCount={rowCount}
            rowHeight={itemHeight}
            overscanCount={3}
            role='grid'
            aria-label={`视频列表，共${displayItemCount}个结果`}
            aria-rowcount={rowCount}
            aria-colcount={columnCount}
            style={{
              isolation: 'auto',
              scrollBehavior: 'smooth',
              ...(isSingleRow && {
                minHeight: itemHeight + 16,
                maxHeight: itemHeight + 32,
              }),
            }}
            onCellsRendered={(visibleCells, allCells) => {
              const { rowStopIndex: visibleRowStopIndex } = visibleCells;

              if (visibleRowStopIndex >= rowCount - LOAD_MORE_THRESHOLD) {
                if (hasNextVirtualPage && !isVirtualLoadingMore) {
                  loadMoreVirtualItems();
                } else if (needsServerData) {
                  const now = Date.now();
                  if (now - lastLoadMoreCallRef.current > 1000) {
                    lastLoadMoreCallRef.current = now;
                    onLoadMore();
                  }
                }
              }
            }}
          />
        )}

        {containerWidth > 100 && (isVirtualLoadingMore || isLoadingMore) && (
          <div className='flex justify-center mt-8 py-8'>
            <div className='relative px-8 py-4 rounded-2xl bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 border border-green-200/50 dark:border-green-700/50 shadow-lg backdrop-blur-sm overflow-hidden'>
              <div className='absolute inset-0 bg-gradient-to-r from-green-400/10 via-emerald-400/10 to-teal-400/10 animate-pulse'></div>

              <div className='relative flex items-center gap-3'>
                <div className='relative'>
                  <div className='animate-spin rounded-full h-8 w-8 border-3 border-green-200 dark:border-green-800'></div>
                  <div className='absolute inset-0 animate-spin rounded-full h-8 w-8 border-3 border-transparent border-t-green-500 dark:border-t-green-400'></div>
                </div>

                <div className='flex items-center gap-1'>
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    加载中
                  </span>
                  <span className='flex gap-0.5'>
                    <span
                      className='animate-bounce'
                      style={{ animationDelay: '0ms' }}
                    >
                      .
                    </span>
                    <span
                      className='animate-bounce'
                      style={{ animationDelay: '150ms' }}
                    >
                      .
                    </span>
                    <span
                      className='animate-bounce'
                      style={{ animationDelay: '300ms' }}
                    >
                      .
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {containerWidth > 100 &&
          !hasMore &&
          !hasNextVirtualPage &&
          displayItemCount > 0 && (
            <div className='flex justify-center mt-8 py-8'>
              <div className='relative px-8 py-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-700/50 shadow-lg backdrop-blur-sm overflow-hidden'>
                <div className='absolute inset-0 bg-gradient-to-br from-blue-100/20 to-purple-100/20 dark:from-blue-800/10 dark:to-purple-800/10'></div>

                <div className='relative flex flex-col items-center gap-2'>
                  <div className='relative'>
                    <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg'>
                      {isBangumi ? (
                        <svg
                          className='w-7 h-7 text-white'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          className='w-7 h-7 text-white'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2.5'
                            d='M5 13l4 4L19 7'
                          ></path>
                        </svg>
                      )}
                    </div>
                    <div className='absolute inset-0 rounded-full bg-blue-400/30 animate-ping'></div>
                  </div>

                  <div className='text-center'>
                    <p className='text-base font-semibold text-gray-800 dark:text-gray-200 mb-1'>
                      {isBangumi ? '本日番剧已全部显示' : '已加载全部内容'}
                    </p>
                    <p className='text-xs text-gray-600 dark:text-gray-400'>
                      {isBangumi
                        ? `今日共 ${displayItemCount} 部`
                        : `共 ${displayItemCount} 项`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  },
);

VirtualVideoGrid.displayName = 'VirtualVideoGrid';

export default VirtualVideoGrid;
