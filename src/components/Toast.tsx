import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastProps extends ToastMessage {
  onDismiss: (id: string) => void;
}

export const Toast = ({ id, message, type, duration = 4000, onDismiss }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const bgColor = type === 'success' ? 'bg-green-50 border-green-200' :
                  type === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200';

  const textColor = type === 'success' ? 'text-green-800' :
                    type === 'error' ? 'text-red-800' :
                    'text-blue-800';

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : AlertCircle;
  const iconColor = type === 'success' ? 'text-green-500' :
                    type === 'error' ? 'text-red-500' :
                    'text-blue-500';

  return (
    <div className={`${bgColor} border rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}>
      <Icon className={`${iconColor} w-5 h-5 flex-shrink-0 mt-0.5`} />
      <p className={`${textColor} text-sm flex-1`}>{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className={`${textColor} hover:opacity-70 flex-shrink-0`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
