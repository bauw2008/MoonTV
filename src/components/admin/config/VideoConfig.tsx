'use client';

// Type declarations for DOM APIs
declare global {
  interface HTMLAnchorElement {
    href: string;
    download: string;
    click(): void;
  }
}

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle,
  Download,
  GripVertical,
  Play,
  Plus,
  Power,
  Save,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminState } from '@/hooks/admin/useAdminState';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';
import { PermissionGuard } from '@/components/PermissionGuard';

import { ConfigService } from '@/services/admin/configService';

interface DataSource {
  name: string;
  key: string;
  api: string;
  detail?: string;
  disabled?: boolean;
  from?: string;
}

// 拖拽排序项组件
const SortableSourceItem = ({
  source,
  onToggleEnable,
  onDelete,
  selected,
  onSelect,
  validationResult,
}: {
  source: DataSource;
  onToggleEnable: (key: string) => void;
  onDelete: (key: string) => void;
  selected: boolean;
  onSelect: (key: string) => void;
  validationResult?: any;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: source.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-pink-50 dark:bg-pink-900/30 border rounded-lg p-3 mb-2 transition-all hover:shadow-sm hover:bg-pink-100 dark:hover:bg-pink-800 ${
        selected
          ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
      } ${source.disabled ? 'opacity-60' : ''}`}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2 flex-1 min-w-0'>
          <button
            {...attributes}
            {...listeners}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-move p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
          >
            <GripVertical size={16} />
          </button>

          <input
            type='checkbox'
            checked={selected}
            onChange={() => onSelect(source.key)}
            className='w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 flex-shrink-0'
          />

          <div className='flex-1 min-w-0'>
            <div className='flex items-center space-x-2 mb-1'>
              <h3 className='font-semibold text-gray-900 dark:text-white text-sm truncate'>
                {source.name}
              </h3>
              <span className='text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium flex-shrink-0'>
                {source.key}
              </span>
            </div>

            <div className='flex items-center space-x-2 mb-1'>
              <code className='text-xs bg-pink-100 dark:bg-pink-800 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-600 font-mono flex-1 truncate'>
                {source.api}
              </code>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                {source.disabled ? (
                  <div className='flex items-center space-x-1 text-red-600 dark:text-red-400'>
                    <div className='w-1.5 h-1.5 rounded-full bg-red-500'></div>
                    <span className='text-xs font-medium'>已禁用</span>
                  </div>
                ) : (
                  <div className='flex items-center space-x-1 text-green-600 dark:text-green-400'>
                    <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
                    <span className='text-xs font-medium'>已启用</span>
                  </div>
                )}

                {source.detail && (
                  <span
                    className='text-xs text-gray-500 dark:text-gray-400 truncate'
                    title={source.detail}
                  >
                    {source.detail}
                  </span>
                )}

                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  {source.from || 'custom'}
                </span>
              </div>

              {/* 有效性检测结果 */}
              {validationResult && (
                <div
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    validationResult.status === 'valid'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : validationResult.status === 'no_results'
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : validationResult.status === 'invalid'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  {validationResult.status === 'validating' && (
                    <>
                      <div className='w-1 h-1 rounded-full bg-yellow-500 animate-spin'></div>
                      <span>检测中</span>
                    </>
                  )}
                  {validationResult.status === 'valid' && (
                    <>
                      <CheckCircle size={10} />
                      <span>有效</span>
                    </>
                  )}
                  {validationResult.status === 'no_results' && (
                    <>
                      <XCircle size={10} />
                      <span>无结果</span>
                    </>
                  )}
                  {validationResult.status === 'invalid' && (
                    <>
                      <XCircle size={10} />
                      <span>无效</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-1 ml-2'>
          <button
            onClick={() => onToggleEnable(source.key)}
            className={`p-1.5 rounded transition-all hover:scale-105 ${
              source.disabled
                ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50'
            }`}
            title={source.disabled ? '启用' : '禁用'}
          >
            <Power size={14} />
          </button>

          <button
            onClick={() => onDelete(source.key)}
            className='p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-all hover:scale-105 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
            title='删除'
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

function VideoConfigContent() {
  const { loading, withLoading } = useAdminState();
  const configService = new ConfigService();

  const [config, setConfig] = useState<any>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const [newSource, setNewSource] = useState<DataSource>({
    name: '',
    key: '',
    api: '',
    detail: '',
    disabled: false,
    from: 'custom',
  });

  const [importExportModal, setImportExportModal] = useState<{
    isOpen: boolean;
    mode: 'import' | 'export' | 'result';
    result?: any;
  }>({
    isOpen: false,
    mode: 'export',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
  );

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await withLoading('loadVideoConfig', () =>
        configService.getConfig(),
      );
      setConfig(data);
      if (data?.SourceConfig) {
        setSources(data.SourceConfig);
      }
    } catch (error) {
      console.error('加载视频配置失败:', error);
    }
  };

  const callSourceApi = async (body: any) => {
    const resp = await fetch('/api/admin/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `操作失败: ${resp.status}`);
    }

    await loadConfig();
  };

  const handleToggleEnable = (key: string) => {
    const target = sources.find((s) => s.key === key);
    if (!target) return;

    const action = target.disabled ? 'enable' : 'disable';
    withLoading(`toggleSource_${key}`, () =>
      callSourceApi({ action, key }),
    ).catch(() => {
      console.error('操作失败', action, key);
    });
  };

  const handleDelete = (key: string) => {
    withLoading(`deleteSource_${key}`, () =>
      callSourceApi({ action: 'delete', key }),
    ).catch((error) => {
      console.error('操作失败', 'delete', key, error);
      // 显示友好的错误信息
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error(error?.message || '删除失败');
        });
      }
    });
  };

  const handleAddSource = () => {
    if (!newSource.name || !newSource.key || !newSource.api) {
      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请填写完整信息');
        });
      }
      return;
    }

    withLoading('addSource', async () => {
      await callSourceApi({
        action: 'add',
        key: newSource.key,
        name: newSource.name,
        api: newSource.api,
        detail: newSource.detail,
      });
      setNewSource({
        name: '',
        key: '',
        api: '',
        detail: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
    }).catch(() => {
      console.error('操作失败', 'add', newSource);
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sources.findIndex((s) => s.key === active.id);
    const newIndex = sources.findIndex((s) => s.key === over.id);
    setSources((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderChanged(true);
  };

  const handleSaveOrder = () => {
    const order = sources.map((s) => s.key);
    withLoading('saveSourceOrder', () =>
      callSourceApi({ action: 'sort', order }),
    )
      .then(() => {
        setOrderChanged(false);
      })
      .catch(() => {
        console.error('操作失败', 'sort', order);
      });
  };

  // 有效性检测处理
  const handleValidateSources = async () => {
    if (!searchKeyword.trim()) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请输入搜索关键词');
        });
      }
      return;
    }

    try {
      setIsValidating(true);
      const response = await fetch(
        `/api/admin/source/validate?q=${encodeURIComponent(searchKeyword.trim())}`,
      );
      const data = await response.json();

      if (response.ok) {
        setValidationResults(data.results || []);
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success(
              `检测完成，共检测 ${data.results?.length || 0} 个视频源`,
            );
          });
        }
      } else {
        throw new Error(data.error || '检测失败');
      }
    } catch (error) {
      console.error('检测视频源失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('检测失败: ' + (error as Error).message);
        });
      }
    } finally {
      setIsValidating(false);
    }
  };

  // 虚拟滚动状态
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [containerHeight, setContainerHeight] = useState(600);
  const itemHeight = 80; // 每个视频源项的高度

  // 计算可见范围
  const updateVisibleRange = useCallback(
    (scrollTop: number) => {
      const start = Math.floor(scrollTop / itemHeight);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      const end = Math.min(start + visibleCount + 5, sources.length); // +5 缓冲

      setVisibleRange({ start: Math.max(0, start - 2), end }); // -2 预渲染
    },
    [containerHeight, sources.length],
  );

  // 滚动处理
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      updateVisibleRange(e.currentTarget.scrollTop);
    },
    [updateVisibleRange],
  );

  // 获取当前可见的视频源
  const visibleSources = sources.slice(visibleRange.start, visibleRange.end);

  const handleSelectAll = () => {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map((s) => s.key)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedSources.size === 0) return;

    if (!confirm(`确定要删除选中的 ${selectedSources.size} 个视频源吗？`))
      return;

    withLoading('batchDelete', async () => {
      for (const key of selectedSources) {
        await callSourceApi({ action: 'delete', key });
      }
      setSelectedSources(new Set());
    }).catch(() => {
      console.error('批量删除失败');
      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('批量删除失败');
        });
      }
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(sources, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a') as HTMLAnchorElement;
    link.href = url;
    link.download = 'video-sources.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedSources = JSON.parse(e.target?.result as string);
        if (!Array.isArray(importedSources)) {
          throw new Error('导入文件格式错误');
        }

        await withLoading('importSources', async () => {
          for (const source of importedSources) {
            if (source.key && source.name && source.api) {
              await callSourceApi({
                action: 'add',
                key: source.key,
                name: source.name,
                api: source.api,
                detail: source.detail,
              });
            }
          }
        });

        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('导入成功');
          });
        }
      } catch (error) {
        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error(
              '导入失败: ' +
                (error instanceof Error ? error.message : '未知错误'),
            );
          });
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <CollapsibleTab
      title='视频配置'
      theme='green'
      icon={
        <svg
          className='w-5 h-5 text-green-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
          />
        </svg>
      }
      defaultCollapsed={true}
    >
      <div className='space-y-6'>
        {/* 统计信息 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-4 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
              {sources.length}
            </div>
            <div className='text-sm text-gray-700 dark:text-gray-300 font-medium'>
              总视频源
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-4 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
              {sources.filter((s) => !s.disabled).length}
            </div>
            <div className='text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已启用
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-4 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
              {sources.filter((s) => s.disabled).length}
            </div>
            <div className='text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已禁用
            </div>
          </div>
          <div className='bg-pink-50 dark:bg-pink-900/30 p-4 rounded-lg border border-pink-200 dark:border-pink-700 shadow-sm hover:shadow-md transition-shadow'>
            <div className='text-2xl font-bold text-purple-600 dark:text-purple-400'>
              {selectedSources.size}
            </div>
            <div className='text-sm text-gray-700 dark:text-gray-300 font-medium'>
              已选择
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className='flex flex-wrap gap-3'>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className='flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md'
          >
            <Plus size={16} />
            <span>添加视频源</span>
          </button>

          <button
            onClick={handleSelectAll}
            className='px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md'
          >
            {selectedSources.size === sources.length ? '取消全选' : '全选'}
          </button>

          <button
            onClick={handleBatchDelete}
            disabled={selectedSources.size === 0}
            className='flex items-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
          >
            <Trash2 size={16} />
            <span>批量删除</span>
            {selectedSources.size > 0 && (
              <span className='ml-1 px-2 py-0.5 bg-red-700 text-white text-xs rounded-full'>
                {selectedSources.size}
              </span>
            )}
          </button>

          <button
            onClick={handleExport}
            className='flex items-center space-x-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md'
          >
            <Download size={16} />
            <span>导出</span>
          </button>

          <label className='flex items-center space-x-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md cursor-pointer'>
            <Upload size={16} />
            <span>导入</span>
            <input
              type='file'
              accept='.json'
              onChange={handleImport}
              className='hidden'
            />
          </label>

          {orderChanged && (
            <button
              onClick={handleSaveOrder}
              disabled={loading.saveSourceOrder}
              className='flex items-center space-x-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:transform-none animate-pulse'
            >
              <Save size={16} />
              <span>{loading.saveSourceOrder ? '保存中...' : '保存顺序'}</span>
            </button>
          )}
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <div className='bg-white dark:bg-gray-800 border rounded-lg p-6 shadow-sm'>
            <h3 className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100'>
              添加新视频源
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300'>
                  名称
                </label>
                <input
                  type='text'
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='视频源名称'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300'>
                  标识
                </label>
                <input
                  type='text'
                  value={newSource.key}
                  onChange={(e) =>
                    setNewSource({ ...newSource, key: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='唯一标识'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300'>
                  API地址
                </label>
                <input
                  type='text'
                  value={newSource.api}
                  onChange={(e) =>
                    setNewSource({ ...newSource, api: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='API地址'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300'>
                  描述
                </label>
                <input
                  type='text'
                  value={newSource.detail}
                  onChange={(e) =>
                    setNewSource({ ...newSource, detail: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                  placeholder='可选描述'
                />
              </div>
            </div>
            <div className='flex justify-end space-x-3 mt-6'>
              <button
                onClick={() => setShowAddForm(false)}
                className='px-6 py-2.5 border border-pink-300 dark:border-pink-600 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-700 transition-all hover:scale-105 font-medium'
              >
                取消
              </button>
              <button
                onClick={handleAddSource}
                disabled={loading.addSource}
                className='px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md'
              >
                {loading.addSource ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 有效性检测 - 移到拖拽区域外面 */}
        <div className='bg-white dark:bg-gray-800 border rounded-lg p-6 shadow-sm'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              视频源有效性检测
            </h3>
          </div>
          
          {/* PC端布局 - 水平排列 */}
          <div className='hidden md:flex space-x-2'>
            <input
              type='text'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder='输入搜索关键词进行检测'
              className='flex-1 px-4 py-3 border border-pink-300 dark:border-pink-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent'
            />
            <button
              onClick={handleValidateSources}
              disabled={isValidating || !searchKeyword.trim()}
              className='flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all hover:scale-105 font-medium shadow-sm hover:shadow-md'
            >
              <Search size={16} />
              <span>{isValidating ? '检测中...' : '开始检测'}</span>
            </button>
          </div>
          
          {/* 移动端布局 - 垂直排列 */}
          <div className='md:hidden space-y-3'>
            <input
              type='text'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder='输入搜索关键词进行检测'
              className='w-full px-4 py-3 border border-pink-300 dark:border-pink-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base'
            />
            <button
              onClick={handleValidateSources}
              disabled={isValidating || !searchKeyword.trim()}
              className='w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all font-medium'
            >
              <Search size={16} />
              <span>{isValidating ? '检测中...' : '开始检测'}</span>
            </button>
          </div>
        </div>

        {/* 视频源列表 */}
        <div className='bg-pink-50 dark:bg-pink-900/30 border rounded-lg p-6 shadow-sm'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              视频源列表
            </h3>
            <span className='text-sm text-gray-500 dark:text-gray-400'>
              拖拽可调整顺序 · 点击复选框可批量操作
            </span>
          </div>

          {sources.length === 0 ? (
            <div className='text-center py-12'>
              <div className='text-gray-400 dark:text-gray-500 mb-2'>
                <Play size={48} className='mx-auto' />
              </div>
              <p className='text-gray-500 dark:text-gray-400'>暂无视频源</p>
              <p className='text-sm text-gray-400 dark:text-gray-500 mt-2'>
                添加视频源开始配置
              </p>
            </div>
          ) : (
            <>
              {/* 虚拟滚动容器 */}
              <div
                className='border border-pink-200 dark:border-pink-600 rounded-lg bg-white dark:bg-gray-800'
                style={{ height: `${containerHeight}px` }}
              >
                <div
                  className='relative overflow-auto h-full'
                  onScroll={handleScroll}
                >
                  {/* 总高度占位符 */}
                  <div style={{ height: `${sources.length * itemHeight}px` }} />

                  {/* 可见项目容器 */}
                  <div
                    className='absolute top-0 left-0 right-0'
                    style={{
                      transform: `translateY(${visibleRange.start * itemHeight}px)`,
                    }}
                  >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={visibleSources.map((s) => s.key)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className='px-4'>
                          {visibleSources.map((source, index) => (
                            <div
                              key={source.key}
                              className='border-b border-gray-100 dark:border-gray-700 last:border-b-0'
                              style={{ height: `${itemHeight}px` }}
                            >
                              <SortableSourceItem
                                source={source}
                                onToggleEnable={handleToggleEnable}
                                onDelete={handleDelete}
                                selected={selectedSources.has(source.key)}
                                validationResult={validationResults.find(
                                  (r) => r.key === source.key,
                                )}
                                onSelect={(key) => {
                                  const newSelected = new Set(selectedSources);
                                  if (newSelected.has(key)) {
                                    newSelected.delete(key);
                                  } else {
                                    newSelected.add(key);
                                  }
                                  setSelectedSources(newSelected);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </CollapsibleTab>
  );
}

export function VideoConfig() {
  return (
    <PermissionGuard permission='canManageConfig'>
      <VideoConfigContent />
    </PermissionGuard>
  );
}
