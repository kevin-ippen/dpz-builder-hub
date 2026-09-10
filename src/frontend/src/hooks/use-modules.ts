import { useState, useEffect } from 'react';
import { useApi } from './use-api';

export type ModulesMap = Record<string, boolean>;

/**
 * Fetches the enabled/disabled state of backend MODULE_* flags.
 *
 * Returns `undefined` while loading (callers should show all features),
 * then a stable map like `{ explore: true, learn: true, pipeline: false, ... }`.
 *
 * Fetched once on mount; cached for the session.
 */
let _cached: ModulesMap | undefined;

export function useModules(): ModulesMap | undefined {
  const { get } = useApi();
  const [modules, setModules] = useState<ModulesMap | undefined>(_cached);

  useEffect(() => {
    if (_cached) return;
    (async () => {
      try {
        const resp = await get<{ modules: ModulesMap }>('/api/settings/modules');
        if (!resp.error && resp.data?.modules) {
          _cached = resp.data.modules;
          setModules(_cached);
        }
      } catch {
        // On error, leave undefined — all modules shown
      }
    })();
  }, [get]);

  return modules;
}
