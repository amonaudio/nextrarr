/**
 * DirectoryBrowserModal — browse host directories to pick a path mapping target.
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, Folder } from 'lucide-react';

interface DirEntry { name: string; path: string; }
interface BrowseResult { current: string; dirs: DirEntry[]; error?: string; }

interface DirectoryBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath?: string;
  onSelect: (path: string) => void;
}

export function DirectoryBrowserModal({
  open, onOpenChange, initialPath = '/mnt/user/', onSelect,
}: DirectoryBrowserModalProps) {
  const [current, setCurrent] = useState(initialPath);
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fetchDirs(path: string) {
    try {
      const res = await fetch('/api/browse-dirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data: BrowseResult = await res.json();
      setCurrent(data.current);
      setDirs(data.dirs ?? []);
      setError(data.error ?? null);
    } catch (e) {
      setError('Errore di rete');
    }
  }

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchDirs(initialPath);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  function up() {
    const parts = current.split('/').filter((p) => p);
    parts.pop();
    fetchDirs('/' + parts.join('/'));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Seleziona Cartella</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={up}>
            <ChevronUp className="h-4 w-4" /> Su
          </Button>
          <Input value={current} readOnly className="flex-1" />
        </div>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        <div className="max-h-72 overflow-y-auto border border-border rounded">
          {dirs.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Nessuna sottocartella.</p>
          ) : (
            dirs.map((d) => (
              <button
                key={d.path}
                className="w-full text-left p-2 cursor-pointer hover:bg-primary hover:text-primary-foreground border-b border-border last:border-b-0"
                onClick={() => fetchDirs(d.path)}
              >
                <Folder className="inline h-4 w-4 mr-2" /> {d.name}
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => { onSelect(current); onOpenChange(false); }}>Usa questa cartella</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
