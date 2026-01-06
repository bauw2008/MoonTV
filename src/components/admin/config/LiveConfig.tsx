'use client';

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
  Calendar,
  Edit,
  GripVertical,
  Plus,
  Power,
  RefreshCw,
  Save,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdminApi } from '@/hooks/admin/useAdminApi';
import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

interface LiveDataSource {
  name: string;
  key: string;
  url: string;
  ua?: string;
  epg?: string;
  disabled?: boolean;
  from?: string;
  channelNumber?: number;
}

// 拖拽排序项组件
const SortableLiveItem = ({
  liveSource,
  onToggleEnable,
  onDelete,
  onEdit,
  isEditing,
  editingSource,
  onSaveEdit,
  onCancelEdit,
}: {
  liveSource: LiveDataSource;
  onToggleEnable: (key: string) => void;
  onDelete: (key: string) => void;
  onEdit: (source: LiveDataSource) => void;
  isEditing: boolean;
  editingSource: LiveDataSource | null;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: liveSource.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isEditing && editingSource?.key === liveSource.key) {
    return (
      <div className='bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-3'>
        <div className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                名称
              </label>

              <input
                type='text'
                value={editingSource.name}
                onChange={(e) =>
                  onEdit({ ...editingSource, name: e.target.value })
                }
                className='w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                URL
              </label>

              <input
                type='text'
                value={editingSource.url}
                onChange={(e) =>
                  onEdit({ ...editingSource, url: e.target.value })
                }
                className='w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                User-Agent
              </label>

              <input
                type='text'
                value={editingSource.ua || ''}
                onChange={(e) =>
                  onEdit({ ...editingSource, ua: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                placeholder='可选'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                EPG
              </label>

              <input
                type='text'
                value={editingSource.epg || ''}
                onChange={(e) =>
                  onEdit({ ...editingSource, epg: e.target.value })
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                placeholder='可选'
              />
            </div>
          </div>

          {/* PC端按钮布局 */}
          <div className='hidden md:flex justify-end space-x-2'>
            <button
              onClick={onCancelEdit}
              className='flex items-center space-x-2 px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-700'
            >
              <X size={16} />
              <span>取消</span>
            </button>

            <button
              onClick={onSaveEdit}
              className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
            >
              <Save size={16} />
              <span>保存</span>
            </button>
          </div>

          {/* 移动端按钮布局 */}
          <div className='md:hidden grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-600'>
            <button
              onClick={onCancelEdit}
              className='flex items-center justify-center px-4 py-3 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-700 font-medium'
            >
              <X size={16} className='mr-2' />
              取消
            </button>

            <button
              onClick={onSaveEdit}
              className='flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium'
            >
              <Save size={16} className='mr-2' />
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-3 transition-all hover:shadow-md ${
        liveSource.disabled ? 'opacity-60' : ''
      }`}
    >
      {/* PC端布局 - 水平排列 */}
      <div className='hidden md:flex items-center justify-between'>
        <div className='flex items-center space-x-3 flex-1'>
          <button
            {...attributes}
            {...listeners}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-move'
          >
            <GripVertical size={18} />
          </button>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <Tv size={16} className='text-blue-500' />

              <h3 className='font-medium text-gray-900 dark:text-white'>
                {liveSource.name}
              </h3>

              <span className='text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded'>
                {liveSource.key}
              </span>

              {liveSource.disabled && (
                <span className='text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded'>
                  已禁用
                </span>
              )}

              {liveSource.channelNumber !== undefined && (
                <span className='text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded'>
                  {liveSource.channelNumber} 个频道
                </span>
              )}
            </div>

            <p
              className='text-sm text-gray-600 dark:text-gray-400 mt-1 truncate'
              title={liveSource.url}
            >
              {liveSource.url}
            </p>

            <div className='flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400'>
              {liveSource.ua && (
                <span title={liveSource.ua}>
                  UA: {liveSource.ua.substring(0, 30)}...
                </span>
              )}

              {liveSource.epg && (
                <span
                  className='flex items-center space-x-1'
                  title={liveSource.epg}
                >
                  <Calendar size={12} />

                  <span>EPG: {liveSource.epg}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={() => onEdit(liveSource)}
            className='p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors'
            title='编辑'
          >
            <Edit size={16} />
          </button>

          <button
            onClick={() => onToggleEnable(liveSource.key)}
            className={`p-2 rounded-lg transition-colors ${
              liveSource.disabled
                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
            }`}
            title={liveSource.disabled ? '启用' : '禁用'}
          >
            <Power size={16} />
          </button>

          <button
            onClick={() => onDelete(liveSource.key)}
            className='p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors'
            title='删除'
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 移动端布局 - 垂直排列 */}
      <div className='md:hidden space-y-3'>
        <div className='flex items-center space-x-3'>
          <button
            {...attributes}
            {...listeners}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-move'
          >
            <GripVertical size={18} />
          </button>

          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <Tv size={16} className='text-blue-500' />

              <h3 className='font-medium text-gray-900 dark:text-white text-base'>
                {liveSource.name}
              </h3>

              {liveSource.disabled && (
                <span className='text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded'>
                  已禁用
                </span>
              )}
            </div>

            <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              标识: {liveSource.key}
            </div>

            {liveSource.channelNumber !== undefined && (
              <div className='text-xs text-blue-600 dark:text-blue-400 mt-1'>
                {liveSource.channelNumber} 个频道
              </div>
            )}
          </div>
        </div>

        <div className='bg-gradient-to-r from-blue-50/40 via-cyan-50/30 to-teal-50/20 dark:from-blue-900/20 dark:via-cyan-900/15 dark:to-teal-900/10 p-3 rounded-lg border border-blue-200/30 dark:border-blue-800/30 backdrop-blur-sm'>
          <div className='text-xs text-gray-500 dark:text-gray-400 mb-1'>
            URL:
          </div>
          <div className='text-sm text-gray-900 dark:text-gray-100 break-all'>
            {liveSource.url}
          </div>
        </div>

        {(liveSource.ua || liveSource.epg) && (
          <div className='flex flex-wrap gap-2'>
            {liveSource.ua && (
              <div className='bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs'>
                <span className='text-gray-500 dark:text-gray-400'>UA:</span>
                <span className='text-gray-700 dark:text-gray-300 ml-1 truncate max-w-32 inline-block'>
                  {liveSource.ua}
                </span>
              </div>
            )}

            {liveSource.epg && (
              <div className='bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs'>
                <span className='text-gray-500 dark:text-gray-400'>EPG:</span>
                <span className='text-gray-700 dark:text-gray-300 ml-1 truncate max-w-32 inline-block'>
                  {liveSource.epg}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 移动端操作按钮 */}
        <div className='flex justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-600'>
          <button
            onClick={() => onEdit(liveSource)}
            className='flex-1 flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium'
          >
            <Edit size={14} className='mr-1' />
            编辑
          </button>

          <button
            onClick={() => onToggleEnable(liveSource.key)}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              liveSource.disabled
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            <Power size={14} className='mr-1' />
            {liveSource.disabled ? '启用' : '禁用'}
          </button>

          <button
            onClick={() => onDelete(liveSource.key)}
            className='flex-1 flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium'
          >
            <Trash2 size={14} className='mr-1' />
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

function LiveConfigContent() {
  // 使用统一接口
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();
  const { configApi } = useAdminApi();

  const [config, setConfig] = useState<any>(null);
  const [liveSources, setLiveSources] = useState<LiveDataSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLiveSource, setEditingLiveSource] =
    useState<LiveDataSource | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [newLiveSource, setNewLiveSource] = useState<LiveDataSource>({
    name: '',
    key: '',
    url: '',
    ua: '',
    epg: '',
    disabled: false,
    from: 'custom',
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
      const response = await fetch('/api/admin/config');
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      const data = await response.json();
      setConfig(data.Config);
      if (data.Config?.LiveConfig) {
        setLiveSources(data.Config.LiveConfig);
        setOrderChanged(false);
      }
    } catch (error) {
      console.error('加载直播配置失败:', error);
      showError('加载配置失败');
    }
  };

  const callLiveSourceApi = async (body: any) => {
    try {
      const resp = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `操作失败: ${resp.status}`);
      }

      // 成功后刷新配置
      await loadConfig();
      showSuccess('操作成功');
    } catch (err) {
      console.error('API调用失败:', err);
      showError(err instanceof Error ? err.message : '操作失败');
      throw err;
    }
  };

  const handleToggleEnable = async (key: string) => {
    const target = liveSources.find((s) => s.key === key);
    if (!target) return;

    const action = target.disabled ? 'enable' : 'disable';
    try {
      await withLoading(`toggleLiveSource_${key}`, () =>
        callLiveSourceApi({ action, key }),
      );
      // 显示成功提示
      const message = target.disabled ? '直播源已启用' : '直播源已禁用';
      showSuccess(message);
    } catch (error) {
      console.error('操作失败', action, key);
      showError('操作失败');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('确定要删除这个直播源吗？')) return;

    try {
      await withLoading(`deleteLiveSource_${key}`, () =>
        callLiveSourceApi({ action: 'delete', key }),
      );
      // 显示成功提示
      showSuccess('直播源已删除');
    } catch (error) {
      console.error('删除失败', error);
      showError('删除失败');
    }
  };

  const handleAddLiveSource = async () => {
    if (!newLiveSource.name || !newLiveSource.key || !newLiveSource.url) {
      showError('请填写必要信息（名称、标识、URL）');
      return;
    }

    try {
      await withLoading('addLiveSource', () =>
        callLiveSourceApi({
          action: 'add',
          key: newLiveSource.key,
          name: newLiveSource.name,
          url: newLiveSource.url,
          ua: newLiveSource.ua,
          epg: newLiveSource.epg,
        }),
      );
      setNewLiveSource({
        name: '',
        key: '',
        url: '',
        epg: '',
        ua: '',
        disabled: false,
        from: 'custom',
      });
      setShowAddForm(false);
      // 显示成功提示
      showSuccess('直播源添加成功');
    } catch (error) {
      console.error('操作失败', 'add', error);
      showError('添加直播源失败');
    }
  };

  const handleEditLiveSource = async () => {
    if (!editingLiveSource?.name || !editingLiveSource.url) {
      showError('请填写必要信息（名称、URL）');
      return;
    }

    try {
      await withLoading('editLiveSource', () =>
        callLiveSourceApi({
          action: 'edit',
          key: editingLiveSource.key,
          name: editingLiveSource.name,
          url: editingLiveSource.url,
          ua: editingLiveSource.ua,
          epg: editingLiveSource.epg,
        }),
      );
      setEditingLiveSource(null);
      // 显示成功提示
      showSuccess('直播源已更新');
    } catch (error) {
      console.error('操作失败', 'edit', editingLiveSource);
      showError('更新直播源失败');
    }
  };

  const handleRefreshLiveSources = async () => {
    if (isRefreshing) return;

    await withLoading('refreshLiveSources', async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch('/api/admin/live/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `刷新失败: ${response.status}`);
        }

        // 刷新成功后重新加载配置
        await loadConfig();
        showSuccess('直播源已刷新');
      } catch (error) {
        console.error('刷新直播源失败:', error);
        showError('刷新失败');
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = liveSources.findIndex((s) => s.key === active.id);
      const newIndex = liveSources.findIndex((s) => s.key === over.id);

      const newSources = arrayMove(liveSources, oldIndex, newIndex);
      setLiveSources(newSources);
      setOrderChanged(true);
    }
  };

  const handleSaveOrder = async () => {
    const order = liveSources.map((s) => s.key);
    try {
      await withLoading('saveLiveSourceOrder', () =>
        callLiveSourceApi({ action: 'sort', order }),
      );
      setOrderChanged(false);
      // 显示成功提示
      showSuccess('直播源顺序已保存');
    } catch (error) {
      console.error('操作失败', 'sort', order);
      showError('保存顺序失败');
    }
  };

  return (
    <div className='p-6'>
      <div className='space-y-6'>
        {/* 统计信息 */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700'>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
              {liveSources.length}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              总直播源
            </div>
          </div>
          <div className='bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700'>
            <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
              {liveSources.filter((s) => !s.disabled).length}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              已启用
            </div>
          </div>
          <div className='bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700'>
            <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
              {liveSources.filter((s) => s.disabled).length}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              已禁用
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className='flex flex-wrap gap-2'>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            <Plus size={16} />
            <span>添加直播源</span>
          </button>

          <button
            onClick={handleRefreshLiveSources}
            disabled={isRefreshing || isLoading('refreshLiveSources')}
            className='flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
          >
            <RefreshCw
              className={
                isRefreshing || isLoading('refreshLiveSources')
                  ? 'animate-spin'
                  : ''
              }
              size={16}
            />
            <span>
              {isRefreshing || isLoading('refreshLiveSources')
                ? '刷新中...'
                : '刷新直播源'}
            </span>
          </button>

          {orderChanged && (
            <button
              onClick={handleSaveOrder}
              disabled={isLoading('saveLiveSourceOrder')}
              className='flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50'
            >
              <Save size={16} />
              <span>
                {isLoading('saveLiveSourceOrder') ? '保存中...' : '保存顺序'}
              </span>
            </button>
          )}
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <div className='bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              添加新直播源
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  名称
                </label>
                <input
                  type='text'
                  value={newLiveSource.name}
                  onChange={(e) =>
                    setNewLiveSource({ ...newLiveSource, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='直播源名称'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  标识
                </label>
                <input
                  type='text'
                  value={newLiveSource.key}
                  onChange={(e) =>
                    setNewLiveSource({ ...newLiveSource, key: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='唯一标识'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  URL
                </label>
                <input
                  type='text'
                  value={newLiveSource.url}
                  onChange={(e) =>
                    setNewLiveSource({ ...newLiveSource, url: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='直播源URL'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  User-Agent
                </label>
                <input
                  type='text'
                  value={newLiveSource.ua}
                  onChange={(e) =>
                    setNewLiveSource({ ...newLiveSource, ua: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='可选'
                />
              </div>
              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  EPG
                </label>
                <input
                  type='text'
                  value={newLiveSource.epg}
                  onChange={(e) =>
                    setNewLiveSource({ ...newLiveSource, epg: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  placeholder='电子节目单URL（可选）'
                />
              </div>
            </div>
            <div className='flex justify-end space-x-2 mt-4'>
              <button
                onClick={() => setShowAddForm(false)}
                className='px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-700'
              >
                取消
              </button>
              <button
                onClick={handleAddLiveSource}
                disabled={isLoading('addLiveSource')}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
              >
                {isLoading('addLiveSource') ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 直播源列表 */}
        <div className='bg-gradient-to-br from-blue-50/30 via-cyan-50/20 to-teal-50/10 dark:from-blue-900/15 dark:via-cyan-900/10 dark:to-teal-900/5 border border-blue-200/40 dark:border-blue-800/40 rounded-lg p-6 backdrop-blur-sm'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={liveSources.map((s) => s.key)}
              strategy={verticalListSortingStrategy}
            >
              {liveSources.map((liveSource) => (
                <SortableLiveItem
                  key={liveSource.key}
                  liveSource={liveSource}
                  onToggleEnable={handleToggleEnable}
                  onDelete={handleDelete}
                  onEdit={setEditingLiveSource}
                  isEditing={!!editingLiveSource}
                  editingSource={editingLiveSource}
                  onSaveEdit={handleEditLiveSource}
                  onCancelEdit={() => setEditingLiveSource(null)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

// 导出组件
function LiveConfig() {
  return <LiveConfigContent />;
}
export default LiveConfig;
