/**
 * SettingsModal — manage API keys + path mapping (Docker → host).
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SettingsData } from '@/lib/settings-store';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onBrowse: (index: number) => void;
}

const EMPTY: SettingsData = {
  radarrUrl: '', radarrApiKey: '',
  sonarrUrl: '', sonarrApiKey: '',
  fanartApiKey: '', tmdbApiKey: '',
  pathMap: [],
};

export function SettingsModal({ open, onOpenChange, onSaved, onBrowse }: SettingsModalProps) {
  const [data, setData] = useState<SettingsData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch('/api/settings').then((r) => r.json()).then((d) => setData(d)).catch(() => {});
    }
  }, [open]);

  function patch<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.status === 'success') {
        toast.success('Impostazioni salvate!');
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(json.message ?? 'Errore salvataggio');
      }
    } catch (e) {
      toast.error('Errore di rete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Impostazioni nEXTrarr</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">Radarr (Film)</h3>
            <div>
              <Label className="text-xs">URL Radarr</Label>
              <Input value={data.radarrUrl} onChange={(e) => patch('radarrUrl', e.target.value)} placeholder="http://radarr:7878" />
            </div>
            <div>
              <Label className="text-xs">API Key Radarr</Label>
              <Input type="password" value={data.radarrApiKey} onChange={(e) => patch('radarrApiKey', e.target.value)} placeholder="API Key" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">Sonarr (Serie TV)</h3>
            <div>
              <Label className="text-xs">URL Sonarr</Label>
              <Input value={data.sonarrUrl} onChange={(e) => patch('sonarrUrl', e.target.value)} placeholder="http://sonarr:8989" />
            </div>
            <div>
              <Label className="text-xs">API Key Sonarr</Label>
              <Input type="password" value={data.sonarrApiKey} onChange={(e) => patch('sonarrApiKey', e.target.value)} placeholder="API Key" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">Fanart.tv</h3>
            <Input type="password" value={data.fanartApiKey} onChange={(e) => patch('fanartApiKey', e.target.value)} placeholder="Fanart.tv API Key" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold border-b border-border pb-1">TMDB</h3>
            <Input type="password" value={data.tmdbApiKey} onChange={(e) => patch('tmdbApiKey', e.target.value)} placeholder="TMDB API Key" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold">Mappatura Percorsi</h3>
              <Button size="sm" variant="outline" onClick={() => patch('pathMap', [...data.pathMap, { docker: '', local: '' }])}>
                <Plus className="h-3 w-3 mr-1" /> Aggiungi
              </Button>
            </div>
            {data.pathMap.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessuna mappatura. Aggiungi almeno una riga.</p>
            ) : (
              <div className="space-y-2">
                {data.pathMap.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center p-2 bg-background border border-border rounded">
                    <span className="text-xs font-bold text-primary w-12 text-center">..arr</span>
                    <Input
                      placeholder="/movies"
                      value={m.docker}
                      onChange={(e) => {
                        const next = [...data.pathMap];
                        next[i] = { ...m, docker: e.target.value };
                        patch('pathMap', next);
                      }}
                    />
                    <span className="opacity-40">→</span>
                    <span className="text-xs font-bold text-primary w-12 text-center">host</span>
                    <Input
                      placeholder="/mnt/user/Movies"
                      value={m.local}
                      onChange={(e) => {
                        const next = [...data.pathMap];
                        next[i] = { ...m, local: e.target.value };
                        patch('pathMap', next);
                      }}
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => onBrowse(i)} title="Sfoglia">
                      <Folder className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => patch('pathMap', data.pathMap.filter((_, j) => j !== i))} title="Rimuovi">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
