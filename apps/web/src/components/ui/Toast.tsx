import { useState, useEffect } from 'react';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return {
    toast,
    showError: (message: string) => setToast({ message, type: 'error' }),
    showSuccess: (message: string) => setToast({ message, type: 'success' }),
    ToastComponent: toast ? (
      <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
        toast.type === 'error' ? 'bg-red-900/90 text-red-200' : 'bg-emerald-900/90 text-emerald-200'
      }`}>
        {toast.message}
      </div>
    ) : null,
  };
}
