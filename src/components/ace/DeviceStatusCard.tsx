import { t, type Language } from '@/lib/ace-translations';
import { type DeviceStatus } from '@/hooks/useAceStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cpu, Thermometer, Fan, Radio } from 'lucide-react';

interface Props {
  status: DeviceStatus;
  lang: Language;
}

function StatusBadge({ status, lang }: { status: string; lang: Language }) {
  const colors: Record<string, string> = {
    ready: 'bg-success/15 text-success border-success/30',
    busy: 'bg-warning/15 text-warning border-warning/30',
    unknown: 'bg-muted text-muted-foreground border-border',
    disconnected: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={`${colors[status] || colors.unknown} uppercase text-xs`}>
      {t(lang, `statusMap.${status}`) || status}
    </Badge>
  );
}

export function DeviceStatusCard({ status, lang }: Props) {
  const rows = [
    { icon: Cpu, label: t(lang, 'deviceInfo.model'), value: status.model || '—' },
    { icon: Cpu, label: t(lang, 'deviceInfo.firmware'), value: status.firmware || '—' },
    { icon: Thermometer, label: t(lang, 'deviceInfo.temp'), value: `${status.temp.toFixed(1)}°C` },
    { icon: Fan, label: t(lang, 'deviceInfo.fan'), value: `${Math.round((status.fan_speed / 7000) * 100)}%` },
    { icon: Radio, label: t(lang, 'deviceInfo.rfid'), value: status.enable_rfid ? t(lang, 'deviceInfo.rfidOn') : t(lang, 'deviceInfo.rfidOff') },
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">{t(lang, 'cards.deviceStatus')}</CardTitle>
        <StatusBadge status={status.status} lang={lang} />
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            <span className="text-sm font-semibold">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
