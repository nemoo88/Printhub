import { useState } from 'react';
import { type FanStatus } from '@/hooks/usePrinterStatus';
import { t, type Language } from '@/lib/ace-translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Fan } from 'lucide-react';

interface Props {
  fans: FanStatus[];
  lang: Language;
  onSetFanSpeed: (name: string, speed: number) => Promise<{ ok: boolean; response: string }>;
  title?: string;
}

export function FansOutputsCard({ fans, lang, onSetFanSpeed, title }: Props) {
  const [adjusting, setAdjusting] = useState<Record<string, number>>({});

  const handleChange = (name: string, value: number[]) => {
    setAdjusting(prev => ({ ...prev, [name]: value[0] }));
  };

  const handleCommit = async (name: string, value: number[]) => {
    await onSetFanSpeed(name, value[0]);
    setAdjusting(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Fan className="h-3.5 w-3.5 text-info" />
          {title || t(lang, 'printer.fansOutputs')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-3">
        {fans.map(fan => {
          const displaySpeed = adjusting[fan.name] ?? fan.speed;
          return (
            <div key={fan.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{fan.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(displaySpeed)}%</span>
              </div>
              <Slider
                value={[displaySpeed]}
                max={100}
                step={1}
                onValueChange={(v) => handleChange(fan.name, v)}
                onValueCommit={(v) => handleCommit(fan.name, v)}
                className="w-full"
              />
            </div>
          );
        })}
        {fans.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">{t(lang, 'printer.noData')}</p>
        )}
      </CardContent>
    </Card>
  );
}
