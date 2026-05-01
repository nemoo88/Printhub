import { t, type Language } from '@/lib/ace-translations';
import { Wifi, WifiOff } from 'lucide-react';

interface Props {
  connected: boolean;
  lang: Language;
}

export function ConnectionBadge({ connected, lang }: Props) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
      connected ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
    }`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className={`animate-pulse-dot absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-success' : 'bg-destructive'}`} />
      </span>
      {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {t(lang, connected ? 'header.connected' : 'header.disconnected')}
    </div>
  );
}
