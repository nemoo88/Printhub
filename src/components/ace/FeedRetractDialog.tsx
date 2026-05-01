import { useState } from 'react';
import { t, type Language } from '@/lib/ace-translations';
import { type AceConfig } from '@/config/ace-config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'feed' | 'retract';
  slotIndex: number;
  config: AceConfig;
  lang: Language;
  onCommand: (cmd: string, params?: Record<string, unknown>) => Promise<boolean>;
}

export function FeedRetractDialog({ open, onClose, mode, slotIndex, config, lang, onCommand }: Props) {
  const isFeed = mode === 'feed';
  const [length, setLength] = useState(isFeed ? config.defaults.feedLength : config.defaults.retractLength);
  const [speed, setSpeed] = useState(isFeed ? config.defaults.feedSpeed : config.defaults.retractSpeed);

  const execute = async () => {
    if (length < 1) {
      toast.error(t(lang, isFeed ? 'notifications.validation.feedLength' : 'notifications.validation.retractLength'));
      return;
    }
    const cmd = isFeed ? 'ACE_FEED' : 'ACE_RETRACT';
    const success = await onCommand(cmd, { INDEX: slotIndex, LENGTH: length, SPEED: speed });
    if (success) onClose();
  };

  const title = t(lang, isFeed ? 'dialogs.feedTitle' : 'dialogs.retractTitle', { slot: String(slotIndex + 1) });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">{t(lang, 'dialogs.length')}</label>
            <Input type="number" min={1} value={length} onChange={e => setLength(Number(e.target.value))} className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">{t(lang, 'dialogs.speed')}</label>
            <Input type="number" min={1} value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-secondary/50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t(lang, 'dialogs.cancel')}</Button>
          <Button onClick={execute} className="bg-primary hover:bg-primary/90">{t(lang, 'dialogs.execute')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
