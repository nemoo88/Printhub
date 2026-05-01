import { useState, useEffect, useRef } from 'react';
import { t, type Language } from '@/lib/ace-translations';
import { type DryerStatus } from '@/hooks/useAceStatus';
import { type AceConfig } from '@/config/ace-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Flame, Square, Thermometer, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dryer: DryerStatus;
  config: AceConfig;
  lang: Language;
  onCommand: (cmd: string, params?: Record<string, unknown>) => Promise<boolean>;
  /** Current printer job state for auto-dryer */
  printJobState?: string;
  /** Estimated remaining print time in seconds for auto-dryer duration */
  printRemainingSeconds?: number;
}

function formatTime(minutes: number, lang: Language): string {
  if (!minutes || minutes <= 0) return `0 ${t(lang, 'time.minutes')}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}${t(lang, 'time.hours')} ${m}${t(lang, 'time.minutesShort')}`;
  return `${m} ${t(lang, 'time.minutes')}`;
}

function formatRemaining(minutes: number, lang: Language): string {
  if (!minutes || minutes <= 0) return `0${t(lang, 'time.minutesShort')} 0${t(lang, 'time.secondsShort')}`;
  const totalMin = Math.floor(minutes);
  const secs = Math.round((minutes - totalMin) * 60);
  if (totalMin > 0) {
    return secs > 0 ? `${totalMin}${t(lang, 'time.minutesShort')} ${secs}${t(lang, 'time.secondsShort')}` : `${totalMin}${t(lang, 'time.minutesShort')}`;
  }
  return `${secs}${t(lang, 'time.secondsShort')}`;
}

const AUTO_DRYER_KEY = 'printhub-auto-dryer';
const AUTO_STARTED_KEY = 'printhub-auto-dryer-started';

export function DryerControlCard({ dryer, config, lang, onCommand, printJobState, printRemainingSeconds }: Props) {
  const [temp, setTemp] = useState(config.defaults.dryingTemp);
  const [duration, setDuration] = useState(config.defaults.dryingDuration);
  const [autoDryer, setAutoDryer] = useState(() => {
    try { return localStorage.getItem(AUTO_DRYER_KEY) === 'true'; } catch { return false; }
  });
  const [autoStarted, setAutoStarted] = useState(() => {
    try { return localStorage.getItem(AUTO_STARTED_KEY) === 'true'; } catch { return false; }
  });
  const prevPrintStateRef = useRef(printJobState);
  const isDrying = dryer.status === 'drying' || dryer.remain_time > 0;
  const progress = dryer.duration > 0 ? Math.max(0, Math.min(100, ((dryer.duration - dryer.remain_time) / dryer.duration) * 100)) : 0;

  useEffect(() => {
    setTemp(config.defaults.dryingTemp);
    setDuration(config.defaults.dryingDuration);
  }, [config.defaults.dryingTemp, config.defaults.dryingDuration]);

  // Persist auto-dryer toggle
  useEffect(() => {
    try { localStorage.setItem(AUTO_DRYER_KEY, String(autoDryer)); } catch {}
  }, [autoDryer]);
  useEffect(() => {
    try { localStorage.setItem(AUTO_STARTED_KEY, String(autoStarted)); } catch {}
  }, [autoStarted]);

  // Auto-start dryer on transition into printing and auto-stop when print leaves active states
  useEffect(() => {
    const prevState = prevPrintStateRef.current;
    prevPrintStateRef.current = printJobState;

    if (!autoDryer) {
      setAutoStarted(false);
      return;
    }

    const printWasActive = prevState === 'printing' || prevState === 'paused';
    const printIsActive = printJobState === 'printing' || printJobState === 'paused';
    const justStarted = printJobState === 'printing' && prevState !== 'printing' && prevState !== undefined;

    // Adopt an already-running dryer at print start (e.g. after reconnect) so stop logic still works
    if (justStarted && isDrying && !autoStarted) {
      setAutoStarted(true);
    }

    if (justStarted && !autoStarted && !isDrying) {
      const printMinutes = printRemainingSeconds ? Math.ceil(printRemainingSeconds / 60) : 0;
      // Use print remaining time + 15 min buffer; fall back to manual duration if no print time available
      const autoDuration = printMinutes > 0 ? printMinutes + 15 : (duration || config.defaults.dryingDuration);
      const autoTemp = temp || config.defaults.dryingTemp;

      onCommand('ACE_START_DRYING', { TEMP: autoTemp, DURATION: autoDuration })
        .then(ok => {
          if (ok) {
            setAutoStarted(true);
            toast.success(t(lang, 'dryer.autoStarted'));
          }
        });
    }

    // Stop dryer when print ends (complete, cancelled, error, standby)
    if (printWasActive && !printIsActive && autoStarted) {
      onCommand('ACE_STOP_DRYING').then(ok => {
        if (ok) {
          toast.info(lang === 'sv' ? 'Tork stoppad (print avslutad)' : 'Dryer stopped (print ended)');
        }
      });
      setAutoStarted(false);
    }
    // Also stop if print state goes to standby/complete/error/cancelled while auto was on
    if (!printIsActive && autoStarted && !printWasActive) {
      // Edge case: state was already non-active but autoStarted lingered (e.g. after reconnect)
      if (printJobState === 'complete' || printJobState === 'cancelled' || printJobState === 'error' || printJobState === 'standby') {
        onCommand('ACE_STOP_DRYING');
        setAutoStarted(false);
      }
    }
  }, [autoDryer, printJobState, autoStarted, isDrying, printRemainingSeconds, temp, duration, config.defaults.dryingTemp, config.defaults.dryingDuration, onCommand, lang]);

  // Dynamically sync dryer duration with print remaining time every 60s
  const lastSyncRef = useRef(0);
  useEffect(() => {
    if (!autoDryer || !autoStarted || !isDrying) return;
    if (printJobState !== 'printing') return;
    if (!printRemainingSeconds || printRemainingSeconds <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Throttle: only sync every 60s
      if (now - lastSyncRef.current < 55_000) return;
      lastSyncRef.current = now;

      const printMinutes = Math.ceil(printRemainingSeconds / 60);
      const desiredDuration = printMinutes + 15;
      const currentRemain = dryer.remain_time; // in minutes

      // Only update if dryer has significantly more or less time than needed
      const diff = Math.abs(currentRemain - desiredDuration);
      if (diff > 10) {
        const autoTemp = dryer.target_temp || temp || config.defaults.dryingTemp;
        onCommand('ACE_START_DRYING', { TEMP: autoTemp, DURATION: desiredDuration })
          .then(ok => {
            if (ok) {
              toast.info(
                lang === 'sv'
                  ? `Torktid synkad: ${desiredDuration} min`
                  : `Dryer synced: ${desiredDuration} min`
              );
            }
          });
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [autoDryer, autoStarted, isDrying, printJobState, printRemainingSeconds, dryer.remain_time, dryer.target_temp, temp, config.defaults.dryingTemp, onCommand, lang]);

  const startDrying = async () => {
    if (temp < 20 || temp > 55) { toast.error(t(lang, 'notifications.validation.tempRange')); return; }
    if (duration < 1) { toast.error(t(lang, 'notifications.validation.durationMin')); return; }
    await onCommand('ACE_START_DRYING', { TEMP: temp, DURATION: duration });
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">{t(lang, 'cards.dryer')}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={isDrying ? 'bg-warning/15 text-warning border-warning/30 uppercase text-xs' : 'bg-muted text-muted-foreground border-border uppercase text-xs'}>
            {t(lang, `dryerStatusMap.${dryer.status}`) || dryer.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isDrying && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t(lang, 'dryer.remainingTime')}</span>
              <span className="font-semibold">{formatRemaining(dryer.remain_time, lang)}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Thermometer className="h-3.5 w-3.5" />{t(lang, 'dryer.targetTemp')}</span>
              <span className="font-semibold">{dryer.target_temp}°C</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t(lang, 'dryer.duration')}</span>
              <span className="font-semibold">{formatTime(dryer.duration, lang)}</span>
            </div>
          </div>
        )}

        {/* Auto-dryer toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${autoDryer ? 'text-warning' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-medium">{t(lang, 'dryer.autoDryer')}</p>
              <p className="text-[10px] text-muted-foreground">{t(lang, 'dryer.autoDryerDesc')}</p>
            </div>
          </div>
          <Switch checked={autoDryer} onCheckedChange={setAutoDryer} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t(lang, 'dryer.inputs.temp')}</label>
            <Input type="number" min={20} max={55} value={temp} onChange={e => setTemp(Number(e.target.value))} disabled={isDrying} className="h-9 bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{lang === 'sv' ? 'Timmar' : 'Hours'}</label>
            <Input type="number" min={0} max={99} value={Math.floor(duration / 60)} onChange={e => {
              const h = Math.max(0, Number(e.target.value));
              setDuration(h * 60 + (duration % 60));
            }} disabled={isDrying} className="h-9 bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{lang === 'sv' ? 'Minuter' : 'Minutes'}</label>
            <Input type="number" min={0} max={59} value={duration % 60} onChange={e => {
              const m = Math.min(59, Math.max(0, Number(e.target.value)));
              setDuration(Math.floor(duration / 60) * 60 + m);
            }} disabled={isDrying} className="h-9 bg-secondary/50" />
          </div>
        </div>

        <div className="flex gap-2">
          {!isDrying ? (
            <Button onClick={startDrying} className="flex-1 gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90">
              <Flame className="h-4 w-4" /> {t(lang, 'dryer.buttons.start')}
            </Button>
          ) : (
            <Button onClick={() => onCommand('ACE_STOP_DRYING')} variant="destructive" className="flex-1 gap-1.5">
              <Square className="h-4 w-4" /> {t(lang, 'dryer.buttons.stop')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
