import { useState, useRef, useEffect } from 'react';
import { t, type Language } from '@/lib/ace-translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Send } from 'lucide-react';

interface Props {
  lang: Language;
  onSendGcode: (gcode: string) => Promise<{ ok: boolean; response: string }>;
}

interface ConsoleLine {
  text: string;
  type: 'input' | 'output' | 'error';
  timestamp: Date;
}

export function ConsoleCard({ lang, onSendGcode }: Props) {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSend = async () => {
    const cmd = input.trim();
    if (!cmd) return;

    setLines(prev => [...prev, { text: `> ${cmd}`, type: 'input', timestamp: new Date() }]);
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput('');

    const result = await onSendGcode(cmd);
    setLines(prev => [...prev, {
      text: result.ok ? result.response : `Error: ${result.response}`,
      type: result.ok ? 'output' : 'error',
      timestamp: new Date(),
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      if (history[newIdx]) setInput(history[newIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setInput(newIdx >= 0 && history[newIdx] ? history[newIdx] : '');
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-success" />
            {t(lang, 'printer.console')}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-5 px-1.5" onClick={() => setLines([])}>
            {t(lang, 'printer.clear')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div
          ref={scrollRef}
          className="bg-background/80 rounded border border-border/30 p-2 h-32 overflow-y-auto font-mono text-[11px] space-y-0.5 mb-2"
        >
          {lines.length === 0 && (
            <p className="text-muted-foreground">{t(lang, 'printer.consoleHint')}</p>
          )}
          {lines.map((line, i) => (
            <div
              key={i}
              className={`${
                line.type === 'input' ? 'text-primary' :
                line.type === 'error' ? 'text-destructive' :
                'text-foreground'
              }`}
            >
              <span className="text-muted-foreground mr-2">
                {line.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {line.text}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="G28, M104 S200, ..."
            className="bg-secondary/50 font-mono text-sm"
          />
          <Button type="submit" size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
