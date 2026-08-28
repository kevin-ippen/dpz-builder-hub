import { useEffect, useState } from 'react';
import { Activity, DollarSign, ShieldCheck, Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';

interface SignalItem {
  id: string;
  signal_type: string;
  signal_source: string;
  value_numeric?: number | null;
  value_text?: string | null;
  observed_at?: string | null;
}

const SIGNAL_META: Record<string, { label: string; icon: any }> = {
  quality_score: { label: 'Quality', icon: ShieldCheck },
  monthly_cost_usd: { label: 'Cost', icon: DollarSign },
  eval_status: { label: 'Eval', icon: Activity },
  freshness: { label: 'Freshness', icon: Clock3 },
};

function formatSignalValue(item: SignalItem) {
  if (item.value_numeric !== null && item.value_numeric !== undefined) {
    if (item.signal_type === 'monthly_cost_usd') return `$${item.value_numeric.toFixed(0)}/mo`;
    if (item.signal_type === 'quality_score') return `${Math.round(item.value_numeric * 100)}%`;
    return String(item.value_numeric);
  }
  return item.value_text || 'n/a';
}

export function SignalTimeline({ assetId }: { assetId: string }) {
  const { get: apiGet } = useApi();
  const [items, setItems] = useState<SignalItem[]>([]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<any>(`/api/dpz/assets/${assetId}/signals`);
      if (!resp.error && resp.data?.items) setItems(resp.data.items);
    })();
  }, [assetId, apiGet]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Signals</h3>
        <Badge variant="outline" className="text-[9px] font-mono">{items.length}</Badge>
      </div>

      <div className="space-y-3">
        {items.slice(0, 6).map((item, idx) => {
          const meta = SIGNAL_META[item.signal_type] || { label: item.signal_type, icon: Activity };
          const Icon = meta.icon;
          return (
            <div key={item.id} className="relative pl-5">
              {idx < Math.min(items.length, 6) - 1 && (
                <div className="absolute left-[7px] top-5 bottom-[-10px] w-px bg-border" />
              )}
              <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border bg-background flex items-center justify-center">
                <Icon className="h-2 w-2 text-primary" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium">{meta.label}</span>
                <span className="text-[12px] font-mono">{formatSignalValue(item)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span>{item.signal_source}</span>
                {item.observed_at && <RelativeDate date={item.observed_at} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
