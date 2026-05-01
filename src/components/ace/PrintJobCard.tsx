import { type PrintJobStatus } from '@/hooks/usePrinterStatus';
import { type SpoolmanSpool } from '@/hooks/useSpoolman';
import { t, type Language } from '@/lib/ace-translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Printer, Clock, Gauge, Palette, Pause, Play, Square, FolderOpen, Weight } from 'lucide-react';

/** Convert filament length (mm) to grams using diameter (mm) and density (g/cm³) */
function mmToGrams(mm: number, diameter = 1.75, density = 1.24): number {
  const radiusCm = (diameter / 2) / 10;
  const lengthCm = mm / 10;
  const volumeCm3 = Math.PI * radiusCm * radiusCm * lengthCm;
  return volumeCm3 * density;
}

interface Props {
  job: PrintJobStatus;
  speedFactor: number;
  activeTool: number;
  lang: Language;
  activeSpool?: SpoolmanSpool | null;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onStartDialog?: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const stateColors: Record<string, string> = {
  printing: 'bg-success/15 text-success border-success/30',
  paused: 'bg-warning/15 text-warning border-warning/30',
  complete: 'bg-info/15 text-info border-info/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
  standby: 'bg-muted text-muted-foreground border-border',
};

export function PrintJobCard({ job, speedFactor, activeTool, lang, activeSpool, onPause, onResume, onCancel, onStartDialog }: Props) {
  const isPrinting = job.state === 'printing';
  const isPaused = job.state === 'paused';
  const isActive = isPrinting || isPaused;
  const estimatedTotal = job.progress > 0 ? (job.printDuration / (job.progress / 100)) : 0;
  const remaining = estimatedTotal - job.printDuration;
  const fm = job.filamentMeta;
  const toolLabel = activeTool >= 0 ? `T${activeTool}` : '—';

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5 text-primary" />
            {t(lang, 'printer.printJob')}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`uppercase text-[10px] px-1.5 py-0 ${stateColors[job.state] || stateColors.standby}`}>
              {t(lang, `printer.states.${job.state}`) || job.state}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-3">
        {isPrinting && (
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground truncate max-w-[200px]">{job.filename || '—'}</span>
              <span className="font-bold text-primary">{job.progress.toFixed(1)}%</span>
            </div>
            <Progress value={job.progress} className="h-2.5" />
          </div>
        )}

        {isPaused && job.filename && (
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground truncate max-w-[200px]">{job.filename}</span>
              <span className="font-bold text-warning">{job.progress.toFixed(1)}%</span>
            </div>
            <Progress value={job.progress} className="h-2.5" />
          </div>
        )}

        {/* Filament info from slicer */}
        {fm && (fm.material || fm.name) && (
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
            <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
            {fm.color && (
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: fm.color.startsWith('#') ? fm.color : `#${fm.color}` }}
              />
            )}
            <div className="min-w-0 text-sm">
              <span className="font-medium">{fm.material || 'Filament'}</span>
              {fm.name && <span className="text-muted-foreground ml-1.5">{fm.name}</span>}
              {fm.weight > 0 && <span className="text-muted-foreground ml-1.5">({(fm.weight).toFixed(0)}g)</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Clock, label: t(lang, 'printer.elapsed'), value: formatDuration(job.printDuration) },
            {
              icon: Clock,
              label: t(lang, 'printer.remaining'),
              value: (() => {
                if (!isActive) return '—';
                // Prefer slicer estimate when available
                if (job.estimatedTime && job.estimatedTime > 0) {
                  const slicerRemaining = job.estimatedTime - job.printDuration;
                  return slicerRemaining > 0 ? formatDuration(slicerRemaining) : '—';
                }
                return remaining > 0 ? formatDuration(remaining) : '—';
              })(),
            },
            ...(isActive && job.estimatedTime && job.estimatedTime > 0 ? [{
              icon: Clock,
              label: lang === 'sv' ? 'Live uppsk.' : 'Live est.',
              value: remaining > 0 ? formatDuration(remaining) : '—',
            }] : []),
            ...(isActive ? [{
              icon: Clock,
              label: 'ETA',
              value: (() => {
                let remainingSec = 0;
                if (job.estimatedTime && job.estimatedTime > 0) {
                  remainingSec = job.estimatedTime - job.printDuration;
                } else if (remaining > 0) {
                  remainingSec = remaining;
                }
                if (remainingSec <= 0) return '—';
                const eta = new Date(Date.now() + remainingSec * 1000);
                return eta.toLocaleTimeString(lang === 'sv' ? 'sv-SE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
              })(),
            }] : []),
            { icon: Gauge, label: t(lang, 'printer.speed'), value: `${Math.round(speedFactor * 100)}%` },
            ...(job.filamentUsed > 0 ? [{
              icon: Weight,
              label: t(lang, 'printer.filamentUsed'),
              value: (() => {
                const diameter = activeSpool?.filament?.diameter ?? 1.75;
                const density = activeSpool?.filament?.density ?? 1.24;
                const grams = mmToGrams(job.filamentUsed, diameter, density);
                return `${grams.toFixed(1)}g (${(job.filamentUsed / 1000).toFixed(2)}m)`;
              })(),
            }] : []),
            { icon: Gauge, label: 'Tool', value: toolLabel },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                <p className="font-medium leading-tight">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Print control buttons */}
        <div className="flex gap-2">
          {!isActive && onStartDialog && (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={onStartDialog}>
              <FolderOpen className="h-3.5 w-3.5" /> {t(lang, 'printer.startPrint')}
            </Button>
          )}
          {isPrinting && onPause && (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs border-warning/50 text-warning hover:bg-warning/10" onClick={onPause}>
              <Pause className="h-3.5 w-3.5" /> {t(lang, 'printer.pause')}
            </Button>
          )}
          {isPaused && onResume && (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs border-success/50 text-success hover:bg-success/10" onClick={onResume}>
              <Play className="h-3.5 w-3.5" /> {t(lang, 'printer.resume')}
            </Button>
          )}
          {isActive && onCancel && (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/10" onClick={onCancel}>
              <Square className="h-3.5 w-3.5" /> {t(lang, 'printer.cancel')}
            </Button>
          )}
        </div>

        {!isActive && job.filename && (
          <p className="text-xs text-muted-foreground truncate">{t(lang, 'printer.lastFile')}: {job.filename}</p>
        )}
      </CardContent>
    </Card>
  );
}
