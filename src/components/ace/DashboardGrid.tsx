import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, RotateCcw, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';

const ResponsiveGridLayout = Responsive as any;

const LAYOUT_KEY = 'printhub-dashboard-layout';
const COLLAPSED_KEY = 'printhub-collapsed-widgets';

type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };

function loadCollapsed(): Record<string, boolean> {
  try {
    const s = localStorage.getItem(COLLAPSED_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveCollapsed(state: Record<string, boolean>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state)); } catch {}
}
type LayoutMap = Record<string, LayoutItem[]>;

export interface DashboardWidget {
  id: string;
  title: string;
  content: ReactNode;
  defaultLayout: { w: number; h: number; minW?: number; minH?: number };
  visible?: boolean;
}

function buildDefaultLayouts(widgets: DashboardWidget[]): LayoutMap {
  const lg: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let rowMaxH = 0;

  widgets.forEach((w) => {
    if (w.visible === false) return;
    const dl = w.defaultLayout;
    if (x + dl.w > 12) {
      x = 0;
      y += rowMaxH;
      rowMaxH = 0;
    }
    lg.push({
      i: w.id,
      x,
      y,
      w: dl.w,
      h: dl.h,
      minW: dl.minW ?? 1,
      minH: dl.minH ?? 1,
    });
    rowMaxH = Math.max(rowMaxH, dl.h);
    x += dl.w;
  });

  const md = lg.map(l => ({ ...l, w: Math.min(l.w, 10), x: l.x >= 10 ? 0 : l.x }));
  // Mobile: stack full-width, auto y
  const sm = lg.map((l, i) => ({ ...l, w: 2, x: 0, y: i * l.h }));
  const xs = lg.map((l, i) => ({ ...l, w: 2, x: 0, y: i * l.h }));

  return { lg, md, sm, xs };
}

function loadLayouts(): LayoutMap | null {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveLayouts(layouts: LayoutMap) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts)); } catch {}
}

interface Props {
  widgets: DashboardWidget[];
  lang: 'sv' | 'en';
}

export function DashboardGrid({ widgets, lang }: Props) {
  const [editMode, setEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>(loadCollapsed);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedWidgets(prev => {
      const next = { ...prev, [id]: !prev[id] };
      saveCollapsed(next);
      return next;
    });
  }, []);

  const isMobile = containerWidth < 768;

  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible !== false), [widgets]);
  const defaultLayouts = useMemo(() => buildDefaultLayouts(visibleWidgets), [visibleWidgets]);

  const [layouts, setLayouts] = useState<LayoutMap>(() => {
    const saved = loadLayouts();
    if (saved) {
      const visibleIds = new Set(visibleWidgets.map(w => w.id));
      const merged: LayoutMap = {};
      for (const bp of Object.keys(defaultLayouts)) {
        const defaultsBp = defaultLayouts[bp] || [];
        const defaultsById = new Map(defaultsBp.map(item => [item.i, item]));
        const savedBp = (saved[bp] || [])
          .filter(l => visibleIds.has(l.i))
          .map(l => {
            const d = defaultsById.get(l.i);
            return d ? { ...l, minW: d.minW, minH: d.minH } : l;
          });
        const savedIds = new Set(savedBp.map(l => l.i));
        const newItems = defaultsBp.filter(l => !savedIds.has(l.i));
        merged[bp] = [...savedBp, ...newItems];
      }
      return merged;
    }
    return defaultLayouts;
  });

  const handleLayoutChange = useCallback((_layout: LayoutItem[], allLayouts: LayoutMap) => {
    if (!editMode) return;
    setLayouts(allLayouts);
    saveLayouts(allLayouts);
  }, [editMode]);

  const handleReset = useCallback(() => {
    setLayouts(defaultLayouts);
    saveLayouts(defaultLayouts);
  }, [defaultLayouts]);

  const lockedLayouts = useMemo(() => {
    if (editMode) return layouts;
    const locked: LayoutMap = {};
    for (const bp of Object.keys(layouts)) {
      locked[bp] = layouts[bp].map(item => ({ ...item, static: true }));
    }
    return locked;
  }, [layouts, editMode]);

  return (
    <div ref={containerRef}>
      {!isMobile && (
        <div className="flex items-center justify-end gap-1.5 mb-2">
          {editMode && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleReset}>
              <RotateCcw className="h-3 w-3" /> {lang === 'sv' ? 'Återställ layout' : 'Reset layout'}
            </Button>
          )}
          <Button
            variant={editMode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {editMode
              ? (lang === 'sv' ? 'Lås layout' : 'Lock layout')
              : (lang === 'sv' ? 'Redigera layout' : 'Edit layout')
            }
          </Button>
        </div>
      )}

      {isMobile ? (
        <div className="flex flex-col gap-3">
          {visibleWidgets.map(widget => {
            const isCollapsed = !!collapsedWidgets[widget.id];
            return (
              <div key={widget.id} className="w-full">
                <button
                  onClick={() => toggleCollapse(widget.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-tight hover:text-primary transition-colors mb-1"
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {widget.title}
                </button>
                {!isCollapsed && widget.content}
              </div>
            );
          })}
        </div>
      ) : (
        <ResponsiveGridLayout
          className="dashboard-grid"
          width={containerWidth}
          layouts={lockedLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={80}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          compactType="vertical"
          margin={[12, 12] as [number, number]}
        >
          {visibleWidgets.map(widget => {
            const isCollapsed = !!collapsedWidgets[widget.id];
            return (
              <div key={widget.id} className={`relative ${editMode ? 'ring-1 ring-primary/30 ring-dashed rounded-lg' : ''}`}>
                {editMode && (
                  <div className="drag-handle absolute top-1 left-1 z-10 cursor-grab active:cursor-grabbing p-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors">
                    <GripVertical className="h-3.5 w-3.5 text-primary/60" />
                  </div>
                )}
                <button
                  onClick={() => toggleCollapse(widget.id)}
                  className="absolute top-1 right-1 z-10 p-0.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  title={isCollapsed ? 'Expand' : 'Minimize'}
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <div className="h-full overflow-hidden">
                  {isCollapsed ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{widget.title}</div>
                  ) : widget.content}
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}