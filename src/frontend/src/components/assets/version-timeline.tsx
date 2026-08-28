import { useState, useEffect } from 'react';
import { Tag, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';

interface Version {
  id: string;
  version: string;
  changelog: string | null;
  released_by: string | null;
  is_latest: boolean;
  download_count: number;
  created_at: string | null;
}

export function VersionTimeline({ assetId }: { assetId: string }) {
  const { get: apiGet } = useApi();
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<any>(`/api/dpz/assets/${assetId}/versions`);
      if (!resp.error && resp.data?.versions) {
        setVersions(resp.data.versions);
      }
    })();
  }, [assetId, apiGet]);

  if (versions.length === 0) return null;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Versions</h3>
        <Badge variant="outline" className="text-[9px] font-mono">{versions.length} release{versions.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="space-y-0">
        {versions.slice(0, 5).map((v, i) => (
          <div key={v.id} className="relative pl-4 pb-3 last:pb-0">
            {/* Timeline connector */}
            {i < Math.min(versions.length, 5) - 1 && (
              <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 ${
              v.is_latest ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/40'
            }`} />

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-semibold">
                v{v.version}
              </span>
              {v.is_latest && (
                <Badge className="text-[8px] px-1 py-0 h-3.5">latest</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              {v.created_at && <RelativeDate date={v.created_at} />}
              {v.download_count > 0 && (
                <span className="flex items-center gap-0.5">
                  <Download className="h-2.5 w-2.5" />{v.download_count}
                </span>
              )}
            </div>
            {v.changelog && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{v.changelog}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
