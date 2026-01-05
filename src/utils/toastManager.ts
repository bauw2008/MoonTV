// 简单的Toast管理器
let currentToast: {
  message: string;
  type: 'success' | 'error';
  id: string;
} | null = null;

export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
) {
  const id = Math.random().toString(36).substr(2, 9);
  currentToast = { message, type, id };

  // 创建自定义事件
  const event = new CustomEvent('showToast', { detail: currentToast });
  window.dispatchEvent(event);

  // 自动移除
  setTimeout(() => {
    currentToast = null;
    const hideEvent = new CustomEvent('hideToast');
    window.dispatchEvent(hideEvent);
  }, 3000);
}

export { currentToast };
