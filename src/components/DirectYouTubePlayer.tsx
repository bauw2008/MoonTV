'use client';

import { AlertCircle, CheckCircle, ExternalLink, Play } from 'lucide-react';
import { useState } from 'react';

import YouTubeVideoCard from './YouTubeVideoCard';

// YouTube URL解析工具函数
const extractVideoId = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtu\.be\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // 验证视频ID格式（YouTube视频ID通常是11个字符）
      const videoId = match[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }
    }
  }
  return null;
};

// 验证YouTube URL格式
const isValidYouTubeUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }
  const videoId = extractVideoId(url);
  return videoId !== null;
};

// 获取视频缩略图URL
const getVideoThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

// 获取YouTube视频信息（使用公开的oEmbed API）
const getVideoInfo = async (
  videoId: string,
): Promise<{ title: string; author_name: string } | null> => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || '直接播放的YouTube视频',
        author_name: data.author_name || '未知频道',
      };
    }
  } catch (error) {
    console.warn('获取视频信息失败:', error);
  }
  return null;
};

interface DirectYouTubePlayerProps {
  className?: string;
}

const DirectYouTubePlayer = ({ className = '' }: DirectYouTubePlayerProps) => {
  const [url, setUrl] = useState('');
  const [videoData, setVideoData] = useState<any>(null);
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 处理URL输入变化
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);

    // 实时验证URL
    if (inputUrl.trim()) {
      const valid = isValidYouTubeUrl(inputUrl.trim());
      setIsValidUrl(valid);
    } else {
      setIsValidUrl(null);
    }
  };

  // 处理URL提交
  const handleUrlSubmit = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }

    const videoId = extractVideoId(trimmedUrl);
    if (!videoId) {
      setIsValidUrl(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      // 尝试获取真实的视频信息
      const videoInfo = await getVideoInfo(videoId);

      // 创建视频对象用于YouTubeVideoCard
      const tempVideo = {
        id: { videoId },
        snippet: {
          title: videoInfo?.title || '直接播放的YouTube视频',
          description: '通过URL直接播放的视频',
          thumbnails: {
            medium: {
              url: getVideoThumbnail(videoId),
              width: 320,
              height: 180,
            },
          },
          channelTitle: videoInfo?.author_name || '未知频道',
          publishedAt: new Date().toISOString(), // 保持当前时间，因为我们无法从oEmbed获取发布时间
          channelId: '',
        },
      };

      setVideoData(tempVideo);
      setIsValidUrl(true);

      // 如果获取视频信息失败但视频ID有效，给用户提示
      if (!videoInfo) {
        setFetchError('无法获取视频详细信息，但可以正常播放');
      }
    } catch (error) {
      console.error('处理视频URL时出错:', error);
      setFetchError('处理视频URL时出错，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    }
  };

  // 清除当前视频
  const handleClear = () => {
    setUrl('');
    setVideoData(null);
    setIsValidUrl(null);
    setFetchError(null);
  };

  // 在新窗口打开原始YouTube链接
  const handleOpenOriginal = () => {
    if (url.trim()) {
      window.open(url.trim(), '_blank');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* URL输入区域 */}
      <div className='space-y-3'>
        <div className='relative'>
          <input
            type='text'
            value={url}
            onChange={handleUrlChange}
            onKeyPress={handleKeyPress}
            placeholder='粘贴YouTube链接，如: https://www.youtube.com/watch?v=... 或 https://youtu.be/...'
            className={`w-full px-4 py-3 pr-12 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
              isValidUrl === false
                ? 'border-red-300 focus:ring-red-500 bg-red-50 dark:bg-red-900/10 dark:border-red-600'
                : isValidUrl === true
                  ? 'border-green-300 focus:ring-green-500 bg-green-50 dark:bg-green-900/10 dark:border-green-600'
                  : 'border-gray-300 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-600'
            } dark:text-gray-100 dark:placeholder-gray-400`}
            disabled={isLoading}
          />

          {/* 验证状态图标 */}
          <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
            {isValidUrl === true && (
              <CheckCircle className='w-5 h-5 text-green-500' />
            )}
            {isValidUrl === false && (
              <AlertCircle className='w-5 h-5 text-red-500' />
            )}
          </div>
        </div>

        {/* 验证提示信息 */}
        {isValidUrl === false && (
          <div className='flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm'>
            <AlertCircle className='w-4 h-4' />
            <span>请输入有效的YouTube链接</span>
          </div>
        )}

        {/* 获取视频信息的错误提示 */}
        {fetchError && (
          <div className='flex items-center space-x-2 text-yellow-600 dark:text-yellow-400 text-sm'>
            <AlertCircle className='w-4 h-4' />
            <span>{fetchError}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className='flex flex-wrap gap-2'>
          <button
            onClick={handleUrlSubmit}
            disabled={!url.trim() || isValidUrl === false || isLoading}
            className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2'
          >
            {isLoading ? (
              <>
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                <span>获取视频信息中...</span>
              </>
            ) : (
              <>
                <Play className='w-4 h-4' />
                <span>播放视频</span>
              </>
            )}
          </button>

          {url.trim() && (
            <button
              onClick={handleOpenOriginal}
              className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2'
            >
              <ExternalLink className='w-4 h-4' />
              <span>原始链接</span>
            </button>
          )}

          {videoData && (
            <button
              onClick={handleClear}
              className='px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors'
            >
              清除
            </button>
          )}
        </div>

        {/* 支持的URL格式提示 */}
        {!videoData && (
          <div className='text-xs text-gray-500 dark:text-gray-400 space-y-1'>
            <p>💡 支持的YouTube链接格式：</p>
            <ul className='pl-4 space-y-1'>
              <li>• https://www.youtube.com/watch?v=VIDEO_ID</li>
              <li>• https://youtu.be/VIDEO_ID</li>
              <li>• https://www.youtube.com/embed/VIDEO_ID</li>
              <li>• https://www.youtube.com/v/VIDEO_ID</li>
            </ul>
          </div>
        )}
      </div>

      {/* 视频播放区域 */}
      {videoData && (
        <div className='space-y-3'>
          <div className='border-t border-gray-200 dark:border-gray-700 pt-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3'>
              🎬 视频播放器
            </h3>
            <div className='max-w-2xl mx-auto'>
              <YouTubeVideoCard video={videoData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectYouTubePlayer;
