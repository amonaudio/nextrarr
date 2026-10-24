/**
 * SettingsModal — manage API keys + path mapping (Docker → host).
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, Plus, X, Plug, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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

type TestState = 'idle' | 'testing' | 'ok' | 'error';

export function SettingsModal({ open, onOpenChange, onSaved, onBrowse }: SettingsModalProps) {
  const [data, setData] = useState<SettingsData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [radarrTest, setRadarrTest] = useState<TestState>('idle');
  const [sonarrTest, setSonarrTest] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState<{ radarr?: string; sonarr?: string }>({});

  useEffect(() => {
    if (open) {
      fetch('/api/settings').then((r) => r.json()).then((d) => setData(d)).catch(() => {});
      setRadarrTest('idle');
      setSonarrTest('idle');
      setTestMessage({});
    }
  }, [open]);

  function patch<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function testConnection(type: 'radarr' | 'sonarr') {
    const url = type === 'radarr' ? data.radarrUrl : data.sonarrUrl;
    const key = type === 'radarr' ? data.radarrApiKey : data.sonarrApiKey;
    if (!url || !key) {
      toast.error(`URL o API Key di ${type} mancante`);
      return;
    }
    if (type === 'radarr') { setRadarrTest('testing'); setTestMessage((m) => ({ ...m, radarr: undefined })); }
    else { setSonarrTest('testing'); setTestMessage((m) => ({ ...m, sonarr: undefined })); }
    try {
      const res = await fetch(`/api/test-connection/${type}?url=${encodeURIComponent(url)}&key=${encodeURIComponent(key)}`);
      const result = await res.json();
      if (result.status === 'success') {
        if (type === 'radarr') { setRadarrTest('ok'); } else { setSonarrTest('ok'); }
        toast.success(result.message);
        setTestMessage((m) => ({ ...m, [type]: result.message }));
      } else {
        if (type === 'radarr') { setRadarrTest('error'); } else { setSonarrTest('error'); }
        toast.error(result.message);
        setTestMessage((m) => ({ ...m, [type]: result.message }));
      }
    } catch (e) {
      if (type === 'radarr') { setRadarrTest('error'); } else { setSonarrTest('error'); }
      toast.error('Errore di rete durante il test');
    }
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
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold">Radarr (Film)</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => testConnection('radarr')}
                disabled={radarrTest === 'testing'}
                className="ml-auto"
              >
                {radarrTest === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" />
                 : radarrTest === 'ok' ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                 : radarrTest === 'error' ? <XCircle className="h-3 w-3 text-red-500" />
                 : <Plug className="h-3 w-3" />}
                <span className="ml-1 text-xs">Test</span>
              </Button>
            </div>
            <div>
              <Label className="text-xs">URL Radarr</Label>
              <Input value={data.radarrUrl} onChange={(e) => { patch('radarrUrl', e.target.value); setRadarrTest('idle'); }} placeholder="http://radarr:7878" />
            </div>
            <div>
              <Label className="text-xs">API Key Radarr</Label>
              <Input type="password" value={data.radarrApiKey} onChange={(e) => { patch('radarrApiKey', e.target.value); setRadarrTest('idle'); }} placeholder="API Key" />
            </div>
            {testMessage.radarr && (
              <p className={`text-xs ${radarrTest === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMessage.radarr}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold">Sonarr (Serie TV)</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => testConnection('sonarr')}
                disabled={sonarrTest === 'testing'}
                className="ml-auto"
              >
                {sonarrTest === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" />
                 : sonarrTest === 'ok' ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                 : sonarrTest === 'error' ? <XCircle className="h-3 w-3 text-red-500" />
                 : <Plug className="h-3 w-3" />}
                <span className="ml-1 text-xs">Test</span>
              </Button>
            </div>
            <div>
              <Label className="text-xs">URL Sonarr</Label>
              <Input value={data.sonarrUrl} onChange={(e) => { patch('sonarrUrl', e.target.value); setSonarrTest('idle'); }} placeholder="http://sonarr:8989" />
            </div>
            <div>
              <Label className="text-xs">API Key Sonarr</Label>
              <Input type="password" value={data.sonarrApiKey} onChange={(e) => { patch('sonarrApiKey', e.target.value); setSonarrTest('idle'); }} placeholder="API Key" />
            </div>
            {testMessage.sonarr && (
              <p className={`text-xs ${sonarrTest === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMessage.sonarr}</p>
            )}
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
