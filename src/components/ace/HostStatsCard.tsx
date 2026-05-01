import { type HostStats } from '@/hooks/useHostStats';
import { type Language } from '@/lib/ace-translations';
import { Card, CardContent } from '@/components/ui/card';
import { Cpu, MemoryStick, HardDrive, Thermometer, Clock, Server, CircuitBoard } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  stats: HostStats;
  loading: boolean;
  lang: Language;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: React.ReactNode;
}

function InfoRow({ icon: Icon, label, value, sub }: InfoRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </span>
        <span className="text-xs font-mono font-semibold">{value}</span>
      </div>
      {sub}
    </div>
  );
}

export function HostStatsCard({ stats, loading, lang }: Props) {
  if (loading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
        <CardContent className="py-4 px-4 text-xs text-muted-foreground">
          {lang === 'sv' ? 'Laddar systeminfo...' : 'Loading system info...'}
        </CardContent>
      </Card>
    );
  }

  const memPct = stats.memTotal > 0 ? (stats.memUsed / stats.memTotal) * 100 : 0;
  const diskPct = stats.diskTotal > 0 ? (stats.diskUsed / stats.diskTotal) * 100 : 0;
  const deviceLabel = stats.cpuModel || stats.hostname || '—';
  const osLabel = stats.distribution || '';

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
      <CardContent className="py-3 px-4 space-y-1.5">
        {/* Device header */}
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/30 mb-1">
          <Server className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{deviceLabel}</p>
            {osLabel && <p className="text-[10px] text-muted-foreground truncate">{osLabel}{stats.cpuCount > 0 ? ` · ${stats.cpuCount} cores` : ''}</p>}
          </div>
        </div>

        {/* Stats list */}
        <InfoRow
          icon={Thermometer}
          label={lang === 'sv' ? 'CPU Temp' : 'CPU Temp'}
          value={stats.cpuTemp != null ? `${stats.cpuTemp.toFixed(1)}°C` : '—'}
        />

        <InfoRow
          icon={Cpu}
          label={lang === 'sv' ? 'CPU Last' : 'CPU Load'}
          value={`${stats.cpuUsage.toFixed(0)}%`}
        />

        <InfoRow
          icon={MemoryStick}
          label="RAM"
          value={stats.memTotal > 0 ? `${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}` : '—'}
        />

        {stats.diskTotal > 0 && (
          <InfoRow
            icon={HardDrive}
            label="Disk"
            value={`${formatBytes(stats.diskUsed)} / ${formatBytes(stats.diskTotal)}`}
          />
        )}

        {stats.uptime > 0 && (
          <InfoRow
            icon={Clock}
            label="Uptime"
            value={formatUptime(stats.uptime)}
          />
        )}

        {/* MCU temperatures */}
        {stats.mcus.map(mcu => (
          mcu.temperature != null && (
            <InfoRow
              key={mcu.name}
              icon={CircuitBoard}
              label={`${mcu.name} Temp`}
              value={`${mcu.temperature.toFixed(1)}°C`}
            />
          )
        ))}
      </CardContent>
    </Card>
  );
}
