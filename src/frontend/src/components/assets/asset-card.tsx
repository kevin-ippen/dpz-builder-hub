import { useState } from 'react';
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

// Deterministic color from string for avatar initials
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function relativeTimeShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

interface CapChipData { slug: string; name: string; category: string; }

const CAP_CLR: Record<string,string> = {
  data: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800',
  ai: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800',
  platform: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800',
};

interface AssetCardProps {
  id: string;
  name: string;
  description?: string;
  typeName?: string;
  maturity?: string;
  publicationScope?: string;
  owner?: string;
  team?: string;
  updatedAt?: string;
  heroImageUrl?: string;
  capabilities?: CapChipData[];
}

export function AssetCard({
  id, name, description, typeName, maturity, publicationScope, owner, team, updatedAt, heroImageUrl, capabilities,
}: AssetCardProps) {
  const navigate = useNavigate();
  const [heroError, setHeroError] = useState(false);
  const stage = maturity && MATURITY_CONFIG[maturity] ? maturity : 'idea';
  const config = MATURITY_CONFIG[stage];
  const stageIndex = MATURITY_ORDER.indexOf(stage);

  return (
    <div
      className="group bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-1"
      onClick={() => navigate(`/assets/${id}`)}
    >
      {/* Hero visual — image or gradient fallback */}
      <div className="relative h-[148px] overflow-hidden bg-gradient-to-br from-muted/60 to-muted">
        {heroImageUrl && !heroError ? (
          <img
            src={heroImageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onError={() => setHeroError(true)}
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

        {/* Capability chips */}
        {capabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {capabilities.slice(0, 3).map(c => (
              <span key={c.slug} className={cn('px-1.5 py-0.5 text-[9px] font-mono rounded border', CAP_CLR[c.category] || CAP_CLR.platform)}>{c.name}</span>
            ))}
            {capabilities.length > 3 && <span className="text-[9px] text-muted-foreground">+{capabilities.length - 3}</span>}
          </div>
        )}
        {/* Owner + team + updated */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          {owner && (
            <>
              <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0', avatarColor(owner))}>
                {owner.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[100px]">{owner.split('@')[0]}</span>
            </>
          )}
          {team && (
            <>
              <span className="text-border">·</span>
              <span className="font-mono text-[10px] truncate max-w-[80px]">{team}</span>
            </>
          )}
          {updatedAt && (
            <span className="ml-auto font-mono text-[10px] shrink-0">{relativeTimeShort(updatedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export { MATURITY_CONFIG, MATURITY_ORDER };
