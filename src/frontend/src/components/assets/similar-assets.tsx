import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { MATURITY_CONFIG } from './asset-card';
import { cn } from '@/lib/utils';

/**
 * Similar assets rail card — queries the VS similarity endpoint
 * and shows top matches with stage-colored ticks.
 */

interface SimilarMatch {
  asset_id: string;
  name: string;
  type_name: string;
  maturity: string;
  score: number;
}

export function SimilarAssets({ assetName, assetDescription, currentAssetId }: {
  assetName: string;
  assetDescription?: string;
  currentAssetId: string;
}) {
  const navigate = useNavigate();
  const { post: apiPost } = useApi();
  const [matches, setMatches] = useState<SimilarMatch[]>([]);

  useEffect(() => {
    const text = `${assetName} ${assetDescription || ''}`.trim();
    if (text.length < 5) return;
    (async () => {
      const resp = await apiPost<any>('/api/dpz/similar', { text });
      if (!resp.error && resp.data?.matches) {
        // Filter out self
        setMatches(resp.data.matches.filter((m: SimilarMatch) => m.asset_id !== currentAssetId));
      }
    })();
  }, [assetName, assetDescription, currentAssetId, apiPost]);

  if (matches.length === 0) return null;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Similar Assets</h3>
      <div className="space-y-2.5">
        {matches.slice(0, 4).map((m) => {
          const config = MATURITY_CONFIG[m.maturity] || MATURITY_CONFIG.idea;
          return (
            <button
              key={m.asset_id}
              className="flex items-start gap-2.5 w-full text-left hover:bg-muted rounded-md p-1.5 -m-1.5 transition-colors"
              onClick={() => navigate(`/assets/${m.asset_id}`)}
            >
              <div className={cn('w-2 h-2 rounded-sm flex-none mt-1.5', config.barColor)} />
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight truncate">{m.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {m.type_name} · {Math.round(m.score * 100)}% match
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
