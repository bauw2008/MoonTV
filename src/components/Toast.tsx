'use client';

import { useEffect, useState } from 'react';

export interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onClose?: () => void;
}

export default function Toast({
  type,
  message,
  duration = 3000,
  position = 'top-right',
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 入场动画
    setIsVisible(true);

    // 自动关闭
    const timer = setTimeout(() => {
      handleLeave();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleLeave = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose?.();
    }, 300); // 300ms 退场动画
  };

  // 样式配置
  const typeStyles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-500 text-white',
  };

  const positionStyles = {
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`
        fixed z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg
        transform transition-all duration-300 ease-in-out
        ${typeStyles[type]}
        ${positionStyles[position]}
        ${
          isVisible && !isLeaving
            ? 'translate-x-0 opacity-100 scale-100'
            : isLeaving
              ? 'translate-x-full opacity-0 scale-95'
              : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <span className='text-lg font-semibold'>{iconMap[type]}</span>
      <span className='text-sm font-medium'>{message}</span>
    </div>
  );
}

// Toast钩子
export function useToast() {
  if (!ToastManager) {
    // 如果在服务端或ToastManager未初始化，返回空函数
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }

  return {
    success: (message: string, duration?: number) =>
      ToastManager.success(message, duration),
    error: (message: string, duration?: number) =>
      ToastManager.error(message, duration),
    warning: (message: string, duration?: number) =>
      ToastManager.warning(message, duration),
    info: (message: string, duration?: number) =>
      ToastManager.info(message, duration),
  };
}

// Toast管理器
class ToastManagerClass {
  private toasts: Array<{
    id: string;
    type: ToastProps['type'];
    message: string;
    duration?: number;
    position?: ToastProps['position'];
  }> = [];

  private listeners: Array<(toasts: ToastManagerClass['toasts']) => void> = [];
  private counter = 0;

  addToast(toast: Omit<ToastProps, 'onClose'>) {
    // 使用时间戳和计数器生成唯一 ID
    const id = `${Date.now()}-${++this.counter}`;
    const newToast = { ...toast, id };

    this.toasts.push(newToast);
    this.notifyListeners();

    // 自动移除
    setTimeout(() => {
      this.removeToast(id);
    }, toast.duration || 3000);

    return id;
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (toasts: ToastManagerClass['toasts']) => void) {
    this.listeners.push(listener);
    listener([...this.toasts]);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  success(message: string, duration?: number) {
    return this.addToast({ type: 'success', message, duration });
  }

  error(message: string, duration?: number) {
    return this.addToast({ type: 'error', message, duration });
  }

  warning(message: string, duration?: number) {
    return this.addToast({ type: 'warning', message, duration });
  }

  info(message: string, duration?: number) {
    return this.addToast({ type: 'info', message, duration });
  }
}

// 确保ToastManager在客户端环境中正确初始化
export const ToastManager =
  typeof window !== 'undefined' ? new ToastManagerClass() : null;

// 监听全局Toast事件
if (typeof window !== 'undefined' && ToastManager) {
  window.addEventListener('showToast', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { type, message, duration } = customEvent.detail;
    ToastManager[type](message, duration);
  });
}

// Toast Provider组件
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
