/**
 * SettingsModal — manage API keys + path mapping (Docker → host).
 *
 * KEY FIX (v0.5): the DirectoryBrowser is now rendered INSIDE this modal
 * and updates the local React state directly (NOT the API). The user clicks
 * "Salva Impostazioni" once to persist everything. Previously, onBrowserSelect
 * in page.tsx fetched stale data from the API (which didn't have unsaved
 * new rows) → overwrote the user's changes → path mapping was lost.
 *
 * Also: all onChange handlers now use the functional form of setData
 * (setData((d) => ...)) instead of referencing data.pathMap from the
 * render scope — avoids stale closure issues with rapid typing.
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
import { DirectoryBrowserModal } from './directory-browser-modal';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const EMPTY: SettingsData = {
  radarrUrl: '', radarrApiKey: '',
  sonarrUrl: '', sonarrApiKey: '',
  fanartApiKey: '', tmdbApiKey: '',
  pathMap: [],
};

type TestState = 'idle' | 'testing' | 'ok' | 'error';

export function SettingsModal({ open, onOpenChange, onSaved }: SettingsModalProps) {
  const [data, setData] = useState<SettingsData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [radarrTest, setRadarrTest] = useState<TestState>('idle');
  const [sonarrTest, setSonarrTest] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState<{ radarr?: string; sonarr?: string }>({});

  // Browser state — now INTERNAL to SettingsModal (not in page.tsx)
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTargetIndex, setBrowserTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      fetch('/api/settings').then((r) => r.json()).then((d) => setData(d)).catch(() => {});
      setRadarrTest('idle');
      setSonarrTest('idle');
      setTestMessage({});
    }
  }, [open]);

  // Helper: update a single pathMap entry using functional setData (avoids stale closure)
  function updatePathMapEntry(index: number, field: 'docker' | 'local', value: string) {
    setData((d) => {
      const next = [...d.pathMap];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return { ...d, pathMap: next };
    });
  }

  function addPathMapEntry() {
    setData((d) => ({
      ...d,
      pathMap: [...d.pathMap, { docker: '', local: '' }],
    }));
  }

  function removePathMapEntry(index: number) {
    setData((d) => ({
      ...d,
      pathMap: d.pathMap.filter((_, j) => j !== index),
    }));
  }

  // Open the internal directory browser for a specific pathMap row
  function openBrowser(index: number) {
    setBrowserTargetIndex(index);
    setBrowserOpen(true);
  }

  // When the user selects a folder in the browser, update the LOCAL state (not the API)
  function onBrowserSelect(path: string) {
    if (browserTargetIndex !== null) {
      updatePathMapEntry(browserTargetIndex, 'local', path);
      toast.success(`Percorso host impostato: ${path}`);
    }
    setBrowserOpen(false);
    setBrowserTargetIndex(null);
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
    } catch {
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
    } catch {
      toast.error('Errore di rete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Impostazioni nEXTrarr</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Radarr */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-sm font-semibold">Radarr (Film)</h3>
                <Button size="sm" variant="outline" onClick={() => testConnection('radarr')} disabled={radarrTest === 'testing'} className="ml-auto">
                  {radarrTest === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" />
                   : radarrTest === 'ok' ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                   : radarrTest === 'error' ? <XCircle className="h-3 w-3 text-red-500" />
                   : <Plug className="h-3 w-3" />}
                  <span className="ml-1 text-xs">Test</span>
                </Button>
              </div>
              <div>
                <Label className="text-xs">URL Radarr</Label>
                <Input value={data.radarrUrl} onChange={(e) => setData((d) => ({ ...d, radarrUrl: e.target.value }))} placeholder="http://radarr:7878" />
              </div>
              <div>
                <Label className="text-xs">API Key Radarr</Label>
                <Input type="password" value={data.radarrApiKey} onChange={(e) => setData((d) => ({ ...d, radarrApiKey: e.target.value }))} placeholder="API Key" />
              </div>
              {testMessage.radarr && (
                <p className={`text-xs ${radarrTest === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMessage.radarr}</p>
              )}
            </div>

            {/* Sonarr */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-sm font-semibold">Sonarr (Serie TV)</h3>
                <Button size="sm" variant="outline" onClick={() => testConnection('sonarr')} disabled={sonarrTest === 'testing'} className="ml-auto">
                  {sonarrTest === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" />
                   : sonarrTest === 'ok' ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                   : sonarrTest === 'error' ? <XCircle className="h-3 w-3 text-red-500" />
                   : <Plug className="h-3 w-3" />}
                  <span className="ml-1 text-xs">Test</span>
                </Button>
              </div>
              <div>
                <Label className="text-xs">URL Sonarr</Label>
                <Input value={data.sonarrUrl} onChange={(e) => setData((d) => ({ ...d, sonarrUrl: e.target.value }))} placeholder="http://sonarr:8989" />
              </div>
              <div>
                <Label className="text-xs">API Key Sonarr</Label>
                <Input type="password" value={data.sonarrApiKey} onChange={(e) => setData((d) => ({ ...d, sonarrApiKey: e.target.value }))} placeholder="API Key" />
              </div>
              {testMessage.sonarr && (
                <p className={`text-xs ${sonarrTest === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{testMessage.sonarr}</p>
              )}
            </div>

            {/* Fanart */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold border-b border-border pb-1">Fanart.tv</h3>
              <Input type="password" value={data.fanartApiKey} onChange={(e) => setData((d) => ({ ...d, fanartApiKey: e.target.value }))} placeholder="Fanart.tv API Key" />
            </div>

            {/* TMDB */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold border-b border-border pb-1">TMDB</h3>
              <Input type="password" value={data.tmdbApiKey} onChange={(e) => setData((d) => ({ ...d, tmdbApiKey: e.target.value }))} placeholder="TMDB API Key" />
            </div>

            {/* Path Mapping */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-sm font-semibold">Mappatura Percorsi</h3>
                <Button size="sm" variant="outline" onClick={addPathMapEntry}>
                  <Plus className="h-3 w-3" /> Aggiungi
                </Button>
              </div>
              {data.pathMap.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna mappatura. Aggiungi almeno una riga.</p>
              ) : (
                <div className="space-y-2">
                  {data.pathMap.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center p-2 bg-background border border-border rounded">
                      <span className="text-xs font-bold text-primary w-10 text-center shrink-0">..arr</span>
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder="/movies"
                          value={m.docker}
                          onChange={(e) => updatePathMapEntry(i, 'docker', e.target.value)}
                        />
                      </div>
                      <span className="opacity-40 shrink-0">→</span>
                      <span className="text-xs font-bold text-primary w-10 text-center shrink-0">host</span>
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder="/mnt/user/Movies"
                          value={m.local}
                          onChange={(e) => updatePathMapEntry(i, 'local', e.target.value)}
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openBrowser(i)} title="Sfoglia" className="shrink-0">
                        <Folder className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => removePathMapEntry(i)} title="Rimuovi" className="shrink-0">
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

      {/* Directory Browser — now INSIDE SettingsModal, updates local state */}
      <DirectoryBrowserModal
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        initialPath={browserTargetIndex !== null ? (data.pathMap[browserTargetIndex]?.local || '/mnt/user/') : '/mnt/user/'}
        onSelect={onBrowserSelect}
      />
    </>
  );
}
