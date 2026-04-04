'use client';

import { useEffect } from 'react';

export function WatchdogInitializer() {
  useEffect(() => {
    // Initialize watchdogs on app load
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data.initialized) {
          console.log('[App] Watchdogs initialized:', data.message);
        }
      })
      .catch(err => {
        console.error('[App] Failed to initialize watchdogs:', err);
      });
  }, []);

  return null;
}
