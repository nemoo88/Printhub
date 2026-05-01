import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { t, type Language } from '@/lib/ace-translations';
import { type GcodeFile } from '@/hooks/usePrintControl';
import { FolderOpen, Search, FileText, Play, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: GcodeFile[];
  loading: boolean;
  lang: Language;
  onLoadFiles: () => void;
  onStart: (filename: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatEstTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m`;
  return `~${m}m`;
}

export function StartPrintDialog({ open, onOpenChange, files, loading, lang, onLoadFiles, onStart }: Props) {
  const [search, setSearch] = useState('');
  const [confirmFile, setConfirmFile] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      onLoadFiles();
      setSearch('');
      setConfirmFile(null);
    }
  }, [open]);

  const filtered = search
    ? files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()))
    : files;

  const handleStart = (filename: string) => {
    if (confirmFile === filename) {
      onStart(filename);
      onOpenChange(false);
    } else {
      setConfirmFile(filename);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {t(lang, 'printer.selectFile')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setConfirmFile(null); }}
              placeholder={t(lang, 'printer.searchFiles')}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onLoadFiles} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          {loading && files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t(lang, 'printer.loadingFiles')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t(lang, 'printer.noFiles')}</div>
          ) : (
            <div className="space-y-1 pr-3">
              {filtered.map(f => {
                const isConfirm = confirmFile === f.path;
                return (
                  <div
                    key={f.path}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      isConfirm ? 'border-primary bg-primary/10' : 'border-border/50 bg-card/80 hover:bg-muted/50'
                    }`}
                    onClick={() => handleStart(f.path)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{f.path}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatSize(f.size)}</span>
                        <span>{formatDate(f.modified)}</span>
                        {f.estimated_time && <span>{formatEstTime(f.estimated_time)}</span>}
                      </div>
                    </div>
                    {isConfirm ? (
                      <Button size="sm" className="h-6 text-xs gap-1 bg-success text-success-foreground hover:bg-success/90 shrink-0">
                        <Play className="h-3 w-3" /> {t(lang, 'printer.confirmStart')}
                      </Button>
                    ) : (
                      <Play className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
