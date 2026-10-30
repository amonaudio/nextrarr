'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Menu, Moon, RefreshCw, Search, Settings, Sun, Youtube } from 'lucide-react';
import { useExtrarrStore } from '@/store/extrarr-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};

interface LibraryTopbarProps {
  refreshing: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenMenu: () => void;
  onOpenPalette: (mode?: 'command' | 'youtube') => void;
}

export function LibraryTopbar({
  refreshing,
  onRefresh,
  onOpenSettings,
  onOpenMenu,
  onOpenPalette,
}: LibraryTopbarProps) {
  const { mediaType, mediaList } = useExtrarrStore();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isDark = mounted ? theme !== 'light' : true;

  return (
    <header className="app-topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onOpenMenu} aria-label="Apri menu">
        <Menu className="h-4 w-4" />
      </button>

      <div className="breadcrumb">
        <span>Libreria</span>
        <span className="breadcrumb-dot" />
        <strong>{mediaType === 'radarr' ? 'Film' : 'Serie'}</strong>
        <span className="breadcrumb-dot" />
        <span className="now">{mediaList.length} titoli</span>
      </div>

      <div className="topbar-actions">
        <button type="button" className="search-trigger" onClick={() => onOpenPalette('command')}>
          <Search className="h-4 w-4" />
          <span>Cerca o esegui un comando...</span>
          <kbd>⌘K</kbd>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onOpenPalette('youtube')}
              aria-label="Cerca su YouTube"
            >
              <Youtube className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Cerca un tema o trailer su YouTube</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="icon-btn"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Aggiorna libreria"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Aggiorna libreria e cache server</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label="Cambia tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="icon-btn accent"
              onClick={onOpenSettings}
              aria-label="Impostazioni"
            >
              <Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Connessioni, percorsi e metadati</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
