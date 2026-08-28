import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Maturity stage system (adapted from "The Exchange" design) ───

const MATURITY_CONFIG: Record<string, {
  color: string; barColor: string; label: string;
  support: string;
}> = {
  idea: {
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    barColor: 'bg-slate-400',
    label: 'Idea',
    support: 'Concept only — no code, no support, not runnable yet.',
  },
  triaged: {
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    barColor: 'bg-slate-500',
    label: 'Triaged',
    support: 'Acknowledged need — not yet built. Vote to signal demand.',
  },
  poc: {
    color: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    barColor: 'bg-amber-500',
    label: 'POC',
    support: 'Fork it, try it — no SLA, no guarantees, may break without notice.',
  },
  validating: {
    color: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    barColor: 'bg-blue-500',
    label: 'Validating',
    support: 'Under active eval — output shape stabilizing, feedback welcome.',
  },
  production_candidate: {
    color: 'bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    barColor: 'bg-purple-500',
    label: 'Prod Candidate',
    support: 'Reviewed — pending final certification. Schema frozen.',
  },
  production: {
    color: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300',
    barColor: 'bg-green-600',
    label: 'Production',
    support: 'Certified, monitored, supported — safe to build on.',
  },
};

const MATURITY_ORDER = ['idea', 'triaged', 'poc', 'validating', 'production_candidate', 'production'];

interface AssetCardProps {
  id: string;
  name: string;
  description?: string;
  typeName?: string;
  maturity?: string;
  publicationScope?: string;
  owner?: string;
  updatedAt?: string;
  heroImageUrl?: string;
}

export function AssetCard({
  id, name, description, typeName, maturity, publicationScope, owner, updatedAt, heroImageUrl,
}: AssetCardProps) {
  const navigate = useNavigate();
  const stage = maturity && MATURITY_CONFIG[maturity] ? maturity : 'idea';
  const config = MATURITY_CONFIG[stage];
  const stageIndex = MATURITY_ORDER.indexOf(stage);

  return (
    <div
      className="group bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-muted-foreground/40 hover:shadow-lg hover:-translate-y-1"
      onClick={() => navigate(`/assets/${id}`)}
    >
      {/* Hero visual — image or gradient fallback */}
      <div className="relative h-[148px] overflow-hidden bg-gradient-to-br from-muted/60 to-muted">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex items-end h-full p-4 bg-[radial-gradient(circle_at_80%_12%,rgba(68,98,201,0.15),transparent_36%),linear-gradient(145deg,hsl(var(--muted)),hsl(var(--card)))]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {typeName || 'Asset'}
            </span>
          </div>
        )}
        {/* Floating badges on the image */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[calc(100%-20px)]">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm border border-white/20',
            config.color,
          )}>
            {config.label}
          </span>
          {typeName && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-white/90 dark:bg-black/70 text-foreground shadow-sm backdrop-blur-sm border border-black/5 dark:border-white/10">
              {typeName}
            </span>
          )}
        </div>
        {/* Maturity progress bar at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 flex h-[3px]">
          {MATURITY_ORDER.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1',
                i <= stageIndex ? config.barColor : 'bg-black/10',
              )}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        {/* Title */}
        <h3 className="font-semibold text-[15px] leading-tight tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
          {name}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Owner + scope */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          {owner && <span className="truncate max-w-[140px]">{owner}</span>}
          {owner && publicationScope && publicationScope !== 'draft' && <span className="text-border">·</span>}
          {publicationScope && publicationScope !== 'draft' && (
            <span className="font-mono uppercase tracking-wider">{publicationScope}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export { MATURITY_CONFIG, MATURITY_ORDER };
