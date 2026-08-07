import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  stat?: {
    value: string | number;
    label: string;
  };
  accent?: 'primary' | 'accent' | 'success' | 'warning' | 'info';
}

const accentColors = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/30 text-accent-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

export const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  description,
  icon: Icon,
  href,
  stat,
  accent = 'primary'
}) => {
  return (
    <Link to={href} className="group block">
      <div className="module-card h-full">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", accentColors[accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
        </div>
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {stat && (
          <div className="mt-4 flex items-baseline gap-2 border-t border-border pt-4">
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
        )}
      </div>
    </Link>
  );
};
