'use client';

// =============================================================================
// components/vendor/MetricCard.tsx
// KPI widget for the vendor dashboard.
// Each card shows a single number with a label, trend indicator, and
// optional sparkline-style sub-label.
//
// Used for: Total Views, Total Redemptions, Conversion Rate, Active Offers.
// =============================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  title: string;
  value: string | number;
  subLabel?: string;
  trend?: {
    direction: TrendDirection;
    label: string;            // e.g., "+12% vs last week"
  };
  icon: React.ReactNode;
  accentColor: 'green' | 'blue' | 'purple' | 'amber';
  loading?: boolean;
}

const COLOR_MAP = {
  green:  { bg: 'bg-vendor-50',  icon: 'bg-vendor-100  text-vendor-600',  trend: 'text-vendor-600',  value: 'text-vendor-700'  },
  blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-100    text-blue-600',     trend: 'text-blue-600',    value: 'text-blue-700'    },
  purple: { bg: 'bg-brand-50',   icon: 'bg-brand-100   text-brand-600',    trend: 'text-brand-600',   value: 'text-brand-700'   },
  amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-100   text-amber-600',    trend: 'text-amber-600',   value: 'text-amber-700'   },
};

export default function MetricCard({
  title, value, subLabel, trend, icon, accentColor, loading = false,
}: MetricCardProps) {
  const colors = COLOR_MAP[accentColor];

  const TrendIcon =
    trend?.direction === 'up'   ? TrendingUp   :
    trend?.direction === 'down' ? TrendingDown : Minus;

  const trendColorClass =
    trend?.direction === 'up'   ? 'text-vendor-600' :
    trend?.direction === 'down' ? 'text-red-500'    : 'text-gray-400';

  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 bg-gray-100 rounded w-24" />
          <div className="w-9 h-9 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-8 bg-gray-100 rounded w-20 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  return (
    <div className={`card p-5 transition-shadow duration-200 hover:shadow-card-hover`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
          {icon}
        </div>
      </div>

      {/* Main metric */}
      <div className="metric-number text-gray-900 mb-1">
        {value}
      </div>

      {/* Sub-label */}
      {subLabel && (
        <p className="text-xs text-gray-500 mb-2">{subLabel}</p>
      )}

      {/* Trend indicator */}
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${trendColorClass}`}>
          <TrendIcon size={13} />
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
