'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Reply, Send, Trash2, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';
import { useToast } from '@/components/Toast';

interface Comment {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
  replies: CommentReply[];
  commentCount?: number;
  category?: 'suggestion' | 'feedback' | 'discussion' | 'other';
  isPinned?: boolean;
}

interface CommentReply {
  id: string;
  username: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'user';
  content: string;
  timestamp: number;
  commentCount?: number;
}

export default function MessageBoard() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [authInfo, setAuthInfo] = useState<{
    username?: string;
    role?: string;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 用于控制每个评论的回复折叠状态
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});
  // 用于控制表情选择器的显示
  const [showEmojiPicker, setShowEmojiPicker] = useState<
    Record<string, boolean>
  >({});
  // 用于控制新评论表情选择器的显示
  const [showNewCommentEmojiPicker, setShowNewCommentEmojiPicker] =
    useState(false);
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // 分类筛选状态
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    'all' | 'suggestion' | 'feedback' | 'discussion' | 'other'
  >('all');

  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    setAuthInfo(auth);

    if (!auth?.username) {
      router.push('/login');
      return;
    }

    fetchComments(1, false);
  }, [router, fetchComments]);

  // 处理分类筛选
  useEffect(() => {
    // 这里可以添加筛选逻辑
  }, [selectedCategoryFilter]);

  const fetchComments = useCallback(
    async (page = 1, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response = await fetch(`/api/message?page=${page}&limit=20`);
        const data = await response.json();

        if (append) {
          // 追加数据而不是替换
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          // 替换数据
          setComments(data.comments || []);
        }

        // 更新分页信息
        setCurrentPage(data.pagination?.currentPage || 1);
        setTotalPages(data.pagination?.totalPages || 1);
        setHasNextPage(data.pagination?.hasNextPage || false);
        setHasPrevPage(data.pagination?.hasPrevPage || false);
      } catch {
        showError('获取评论失败', '请稍后重试');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [showError],
  );

  const [selectedCategory, setSelectedCategory] = useState<
    'suggestion' | 'feedback' | 'discussion' | 'other'
  >('other');

  // 添加表情到新评论内容
  const addEmojiToNewComment = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
    // 添加后隐藏表情选择器
    setShowNewCommentEmojiPicker(false);
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !authInfo?.username) {
      return;
    }

    try {
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          category: selectedCategory,
        }),
      });

      if (response.ok) {
        setNewComment('');
        fetchComments(1, false); // 发布新评论后重新加载第一页
        showSuccess('发布成功', '您的留言已发布');
      } else {
        const errorData = await response.json();
        showError('发布失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('发布失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('发布评论失败:', error);
    }
  };

  const handlePostReply = async (commentId: string) => {
    if (!replyContent.trim() || !authInfo?.username) {
      return;
    }

    try {
      const response = await fetch(`/api/message/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent }),
      });

      if (response.ok) {
        setReplyContent('');
        setReplyingTo(null);
        fetchComments(currentPage, false); // 回复后重新加载当前页
        showSuccess('回复成功', '您的回复已发布');
      } else {
        const errorData = await response.json();
        showError('回复失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('回复失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('发布回复失败:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!authInfo?.role || !['owner', 'admin'].includes(authInfo.role)) {
      return;
    }

    try {
      setDeletingId(commentId);
      const response = await fetch(`/api/message/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchComments(currentPage, false); // 删除评论后重新加载当前页
        showSuccess('删除成功', '评论已删除');
      } else {
        const errorData = await response.json();
        showError('删除失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('删除失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('删除评论失败:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!authInfo?.role || !['owner', 'admin'].includes(authInfo.role)) {
      return;
    }

    try {
      setDeletingId(replyId);
      const response = await fetch(
        `/api/message/${commentId}/reply/${replyId}`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        fetchComments(currentPage, false); // 删除回复后重新加载当前页
        showSuccess('删除成功', '回复已删除');
      } else {
        const errorData = await response.json();
        showError('删除失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('删除失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('删除回复失败:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllComments = async () => {
    if (!authInfo?.role || !['owner', 'admin'].includes(authInfo.role)) {
      return;
    }

    try {
      const response = await fetch('/api/message/clear', {
        method: 'POST',
      });

      if (response.ok) {
        fetchComments(1, false); // 清空所有评论后重新加载第一页
        showSuccess('清空成功', '所有留言和回复已清空');
      } else {
        const errorData = await response.json();
        showError('清空失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('清空失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('清空留言失败:', error);
    }
  };

  // 处理置顶/取消置顶
  const handleTogglePin = async (commentId: string) => {
    if (!authInfo?.role || !['owner', 'admin'].includes(authInfo.role)) {
      return;
    }

    try {
      const response = await fetch(`/api/message/${commentId}/pin`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        fetchComments(currentPage, false); // 置顶操作后重新加载当前页
        showSuccess(result.message, '');
      } else {
        const errorData = await response.json();
        showError('操作失败', errorData.error || '请稍后重试');
      }
    } catch (error) {
      showError('操作失败', '请稍后重试');
      // eslint-disable-next-line no-console
      console.error('置顶操作失败:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return '刚刚';
    }
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    }
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    }
    return date.toLocaleDateString('zh-CN');
  };

  // 常用表情符号
  const commonEmojis = [
    '😀',
    '😂',
    '😍',
    '😎',
    '👍',
    '👎',
    '❤️',
    '🎉',
    '🔥',
    '✨',
    '🤔',
    '😢',
    '😡',
    '😱',
    '🤩',
    '🥳',
    '👏',
    '🙌',
    '🙏',
    '💪',
  ];

  // 切换回复区域的展开/折叠状态
  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // 切换表情选择器的显示状态
  const toggleEmojiPicker = (commentId: string) => {
    setShowEmojiPicker((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // 添加表情到回复内容
  const addEmojiToReply = (emoji: string, commentId: string) => {
    setReplyContent((prev) => prev + emoji);
    // 添加后隐藏表情选择器
    setShowEmojiPicker((prev) => ({
      ...prev,
      [commentId]: false,
    }));
  };

  // 切换新评论表情选择器的显示状态
  const toggleNewCommentEmojiPicker = () => {
    setShowNewCommentEmojiPicker((prev) => !prev);
  };

  // 计算筛选后的评论
  const filteredComments = useMemo(() => {
    if (selectedCategoryFilter === 'all') {
      return comments;
    }
    return comments.filter(
      (comment) => comment.category === selectedCategoryFilter,
    );
  }, [comments, selectedCategoryFilter]);

  return (
    <PageLayout activePath='/message'>
      <div className='h-screen flex flex-col'>
        <div className='flex-1 flex flex-col lg:flex-row gap-4 p-4'>
          {/* 主内容区 */}
          <div className='flex-1 flex flex-col'>
            {/* 主内容区域 - 包含页面标题、发布新留言模块和评论列表 */}
            <div className='flex-1 flex flex-col lg:flex-row gap-4 max-w-6xl mx-auto w-full'>
              {/* 左侧内容 - 页面标题、发布新留言模块和评论列表 */}
              <div className='flex-1 flex flex-col overflow-hidden'>
                {/* 页面标题和描述 - 调整padding避免与顶部按钮重叠 */}
                <div className='px-4 pt-6 pb-4'>
                  <div className='mb-4'>
                    <div className='flex items-center gap-2 mb-1'>
                      <MessageSquare className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                      <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
                        留言板
                      </h1>
                    </div>
                    <p className='text-gray-600 dark:text-gray-400 mt-2'>
                      在这里留下您的想法和建议
                    </p>
                  </div>
                </div>
                {/* 发布新留言模块 */}
                <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm p-3 mb-4 border border-gray-200/50 dark:border-gray-700/50 w-full'>
                  <div className='flex gap-2'>
                    <div className='flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center'>
                      <User className='w-4 h-4 text-white' />
                    </div>
                    <div className='flex-1 flex flex-col gap-2'>
                      <div className='relative'>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder='说点什么...'
                          className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none pr-8'
                          rows={3}
                          onClick={(e) => e.stopPropagation()} // 阻止点击textarea时关闭选择器
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNewCommentEmojiPicker();
                          }}
                          className='absolute right-2 bottom-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors z-20'
                          title='表情'
                        >
                          <span className='text-lg'>😊</span>
                        </button>

                        {/* 新评论表情选择器 */}
                        {showNewCommentEmojiPicker && (
                          <div
                            className='absolute right-0 bottom-full mb-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50'
                            onClick={(e) => e.stopPropagation()} // 阻止选择器内部点击事件冒泡
                          >
                            <div className='grid grid-cols-10 gap-1'>
                              {commonEmojis.map((emoji, index) => (
                                <button
                                  key={index}
                                  onClick={() => addEmojiToNewComment(emoji)}
                                  className='text-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors'
                                  type='button'
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className='flex justify-between items-center'>
                        {/* 分类选择 */}
                        <div className='flex flex-wrap gap-1.5 items-center'>
                          <span className='text-xs text-gray-600 dark:text-gray-400'>
                            分类:
                          </span>
                          <button
                            onClick={() => setSelectedCategory('suggestion')}
                            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                              selectedCategory === 'suggestion'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            建议
                          </button>
                          <button
                            onClick={() => setSelectedCategory('feedback')}
                            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                              selectedCategory === 'feedback'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            反馈
                          </button>
                          <button
                            onClick={() => setSelectedCategory('discussion')}
                            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                              selectedCategory === 'discussion'
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            讨论
                          </button>
                          <button
                            onClick={() => setSelectedCategory('other')}
                            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                              selectedCategory === 'other'
                                ? 'bg-gray-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            其他
                          </button>
                        </div>
                        {/* 发布按钮 */}
                        <button
                          onClick={handlePostComment}
                          disabled={!newComment.trim()}
                          className='flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-xs'
                        >
                          <Send className='w-3 h-3' />
                          <span>发布</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 评论列表 - 可滚动区域 */}
                <div className='flex-1 overflow-y-auto space-y-4'>
                  {loading ? (
                    <div className='flex justify-center py-8'>
                      <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
                    </div>
                  ) : filteredComments.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm p-12 border border-gray-200/50 dark:border-gray-700/50 text-center'
                    >
                      <MessageSquare className='w-12 h-12 text-gray-400 mx-auto' />
                      <p className='text-gray-500 dark:text-gray-400 mt-4'>
                        {selectedCategoryFilter === 'all'
                          ? '暂无留言，快来抢沙发吧！'
                          : '该分类下暂无留言'}
                      </p>
                    </motion.div>
                  ) : (
                    <AnimatePresence>
                      {filteredComments.map((comment) => (
                        // 每个评论作为一个独立模块
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                          className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                        >
                          <div className='p-4'>
                            {/* 评论头部 */}
                            <div className='flex items-start gap-4'>
                              <div className='flex-shrink-0 relative'>
                                {comment.avatar ? (
                                  <div className='w-10 h-10 rounded-full overflow-hidden relative z-10'>
                                    <img
                                      src={comment.avatar}
                                      alt={comment.username}
                                      className='w-full h-full object-cover'
                                    />
                                  </div>
                                ) : (
                                  <div className='w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center relative z-10'>
                                    <User className='w-5 h-5 text-white' />
                                  </div>
                                )}
                                {/* 角色图标 - 角标形式 */}
                                {comment.role === 'owner' && (
                                  <div className='absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                    <svg
                                      className='w-3 h-3 text-yellow-800'
                                      fill='currentColor'
                                      viewBox='0 0 24 24'
                                      xmlns='http://www.w3.org/2000/svg'
                                    >
                                      <path d='M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 2c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z' />
                                    </svg>
                                  </div>
                                )}
                                {comment.role === 'admin' && (
                                  <div className='absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                    <svg
                                      className='w-3 h-3 text-white'
                                      fill='currentColor'
                                      viewBox='0 0 20 20'
                                      xmlns='http://www.w3.org/2000/svg'
                                    >
                                      <path
                                        fillRule='evenodd'
                                        d='M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                                        clipRule='evenodd'
                                      />
                                    </svg>
                                  </div>
                                )}
                                {comment.role === 'user' && (
                                  <div className='absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                    <svg
                                      className='w-3 h-3 text-white'
                                      fill='currentColor'
                                      viewBox='0 0 20 20'
                                      xmlns='http://www.w3.org/2000/svg'
                                    >
                                      <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='flex items-center gap-2 flex-wrap'>
                                  {/* 置顶标识 */}
                                  {comment.isPinned && (
                                    <span className='px-2 py-0.5 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full shadow-sm animate-pulse'>
                                      置顶
                                    </span>
                                  )}
                                  <span
                                    className={`font-medium ${
                                      comment.role === 'admin' ||
                                      comment.role === 'owner'
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-900 dark:text-gray-100'
                                    }`}
                                  >
                                    {comment.username}
                                  </span>
                                  {comment.role === 'owner' && (
                                    <span className='px-2 py-0.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full animate-pulse shadow-sm'>
                                      站长
                                    </span>
                                  )}
                                  {comment.role === 'admin' && (
                                    <span className='px-2 py-0.5 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full shadow-sm'>
                                      管理员
                                    </span>
                                  )}
                                  {comment.role === 'user' && (
                                    <span className='px-2 py-0.5 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-sm'>
                                      用户
                                    </span>
                                  )}
                                  {/* 分类标签 */}
                                  {comment.category === 'suggestion' && (
                                    <span className='px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full shadow-sm'>
                                      建议
                                    </span>
                                  )}
                                  {comment.category === 'feedback' && (
                                    <span className='px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full shadow-sm'>
                                      反馈
                                    </span>
                                  )}
                                  {comment.category === 'discussion' && (
                                    <span className='px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full shadow-sm'>
                                      讨论
                                    </span>
                                  )}
                                  {comment.category === 'other' && (
                                    <span className='px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full shadow-sm'>
                                      其他
                                    </span>
                                  )}
                                  {/* 徽章系统 */}
                                  {comment.commentCount &&
                                    comment.commentCount >= 100 && (
                                      <span
                                        className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full shadow-sm'
                                        title={`资深用户 (${comment.commentCount}条留言)`}
                                      >
                                        💎
                                      </span>
                                    )}
                                  {comment.commentCount &&
                                    comment.commentCount >= 50 &&
                                    comment.commentCount < 100 && (
                                      <span
                                        className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-full shadow-sm'
                                        title={`活跃用户 (${comment.commentCount}条留言)`}
                                      >
                                        🏅
                                      </span>
                                    )}
                                  {comment.commentCount &&
                                    comment.commentCount >= 20 &&
                                    comment.commentCount < 50 && (
                                      <span
                                        className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-blue-400 to-cyan-500 text-white rounded-full shadow-sm'
                                        title={`积极用户 (${comment.commentCount}条留言)`}
                                      >
                                        🌟
                                      </span>
                                    )}
                                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                                    {formatTime(comment.timestamp)}
                                  </span>
                                </div>
                                <p className='text-gray-700 dark:text-gray-300 mt-3 whitespace-pre-wrap leading-relaxed'>
                                  {comment.content}
                                </p>
                              </div>
                              {/* 管理员操作按钮 */}
                              {authInfo?.role &&
                                ['owner', 'admin'].includes(authInfo.role) && (
                                  <div className='flex flex-col gap-1'>
                                    {/* 置顶按钮 */}
                                    <button
                                      onClick={() =>
                                        handleTogglePin(comment.id)
                                      }
                                      className={`p-1 rounded-full transition-colors ${
                                        comment.isPinned
                                          ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                                          : 'text-gray-500 hover:text-yellow-500 dark:text-gray-400 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                      }`}
                                      title={
                                        comment.isPinned ? '取消置顶' : '置顶'
                                      }
                                    >
                                      <svg
                                        className='w-4 h-4'
                                        fill='currentColor'
                                        viewBox='0 0 20 20'
                                        xmlns='http://www.w3.org/2000/svg'
                                      >
                                        <path d='M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z' />
                                      </svg>
                                    </button>
                                    {/* 删除按钮 */}
                                    <button
                                      onClick={() =>
                                        handleDeleteComment(comment.id)
                                      }
                                      disabled={deletingId === comment.id}
                                      className='p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                                    >
                                      {deletingId === comment.id ? (
                                        <div className='w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin'></div>
                                      ) : (
                                        <Trash2 className='w-4 h-4' />
                                      )}
                                    </button>
                                  </div>
                                )}
                            </div>

                            {/* 回复区域 - 默认折叠 */}
                            <div className='mt-3'>
                              {/* 回复计数和展开/折叠按钮 */}
                              {comment.replies.length > 0 && (
                                <div className='flex items-center justify-between mb-3'>
                                  <span className='text-sm bg-blue-500 text-white rounded-full px-2.5 py-0.5 shadow-sm'>
                                    {comment.replies.length} 条回复
                                  </span>
                                  <button
                                    onClick={() => toggleReplies(comment.id)}
                                    className='text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 group'
                                    title={
                                      expandedReplies[comment.id]
                                        ? '收起回复'
                                        : '查看回复'
                                    }
                                  >
                                    <span className='group-hover:opacity-100 opacity-0 transition-opacity'>
                                      {expandedReplies[comment.id]
                                        ? '收起'
                                        : '查看'}
                                    </span>
                                    {expandedReplies[comment.id] ? (
                                      <svg
                                        className='w-4 h-4'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                        xmlns='http://www.w3.org/2000/svg'
                                      >
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth={2}
                                          d='M5 15l7-7 7 7'
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        className='w-4 h-4'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                        xmlns='http://www.w3.org/2000/svg'
                                      >
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth={2}
                                          d='M19 9l-7 7-7-7'
                                        />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* 回复列表 - 根据展开状态显示 */}
                              <AnimatePresence>
                                {expandedReplies[comment.id] && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className='overflow-hidden'
                                  >
                                    <div className='space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-700'>
                                      {comment.replies.map((reply) => (
                                        <div
                                          key={reply.id}
                                          className='flex items-start gap-4 pt-3'
                                        >
                                          <div className='flex-shrink-0 relative'>
                                            {reply.avatar ? (
                                              <div className='w-8 h-8 rounded-full overflow-hidden relative z-10'>
                                                <img
                                                  src={reply.avatar}
                                                  alt={reply.username}
                                                  className='w-full h-full object-cover'
                                                />
                                              </div>
                                            ) : (
                                              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center relative z-10'>
                                                <User className='w-4 h-4 text-white' />
                                              </div>
                                            )}
                                            {/* 角色图标 - 角标形式 */}
                                            {reply.role === 'owner' && (
                                              <div className='absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                                <svg
                                                  className='w-2.5 h-2.5 text-yellow-800'
                                                  fill='currentColor'
                                                  viewBox='0 0 24 24'
                                                  xmlns='http://www.w3.org/2000/svg'
                                                >
                                                  <path d='M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 2c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z' />
                                                </svg>
                                              </div>
                                            )}
                                            {reply.role === 'admin' && (
                                              <div className='absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                                <svg
                                                  className='w-2.5 h-2.5 text-white'
                                                  fill='currentColor'
                                                  viewBox='0 0 20 20'
                                                  xmlns='http://www.w3.org/2000/svg'
                                                >
                                                  <path
                                                    fillRule='evenodd'
                                                    d='M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                                                    clipRule='evenodd'
                                                  />
                                                </svg>
                                              </div>
                                            )}
                                            {reply.role === 'user' && (
                                              <div className='absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-0'>
                                                <svg
                                                  className='w-2.5 h-2.5 text-white'
                                                  fill='currentColor'
                                                  viewBox='0 0 20 20'
                                                  xmlns='http://www.w3.org/2000/svg'
                                                >
                                                  <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                                </svg>
                                              </div>
                                            )}
                                          </div>
                                          <div className='flex-1 min-w-0'>
                                            <div className='flex items-center gap-2 flex-wrap'>
                                              <span
                                                className={`font-medium text-sm ${
                                                  reply.role === 'admin' ||
                                                  reply.role === 'owner'
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-gray-900 dark:text-gray-100'
                                                }`}
                                              >
                                                {reply.username}
                                              </span>
                                              {reply.role === 'owner' && (
                                                <span className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full animate-pulse shadow-sm'>
                                                  站长
                                                </span>
                                              )}
                                              {reply.role === 'admin' && (
                                                <span className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full shadow-sm'>
                                                  管理员
                                                </span>
                                              )}
                                              {reply.role === 'user' && (
                                                <span className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-sm'>
                                                  用户
                                                </span>
                                              )}
                                              {/* 徽章系统 */}
                                              {reply.commentCount &&
                                                reply.commentCount >= 100 && (
                                                  <span
                                                    className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full shadow-sm'
                                                    title={`资深用户 (${reply.commentCount}条留言)`}
                                                  >
                                                    💎
                                                  </span>
                                                )}
                                              {reply.commentCount &&
                                                reply.commentCount >= 50 &&
                                                reply.commentCount < 100 && (
                                                  <span
                                                    className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-full shadow-sm'
                                                    title={`活跃用户 (${reply.commentCount}条留言)`}
                                                  >
                                                    🏅
                                                  </span>
                                                )}
                                              {reply.commentCount &&
                                                reply.commentCount >= 20 &&
                                                reply.commentCount < 50 && (
                                                  <span
                                                    className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-blue-400 to-cyan-500 text-white rounded-full shadow-sm'
                                                    title={`积极用户 (${reply.commentCount}条留言)`}
                                                  >
                                                    🌟
                                                  </span>
                                                )}
                                              <span className='text-xs text-gray-500 dark:text-gray-400'>
                                                {formatTime(reply.timestamp)}
                                              </span>
                                            </div>
                                            <p className='text-gray-700 dark:text-gray-300 mt-1 text-sm whitespace-pre-wrap leading-relaxed'>
                                              {reply.content}
                                            </p>
                                          </div>
                                          {/* 删除按钮 - 仅管理员可见 */}
                                          {authInfo?.role &&
                                            ['owner', 'admin'].includes(
                                              authInfo.role,
                                            ) && (
                                              <button
                                                onClick={() =>
                                                  handleDeleteReply(
                                                    comment.id,
                                                    reply.id,
                                                  )
                                                }
                                                disabled={
                                                  deletingId === reply.id
                                                }
                                                className='p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                                              >
                                                {deletingId === reply.id ? (
                                                  <div className='w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin'></div>
                                                ) : (
                                                  <Trash2 className='w-3 h-3' />
                                                )}
                                              </button>
                                            )}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* 回复输入框 */}
                              {replyingTo === comment.id ? (
                                <div className='mt-2 pt-2 border-t border-gray-200 dark:border-gray-700'>
                                  <div className='flex gap-1.5'>
                                    <div className='relative flex-1'>
                                      <input
                                        type='text'
                                        value={replyContent}
                                        onChange={(e) =>
                                          setReplyContent(e.target.value)
                                        }
                                        placeholder='输入回复内容...'
                                        className='w-full px-2 py-1.5 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm'
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handlePostReply(comment.id);
                                          }
                                          if (e.key === 'Escape') {
                                            setReplyingTo(null);
                                            setReplyContent('');
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() =>
                                          toggleEmojiPicker(comment.id)
                                        }
                                        className='absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors z-20'
                                        type='button'
                                        title='表情'
                                      >
                                        <span className='text-lg'>😊</span>
                                      </button>
                                    </div>
                                    <div className='flex gap-0.5'>
                                      <button
                                        onClick={() => {
                                          setReplyingTo(null);
                                          setReplyContent('');
                                        }}
                                        className='p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'
                                        type='button'
                                      >
                                        <X className='w-3.5 h-3.5' />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handlePostReply(comment.id)
                                        }
                                        disabled={!replyContent.trim()}
                                        className='p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                        type='button'
                                      >
                                        <Send className='w-3.5 h-3.5' />
                                      </button>
                                    </div>
                                  </div>
                                  {/* 表情选择器 */}
                                  {showEmojiPicker[comment.id] && (
                                    <div className='mt-2 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50'>
                                      <div className='grid grid-cols-10 gap-1'>
                                        {commonEmojis.map((emoji, index) => (
                                          <button
                                            key={index}
                                            onClick={() =>
                                              addEmojiToReply(emoji, comment.id)
                                            }
                                            className='text-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors'
                                            type='button'
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setReplyingTo(comment.id)}
                                  className='flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2 group'
                                >
                                  <Reply className='w-4 h-4' />
                                  <span className='group-hover:opacity-100 opacity-0 transition-opacity'>
                                    回复
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {/* 分页控件 */}
                <div className='mt-6 flex justify-center items-center gap-2'>
                  <button
                    onClick={() => fetchComments(currentPage - 1, false)}
                    disabled={!hasPrevPage || loadingMore}
                    className='px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    上一页
                  </button>

                  <span className='text-gray-700 dark:text-gray-300'>
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>

                  <button
                    onClick={() => fetchComments(currentPage + 1, false)}
                    disabled={!hasNextPage || loadingMore}
                    className='px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    下一页
                  </button>

                  {loadingMore && (
                    <div className='flex items-center gap-2 text-gray-600 dark:text-gray-400'>
                      <div className='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                      <span>加载中...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧分类筛选面板 - 与左侧留言输入框高度对齐 */}
              <div className='hidden lg:block w-64 flex-shrink-0 h-fit max-h-80 mt-32'>
                {/* 留言分类模块 - 调整高度与左侧输入框对齐 */}
                <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm p-3 border border-gray-200/50 dark:border-gray-700/50'>
                  <h3 className='text-base font-semibold text-gray-900 dark:text-white mb-3'>
                    留言分类
                  </h3>
                  <div className='space-y-1.5'>
                    <button
                      onClick={() => setSelectedCategoryFilter('all')}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center justify-between text-sm ${
                        selectedCategoryFilter === 'all'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>全部留言</span>
                      <span className='text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full px-1.5 py-0.5'>
                        {comments.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedCategoryFilter('suggestion')}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center justify-between text-sm ${
                        selectedCategoryFilter === 'suggestion'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className='flex items-center gap-1.5'>
                        <span className='w-2 h-2 rounded-full bg-blue-500'></span>
                        建议
                      </span>
                      <span className='text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full px-1.5 py-0.5'>
                        {
                          comments.filter((c) => c.category === 'suggestion')
                            .length
                        }
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedCategoryFilter('feedback')}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center justify-between text-sm ${
                        selectedCategoryFilter === 'feedback'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className='flex items-center gap-1.5'>
                        <span className='w-2 h-2 rounded-full bg-green-500'></span>
                        反馈
                      </span>
                      <span className='text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full px-1.5 py-0.5'>
                        {
                          comments.filter((c) => c.category === 'feedback')
                            .length
                        }
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedCategoryFilter('discussion')}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center justify-between text-sm ${
                        selectedCategoryFilter === 'discussion'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className='flex items-center gap-1.5'>
                        <span className='w-2 h-2 rounded-full bg-purple-500'></span>
                        讨论
                      </span>
                      <span className='text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full px-1.5 py-0.5'>
                        {
                          comments.filter((c) => c.category === 'discussion')
                            .length
                        }
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedCategoryFilter('other')}
                      className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center justify-between text-sm ${
                        selectedCategoryFilter === 'other'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className='flex items-center gap-1.5'>
                        <span className='w-2 h-2 rounded-full bg-gray-500'></span>
                        其他
                      </span>
                      <span className='text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-1.5 py-0.5'>
                        {comments.filter((c) => c.category === 'other').length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 管理菜单模块 - 仅管理员可见 */}
                {authInfo?.role &&
                  ['owner', 'admin'].includes(authInfo.role) &&
                  comments.length > 0 && (
                    <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-sm p-3 border border-gray-200/50 dark:border-gray-700/50 mt-3'>
                      <h3 className='text-base font-semibold text-gray-900 dark:text-white mb-3'>
                        管理菜单
                      </h3>
                      <button
                        onClick={() => {
                          if (
                            // eslint-disable-next-line no-alert
                            confirm(
                              '确定要清空所有留言和回复吗？此操作不可恢复！',
                            )
                          ) {
                            handleClearAllComments();
                          }
                        }}
                        className='w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors text-sm'
                      >
                        清空所有留言
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
