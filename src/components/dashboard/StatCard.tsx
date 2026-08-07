import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}

const variants = {
  default: 'bg-card',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-success/5 border-success/20',
  warning: 'bg-warning/5 border-warning/20',
  destructive: 'bg-destructive/5 border-destructive/20',
};

const iconVariants = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default'
}) => {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-3 sm:p-5 shadow-card transition-all hover:shadow-md min-w-0",
      variants[variant]
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0", iconVariants[variant])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
      
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {trend.direction === 'up' ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          <span className={cn(
            "text-sm font-medium",
            trend.direction === 'up' ? "text-success" : "text-destructive"
          )}>
            {trend.value}%
          </span>
          <span className="text-sm text-muted-foreground">from last week</span>
        </div>
      )}
    </div>
  );
};
