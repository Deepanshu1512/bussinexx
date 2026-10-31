import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  glowVariant?: 'sky' | 'emerald' | 'amber' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  glowVariant = 'sky',
}) => {
  const glowClasses = {
    sky: 'hover:border-sky-500/30 glow-primary',
    emerald: 'hover:border-emerald-500/30 glow-emerald',
    amber: 'hover:border-amber-500/30 glow-amber',
    purple: 'hover:border-purple-500/30 glow-purple',
  };

  const iconBgClasses = {
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-white/5 transition-all duration-300 ${glowClasses[glowVariant]}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className={`p-2.5 rounded-xl border ${iconBgClasses[glowVariant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-white font-mono">{value}</h3>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        {trend ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold px-1.5 py-0.5 rounded ${
                trend.isPositive
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {trend.value}
            </span>
            {trend.label && <span className="text-zinc-500">{trend.label}</span>}
          </div>
        ) : (
          <span className="text-zinc-500">{subtitle || 'Updated live'}</span>
        )}
      </div>
    </div>
  );
};
