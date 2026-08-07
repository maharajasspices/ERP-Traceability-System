import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => 
    options.find(opt => opt.value === value), 
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options.slice(0, 50);
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.sublabel?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50);
  }, [options, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer transition-all duration-200",
          isOpen && "ring-2 ring-ring ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn(
            "truncate",
            !selectedOption && "text-muted-foreground"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 ml-2">
          {value && !isOpen && (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleClear}
            />
          )}
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto animate-fade-in">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-accent",
                  option.value === value && "bg-accent"
                )}
                onClick={() => handleSelect(option.value)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{option.label}</div>
                    {option.sublabel && (
                      <div className="text-xs text-muted-foreground truncate">{option.sublabel}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {option.badge && (
                      <Badge variant="outline" className="text-xs">{option.badge}</Badge>
                    )}
                    {option.value === value && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
