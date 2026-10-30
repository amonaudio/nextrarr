'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { AlertTriangle, Check, Clock3, RefreshCw, Sparkles } from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { computeLibraryStats } from '@/lib/library';

interface LibraryOverviewProps {
  refreshing: boolean;
  onRefresh: () => void;
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
}

export function LibraryOverview({ refreshing, onRefresh }: LibraryOverviewProps) {
  const { mediaType, mediaList, setMainFilter, setActiveCustomFilter } = useExtrarrStore();
  const stats = useMemo(() => computeLibraryStats(mediaList), [mediaList]);
  const source = mediaType === 'radarr' ? 'Radarr' : 'Sonarr';
  const missing = Math.max(0, stats.incomplete);

  function showIncomplete() {
    setActiveCustomFilter(null);
    setMainFilter('incomplete');
    document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="overview" aria-label="Panoramica libreria">
      <div className="hero-panel">
        <div className="eyebrow">
          <span className="dot" />
          <span>{source}</span>
          <span className="eyebrow-sep">·</span>
          <span>connesso</span>
          <span className="eyebrow-sep">/</span>
          <span>{stats.total} titoli in libreria</span>
        </div>
        <h1>
          La tua libreria,
          <br />
          <em>senza buchi.</em>
        </h1>
        <p>
          Temi, artwork e trailer: tutto ciò che manca, in un unico posto.
          Controlla la copertura e completa i titoli con pochi passaggi.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={showIncomplete}>
            <Sparkles className="h-4 w-4" />
            Completa i mancanti
            <span className="btn-tag">{missing}</span>
          </button>
          <button type="button" className="btn-ghost" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {refreshing ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
        </div>
        <div className="hero-meta">
          <span>
            <Check className="h-3.5 w-3.5" />
            {stats.valid} titoli validi
          </span>
          <span>
            <AlertTriangle className="h-3.5 w-3.5" />
            {stats.warnings} avvisi
          </span>
          <span>
            <Clock3 className="h-3.5 w-3.5" />
            {stats.recent} nuovi
          </span>
        </div>
      </div>

      <aside className="coverage-card" aria-label="Copertura libreria">
        <div className="coverage-head">
          <div>
            <span className="coverage-label">Copertura libreria</span>
            <strong>{stats.coveragePct}%</strong>
          </div>
          <span className="trend-pill">
            <Check className="h-3 w-3" />
            live
          </span>
        </div>

        <div className="ring-wrap">
          <div
            className="coverage-ring"
            style={{ '--p': stats.coveragePct } as CSSProperties}
            role="img"
            aria-label={`Copertura ${stats.coveragePct}%`}
          >
            <b>{stats.coveragePct}%</b>
            <small>completo</small>
          </div>
          <div className="coverage-rows">
            <div className="coverage-row">
              <span>Tema</span>
              <span className="coverage-track">
                <span
                  className="coverage-fill theme"
                  style={{ width: `${percent(stats.theme.have, stats.theme.total)}%` }}
                />
              </span>
              <b>{stats.theme.have}/{stats.theme.total}</b>
            </div>
            <div className="coverage-row">
              <span>Artwork</span>
              <span className="coverage-track">
                <span
                  className="coverage-fill art"
                  style={{ width: `${percent(stats.artwork.have, stats.artwork.total)}%` }}
                />
              </span>
              <b>{stats.artwork.have}/{stats.artwork.total}</b>
            </div>
            <div className="coverage-row">
              <span>Trailer</span>
              <span className="coverage-track">
                <span
                  className="coverage-fill trailer"
                  style={{ width: `${percent(stats.trailer.have, stats.trailer.total)}%` }}
                />
              </span>
              <b>{stats.trailer.have}/{stats.trailer.total}</b>
            </div>
          </div>
        </div>

        <div className="coverage-foot">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {stats.warnings > 0
              ? `${stats.warnings} ${stats.warnings === 1 ? 'avviso di percorso da verificare' : 'avvisi di percorso da verificare'}.`
              : 'Nessun avviso di percorso.'}
          </span>
        </div>
      </aside>
    </section>
  );
}
