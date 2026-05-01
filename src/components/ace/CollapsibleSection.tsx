import { useState, useEffect, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'printhub-sections';

function loadVisibility(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveVisibility(state: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

interface Props {
  id: string;
  title: string;
  defaultOpen?: boolean;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ id, title, defaultOpen = true, icon, actions, children }: Props) {
  const [open, setOpen] = useState(() => {
    const stored = loadVisibility();
    return stored[id] !== undefined ? stored[id] : defaultOpen;
  });

  useEffect(() => {
    const stored = loadVisibility();
    stored[id] = open;
    saveVisibility(stored);
  }, [id, open]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-sm font-semibold tracking-tight hover:text-primary transition-colors"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {icon}
          {title}
        </button>
        {open && actions}
      </div>
      {open && children}
    </div>
  );
}
