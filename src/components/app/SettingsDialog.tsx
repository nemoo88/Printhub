import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { t, type Language } from '@/lib/ace-translations';
import type { AceConfig } from '@/config/ace-config';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AceConfig;
  lang: Language;
  onSave: (config: AceConfig) => void;
}

export function SettingsDialog({ open, onOpenChange, config, lang, onSave }: Props) {
  const [apiInput, setApiInput] = useState(config.apiBase);
  const [printerApiInput, setPrinterApiInput] = useState(config.printerApiBase);
  const [cameraInput, setCameraInput] = useState(config.cameraUrl);
  const [spoolmanInput, setSpoolmanInput] = useState(config.spoolmanUrl);

  useEffect(() => {
    if (!open) return;
    setApiInput(config.apiBase);
    setPrinterApiInput(config.printerApiBase);
    setCameraInput(config.cameraUrl);
    setSpoolmanInput(config.spoolmanUrl);
  }, [open, config.apiBase, config.printerApiBase, config.cameraUrl, config.spoolmanUrl]);

  const mixedContentRisk = typeof window !== 'undefined' && window.location.protocol === 'https:' &&
    [apiInput, printerApiInput, cameraInput, spoolmanInput].some(v => v.trim().startsWith('http://'));

  const handleSave = () => {
    onSave({
      ...config,
      apiBase: apiInput.trim(),
      printerApiBase: printerApiInput.trim(),
      cameraUrl: cameraInput.trim(),
      spoolmanUrl: spoolmanInput.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(lang, 'config.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(lang, 'config.description')}</p>
          {mixedContentRisk && (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-2 py-1.5">
              HTTPS preview kan inte anropa HTTP-adresser. Central sync mellan webbläsare blockeras tills du kör appen via lokal HTTP-adress eller använder HTTPS-endpoints.
            </p>
          )}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.apiBase')}</label>
            <Input value={apiInput} onChange={e => setApiInput(e.target.value)} placeholder={t(lang, 'config.placeholder')} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.printerApiBase')}</label>
            <Input value={printerApiInput} onChange={e => setPrinterApiInput(e.target.value)} placeholder={t(lang, 'config.printerPlaceholder')} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.cameraUrl')}</label>
            <Input value={cameraInput} onChange={e => setCameraInput(e.target.value)} placeholder={t(lang, 'config.cameraPlaceholder')} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t(lang, 'config.spoolmanUrl')}</label>
            <Input value={spoolmanInput} onChange={e => setSpoolmanInput(e.target.value)} placeholder={t(lang, 'config.spoolmanPlaceholder')} />
          </div>
          <Button onClick={handleSave} className="w-full">{t(lang, 'config.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
