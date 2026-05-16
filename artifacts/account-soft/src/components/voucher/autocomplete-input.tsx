import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string, extra?: any) => void;
  suggestions: { label: string; sublabel?: string; data?: any }[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  icon?: React.ReactNode;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  inputClassName,
  disabled,
  onKeyDown,
  autoFocus,
  icon,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.length >= 1
    ? suggestions.filter(s => s.label.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    setHighlighted(0);
    setOpen(filtered.length > 0);
  }, [filtered.length, value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectItem = useCallback((item: { label: string; data?: any }) => {
    onChange(item.label);
    onSelect?.(item.label, item.data);
    setOpen(false);
    setTimeout(() => inputRef.current?.blur(), 50);
  }, [onChange, onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return; }
      if (e.key === "Enter" && filtered[highlighted]) { e.preventDefault(); selectItem(filtered[highlighted]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
          {icon}
        </div>
      )}
      <Input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => filtered.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(icon && "pl-9", inputClassName)}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="autocomplete-list">
          {filtered.map((item, i) => (
            <div
              key={item.label}
              className={cn("autocomplete-item", i === highlighted && "highlighted")}
              onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="flex-1">{item.label}</span>
              {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
