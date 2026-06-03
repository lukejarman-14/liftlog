import { useCallback } from 'react';
import { useStore } from './useStore';

export const useToast = () => {
  const { addToast: addToastToStore, removeToast } = useStore();

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    addToastToStore({ id, message, type, duration });
    return id;
  }, [addToastToStore]);

  const success = useCallback((message: string, duration = 3000) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message: string, duration = 5000) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const info = useCallback((message: string, duration = 4000) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  return { success, error, info, dismiss };
};
