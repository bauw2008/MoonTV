'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  EpisodeSkipConfig,
  getSkipConfig,
  saveSkipConfig,
  SkipSegment,
} from '@/lib/db.client';

interface MiniSkipSettingsProps {
  source: string;
  id: string;
  title: string;
  duration: number;
  currentTime: number;
  artPlayerRef: React.MutableRefObject<any>;
}

export default function MiniSkipSettings({
  source,
  id,
  title,
  duration,
  currentTime,
  artPlayerRef,
}: MiniSkipSettingsProps) {
  // 获取用户设置的辅助函数
  const getUserSettings = useCallback(() => {
    if (typeof window === 'undefined') {
      return { autoSkip: true, autoNextEpisode: true };
    }

    const savedEnableAutoSkip = localStorage.getItem('enableAutoSkip');
    const savedEnableAutoNextEpisode = localStorage.getItem(
      'enableAutoNextEpisode'
    );

    return {
      autoSkip:
        savedEnableAutoSkip !== null ? JSON.parse(savedEnableAutoSkip) : true,
      autoNextEpisode:
        savedEnableAutoNextEpisode !== null
          ? JSON.parse(savedEnableAutoNextEpisode)
          : true,
    };
  }, []);

  // 批量设置状态
  const [batchSettings, setBatchSettings] = useState(() => {
    const { autoSkip, autoNextEpisode } = getUserSettings();

    return {
      openingStart: '0:00',
      openingEnd: '1:30',
      endingMode: 'remaining',
      endingStart: '2:00',
      endingEnd: '',
      autoSkip,
      autoNextEpisode,
    };
  });

  // 监听用户设置变化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSettingsChange = () => {
      const { autoSkip, autoNextEpisode } = getUserSettings();
      setBatchSettings((prev) => ({ ...prev, autoSkip, autoNextEpisode }));
    };

    // 监听 storage 事件（其他标签页变化）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'enableAutoSkip' || e.key === 'enableAutoNextEpisode') {
        handleSettingsChange();
      }
    };

    // 监听自定义事件（同一页面内变化）
    const handleLocalSettingsChange = () => {
      handleSettingsChange();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChanged', handleLocalSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(
        'localStorageChanged',
        handleLocalSettingsChange
      );
    };
  }, [getUserSettings]);

  // 时间格式转换函数
  const timeToSeconds = useCallback((timeStr: string): number => {
    if (!timeStr || timeStr.trim() === '') return 0;

    // 支持多种格式: "2:10", "2:10.5", "130", "130.5"
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else {
      return parseFloat(timeStr) || 0;
    }
  }, []);

  const secondsToTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = seconds % 1;
    if (decimal > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${Math.floor(
        decimal * 10
      )}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 快速标记当前时间为片头结束
  const markCurrentAsOpeningEnd = useCallback(() => {
    if (!artPlayerRef.current) return;
    const currentTime = artPlayerRef.current.currentTime || 0;
    if (currentTime > 0) {
      setBatchSettings((prev) => ({
        ...prev,
        openingEnd: secondsToTime(currentTime),
      }));
      // 显示提示
      if (artPlayerRef.current.notice) {
        artPlayerRef.current.notice.show = `已标记片头结束: ${secondsToTime(
          currentTime
        )}`;
      }
    }
  }, [artPlayerRef, secondsToTime]);

  // 快速标记当前时间为片尾开始
  const markCurrentAsEndingStart = useCallback(() => {
    if (!artPlayerRef.current || !duration) return;
    const currentTime = artPlayerRef.current.currentTime || 0;

    if (batchSettings.endingMode === 'remaining') {
      // 剩余时间模式
      const remainingTime = duration - currentTime;
      if (remainingTime > 0) {
        setBatchSettings((prev) => ({
          ...prev,
          endingStart: secondsToTime(remainingTime),
        }));
        // 显示提示
        if (artPlayerRef.current.notice) {
          artPlayerRef.current.notice.show = `已标记片尾开始: 剩余${secondsToTime(
            remainingTime
          )}`;
        }
      }
    } else {
      // 绝对时间模式
      if (currentTime > 0) {
        setBatchSettings((prev) => ({
          ...prev,
          endingStart: secondsToTime(currentTime),
        }));
        // 显示提示
        if (artPlayerRef.current.notice) {
          artPlayerRef.current.notice.show = `已标记片尾开始: ${secondsToTime(
            currentTime
          )}`;
        }
      }
    }
  }, [artPlayerRef, duration, secondsToTime, batchSettings.endingMode]);

  // 保存批量设置的跳过配置
  const handleSaveBatchSettings = useCallback(async () => {
    const segments: SkipSegment[] = [];

    // 添加片头设置
    if (batchSettings.openingStart && batchSettings.openingEnd) {
      const start = timeToSeconds(batchSettings.openingStart);
      const end = timeToSeconds(batchSettings.openingEnd);

      if (start >= end) {
        alert('片头开始时间必须小于结束时间');
        return;
      }

      segments.push({
        start,
        end,
        type: 'opening',
        title: '片头',
        autoSkip: batchSettings.autoSkip,
      });
    }

    // 添加片尾设置
    if (batchSettings.endingStart) {
      const endingStartSeconds = timeToSeconds(batchSettings.endingStart);

      if (batchSettings.endingMode === 'remaining') {
        // 剩余时间模式：保存剩余时间信息
        let actualStartSeconds = duration - endingStartSeconds;

        if (actualStartSeconds < 0) {
          actualStartSeconds = 0;
        }

        segments.push({
          start: actualStartSeconds,
          end: batchSettings.endingEnd
            ? duration - timeToSeconds(batchSettings.endingEnd)
            : duration,
          type: 'ending',
          title: `剩余${batchSettings.endingStart}时跳转下一集`,
          autoSkip: batchSettings.autoSkip,
          autoNextEpisode: batchSettings.autoNextEpisode,
          mode: 'remaining',
          remainingTime: endingStartSeconds, // 保存剩余时间
        });
      } else {
        // 绝对时间模式
        const actualStartSeconds = endingStartSeconds;
        const actualEndSeconds = batchSettings.endingEnd
          ? timeToSeconds(batchSettings.endingEnd)
          : duration;

        if (actualStartSeconds >= actualEndSeconds) {
          alert('片尾开始时间必须小于结束时间');
          return;
        }

        segments.push({
          start: actualStartSeconds,
          end: actualEndSeconds,
          type: 'ending',
          title: '片尾',
          autoSkip: batchSettings.autoSkip,
          autoNextEpisode: batchSettings.autoNextEpisode,
          mode: 'absolute',
        });
      }
    }

    if (segments.length === 0) {
      alert('请至少设置片头或片尾时间');
      return;
    }

    try {
      const updatedConfig: EpisodeSkipConfig = {
        source,
        id,
        title,
        segments,
        updated_time: Date.now(),
      };

      await saveSkipConfig(source, id, updatedConfig);
      alert('跳过配置已保存');
    } catch (err) {
      console.error('保存跳过配置失败:', err);
      alert('保存失败，请重试');
    }
  }, [
    batchSettings,
    duration,
    source,
    id,
    title,
    timeToSeconds,
    secondsToTime,
  ]);

  // 加载现有配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getSkipConfig(source, id);
        if (config && config.segments && config.segments.length > 0) {
          // 找到片头和片尾片段
          const openingSegment = config.segments.find(
            (s) => s.type === 'opening'
          );
          const endingSegment = config.segments.find(
            (s) => s.type === 'ending'
          );

          // 只更新时间相关的字段，不更新 autoSkip 和 autoNextEpisode
          setBatchSettings((prev) => ({
            ...prev,
            openingStart: openingSegment
              ? secondsToTime(openingSegment.start)
              : prev.openingStart,
            openingEnd: openingSegment
              ? secondsToTime(openingSegment.end)
              : prev.openingEnd,
            endingStart: endingSegment
              ? endingSegment.mode === 'remaining' &&
                endingSegment.remainingTime
                ? secondsToTime(endingSegment.remainingTime)
                : duration > 0
                ? secondsToTime(duration - endingSegment.start)
                : prev.endingStart
              : prev.endingStart,
            endingEnd: endingSegment
              ? endingSegment.mode === 'remaining' &&
                endingSegment.end < duration &&
                duration > 0
                ? secondsToTime(duration - endingSegment.end)
                : ''
              : prev.endingEnd,
            endingMode:
              endingSegment?.mode === 'absolute' ? 'absolute' : 'remaining',
          }));
        }
      } catch (err) {
        console.error('加载跳过配置失败:', err);
      }
    };

    loadConfig();
  }, [source, id, duration, secondsToTime]);

  return (
    <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
      {/* 自动跳过设置 */}
      <div className='flex items-center justify-between'>
        <label className='flex items-center space-x-2'>
          <input
            type='checkbox'
            checked={batchSettings.autoSkip}
            onChange={(e) =>
              setBatchSettings({
                ...batchSettings,
                autoSkip: e.target.checked,
              })
            }
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500'
          />
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            自动跳过
          </span>
        </label>
      </div>

      {/* 片头时间设置 */}
      <div className='space-y-2'>
        <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          🎬 片头时间
        </div>
        <div className='flex items-center space-x-2'>
          <div className='flex-1'>
            <input
              type='text'
              value={batchSettings.openingStart}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  openingStart: e.target.value,
                })
              }
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
              placeholder='开始时间'
            />
          </div>
          <div className='flex-1'>
            <input
              type='text'
              value={batchSettings.openingEnd}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  openingEnd: e.target.value,
                })
              }
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
              placeholder='结束时间'
            />
          </div>
          <button
            onClick={markCurrentAsOpeningEnd}
            className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            title='标记当前时间为片头结束时间'
          >
            📍
          </button>
        </div>
      </div>

      {/* 自动下一集设置 */}
      <div className='flex items-center justify-between'>
        <label className='flex items-center space-x-2'>
          <input
            type='checkbox'
            checked={batchSettings.autoNextEpisode}
            onChange={(e) =>
              setBatchSettings({
                ...batchSettings,
                autoNextEpisode: e.target.checked,
              })
            }
            className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500'
          />
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            自动下一集
          </span>
        </label>
      </div>

      {/* 片尾时间设置 */}
      <div className='space-y-2'>
        <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          🎭 片尾时间
        </div>

        {/* 片尾模式选择 */}
        <div className='flex space-x-4'>
          <label className='flex items-center space-x-1'>
            <input
              type='radio'
              name='endingMode'
              value='remaining'
              checked={batchSettings.endingMode === 'remaining'}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  endingMode: e.target.value,
                })
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-sm text-gray-700 dark:text-gray-300'>
              剩余时间
            </span>
          </label>
          <label className='flex items-center space-x-1'>
            <input
              type='radio'
              name='endingMode'
              value='absolute'
              checked={batchSettings.endingMode === 'absolute'}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  endingMode: e.target.value,
                })
              }
              className='w-4 h-4 text-blue-600'
            />
            <span className='text-sm text-gray-700 dark:text-gray-300'>
              绝对时间
            </span>
          </label>
        </div>

        <div className='flex items-center space-x-2'>
          <div className='flex-1'>
            <input
              type='text'
              value={batchSettings.endingStart}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  endingStart: e.target.value,
                })
              }
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
              placeholder={
                batchSettings.endingMode === 'remaining'
                  ? '剩余时间'
                  : '开始时间'
              }
            />
          </div>
          <div className='flex-1'>
            <input
              type='text'
              value={batchSettings.endingEnd}
              onChange={(e) =>
                setBatchSettings({
                  ...batchSettings,
                  endingEnd: e.target.value,
                })
              }
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
              placeholder='结束时间（可选）'
            />
          </div>
          <button
            onClick={markCurrentAsEndingStart}
            className='px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors'
            title='标记当前时间为片尾开始时间'
          >
            📍
          </button>
        </div>
      </div>

      {/* 保存按钮 */}
      <button
        onClick={handleSaveBatchSettings}
        className='w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors'
      >
        保存设置
      </button>

      {/* 当前时间显示 */}
      <div className='text-xs text-gray-500 dark:text-gray-400'>
        当前时间: {secondsToTime(currentTime)} | 剩余:{' '}
        {secondsToTime(duration - currentTime)}
      </div>
    </div>
  );
}
