/**
 * ThemeProvider — wraps next-themes for dark/light toggle.
 * Mounted once in the root layout.
 *
 * IMPORTANT: uses `attribute="class"` (not `data-theme`) to match the
 * Tailwind/shadcn CSS in globals.css which defines `.dark { ... }` —
 * next-themes sets class="dark" on <html> so the .dark selector matches.
 */

'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
