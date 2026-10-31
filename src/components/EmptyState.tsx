import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
      <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 mb-4 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 tracking-tight">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-sm mt-1.5 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/10 cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
