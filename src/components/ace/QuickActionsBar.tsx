import { t, type Language } from '@/lib/ace-translations';
import { Button } from '@/components/ui/button';
import { Unplug, ShieldOff, RefreshCw } from 'lucide-react';

interface Props {
  lang: Language;
  onUnload: () => void;
  onStopAssist: () => void;
  onRefresh: () => void;
}

export function QuickActionsBar({ lang, onUnload, onStopAssist, onRefresh }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="gap-1.5 border-primary/30 hover:bg-primary/10" onClick={onUnload}>
        <Unplug className="h-4 w-4" /> {t(lang, 'quickActions.unload')}
      </Button>
      <Button variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={onStopAssist}>
        <ShieldOff className="h-4 w-4" /> {t(lang, 'quickActions.stopAssist')}
      </Button>
      <Button variant="outline" className="gap-1.5 border-info/30 text-info hover:bg-info/10" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" /> {t(lang, 'quickActions.refresh')}
      </Button>
    </div>
  );
}
