'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Clock3, Image as ImageIcon,
  Layers3, ListChecks, Music, Play, Sparkles, Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  completeness, describeMissing, getLibraryStats, getPriorityQueue, isNew, missingAssets,
} from '@/lib/library-insights';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useExtrarrStore } from '@/store/extrarr-store';

interface CommandDashboardProps {
  onOpenEditor: (id: number) => void;
  onSetFilter: (filter: string) => void;
}

function assetIcon(asset: 'theme' | 'artwork' | 'trailer') {
  if (asset === 'theme') return Music;
  if (asset === 'artwork') return ImageIcon;
  return Play;
}

const POSTER_FALLBACK = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 225'><rect width='100%' height='100%' fill='%23111318'/><text x='75' y='120' fill='%23ff8a4c' font-family='sans-serif' font-size='12' text-anchor='middle'>N/A</text></svg>`;

function PosterImage({ media, className, alt }: { media: MediaItem; className: string; alt: string }) {
  const sources = [media.poster, media.remote_poster].filter((source, index, list): source is string => (
    Boolean(source) && list.indexOf(source) === index
  ));
  const [attempt, setAttempt] = useState(0);
  return (
    <img
      src={sources[attempt] || POSTER_FALLBACK}
      alt={alt}
      className={className}
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}

export function CommandDashboard({ onOpenEditor, onSetFilter }: CommandDashboardProps) {
  const { mediaList, mediaType } = useExtrarrStore();
  const stats = useMemo(() => getLibraryStats(mediaList), [mediaList]);
  const queue = useMemo(() => getPriorityQueue(mediaList, 4), [mediaList]);
  const [skipped, setSkipped] = useState<number[]>([]);

  const next = queue.find((media) => !skipped.includes(media.id)) ?? queue[0] ?? null;
  const nextMissing = next ? missingAssets(next) : [];
  const libraryName = mediaType === 'radarr' ? 'Film' : 'Serie';
  const missingTotal = stats.missingTheme + stats.missingArtwork + stats.missingTrailer;

  const healthTitle = stats.score >= 90
    ? 'La collezione è praticamente pronta.'
    : stats.score >= 70
      ? 'Quasi tutta la collezione è pronta.'
      : 'La libreria chiede ancora attenzione.';

  function skipNext() {
    if (!next) return;
    setSkipped((current) => {
      const nextSkipped = [...current, next.id];
      return nextSkipped.length >= queue.length ? [] : nextSkipped;
    });
  }

  function applyFilter(filter: string) {
    onSetFilter(filter);
    window.requestAnimationFrame(() => {
      document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <>
      <section className="mx-auto w-full max-w-[1680px] px-4 pb-2 pt-7 sm:px-6 lg:px-8 lg:pt-9">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              </span>
              {libraryName} · {stats.valid} titoli validi · {stats.invalid} da verificare
            </div>
            <h1 className="mt-3 text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-5xl xl:text-6xl">
              La tua libreria,<br />
              <span className="text-primary">sotto controllo.</span>
            </h1>
            <p className="mt-4 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              {stats.valid} {libraryName.toLowerCase()}, {stats.score}% completo. La coda intelligente ha già trovato i prossimi da rifinire.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <Button
              type="button"
              variant="outline"
              className="h-9 border-border/80 bg-muted/25 text-[11px] font-bold"
            >
              <ListChecks className="h-4 w-4" />
              Seleziona
            </Button>
            <Button
              type="button"
              onClick={() => applyFilter('incomplete')}
              variant="outline"
              className="h-9 border-border/80 bg-muted/25 text-[11px] font-bold"
            >
              <ListChecks className="h-4 w-4" />
              Da rifinire
              <span className="rounded-full bg-muted px-1.5 font-mono text-[9px]">{stats.incomplete}</span>
            </Button>
            <Button
              type="button"
              onClick={() => next && onOpenEditor(next.id)}
              disabled={!next}
              className="h-9 text-[11px] font-bold shadow-[0_8px_22px_rgba(255,138,76,.14)]"
            >
              <Wand2 className="h-4 w-4" />
              Completa ora
            </Button>
          </div>
        </div>

        <div className="mt-7 grid gap-3.5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.66fr)]">
          <section className="rounded-[18px] border border-border bg-gradient-to-b from-card to-background/45 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="grid items-center gap-5 sm:grid-cols-[124px_minmax(0,1fr)] xl:grid-cols-[124px_minmax(0,1fr)_190px]">
              <div
                className="relative mx-auto grid h-[124px] w-[124px] place-items-center rounded-full sm:mx-0"
                style={{ background: `conic-gradient(from -90deg, var(--primary) ${stats.score}%, rgba(255,255,255,.06) 0)` }}
                aria-label={`Salute libreria ${stats.score}%`}
              >
                <div className="absolute inset-[10px] rounded-full bg-card shadow-[inset_0_0_0_6px_rgba(0,0,0,.12)]" />
                <span className="relative flex items-baseline gap-0.5 text-3xl font-extrabold tracking-[-0.06em]">
                  {stats.score}<small className="text-[11px] font-bold tracking-normal text-muted-foreground">%</small>
                </span>
                <div className="absolute -inset-[18px] rounded-full bg-[radial-gradient(circle,rgba(255,138,76,.14),transparent_67%)]" />
              </div>

              <div className="min-w-0 text-center sm:text-left">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Salute libreria</span>
                <h2 className="mt-1.5 text-lg font-bold tracking-[-0.035em] sm:text-xl">{healthTitle}</h2>
                <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-muted-foreground sm:mx-0">
                  {stats.almost} titoli sono a un solo asset dal traguardo. {stats.complete} sono già completi.
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                {[
                  { label: 'Artwork', value: stats.artworkPct, missing: stats.missingArtwork },
                  { label: 'Tema', value: stats.themePct, missing: stats.missingTheme },
                  { label: 'Trailer', value: stats.trailerPct, missing: stats.missingTrailer },
                ].map((metric) => (
                  <div key={metric.label} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px]">
                    <span className="text-muted-foreground">{metric.label}</span>
                    <b className="font-mono text-[10px] font-semibold text-foreground/80">{metric.value}%</b>
                    <div className="col-span-2 h-1 overflow-hidden rounded-full bg-secondary">
                      <i className="block h-full rounded-full bg-primary shadow-[0_0_10px_rgba(255,138,76,.4)]" style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-border bg-gradient-to-b from-card to-background/45 p-4 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prossima azione</span>
              <Badge variant="outline" className={cn('h-5 border-amber-400/30 bg-amber-400/10 px-2 text-[8.5px] text-amber-300', !next && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300')}>
                {next ? 'Priorità alta' : 'Tutto completo'}
              </Badge>
            </div>

            {next ? (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <PosterImage
                    media={next}
                    className="h-[88px] w-[61px] shrink-0 rounded-lg bg-secondary object-cover shadow-lg shadow-black/30"
                    alt={`Poster di ${next.title}`}
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold leading-tight tracking-[-0.025em]">{next.title}</h3>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {next.year} · {next.resolution || 'Qualità n/d'}{next.audio_channels ? ` · ${next.audio_channels}` : ''}
                      {isNew(next) ? ' · aggiunto di recente' : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {nextMissing.map((asset) => {
                        const Icon = assetIcon(asset);
                        return (
                          <span key={asset} className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-muted/50 px-1.5 text-[8.5px] font-semibold text-muted-foreground">
                            <Icon className="h-2.5 w-2.5" />
                            {asset === 'theme' ? 'Tema' : asset === 'artwork' ? 'Artwork' : 'Trailer'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  {nextMissing.length === 1
                    ? 'Un solo asset lo separa dal 100%. È il candidato con il miglior rapporto sforzo/impatto.'
                    : `${describeMissing(next)}. Conviene partire da qui per alzare la salute della libreria.`}
                </p>
                <div className="mt-auto flex gap-2">
                  <Button type="button" onClick={() => onOpenEditor(next.id)} className="h-8 flex-1 text-[10px] font-bold">
                    Completa ora
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" onClick={skipNext} className="h-8 flex-1 text-[10px] font-bold">
                    Salta
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-sm font-bold">Nessuna azione urgente</p>
                <p className="text-[10.5px] text-muted-foreground">Tutti gli asset disponibili sono già presenti.</p>
              </div>
            )}
          </section>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { value: stats.incomplete, label: 'da rifinire', icon: Wand2, filter: 'incomplete' },
            { value: stats.almost, label: 'quasi pronti · 1 asset mancante', icon: Sparkles, filter: 'almost' },
            { value: stats.recent, label: 'nuovi negli ultimi 14 giorni', icon: Clock3, filter: 'new' },
            { value: queue.length, label: 'in coda · priorità calcolata', icon: Layers3, filter: 'incomplete' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => applyFilter(item.filter)}
                className="flex min-w-0 items-center gap-2.5 rounded-[13px] border border-border bg-card/60 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-black/20"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <b className="block text-sm tracking-[-0.02em]">{item.value}</b>
                  <span className="block truncate text-[9px] text-muted-foreground">{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="command-queue" className="mx-auto w-full max-w-[1680px] scroll-mt-20 px-4 pb-1 pt-7 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-[-0.04em]">
              Coda intelligente
              <span className="rounded-full border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-normal text-muted-foreground">{queue.length}</span>
            </h2>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">Ordine calcolato da nuovi arrivi, quasi completi e mapping.</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button type="button" variant="ghost" onClick={() => applyFilter('incomplete')} className="h-7 text-[10px] font-bold text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Perché questi?
            </Button>
            <Button type="button" variant="outline" onClick={() => applyFilter('almost')} className="h-7 border-border/80 bg-muted/25 text-[10px] font-bold">
              Apri triage
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/35 px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
            <p className="mt-2 text-sm font-bold">Coda vuota</p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">Non ci sono titoli incompleti da rifinire.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {queue.map((media) => {
              const missing = missingAssets(media);
              const percent = completeness(media);
              const why = isNew(media) ? 'Nuovo in libreria' : missing.length === 1 ? 'A un passo' : 'Priorità alta';
              return (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => onOpenEditor(media.id)}
                  className="group flex min-w-0 gap-3 rounded-[14px] border border-border bg-card/65 p-2.5 text-left text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-xl hover:shadow-black/20"
                >
                  <span className="relative h-[88px] w-[61px] shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <PosterImage media={media} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 grid h-4 min-w-[23px] place-items-center rounded-full border border-white/15 bg-black/75 px-1 font-mono text-[7.5px] text-white backdrop-blur">
                      {percent}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col py-0.5">
                    <span className="flex items-center gap-1 truncate text-[8.5px] font-semibold text-primary">
                      <Sparkles className="h-2.5 w-2.5" />
                      {why}
                    </span>
                    <span className="mt-1 truncate text-xs font-bold tracking-[-0.02em]">{media.title}</span>
                    <span className="mt-0.5 truncate text-[9px] text-muted-foreground">{describeMissing(media)}</span>
                    <span className="mt-auto block h-[3px] overflow-hidden rounded-full bg-secondary">
                      <i className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-1 text-[8px] text-muted-foreground">
                      <span>{missing.length} asset</span>
                      <span className="flex items-center gap-0.5 font-semibold text-primary">
                        Rifinisci <ChevronRight className="h-2.5 w-2.5" />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
