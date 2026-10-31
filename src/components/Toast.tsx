import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : t.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
              : 'bg-zinc-900/90 border-zinc-700/50 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span className="font-medium text-xs leading-snug">{t.message}</span>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
