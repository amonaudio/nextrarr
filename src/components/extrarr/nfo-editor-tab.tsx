/**
 * NfoEditorTab — full NFO editor with two views:
 *
 *  1. **Form view**: structured fields (title, originaltitle, sorttitle, year,
 *     rating, premiered, runtime, mpaa, studio, genres[], director, writer,
 *     plot, outline, tags[], uniqueids[], trailer).
 *
 *  2. **Raw XML view**: textarea with the raw XML content for power users.
 *
 * Both views are synced: switching tabs rebuilds the raw XML from the form,
 * and switching to the form re-parses the raw XML. The Save button sends the
 * current raw XML to /api/save-nfo (atomic write on the server).
 *
 * In demo mode the file is virtual (the editor works but no disk write
 * happens on save).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface NfoEditorTabProps {
  mediaType: 'radarr' | 'sonarr';
  mediaId: number;
  onChanged: () => void;
}

interface NfoFields {
  title: string;
  originaltitle: string;
  sorttitle: string;
  year: string;
  rating: string;
  ratingMax: string;
  premiered: string;
  runtime: string;
  mpaa: string;
  studio: string;
  genres: string[];
  director: string;
  writer: string;
  plot: string;
  outline: string;
  tags: string[];
  trailer: string;
  uniqueids: { type: string; default: boolean; value: string }[];
}

const EMPTY_FIELDS: NfoFields = {
  title: '', originaltitle: '', sorttitle: '',
  year: '', rating: '', ratingMax: '10', premiered: '', runtime: '',
  mpaa: '', studio: '', genres: [], director: '', writer: '',
  plot: '', outline: '', tags: [], trailer: '', uniqueids: [],
};

/**
 * Parse NFO XML string into a structured fields object.
 * Uses DOMParser (browser only — this is a client component).
 */
function parseNfoFields(raw: string): NfoFields {
  const fields: NfoFields = { ...EMPTY_FIELDS, genres: [], tags: [], uniqueids: [] };
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'application/xml');
    const root = doc.documentElement;
    if (!root) return fields;

    const getText = (tag: string): string => {
      const el = root.querySelector(tag);
      return el?.textContent?.trim() ?? '';
    };
    const getList = (tag: string): string[] => {
      return Array.from(root.querySelectorAll(tag))
        .map((el) => el.textContent?.trim() ?? '')
        .filter(Boolean);
    };

    fields.title = getText('title');
    fields.originaltitle = getText('originaltitle');
    fields.sorttitle = getText('sorttitle');
    fields.year = getText('year');
    fields.rating = getText('rating');
    fields.ratingMax = root.querySelector('rating')?.getAttribute('max') ?? '10';
    fields.premiered = getText('premiered');
    fields.runtime = getText('runtime');
    fields.mpaa = getText('mpaa');
    fields.studio = getText('studio');
    fields.genres = getList('genre');
    fields.director = getText('director');
    fields.writer = getText('writer');
    fields.plot = getText('plot');
    fields.outline = getText('outline');
    fields.tags = getList('tag');
    fields.trailer = getText('trailer');
    fields.uniqueids = Array.from(root.querySelectorAll('uniqueid')).map((el) => ({
      type: el.getAttribute('type') ?? '',
      default: el.getAttribute('default') === 'true',
      value: el.textContent?.trim() ?? '',
    }));
  } catch (e) {
    // ignore parse errors — fall back to empty
  }
  return fields;
}

/**
 * Serialize a fields object back to NFO XML.
 * Tries to preserve field order, multi-value genres/tags/uniqueids.
 */
function buildNfoXml(fields: NfoFields, mediaType: 'radarr' | 'sonarr'): string {
  const rootTag = mediaType === 'radarr' ? 'movie' : 'tvshow';
  const esc = (s: string) =>
    s.replace(/[<>&'"]/g, (c) =>
      c === '<' ? '&lt;' :
      c === '>' ? '&gt;' :
      c === '&' ? '&amp;' :
      c === "'" ? '&apos;' :
      c === '"' ? '&quot;' : c);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push(`<${rootTag}>`);
  if (fields.title) lines.push(`  <title>${esc(fields.title)}</title>`);
  if (fields.originaltitle) lines.push(`  <originaltitle>${esc(fields.originaltitle)}</originaltitle>`);
  if (fields.sorttitle) lines.push(`  <sorttitle>${esc(fields.sorttitle)}</sorttitle>`);
  if (fields.rating) {
    lines.push(`  <rating name="themoviedb" max="${esc(fields.ratingMax || '10')}" default="true">${esc(fields.rating)}</rating>`);
  }
  if (fields.year) lines.push(`  <year>${esc(fields.year)}</year>`);
  if (fields.premiered) lines.push(`  <premiered>${esc(fields.premiered)}</premiered>`);
  if (fields.runtime) lines.push(`  <runtime>${esc(fields.runtime)}</runtime>`);
  if (fields.mpaa) lines.push(`  <mpaa>${esc(fields.mpaa)}</mpaa>`);
  if (fields.studio) lines.push(`  <studio>${esc(fields.studio)}</studio>`);
  for (const g of fields.genres) {
    if (g.trim()) lines.push(`  <genre>${esc(g.trim())}</genre>`);
  }
  if (fields.director) lines.push(`  <director>${esc(fields.director)}</director>`);
  if (fields.writer) lines.push(`  <writer>${esc(fields.writer)}</writer>`);
  if (fields.outline) lines.push(`  <outline>${esc(fields.outline)}</outline>`);
  if (fields.plot) lines.push(`  <plot>${esc(fields.plot)}</plot>`);
  for (const t of fields.tags) {
    if (t.trim()) lines.push(`  <tag>${esc(t.trim())}</tag>`);
  }
  for (const u of fields.uniqueids) {
    if (!u.value.trim()) continue;
    const def = u.default ? ' default="true"' : '';
    const typeAttr = u.type ? ` type="${esc(u.type)}"` : '';
    lines.push(`  <uniqueid${typeAttr}${def}>${esc(u.value.trim())}</uniqueid>`);
  }
  if (fields.trailer) lines.push(`  <trailer>${esc(fields.trailer)}</trailer>`);
  lines.push(`</${rootTag}>`);
  return lines.join('\n') + '\n';
}

export function NfoEditorTab({ mediaType, mediaId, onChanged }: NfoEditorTabProps) {
  const [raw, setRaw] = useState<string>('');
  const [fields, setFields] = useState<NfoFields>({ ...EMPTY_FIELDS, genres: [], tags: [], uniqueids: [] });
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Active tab: 'form' | 'raw'
  const [tab, setTab] = useState<'form' | 'raw'>('form');
  const formRef = useRef<NfoFields>(fields);

  // Load NFO content on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/get-nfo/${mediaType}/${mediaId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'error') {
          setError(data.message);
        } else {
          setRaw(data.raw ?? '');
          setFilename(data.filename ?? '');
          setFields(parseNfoFields(data.raw ?? ''));
          formRef.current = parseNfoFields(data.raw ?? '');
        }
      } catch (e) {
        if (!cancelled) setError('Errore di rete');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mediaType, mediaId]);

  // When switching from form → raw: serialize the current form into raw
  function switchToRaw() {
    setRaw(buildNfoXml(fields, mediaType));
    setTab('raw');
    setDirty(true);
  }
  // When switching from raw → form: parse the current raw into fields
  function switchToForm() {
    setFields(parseNfoFields(raw));
    formRef.current = parseNfoFields(raw);
    setTab('form');
    setDirty(true);
  }

  async function save() {
    // Always save the current raw XML (rebuild from form if currently on form tab)
    const xmlToSave = tab === 'form' ? buildNfoXml(fields, mediaType) : raw;
    setSaving(true);
    try {
      const res = await fetch(`/api/save-nfo/${mediaType}/${mediaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: xmlToSave }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
        setRaw(xmlToSave);
        setDirty(false);
        onChanged();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Errore di rete');
    } finally {
      setSaving(false);
    }
  }

  // Form field helpers
  function patch<K extends keyof NfoFields>(key: K, value: NfoFields[K]) {
    setFields((f) => {
      const next = { ...f, [key]: value };
      formRef.current = next;
      return next;
    });
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Caricamento NFO...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        File: <code className="bg-muted px-1 rounded">{filename || '(nessuno)'}</code>
        {dirty && <span className="ml-2 text-amber-500">● modifiche non salvate</span>}
      </div>

      <Tabs value={tab} onValueChange={(v) => (v === 'raw' ? switchToRaw() : switchToForm())}>
        <TabsList>
          <TabsTrigger value="form">📝 Form</TabsTrigger>
          <TabsTrigger value="raw">{`</> Raw XML`}</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-3 mt-3 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={fields.title} onChange={(e) => patch('title', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Original Title</Label>
              <Input value={fields.originaltitle} onChange={(e) => patch('originaltitle', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sort Title</Label>
              <Input value={fields.sorttitle} onChange={(e) => patch('sorttitle', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Input value={fields.year} onChange={(e) => patch('year', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Premiered</Label>
              <Input value={fields.premiered} onChange={(e) => patch('premiered', e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label className="text-xs">Runtime (min)</Label>
              <Input value={fields.runtime} onChange={(e) => patch('runtime', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Rating (0-{fields.ratingMax || '10'})</Label>
              <Input value={fields.rating} onChange={(e) => patch('rating', e.target.value)} type="number" step="0.1" />
            </div>
            <div>
              <Label className="text-xs">Rating Max</Label>
              <Input value={fields.ratingMax} onChange={(e) => patch('ratingMax', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">MPAA</Label>
              <Input value={fields.mpaa} onChange={(e) => patch('mpaa', e.target.value)} placeholder="Rated R / Not Rated" />
            </div>
            <div>
              <Label className="text-xs">Studio</Label>
              <Input value={fields.studio} onChange={(e) => patch('studio', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Director</Label>
              <Input value={fields.director} onChange={(e) => patch('director', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Writer</Label>
              <Input value={fields.writer} onChange={(e) => patch('writer', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Genres (uno per riga)</Label>
            <Textarea
              rows={3}
              value={fields.genres.join('\n')}
              onChange={(e) => patch('genres', e.target.value.split('\n'))}
              placeholder="Science Fiction&#10;Action"
            />
          </div>

          <div>
            <Label className="text-xs">Tags (uno per riga)</Label>
            <Textarea
              rows={2}
              value={fields.tags.join('\n')}
              onChange={(e) => patch('tags', e.target.value.split('\n'))}
              placeholder="demo&#10;favorite"
            />
          </div>

          <div>
            <Label className="text-xs">Outline (breve)</Label>
            <Textarea
              rows={2}
              value={fields.outline}
              onChange={(e) => patch('outline', e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Plot</Label>
            <Textarea
              rows={5}
              value={fields.plot}
              onChange={(e) => patch('plot', e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Trailer URL (Kodi plugin:// o YouTube URL)</Label>
            <Input
              value={fields.trailer}
              onChange={(e) => patch('trailer', e.target.value)}
              placeholder="plugin://plugin.video.youtube/play/?video_id=XXXXXXXXXXX"
            />
          </div>

          {/* Unique IDs editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Unique IDs (TMDB, IMDB, TVDB...)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => patch('uniqueids', [...fields.uniqueids, { type: '', default: false, value: '' }])}
              >
                <Plus className="h-3 w-3" /> Aggiungi
              </Button>
            </div>
            {fields.uniqueids.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun ID esterno.</p>
            ) : (
              <div className="space-y-2">
                {fields.uniqueids.map((u, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="tmdb"
                      value={u.type}
                      onChange={(e) => {
                        const next = [...fields.uniqueids];
                        next[i] = { ...u, type: e.target.value };
                        patch('uniqueids', next);
                      }}
                      className="w-24"
                    />
                    <Input
                      placeholder="12345"
                      value={u.value}
                      onChange={(e) => {
                        const next = [...fields.uniqueids];
                        next[i] = { ...u, value: e.target.value };
                        patch('uniqueids', next);
                      }}
                    />
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={u.default}
                        onChange={(e) => {
                          const next = [...fields.uniqueids];
                          // Only one can be default
                          next[i] = { ...u, default: e.target.checked };
                          if (e.target.checked) {
                            for (let j = 0; j < next.length; j++) {
                              if (j !== i) next[j].default = false;
                            }
                          }
                          patch('uniqueids', next);
                        }}
                      />
                      default
                    </label>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => patch('uniqueids', fields.uniqueids.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="raw" className="mt-3">
          <Textarea
            rows={20}
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setDirty(true); }}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Modifica direttamente l'XML. Al salvataggio il server valida la struttura di base.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-2">Salva NFO</span>
        </Button>
      </div>
    </div>
  );
}
