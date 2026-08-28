import { CheckCircle2, Circle } from 'lucide-react';
import { MATURITY_ORDER, MATURITY_CONFIG } from './asset-card';

/**
 * Gate requirements checklist — shows what's needed to reach the next maturity stage.
 * Adapted from the Exchange project-page "promotion gates" rail card.
 */

interface GateCheck {
  label: string;
  check: (asset: any) => boolean;
}

const GATE_REQUIREMENTS: Record<string, GateCheck[]> = {
  idea: [
    { label: 'Has a description', check: (a) => !!a.description },
    { label: 'Asset type assigned', check: (a) => !!a.asset_type_id },
    { label: 'Value hypothesis stated', check: (a) => !!a.properties?.value_hypothesis },
  ],
  triaged: [
    { label: 'Has a description', check: (a) => !!a.description },
    { label: 'Linked to at least one external reference', check: (a) => (a._refCount ?? 0) > 0 },
    { label: 'Owner identified', check: (a) => !!a.created_by },
  ],
  poc: [
    { label: 'Has runnable code or artifact', check: (a) => !!a.properties?.repo_url || !!a.properties?.demo_url },
    { label: 'At least one external reference', check: (a) => (a._refCount ?? 0) > 0 },
    { label: 'Tested by at least one consumer', check: () => false }, // placeholder
  ],
  validating: [
    { label: 'Has eval/quality score', check: () => false }, // placeholder until Sprint E
    { label: 'Schema documented', check: (a) => !!a.description && a.description.length > 50 },
    { label: 'Support contact defined', check: (a) => !!a.created_by },
    { label: 'Reviewed by another team', check: () => false }, // placeholder
  ],
  production_candidate: [
    { label: 'All validating gates passed', check: () => false },
    { label: 'Governance sign-off', check: () => false },
    { label: 'SLA documented', check: () => false },
  ],
  production: [],
};

interface PromotionGatesProps {
  asset: any;
  maturity?: string;
}

export function PromotionGates({ asset, maturity }: PromotionGatesProps) {
  const stage = maturity && GATE_REQUIREMENTS[maturity] ? maturity : 'idea';
  const currentIdx = MATURITY_ORDER.indexOf(stage);
  const nextStage = currentIdx < MATURITY_ORDER.length - 1 ? MATURITY_ORDER[currentIdx + 1] : null;

  if (!nextStage || stage === 'production') {
    return (
      <div className="rounded-xl border p-4 text-center">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Lifecycle</div>
        <p className="text-sm text-green-700 dark:text-green-400 font-medium">Fully certified — no further gates.</p>
      </div>
    );
  }

  const gates = GATE_REQUIREMENTS[stage] || [];
  const passedCount = gates.filter(g => g.check(asset)).length;
  const nextConfig = MATURITY_CONFIG[nextStage];

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">To reach {nextConfig?.label || nextStage}</h3>
        <span className="text-xs text-muted-foreground">{passedCount}/{gates.length}</span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 h-1.5">
        {gates.map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${i < passedCount ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Checklist */}
      <ul className="space-y-2">
        {gates.map((gate, i) => {
          const passed = gate.check(asset);
          return (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              {passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-none mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground flex-none mt-0.5" />
              )}
              <span className={passed ? 'text-muted-foreground line-through' : ''}>{gate.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
