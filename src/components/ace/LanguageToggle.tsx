import { type Language } from '@/lib/ace-translations';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface Props {
  lang: Language;
  onToggle: () => void;
}

export function LanguageToggle({ lang, onToggle }: Props) {
  return (
    <Button variant="outline" size="sm" onClick={onToggle} className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary">
      <Globe className="h-3.5 w-3.5" />
      {lang.toUpperCase()}
    </Button>
  );
}
