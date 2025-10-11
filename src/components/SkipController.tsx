/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteSkipConfig,
  EpisodeSkipConfig,
  getSkipConfig,
  saveSkipConfig,
  SkipSegment,
} from '@/lib/db.client';

interface SkipControllerProps {
  source: string;
  id: string;
  title: string;
  artPlayerRef: React.MutableRefObject<any>;
  currentTime?: number;
  duration?: number;
  isSettingMode?: boolean;
  onSettingModeChange?: (isOpen: boolean) => void;
  onNextEpisode?: () => void; // 新增：跳转下一集的回调
  showSettingsPanel?: boolean; // 新增：控制是否显示设置面板
}

export default function SkipController({
  source,
  id,
  title,
  artPlayerRef,
  currentTime = 0,
  duration = 0,
  isSettingMode = false,
  onSettingModeChange,
  onNextEpisode,
  showSettingsPanel = false, // 默认不显示设置面板
}: SkipControllerProps) {
  console.log('🎬 SkipController 渲染:', { source, id, title });
  const [skipConfig, setSkipConfig] = useState<EpisodeSkipConfig | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [currentSkipSegment, setCurrentSkipSegment] =
    useState<SkipSegment | null>(null);
  const [newSegment, setNewSegment] = useState<Partial<SkipSegment>>({});

  // 新增状态：批量设置模式 - 支持分:秒格式
  // 🔑 初始化时直接从 localStorage 读取用户设置，避免重新挂载时重置为默认值
  const [batchSettings, setBatchSettings] = useState(() => {
    const savedEnableAutoSkip =
      typeof window !== 'undefined'
        ? localStorage.getItem('enableAutoSkip')
        : null;
    const savedEnableAutoNextEpisode =
      typeof window !== 'undefined'
        ? localStorage.getItem('enableAutoNextEpisode')
        : null;
    const userAutoSkip =
      savedEnableAutoSkip !== null ? JSON.parse(savedEnableAutoSkip) : true;
    const userAutoNextEpisode =
      savedEnableAutoNextEpisode !== null
        ? JSON.parse(savedEnableAutoNextEpisode)
        : true;

    console.log('🎯 [useState初始化] localStorage原始值:', {
      savedEnableAutoSkip,
      savedEnableAutoNextEpisode,
    });
    console.log('🎯 [useState初始化] 解析后的值:', {
      userAutoSkip,
      userAutoNextEpisode,
    });

    return {
      openingStart: '0:00', // 片头开始时间（分:秒格式）
      openingEnd: '1:30', // 片头结束时间（分:秒格式，90秒=1分30秒）
      endingMode: 'remaining', // 片尾模式：'remaining'(剩余时间) 或 'absolute'(绝对时间)
      endingStart: '2:00', // 片尾开始时间（剩余时间模式：还剩多少时间开始倒计时；绝对时间模式：从视频开始多长时间）
      endingEnd: '', // 片尾结束时间（可选，空表示直接跳转下一集）
      autoSkip: userAutoSkip, // 🔑 从 localStorage 读取
      autoNextEpisode: userAutoNextEpisode, // 🔑 从 localStorage 读取
    };
  });

  // 🔑 从 localStorage 读取用户全局设置，并监听变化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 读取 localStorage 的函数
    const loadUserSettings = () => {
      const savedEnableAutoSkip = localStorage.getItem('enableAutoSkip');
      const savedEnableAutoNextEpisode = localStorage.getItem(
        'enableAutoNextEpisode'
      );
      const userAutoSkip =
        savedEnableAutoSkip !== null ? JSON.parse(savedEnableAutoSkip) : true;
      const userAutoNextEpisode =
        savedEnableAutoNextEpisode !== null
          ? JSON.parse(savedEnableAutoNextEpisode)
          : true;

      console.log('🔄 [SkipController] 读取用户设置:', {
        userAutoSkip,
        userAutoNextEpisode,
      });

      setBatchSettings((prev) => ({
        ...prev,
        autoSkip: userAutoSkip,
        autoNextEpisode: userAutoNextEpisode,
      }));
    };

    // 初始化时读取一次
    loadUserSettings();

    // 🔑 监听 storage 事件（其他标签页或窗口的变化）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'enableAutoSkip' || e.key === 'enableAutoNextEpisode') {
        console.log(
          '🔄 [SkipController] localStorage 变化:',
          e.key,
          e.newValue
        );
        loadUserSettings();
      }
    };

    // 🔑 监听自定义事件（同一页面内UserMenu的变化）
    const handleLocalSettingsChange = () => {
      console.log('🔄 [SkipController] 检测到本地设置变化');
      loadUserSettings();
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
  }, []);

  const lastSkipTimeRef = useRef<number>(0);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSkipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔑 使用 ref 来存储 batchSettings，避免触发不必要的重新渲染
  const batchSettingsRef = useRef(batchSettings);

  // 🔑 同步 batchSettings 到 ref
  useEffect(() => {
    console.log('🔄 [batchSettings变化]:', {
      autoSkip: batchSettings.autoSkip,
      autoNextEpisode: batchSettings.autoNextEpisode,
    });
    batchSettingsRef.current = batchSettings;
  }, [batchSettings]);

  // 拖动相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(() => {
    // 从 localStorage 读取保存的位置
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('skipControllerPosition');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('解析保存的位置失败:', e);
        }
      }
    }
    // 默认左下角
    return { x: 16, y: window.innerHeight - 200 };
  });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 拖动处理函数
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 只在点击顶部标题栏时触发拖动
      if ((e.target as HTMLElement).closest('.drag-handle')) {
        setIsDragging(true);
        dragStartPos.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        };
      }
    },
    [position]
  );

  // 触摸开始
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('.drag-handle')) {
        setIsDragging(true);
        const touch = e.touches[0];
        dragStartPos.current = {
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        };
      }
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;

      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 200);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    },
    [isDragging]
  );

  // 触摸移动
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      const newX = touch.clientX - dragStartPos.current.x;
      const newY = touch.clientY - dragStartPos.current.y;

      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 200);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('skipControllerPosition', JSON.stringify(position));
    }
  }, [position]);

  // 添加全局事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

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

  // 加载跳过配置
  const loadSkipConfig = useCallback(async () => {
    try {
      console.log('🔄 开始加载配置:', { source, id });
      const config = await getSkipConfig(source, id);
      console.log('✅ 配置加载完成:', config);
      setSkipConfig(config);
    } catch (err) {
      console.error('❌ 加载跳过配置失败:', err);
    }
  }, [source, id]);

  // 自动跳过逻辑
  const handleAutoSkip = useCallback(
    (segment: SkipSegment) => {
      console.log('⏭️ handleAutoSkip 被调用:', segment);
      if (!artPlayerRef.current) {
        console.log('❌ artPlayerRef.current 为空，无法跳过');
        return;
      }

      // 如果是片尾且开启了自动下一集，直接跳转下一集
      if (
        segment.type === 'ending' &&
        segment.autoNextEpisode &&
        onNextEpisode
      ) {
        console.log('⏭️ 片尾自动跳转下一集');
        // 🔑 先暂停视频，防止 video:ended 事件再次触发
        if (artPlayerRef.current) {
          if (!artPlayerRef.current.paused) {
            artPlayerRef.current.pause();
          }
          // 显示跳过提示
          if (artPlayerRef.current.notice) {
            artPlayerRef.current.notice.show = '自动跳转下一集';
          }
        }
        // 延迟执行跳转，确保暂停生效
        setTimeout(() => {
          onNextEpisode();
        }, 100);
      } else {
        // 否则跳到片段结束位置
        const targetTime = segment.end + 1;
        console.log('⏭️ 执行跳过，跳转到:', targetTime);
        artPlayerRef.current.currentTime = targetTime;
        lastSkipTimeRef.current = Date.now();

        // 显示跳过提示
        if (artPlayerRef.current.notice) {
          const segmentName = segment.type === 'opening' ? '片头' : '片尾';
          artPlayerRef.current.notice.show = `自动跳过${segmentName}`;
        }
      }

      setCurrentSkipSegment(null);
    },
    [artPlayerRef, onNextEpisode]
  );

  // 检查当前播放时间是否在跳过区间内
  const checkSkipSegment = useCallback(
    (time: number) => {
      // 🔑 使用 ref 中的 batchSettings，避免闭包问题
      const currentBatchSettings = batchSettingsRef.current;

      // 如果没有保存的配置，使用 batchSettings 默认配置
      let segments = skipConfig?.segments;

      if (!segments || segments.length === 0) {
        // 根据 batchSettings 生成临时配置
        const tempSegments: SkipSegment[] = [];

        // 添加片头配置
        const openingStart = timeToSeconds(currentBatchSettings.openingStart);
        const openingEnd = timeToSeconds(currentBatchSettings.openingEnd);
        if (openingStart < openingEnd) {
          tempSegments.push({
            type: 'opening',
            start: openingStart,
            end: openingEnd,
            autoSkip: currentBatchSettings.autoSkip,
          });
        }

        // 添加片尾配置（如果设置了）
        if (duration > 0 && currentBatchSettings.endingStart) {
          const endingStartSeconds = timeToSeconds(
            currentBatchSettings.endingStart
          );
          const endingStart =
            currentBatchSettings.endingMode === 'remaining'
              ? duration - endingStartSeconds
              : endingStartSeconds;

          tempSegments.push({
            type: 'ending',
            start: endingStart,
            end: duration,
            autoSkip: currentBatchSettings.autoSkip,
            autoNextEpisode: currentBatchSettings.autoNextEpisode,
            mode: currentBatchSettings.endingMode as 'absolute' | 'remaining',
            remainingTime:
              currentBatchSettings.endingMode === 'remaining'
                ? endingStartSeconds
                : undefined,
          });
        }

        segments = tempSegments;
        console.log('📋 使用默认配置:', segments);
      } else {
        // 如果有保存的配置，处理 remaining 模式
        segments = segments.map((seg) => {
          if (
            seg.type === 'ending' &&
            seg.mode === 'remaining' &&
            seg.remainingTime
          ) {
            // 重新计算 start 和 end（基于当前视频的 duration）
            return {
              ...seg,
              start: duration - seg.remainingTime,
              end: duration,
            };
          }
          return seg;
        });
      }

      if (!segments || segments.length === 0) {
        return;
      }

      const currentSegment = segments.find(
        (segment) => time >= segment.start && time <= segment.end
      );

      console.log('🔍 检查片段:', {
        time,
        currentSegment: currentSegment?.type,
        currentSkipSegment: currentSkipSegment?.type,
        isNew:
          currentSegment && currentSegment.type !== currentSkipSegment?.type,
      });

      // 比较片段类型而不是对象引用（避免临时对象导致的重复触发）
      if (currentSegment && currentSegment.type !== currentSkipSegment?.type) {
        setCurrentSkipSegment(currentSegment);

        // 检查当前片段是否开启自动跳过（默认为true）
        const shouldAutoSkip = currentSegment.autoSkip !== false;
        console.log('📍 检测到片段:', {
          type: currentSegment.type,
          shouldAutoSkip,
          segment: currentSegment,
        });

        if (shouldAutoSkip) {
          // 自动跳过：延迟1秒执行跳过
          if (autoSkipTimeoutRef.current) {
            console.log('⏱️ 清除旧的 timeout');
            clearTimeout(autoSkipTimeoutRef.current);
          }
          console.log('⏱️ 设置新的 timeout (1秒后执行跳过)');
          autoSkipTimeoutRef.current = setTimeout(() => {
            handleAutoSkip(currentSegment);
          }, 1000);

          setShowSkipButton(false); // 自动跳过时不显示按钮
        } else {
          // 手动模式：显示跳过按钮
          setShowSkipButton(true);

          // 自动隐藏跳过按钮
          if (skipTimeoutRef.current) {
            clearTimeout(skipTimeoutRef.current);
          }
          skipTimeoutRef.current = setTimeout(() => {
            setShowSkipButton(false);
            setCurrentSkipSegment(null);
          }, 8000);
        }
      } else if (!currentSegment && currentSkipSegment?.type) {
        console.log('✅ 离开片段区域');
        setCurrentSkipSegment(null);
        setShowSkipButton(false);
        if (skipTimeoutRef.current) {
          clearTimeout(skipTimeoutRef.current);
        }
        if (autoSkipTimeoutRef.current) {
          clearTimeout(autoSkipTimeoutRef.current);
        }
      }
    },
    [skipConfig, currentSkipSegment, handleAutoSkip, duration, timeToSeconds] // 🔑 移除 batchSettings 依赖，使用 ref
  );

  // 执行跳过
  const handleSkip = useCallback(() => {
    if (!currentSkipSegment || !artPlayerRef.current) return;

    // 如果是片尾且有下一集回调，则播放下一集
    if (currentSkipSegment.type === 'ending' && onNextEpisode) {
      setShowSkipButton(false);
      setCurrentSkipSegment(null);

      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }

      // 🔑 先暂停视频并销毁播放器事件，防止 video:ended 事件再次触发
      if (artPlayerRef.current) {
        if (!artPlayerRef.current.paused) {
          artPlayerRef.current.pause();
        }
        // 显示提示
        if (artPlayerRef.current.notice) {
          artPlayerRef.current.notice.show = '正在播放下一集...';
        }
      }

      // 延迟执行跳转，确保暂停生效
      setTimeout(() => {
        onNextEpisode();
      }, 100);
      return;
    }

    // 片头或没有下一集回调时，执行普通跳过
    const targetTime = currentSkipSegment.end + 1; // 跳到片段结束后1秒
    artPlayerRef.current.currentTime = targetTime;
    lastSkipTimeRef.current = Date.now();

    setShowSkipButton(false);
    setCurrentSkipSegment(null);

    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    // 显示跳过提示
    if (artPlayerRef.current.notice) {
      const segmentName =
        currentSkipSegment.type === 'opening' ? '片头' : '片尾';
      artPlayerRef.current.notice.show = `已跳过${segmentName}`;
    }
  }, [currentSkipSegment, artPlayerRef, onNextEpisode]);

  // 保存新的跳过片段（单个片段模式）
  const handleSaveSegment = useCallback(async () => {
    if (!newSegment.start || !newSegment.end || !newSegment.type) {
      alert('请填写完整的跳过片段信息');
      return;
    }

    if (newSegment.start >= newSegment.end) {
      alert('开始时间必须小于结束时间');
      return;
    }

    try {
      const segment: SkipSegment = {
        start: newSegment.start,
        end: newSegment.end,
        type: newSegment.type as 'opening' | 'ending',
        title:
          newSegment.title || (newSegment.type === 'opening' ? '片头' : '片尾'),
        autoSkip: true, // 默认开启自动跳过
        autoNextEpisode: newSegment.type === 'ending', // 片尾默认开启自动下一集
      };

      const updatedConfig: EpisodeSkipConfig = {
        source,
        id,
        title,
        segments: skipConfig?.segments
          ? [...skipConfig.segments, segment]
          : [segment],
        updated_time: Date.now(),
      };

      await saveSkipConfig(source, id, updatedConfig);
      setSkipConfig(updatedConfig);
      onSettingModeChange?.(false);
      setNewSegment({});

      alert('跳过片段已保存');
    } catch (err) {
      console.error('保存跳过片段失败:', err);
      alert('保存失败，请重试');
    }
  }, [newSegment, skipConfig, source, id, title, onSettingModeChange]);

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
      setSkipConfig(updatedConfig);
      // batchSettings 会通过 useEffect 自动从 skipConfig 同步，不需要手动重置
      onSettingModeChange?.(false);

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
    onSettingModeChange,
    timeToSeconds,
    secondsToTime,
  ]);

  // 删除跳过片段
  const handleDeleteSegment = useCallback(
    async (index: number) => {
      if (!skipConfig?.segments) return;

      try {
        const updatedSegments = skipConfig.segments.filter(
          (_, i) => i !== index
        );

        if (updatedSegments.length === 0) {
          // 如果没有片段了，删除整个配置
          await deleteSkipConfig(source, id);
          setSkipConfig(null);
        } else {
          // 更新配置
          const updatedConfig: EpisodeSkipConfig = {
            ...skipConfig,
            segments: updatedSegments,
            updated_time: Date.now(),
          };
          await saveSkipConfig(source, id, updatedConfig);
          setSkipConfig(updatedConfig);
        }

        alert('跳过片段已删除');
      } catch (err) {
        console.error('删除跳过片段失败:', err);
        alert('删除失败，请重试');
      }
    },
    [skipConfig, source, id]
  );

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算实际的 segments（处理 remaining 模式）
  const actualSegments = useMemo(() => {
    if (!skipConfig?.segments) return [];

    return skipConfig.segments.map((seg) => {
      if (
        seg.type === 'ending' &&
        seg.mode === 'remaining' &&
        seg.remainingTime &&
        duration > 0
      ) {
        // 基于当前 duration 重新计算片尾时间
        return {
          ...seg,
          start: duration - seg.remainingTime,
          end: duration,
        };
      }
      return seg;
    });
  }, [skipConfig, duration]);

  // 初始化加载配置
  useEffect(() => {
    console.log('🔥 useEffect 触发，准备调用 loadSkipConfig');
    loadSkipConfig();
  }, [loadSkipConfig]);

  // 🔑 确保每次 source/id 变化时，都从 localStorage 读取用户全局设置
  useEffect(() => {
    const savedEnableAutoSkip = localStorage.getItem('enableAutoSkip');
    const savedEnableAutoNextEpisode = localStorage.getItem(
      'enableAutoNextEpisode'
    );
    const userAutoSkip =
      savedEnableAutoSkip !== null ? JSON.parse(savedEnableAutoSkip) : true;
    const userAutoNextEpisode =
      savedEnableAutoNextEpisode !== null
        ? JSON.parse(savedEnableAutoNextEpisode)
        : true;

    console.log('🔄 从 localStorage 读取用户设置:', {
      userAutoSkip,
      userAutoNextEpisode,
    });

    setBatchSettings((prev) => ({
      ...prev,
      autoSkip: userAutoSkip,
      autoNextEpisode: userAutoNextEpisode,
    }));
  }, [source, id]); // 切换集数时重新读取用户设置

  // 当 skipConfig 改变时，同步到 batchSettings（但保留用户全局设置）
  // 🔑 注意：这个 useEffect 只在 skipConfig 改变时触发，不受 duration 影响
  useEffect(() => {
    if (skipConfig && skipConfig.segments && skipConfig.segments.length > 0) {
      // 找到片头和片尾片段
      const openingSegment = skipConfig.segments.find(
        (s) => s.type === 'opening'
      );
      const endingSegment = skipConfig.segments.find(
        (s) => s.type === 'ending'
      );

      console.log(
        '🔄 [skipConfig变化] 同步时间字段到 batchSettings，保留 autoSkip/autoNextEpisode'
      );

      // 🔑 只更新时间相关的字段，不更新 autoSkip 和 autoNextEpisode
      setBatchSettings((prev) => {
        console.log(
          '🔍 [skipConfig变化] 当前 prev.autoSkip:',
          prev.autoSkip,
          'prev.autoNextEpisode:',
          prev.autoNextEpisode
        );
        return {
          ...prev,
          openingStart: openingSegment
            ? secondsToTime(openingSegment.start)
            : prev.openingStart,
          openingEnd: openingSegment
            ? secondsToTime(openingSegment.end)
            : prev.openingEnd,
          endingStart: endingSegment
            ? endingSegment.mode === 'remaining' && endingSegment.remainingTime
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
          // 🔑 保持当前的 autoSkip 和 autoNextEpisode 不变（已经通过其他 useEffect 从 localStorage 读取）
        };
      });
    }
  }, [skipConfig, duration]); // 🔑 移除 secondsToTime 依赖，避免不必要的触发

  // 监听播放时间变化
  useEffect(() => {
    if (currentTime > 0) {
      checkSkipSegment(currentTime);
    }
  }, [currentTime, checkSkipSegment]);

  // 当 source 或 id 变化时，清理所有状态（换集时）
  useEffect(() => {
    setShowSkipButton(false);
    setCurrentSkipSegment(null);

    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }
    if (autoSkipTimeoutRef.current) {
      clearTimeout(autoSkipTimeoutRef.current);
    }
  }, [source, id]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
      if (autoSkipTimeoutRef.current) {
        clearTimeout(autoSkipTimeoutRef.current);
      }
    };
  }, []);

  // 🔑 关闭弹窗的统一处理函数
  const handleCloseDialog = useCallback(() => {
    onSettingModeChange?.(false);
    // 取消时从 localStorage 读取用户设置，不能硬编码默认值
    const savedEnableAutoSkip = localStorage.getItem('enableAutoSkip');
    const savedEnableAutoNextEpisode = localStorage.getItem(
      'enableAutoNextEpisode'
    );
    const userAutoSkip =
      savedEnableAutoSkip !== null ? JSON.parse(savedEnableAutoSkip) : true;
    const userAutoNextEpisode =
      savedEnableAutoNextEpisode !== null
        ? JSON.parse(savedEnableAutoNextEpisode)
        : true;

    console.log('❌ [关闭弹窗] 从 localStorage 读取用户设置:', {
      userAutoSkip,
      userAutoNextEpisode,
    });

    setBatchSettings({
      openingStart: '0:00',
      openingEnd: '1:30',
      endingMode: 'remaining',
      endingStart: '2:00',
      endingEnd: '',
      autoSkip: userAutoSkip,
      autoNextEpisode: userAutoNextEpisode,
    });
  }, [onSettingModeChange]);

  // 🔑 监听 ESC 键关闭弹窗
  useEffect(() => {
    if (!isSettingMode) return;

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDialog();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isSettingMode, handleCloseDialog]);

  return (
    <div className='skip-controller'>
      {/* 跳过按钮 - 更紧凑的样式 */}
      {showSkipButton && currentSkipSegment && (
        <div className='absolute top-3 left-3 z-[9999] bg-black/90 text-white px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/30 shadow-xl animate-fade-in'>
          <div className='flex items-center space-x-2'>
            <span className='text-xs font-medium'>
              {currentSkipSegment.type === 'opening' ? '🎬 片头' : '🎭 片尾'}
            </span>
            <button
              onClick={handleSkip}
              className='px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors shadow-sm'
            >
              跳过
            </button>
          </div>
        </div>
      )}

      {/* 设置模式面板 - 紧凑悬浮窗口 */}
      {isSettingMode && (
        <div
          className={`${
            showSettingsPanel
              ? 'absolute z-[9999] top-4 right-4 bg-transparent'
              : 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'
          }`}
        >
          <div
            className={`${
              showSettingsPanel
                ? 'glass-card-dark backdrop-blur-xl rounded-xl p-3 w-64 max-h-[45vh] overflow-y-auto border border-gray-600/40 shadow-2xl'
                : 'glass-card-dark backdrop-blur-xl rounded-xl p-3 w-full max-w-xs max-h-[45vh] overflow-y-auto border border-gray-600/40 shadow-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex justify-between items-center mb-2 pb-2 border-b border-gray-600/40'>
              <h3 className='text-sm font-semibold text-gray-100'>智能跳过</h3>
              {showSettingsPanel && (
                <button
                  onClick={() => onSettingModeChange?.(false)}
                  className='text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-gray-700 transition-colors'
                  title='关闭'
                >
                  <svg
                    className='w-3 h-3'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className='space-y-2'>
              <div className='grid grid-cols-2 gap-3'>
                <label className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-gray-300'>自动跳过</span>
                  <input
                    type='checkbox'
                    checked={batchSettings.autoSkip}
                    onChange={(e) =>
                      setBatchSettings({
                        ...batchSettings,
                        autoSkip: e.target.checked,
                      })
                    }
                    className='w-3 h-3 rounded border-gray-500 text-blue-600'
                  />
                </label>
                <label className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-gray-300'>自动下一集</span>
                  <input
                    type='checkbox'
                    checked={batchSettings.autoNextEpisode}
                    onChange={(e) =>
                      setBatchSettings({
                        ...batchSettings,
                        autoNextEpisode: e.target.checked,
                      })
                    }
                    className='w-3 h-3 rounded border-gray-500 text-blue-600'
                  />
                </label>
              </div>
            </div>

            <div className='space-y-2 mt-3'>
              <div className='space-y-1'>
                <div className='text-xs font-medium text-gray-100 flex items-center'>
                  <span className='mr-1'>🎬</span> 片头
                </div>
                <div className='grid grid-cols-[1fr_1fr_auto] gap-1'>
                  <div>
                    <label className='block text-xs text-gray-400'>开始</label>
                    <input
                      type='text'
                      value={batchSettings.openingStart}
                      onChange={(e) =>
                        setBatchSettings({
                          ...batchSettings,
                          openingStart: e.target.value,
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100 placeholder-gray-500'
                      placeholder='0:00'
                    />
                  </div>
                  <div>
                    <label className='block text-xs text-gray-400'>结束</label>
                    <input
                      type='text'
                      value={batchSettings.openingEnd}
                      onChange={(e) =>
                        setBatchSettings({
                          ...batchSettings,
                          openingEnd: e.target.value,
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100 placeholder-gray-500'
                      placeholder='1:30'
                    />
                  </div>
                  <div className='flex items-end'>
                    <button
                      onClick={markCurrentAsOpeningEnd}
                      className='px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors shadow-sm flex items-center justify-center min-w-[32px] h-[26px]'
                      title='标记当前时间为片头结束时间'
                    >
                      <span className='text-xs'>📍</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className='space-y-1'>
                <div className='text-xs font-medium text-gray-100 flex items-center'>
                  <span className='mr-1'>🎭</span> 片尾
                </div>

                <div className='flex gap-3 mb-1'>
                  <label className='flex items-center text-xs text-gray-300'>
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
                      className='w-2.5 h-2.5 mr-1 text-blue-600'
                    />
                    剩余
                  </label>
                  <label className='flex items-center text-xs text-gray-300'>
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
                      className='w-2.5 h-2.5 mr-1 text-blue-600'
                    />
                    绝对
                  </label>
                </div>

                <div className='grid grid-cols-[1fr_1fr_auto] gap-1'>
                  <div>
                    <label className='block text-xs text-gray-400'>
                      {batchSettings.endingMode === 'remaining'
                        ? '剩余'
                        : '开始'}
                    </label>
                    <input
                      type='text'
                      value={batchSettings.endingStart}
                      onChange={(e) =>
                        setBatchSettings({
                          ...batchSettings,
                          endingStart: e.target.value,
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100 placeholder-gray-500'
                      placeholder={
                        batchSettings.endingMode === 'remaining'
                          ? '2:00'
                          : '20:00'
                      }
                    />
                  </div>
                  <div>
                    <label className='block text-xs text-gray-400'>结束</label>
                    <input
                      type='text'
                      value={batchSettings.endingEnd}
                      onChange={(e) =>
                        setBatchSettings({
                          ...batchSettings,
                          endingEnd: e.target.value,
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100 placeholder-gray-500'
                      placeholder='留空'
                    />
                  </div>
                  <div className='flex items-end'>
                    <button
                      onClick={markCurrentAsEndingStart}
                      className='px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors shadow-sm flex items-center justify-center min-w-[32px] h-[26px]'
                      title='标记当前时间为片尾开始时间'
                    >
                      <span className='text-xs'>📍</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className='mt-2 p-2 bg-gray-700/40 backdrop-blur-sm rounded border border-gray-600/50'>
              <div className='text-xs text-gray-400 space-y-0.5'>
                <div className='flex justify-between'>
                  <span>当前:</span>
                  <span>{secondsToTime(currentTime)}</span>
                </div>
                {duration > 0 && (
                  <div className='flex justify-between'>
                    <span>剩余:</span>
                    <span>{secondsToTime(duration - currentTime)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className='flex space-x-2 mt-3 pt-2 border-t border-gray-600/40'>
              <button
                onClick={handleSaveBatchSettings}
                className='flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors shadow-sm'
              >
                保存
              </button>
              {!showSettingsPanel && (
                <button
                  onClick={() => {
                    onSettingModeChange?.(false);
                    setBatchSettings({
                      openingStart: '0:00',
                      openingEnd: '1:30',
                      endingMode: 'remaining',
                      endingStart: '2:00',
                      endingEnd: '',
                      autoSkip: true,
                      autoNextEpisode: true,
                    });
                  }}
                  className='flex-1 px-2 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors shadow-sm'
                >
                  取消
                </button>
              )}
            </div>

            {/* 分割线 */}
            <div className='my-2 border-t border-gray-600/40'></div>

            {/* 高级设置：单个片段模式 */}
            <details className='mb-1'>
              <summary className='cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-200'>
                高级设置
              </summary>
              <div className='mt-1 space-y-2 pl-2 border-l-2 border-gray-600/60'>
                <div>
                  <label className='block text-xs font-medium mb-0.5 text-gray-200'>
                    类型
                  </label>
                  <select
                    value={newSegment.type || ''}
                    onChange={(e) =>
                      setNewSegment({
                        ...newSegment,
                        type: e.target.value as 'opening' | 'ending',
                      })
                    }
                    className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100'
                  >
                    <option value=''>选择类型</option>
                    <option value='opening'>片头</option>
                    <option value='ending'>片尾</option>
                  </select>
                </div>

                <div className='grid grid-cols-2 gap-1'>
                  <div>
                    <label className='block text-xs font-medium mb-0.5 text-gray-200'>
                      开始时间 (秒)
                    </label>
                    <input
                      type='number'
                      value={newSegment.start || ''}
                      onChange={(e) =>
                        setNewSegment({
                          ...newSegment,
                          start: parseFloat(e.target.value),
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100'
                    />
                  </div>

                  <div>
                    <label className='block text-xs font-medium mb-0.5 text-gray-200'>
                      结束时间 (秒)
                    </label>
                    <input
                      type='number'
                      value={newSegment.end || ''}
                      onChange={(e) =>
                        setNewSegment({
                          ...newSegment,
                          end: parseFloat(e.target.value),
                        })
                      }
                      className='w-full px-1.5 py-1 text-xs border border-gray-600/50 rounded bg-gray-800/80 text-gray-100'
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSegment}
                  className='w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-sm'
                >
                  添加片段
                </button>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* 管理已有片段 - 更紧凑的悬浮面板 */}
      {skipConfig &&
        skipConfig.segments &&
        skipConfig.segments.length > 0 &&
        !isSettingMode &&
        !showSettingsPanel && (
          <div
            ref={panelRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              cursor: isDragging ? 'grabbing' : 'default',
              userSelect: isDragging ? 'none' : 'auto',
            }}
            className='z-[9998] glass-card-dark backdrop-blur-xl rounded-xl shadow-2xl border border-gray-600/40 animate-fade-in max-w-[240px]'
          >
            <div className='p-2'>
              <h4 className='drag-handle font-medium mb-1 text-gray-900 dark:text-gray-100 text-xs flex items-center cursor-move select-none'>
                <svg
                  className='w-3 h-3 mr-1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M13 5l7 7-7 7M5 5l7 7-7 7'
                  />
                </svg>
                跳过配置
                <span className='ml-auto text-xs text-gray-500 dark:text-gray-400 text-[10px]'>
                  拖动
                </span>
              </h4>
              <div className='space-y-1 max-h-32 overflow-y-auto'>
                {skipConfig.segments.map((segment, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-1.5 bg-gray-50/80 dark:bg-gray-700/80 rounded text-xs'
                  >
                    <span className='text-gray-800 dark:text-gray-200 flex-1 mr-1'>
                      <div className='flex items-center space-x-1'>
                        <span className='font-medium text-[10px]'>
                          {segment.type === 'opening' ? '🎬' : '🎭'}
                        </span>
                        <span className='text-gray-600 dark:text-gray-400 text-[10px]'>
                          {formatTime(segment.start)}-{formatTime(segment.end)}
                        </span>
                        {segment.autoSkip && (
                          <span className='px-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded text-[10px]'>
                            自动
                          </span>
                        )}
                      </div>
                    </span>
                    <button
                      onClick={() => handleDeleteSegment(index)}
                      className='px-1 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] transition-colors flex-shrink-0'
                      title='删除'
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className='mt-1 pt-1 border-t border-gray-200/60 dark:border-gray-600/60'>
                <button
                  onClick={() => onSettingModeChange?.(true)}
                  className='w-full px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-xs transition-colors shadow-sm'
                >
                  修改配置
                </button>
              </div>
            </div>
          </div>
        )}

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// 导出跳过控制器的设置按钮组件
export function SkipSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors'
      title='设置跳过片头片尾'
    >
      <svg
        className='w-4 h-4'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M13 5l7 7-7 7M5 5l7 7-7 7'
        />
      </svg>
      <span>跳过设置</span>
    </button>
  );
}
