import { useState } from 'react';
import { type HeaterStatus } from '@/hooks/usePrinterStatus';
import { t, type Language } from '@/lib/ace-translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Thermometer, Flame } from 'lucide-react';

interface Props {
  heaters: HeaterStatus[];
  lang: Language;
  onSetTemp: (name: string, target: number) => Promise<{ ok: boolean; response: string }>;
}

export function TemperaturesCard({ heaters, lang, onSetTemp }: Props) {
  const [editingHeater, setEditingHeater] = useState<string | null>(null);
  const [tempInput, setTempInput] = useState('');

  const handleSetTemp = async (name: string) => {
    const target = Number(tempInput);
    if (!isNaN(target) && target >= 0) {
      await onSetTemp(name, target);
      setEditingHeater(null);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Thermometer className="h-3.5 w-3.5 text-destructive" />
          {t(lang, 'printer.temperatures')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-0">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-muted-foreground pb-1 border-b border-border/30 px-1">
          <span>{t(lang, 'printer.name')}</span>
          <span className="w-16 text-right">{t(lang, 'printer.power')}</span>
          <span className="w-20 text-right">{t(lang, 'printer.actual')}</span>
          <span className="w-20 text-right">{t(lang, 'printer.target')}</span>
        </div>
        {heaters.map(heater => (
          <div key={heater.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-1 border-b border-border/20 last:border-0 px-1">
            <div className="flex items-center gap-1.5">
              <Flame className={`h-2.5 w-2.5 ${heater.power > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium capitalize">{heater.name}</span>
            </div>
            <span className="w-16 text-right text-xs text-muted-foreground">
              {heater.power > 0 ? `${Math.round(heater.power * 100)}%` : 'off'}
            </span>
            <span className="w-20 text-right text-sm font-mono">
              {heater.temperature.toFixed(1)}°C
            </span>
            <div className="w-20 flex justify-end">
              {editingHeater === heater.name ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSetTemp(heater.name); }} className="flex gap-1">
                  <Input
                    type="number"
                    value={tempInput}
                    onChange={e => setTempInput(e.target.value)}
                    className="h-6 w-14 text-xs bg-secondary/50 px-1"
                    autoFocus
                    onBlur={() => setEditingHeater(null)}
                  />
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs font-mono hover:bg-secondary"
                  onClick={() => { setEditingHeater(heater.name); setTempInput(String(heater.target)); }}
                >
                  {heater.target > 0 ? `${heater.target}°C` : '—'}
                </Button>
              )}
            </div>
          </div>
        ))}
        {heaters.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">{t(lang, 'printer.noData')}</p>
        )}
      </CardContent>
    </Card>
  );
}
