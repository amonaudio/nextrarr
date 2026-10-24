/**
 * GET /api/test-connection/[type]
 * Tests the Radarr/Sonarr connection with the URL + API key passed via
 * query string. Returns success or a detailed error so the user can
 * debug from the Settings modal without saving first.
 *
 * Query params:
 *   - url: the base URL (e.g. http://192.168.1.50:7878)
 *   - key: the API key
 *
 * In demo mode, returns success with a mock status (so the user can
 * see the "Test" button working without configuring a real Radarr).
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/settings-store';
import { shouldUseMock } from '@/lib/mock-data';
import type { MediaType } from '@/lib/services/radarr-sonarr';

export const dynamic = 'force-dynamic';

function isValidType(t: string | undefined): t is MediaType {
  return t === 'radarr' || t === 'sonarr';
}

function sanitizeBaseUrl(raw: string): string {
  let url = raw.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api\/v\d+$/i, '');
  return url;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ status: 'error', message: 'Tipo non valido' }, { status: 400 });
  }

  const urlParam = req.nextUrl.searchParams.get('url') ?? '';
  const keyParam = req.nextUrl.searchParams.get('key') ?? '';

  if (!urlParam) {
    return NextResponse.json({ status: 'error', message: 'URL mancante' }, { status: 400 });
  }
  if (!keyParam) {
    return NextResponse.json({ status: 'error', message: 'API Key mancante' }, { status: 400 });
  }

  const settings = await loadSettings();
  if (shouldUseMock(type, settings)) {
    return NextResponse.json({
      status: 'success',
      message: 'Demo mode: connessione simulata (nessun Radarr reale configurato)',
      demo: true,
    });
  }

  const baseUrl = sanitizeBaseUrl(urlParam);
  const testUrl = `${baseUrl}/api/v3/system/status`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(testUrl, {
      headers: { 'X-Api-Key': keyParam },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          status: 'error',
          message: `API key rifiutata da ${type} (HTTP ${res.status}). Verifica che la chiave sia corretta in ${type} → Settings → General → API Key.`,
        });
      }
      if (res.status === 404) {
        return NextResponse.json({
          status: 'error',
          message: `Endpoint non trovato (HTTP 404). L'URL "${baseUrl}" non sembra essere un'istanza ${type} valida.`,
        });
      }
      let bodyPreview = '';
      try { bodyPreview = (await res.text()).slice(0, 100); } catch { /* ignore */ }
      return NextResponse.json({
        status: 'error',
        message: `HTTP ${res.status} ${res.statusText} da ${baseUrl}. Anteprima: ${bodyPreview}`,
      });
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      let bodyPreview = '';
      try { bodyPreview = (await res.text()).slice(0, 100); } catch { /* ignore */ }
      return NextResponse.json({
        status: 'error',
        message: `${type} ha restituito HTML invece di JSON (Content-Type: ${contentType}). L'URL "${baseUrl}" probabilmente punta alla pagina web invece che all'API. Anteprima: ${bodyPreview.slice(0, 60)}...`,
      });
    }
    const data = await res.json() as { appName?: string; version?: string; appVersion?: string };
    const app = data.appName ?? type;
    const ver = data.version ?? data.appVersion ?? 'sconosciuta';
    return NextResponse.json({
      status: 'success',
      message: `${app} ${ver} raggiungibile all'URL ${baseUrl}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json({
        status: 'error',
        message: `Timeout dopo 10s contattando ${baseUrl}. Possibile causa: URL sbagliato, ${type} non raggiungibile dal container, o firewall che blocca.`,
      });
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return NextResponse.json({
        status: 'error',
        message: `Hostname non risolvibile: ${baseUrl}. Possibile causa: nome del container sbagliato (es. "radarr" non è sulla stessa rete Docker), oppure IP errato.`,
      });
    }
    if (msg.includes('ECONNREFUSED')) {
      return NextResponse.json({
        status: 'error',
        message: `Connessione rifiutata verso ${baseUrl}. Possibile causa: ${type} non in esecuzione, o porta sbagliata.`,
      });
    }
    return NextResponse.json({
      status: 'error',
      message: `Errore di rete: ${msg}`,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
