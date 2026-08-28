import { FileCheck2, Activity, Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EvidenceScoreCardProps {
  evidenceScore?: number | null;
  signalTypes?: number | null;
  totalSignals?: number | null;
  lastSignalAt?: string | null;
}

export function EvidenceScoreCard({
  evidenceScore,
  signalTypes,
  totalSignals,
  lastSignalAt,
}: EvidenceScoreCardProps) {
  const score = evidenceScore ?? 0;
  const tone = score >= 4 ? 'text-green-600' : score >= 2 ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Evidence</h3>
        <Badge variant={score >= 4 ? 'default' : score >= 2 ? 'secondary' : 'outline'} className="text-[9px] font-mono">
          {score}/5
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <div className={`text-2xl font-bold tracking-tight ${tone}`}>{score}</div>
          <p className="text-[11px] text-muted-foreground">completeness score</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-mono uppercase">
              <Activity className="h-3 w-3" /> Signal Types
            </div>
            <div className="mt-1 font-semibold">{signalTypes ?? 0}</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-mono uppercase">
              <FileCheck2 className="h-3 w-3" /> Observations
            </div>
            <div className="mt-1 font-semibold">{totalSignals ?? 0}</div>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {lastSignalAt ? `Last updated ${new Date(lastSignalAt).toLocaleDateString()}` : 'No evidence captured yet'}
        </div>
      </div>
    </div>
  );
}
