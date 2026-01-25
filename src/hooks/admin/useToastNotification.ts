export const useToastNotification = () => {
  const showError = async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.error(message);
    }
  };

  const showSuccess = async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.success(message);
    }
  };

  const showWarning = async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.warning(message);
    }
  };

  return { showError, showSuccess, showWarning };
};
