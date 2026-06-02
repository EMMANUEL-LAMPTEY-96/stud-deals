'use client';

// =============================================================================
// components/shared/ServiceWorkerRegistrar.tsx
//
// Registers /sw.js on first load.
// Must be a 'use client' component so it runs in the browser.
// Renders nothing — side-effect only.
// =============================================================================

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // SW registration failure is non-fatal — app works without it
        });
    }
  }, []);

  return null;
}
