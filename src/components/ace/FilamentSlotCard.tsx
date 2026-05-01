import { t, type Language } from '@/lib/ace-translations';
import { type SlotData } from '@/hooks/useAceStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, ParkingSquare, Zap, ZapOff, ArrowDown, ArrowUp } from 'lucide-react';

interface Props {
  slot: SlotData;
  lang: Language;
  feedAssistSlot: number;
  onLoad: (index: number) => void;
  onPark: (index: number) => void;
  onToggleAssist: (index: number) => void;
  onFeed: (index: number) => void;
  onRetract: (index: number) => void;
}

function getColorHex(color: number[]): string {
  if (!color || color.length < 3) return '#000000';
  const r = Math.max(0, Math.min(255, color[0])).toString(16).padStart(2, '0');
  const g = Math.max(0, Math.min(255, color[1])).toString(16).padStart(2, '0');
  const b = Math.max(0, Math.min(255, color[2])).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function getRfidText(rfid: number, lang: Language): string {
  const value = t(lang, `rfidStatusMap.${rfid}`);
  return value === `rfidStatusMap.${rfid}` ? t(lang, 'common.unknown') : value;
}

const statusBorder: Record<string, string> = {
  ready: 'border-success/50',
  empty: 'border-muted-foreground/30',
  busy: 'border-warning/50',
};

const statusBadgeClass: Record<string, string> = {
  ready: 'bg-success/15 text-success border-success/30',
  empty: 'bg-muted text-muted-foreground border-border',
  busy: 'bg-warning/15 text-warning border-warning/30',
};

export function FilamentSlotCard({ slot, lang, feedAssistSlot, onLoad, onPark, onToggleAssist, onFeed, onRetract }: Props) {
  const hex = getColorHex(slot.color);
  const isAssistActive = feedAssistSlot === slot.index;

  return (
    <Card className={`border-2 ${statusBorder[slot.status] || 'border-border/50'} bg-card/80 backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-primary/5`}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{t(lang, 'slots.slot')} {slot.index + 1}</h3>
          <Badge variant="outline" className={`${statusBadgeClass[slot.status] || statusBadgeClass.empty} uppercase text-xs`}>
            {t(lang, `slotStatusMap.${slot.status}`) || slot.status}
          </Badge>
        </div>

        {/* Color swatch */}
        <div className="relative h-14 w-full rounded-lg border border-border/50 flex items-center justify-center" style={{ backgroundColor: hex }}>
          <span className="rounded bg-background/90 px-2 py-0.5 text-xs font-mono font-semibold">{hex.toUpperCase()}</span>
        </div>

        {/* Info */}
        <div className="space-y-1.5 text-sm">
          {[
            { label: t(lang, 'slots.type'), value: slot.type || '—' },
            { label: t(lang, 'slots.sku'), value: slot.sku || '—' },
            { label: t(lang, 'slots.rfid'), value: getRfidText(slot.rfid, lang) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-1 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground text-xs">{label}</span>
              <span className="font-medium text-xs">{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onLoad(slot.index)}>
            <Upload className="h-3 w-3" /> {t(lang, 'buttons.load')}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onPark(slot.index)}>
            <ParkingSquare className="h-3 w-3" /> {t(lang, 'buttons.park')}
          </Button>
          <Button
            size="sm"
            variant={isAssistActive ? 'default' : 'outline'}
            className={`h-8 text-xs gap-1 ${isAssistActive ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`}
            onClick={() => onToggleAssist(slot.index)}
          >
            {isAssistActive ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            {isAssistActive ? t(lang, 'buttons.assistOn') : t(lang, 'buttons.assistOff')}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onFeed(slot.index)}>
            <ArrowDown className="h-3 w-3" /> {t(lang, 'buttons.feed')}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1 col-span-2" onClick={() => onRetract(slot.index)}>
            <ArrowUp className="h-3 w-3" /> {t(lang, 'buttons.retract')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
