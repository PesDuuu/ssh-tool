import React from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle, HiOutlineXMark } from 'react-icons/hi2';
import useUIStore from '../store/uiStore';

const icons = {
  success: HiOutlineCheckCircle,
  error: HiOutlineExclamationCircle,
  warning: HiOutlineExclamationCircle,
  info: HiOutlineInformationCircle,
};

const colors = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || icons.info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-up ${colors[toast.type] || colors.info}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-xs flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="p-0.5 hover:opacity-70 flex-shrink-0">
              <HiOutlineXMark className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
