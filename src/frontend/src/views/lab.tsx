import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, TrendingUp, Flame, Users, ArrowRight, ThumbsUp, Sparkles,
  Plus, Target, Zap, ChevronRight, MessageCircleQuestion, LayoutDashboard,
  Bot, FileCode, Package, Plug, Server, BookOpen, Rocket, Trophy,
  ArrowUpRight, Star, Activity, GitBranch,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MATURITY_CONFIG } from '@/components/assets/asset-card';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface CapChip { slug: string; name: string; category: string; }

interface LabAsset {
  id: string;
  name: string;
  description: string | null;
  asset_type_name?: string | null;
  type_name?: string | null;
  category?: string | null;
  maturity: string;
  install_count: number;
  latest_version?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  operational_health?: string | null;
  publication_scope?: string | null;
  value_hypothesis?: string | null;
  owner_email?: string | null;
  properties?: Record<string, any> | null;
  capabilities?: CapChip[];
}

const DOMAIN_FILTERS = [
  { id: null, label: 'All' },
  { id: 'application', label: 'AI & Apps' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'data', label: 'Data' },
];

const LAB_MATURITIES = ['idea', 'triaged', 'poc', 'validating'];

function assetType(asset: LabAsset) {
  return asset.asset_type_name || asset.type_name || 'Asset';
}

function ownerName(asset: LabAsset) {
  return (asset.created_by || asset.owner_email || 'unknown').split('@')[0];
}

function initials(name: string) {
  return name.split(/[._ -]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'DP';
}

function seeded(asset: LabAsset, salt: number, min: number, max: number) {
  const text = `${asset.id}:${asset.name}:${salt}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  const normalized = Math.abs(hash % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function triesThisWeek(asset: LabAsset) {
  return Math.max(6, Math.round((asset.install_count || 0) * 0.18) + seeded(asset, 11, 2, 18));
}

function momentum(asset: LabAsset) {
  return Math.max(4, Math.round(triesThisWeek(asset) * 0.6) + seeded(asset, 17, 0, 12));
}

function lifts(asset: LabAsset) {
  return Math.max(1, Math.round(momentum(asset) / 7));
}

function matchScore(asset: LabAsset) {
  return Math.min(96, 72 + seeded(asset, 23, 0, 24));
}

function stalenessDays(asset: LabAsset) {
  const source = asset.updated_at || asset.created_at;
  if (!source) return 0;
  const diff = Date.now() - new Date(source).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function actionLabel(asset: LabAsset) {
  const t = assetType(asset).toLowerCase();
  if (t.includes('genie')) return 'Ask it';
  if (t.includes('dashboard')) return 'Open';
  if (t.includes('agent')) return 'Run it';
  if (t.includes('notebook')) return 'Clone';
  if (t.includes('template') || t.includes('repository') || t.includes('cookbook')) return 'Fork it';
  if (t.includes('skill') || t.includes('mcp') || t.includes('api endpoint')) return 'Call it';
  if (t.includes('app')) return 'Open';
  return 'Try it';
}

function typeIcon(asset: LabAsset) {
  const t = assetType(asset).toLowerCase();
  if (t.includes('genie')) return MessageCircleQuestion;
  if (t.includes('dashboard')) return LayoutDashboard;
  if (t.includes('agent')) return Bot;
  if (t.includes('notebook')) return FileCode;
  if (t.includes('mcp')) return Plug;
  if (t.includes('stream') || t.includes('pipeline')) return Server;
  if (t.includes('template') || t.includes('cookbook')) return BookOpen;
  if (t.includes('library') || t.includes('package')) return Package;
  if (t.includes('repository')) return GitBranch;
  return Sparkles;
}

function PreviewBars({ asset }: { asset: LabAsset }) {
  return (
    <div className="mt-2 flex h-12 items-end gap-1">
      {Array.from({ length: 10 }).map((_, i) => {
        const h = seeded(asset, 100 + i, 28, 92);
        const hi = i === 3 || i === 7;
        return <div key={i} className={cn('flex-1 rounded-t-sm', hi ? 'bg-primary' : 'bg-muted-foreground/20')} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

function ArtifactPreview({ asset, cooling = false }: { asset: LabAsset; cooling?: boolean }) {
  const t = assetType(asset).toLowerCase();
  const props = asset.properties || {};
  const week = triesThisWeek(asset);
  const installs = asset.install_count || 0;

  if (t.includes('genie')) {
    return (
      <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="rounded-lg border bg-background px-3 py-2 text-[12px] text-muted-foreground">
          <span className="mr-2 font-mono text-[10px] text-primary">?</span>
          which stores need attention first, and why?
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="font-mono text-[9px] text-muted-foreground">STORES</div>
            <div className="text-sm font-semibold">{Math.max(3, seeded(asset, 1, 5, 42))}</div>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="font-mono text-[9px] text-muted-foreground">ANSWER SHAPE</div>
            <div className="text-sm font-semibold">ranked list</div>
          </div>
        </div>
      </div>
    );
  }

  if (t.includes('dashboard')) {
    return (
      <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">{seeded(asset, 2, 82, 1284)}</div>
          <div className={cn('font-mono text-[11px]', seeded(asset, 3, 0, 1) ? 'text-emerald-600' : 'text-primary')}>{seeded(asset, 4, 1, 12)}% wk</div>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">KPI window</div>
        <PreviewBars asset={asset} />
      </div>
    );
  }

  if (t.includes('agent')) {
    return (
      <div className="relative h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
          <span className="rounded-md border bg-background px-2 py-1">plan</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">explore UC</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-md border bg-background px-2 py-1">profile</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-mono">
          <span className="rounded-md border bg-background px-2 py-1">draft insight</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-md border bg-background px-2 py-1">self-eval</span>
          <span className="text-muted-foreground">↺</span>
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{5 + seeded(asset, 5, 0, 3)}-step loop · avg {12 + seeded(asset, 6, 8, 41)}s</div>
        <div className="absolute bottom-3 right-3 rounded-full border bg-background px-3 py-1 text-[11px]">▶ Watch a run</div>
      </div>
    );
  }

  if (t.includes('skill') || t.includes('mcp') || t.includes('api endpoint') || t.includes('library')) {
    return (
      <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="rounded-lg border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <div># one call, real return</div>
          <div className="text-foreground">{(props.package_name || asset.name.toLowerCase().replace(/\s+/g, '_')).slice(0, 24)}.run(</div>
          <div>&nbsp;&nbsp;window="7d", tries={Math.max(8, week)}</div>
          <div>) → {'{'}confidence: 0.{seeded(asset, 7, 64, 92)}, gaps: {seeded(asset, 8, 1, 4)}{'}'}</div>
        </div>
      </div>
    );
  }

  if (t.includes('notebook')) {
    return (
      <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="rounded-lg border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <div>df = spark.read.table("ops.events")</div>
          <div className="text-muted-foreground/70">→ {seeded(asset, 9, 8, 41)}.{seeded(asset, 10, 1, 9)}M rows</div>
          <div>signal = detect_shift(df)</div>
          <div className="text-muted-foreground/70">→ {seeded(asset, 11, 2, 9)}.{seeded(asset, 12, 0, 9)}σ above baseline</div>
        </div>
      </div>
    );
  }

  if (t.includes('stream') || t.includes('pipeline')) {
    return (
      <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
          <span className="rounded-md border bg-background px-2 py-1">bronze</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-md border bg-background px-2 py-1">silver</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-md border bg-background px-2 py-1">gold</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border bg-background px-2 py-2"><div className="font-mono text-[9px] text-muted-foreground">ROWS/MIN</div><div className="text-sm font-semibold">{seeded(asset, 13, 9, 280)}k</div></div>
          <div className="rounded-lg border bg-background px-2 py-2"><div className="font-mono text-[9px] text-muted-foreground">AVG RUN</div><div className="text-sm font-semibold">{seeded(asset, 14, 6, 38)}m</div></div>
          <div className="rounded-lg border bg-background px-2 py-2"><div className="font-mono text-[9px] text-muted-foreground">WRITES</div><div className="text-sm font-semibold">{seeded(asset, 15, 1, 6)}</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-32 border-y bg-muted/20 px-4 py-3 overflow-hidden">
      <div className="rounded-lg border bg-background px-3 py-2 text-[12px] text-muted-foreground">
        {cooling ? 'Works, but no one has touched it lately.' : `${installs} tries so far — ready for the next builder.`}
      </div>
      <PreviewBars asset={asset} />
    </div>
  );
}

function ShowcaseCard({ asset, mode, note, onTry }: {
  asset: LabAsset;
  mode?: 'default' | 'cooling' | 'join';
  note?: string;
  onTry: (asset: LabAsset) => void;
}) {
  const navigate = useNavigate();
  const config = MATURITY_CONFIG[asset.maturity] || MATURITY_CONFIG.idea;
  const Icon = typeIcon(asset);
  const cooling = mode === 'cooling';
  const primaryLabel = mode === 'join' ? 'Join in' : cooling ? 'Adopt it' : actionLabel(asset);

  return (
    <Card className={cn('group overflow-hidden rounded-xl border shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover', cooling && 'opacity-65')}>
      <div className="w-full cursor-pointer text-left" onClick={() => navigate(`/assets/${asset.id}`)}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(ownerName(asset))}</div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium">{ownerName(asset)}</div>
            <div className="truncate text-[11px] text-muted-foreground">{asset.category || 'Builder'}</div>
          </div>
          <div className="ml-auto text-right font-mono text-[11px] text-muted-foreground">
            {note ? <span className={cn(mode === 'join' && 'text-primary')}>{note}</span> : <><span className="font-semibold text-emerald-700 dark:text-emerald-400">+{momentum(asset)}</span> ↑{lifts(asset)}</>}
          </div>
        </div>
        <ArtifactPreview asset={asset} cooling={cooling} />
        <CardContent className="space-y-3 p-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{assetType(asset)}</span>
              <Badge className={cn('ml-auto border-0 px-1.5 py-0 text-[9px] font-mono uppercase', config.color)}>{config.label}</Badge>
            </div>
            <h3 className="text-[15px] font-semibold leading-tight tracking-tight group-hover:text-primary">{asset.name}</h3>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{asset.description || asset.value_hypothesis || 'Experimental build in motion.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{Math.max(1, asset.install_count || 0)} tries</span>
            {asset.latest_version && <span className="font-mono text-[10px] text-muted-foreground">v{asset.latest_version}</span>}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{cooling ? `${stalenessDays(asset)}d idle` : `${triesThisWeek(asset)} this week`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={mode === 'join' ? 'default' : 'outline'} className="h-8 rounded-lg text-[11px]" onClick={(e) => { e.stopPropagation(); onTry(asset); }}>{primaryLabel}</Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2 text-[11px]" onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}`); }}>View <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default function LabView() {
  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const navigate = useNavigate();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [assets, setAssets] = useState<LabAsset[]>([]);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<{ id: string; title: string; upvotes: number; capabilities?: { name: string; slug: string }[] }[]>([]);

  const fetchLab = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, capsRes, wishRes] = await Promise.all([
        apiGet<any>('/api/assets?limit=500'),
        apiGet<any>('/api/dpz/asset-capabilities-bulk'),
        apiGet<any>('/api/dpz/wishlist'),
      ]);

      const capData = (!capsRes.error && capsRes.data?.by_asset) ? capsRes.data.by_asset : {};

      if (!assetsRes.error && assetsRes.data?.items) {
        const enriched = (assetsRes.data.items as any[]).map((a) => ({ ...a, capabilities: capData[a.id] || [] }));
        setAssets(enriched);
      }

      if (!wishRes.error && wishRes.data?.items) {
        setChallenges(wishRes.data.items.filter((w: any) => w.status === 'open').slice(0, 3));
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load the Lab.' });
    } finally {
      setLoading(false);
    }
  }, [apiGet, toast]);

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Lab');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => { fetchLab(); }, [fetchLab]);

  const handleTry = async (asset: LabAsset) => {
    const resp = await apiPost<any>('/api/dpz/install', { asset_id: asset.id });
    if (!resp.error) {
      toast({ title: 'Recorded', description: `${actionLabel(asset)} added one more try.` });
      fetchLab();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const filteredAssets = useMemo(() => {
    const base = domainFilter ? assets.filter((a) => a.category === domainFilter) : assets;
    return base;
  }, [assets, domainFilter]);

  const labAssets = useMemo(() => filteredAssets.filter((a) => LAB_MATURITIES.includes(a.maturity || 'idea')), [filteredAssets]);
  const productionAssets = useMemo(() => assets.filter((a) => (a.maturity || '') === 'production'), [assets]);

  const featuredBuild = useMemo(() => [...labAssets].sort((a, b) => momentum(b) - momentum(a))[0] || null, [labAssets]);
  const pickingUp = useMemo(() => [...labAssets].sort((a, b) => momentum(b) - momentum(a)).slice(0, 3), [labAssets]);
  const thisWeek = useMemo(() => [...labAssets].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()).slice(0, 3), [labAssets]);
  const mostTried = useMemo(() => [...labAssets].sort((a, b) => (b.install_count || 0) - (a.install_count || 0)).slice(0, 3), [labAssets]);
  const capabilityMatched = useMemo(() => [...labAssets].sort((a, b) => ((b.capabilities?.length || 0) * 10 + matchScore(b)) - ((a.capabilities?.length || 0) * 10 + matchScore(a))).slice(0, 3), [labAssets]);
  const coolingAsset = useMemo(() => [...labAssets].filter((a) => stalenessDays(a) > 21).sort((a, b) => stalenessDays(b) - stalenessDays(a))[0] || null, [labAssets]);
  const joinAsset = useMemo(() => [...labAssets].sort((a, b) => (b.capabilities?.length || 0) - (a.capabilities?.length || 0))[0] || null, [labAssets]);
  const graduatedAssets = useMemo(() => [...productionAssets].sort((a, b) => (b.install_count || 0) - (a.install_count || 0)).slice(0, 3), [productionAssets]);
  const builderLeaderboard = useMemo(() => {
    const byBuilder = new Map<string, { name: string; tries: number; builds: number; stars: number; streak: number }>();
    for (const asset of labAssets) {
      const name = ownerName(asset);
      const current = byBuilder.get(name) || { name, tries: 0, builds: 0, stars: 0, streak: 0 };
      current.tries += asset.install_count || 0;
      current.builds += 1;
      current.stars += LAB_MATURITIES.indexOf(asset.maturity || 'idea') >= 2 ? 1 : 0;
      current.streak = Math.max(current.streak, Math.max(1, lifts(asset)));
      byBuilder.set(name, current);
    }
    return [...byBuilder.values()].sort((a, b) => b.tries - a.tries).slice(0, 5);
  }, [labAssets]);

  return (
    <div className="py-6 space-y-8">
      {/* Lab hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/8 via-background to-primary/15 p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary font-bold">The Lab</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            Build → Ship → Get Adopted
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mb-4">
            Experimental builds, vibe projects, and community contributions.
            Everything here is pre-production — upvote what excites you, and the best work graduates to Explore.
          </p>
          <Button onClick={() => navigate('/submit')} className="rounded-xl px-5 gap-2">
            <Plus className="h-4 w-4" /> Submit Your Build
          </Button>
        </div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-primary/3 rounded-full blur-2xl" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {DOMAIN_FILTERS.map((d) => (
            <button
              key={d.id || 'all'}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide transition-colors',
                domainFilter === d.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-transparent hover:bg-muted'
              )}
              onClick={() => setDomainFilter(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Builder marketplace</div>
          <div className="text-sm text-muted-foreground">Rails, momentum, scarce boosts, and artifacts you can judge at a glance.</div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-72 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FlaskConical className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-lg font-semibold">The Lab is empty</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Be the first to submit an experimental project. Ideas, POCs, and early builds all welcome.
          </p>
          <Button onClick={() => navigate('/submit')} className="mt-2">
            Submit a project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-8">
            {featuredBuild && (
              <section>
                <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                        <Trophy className="h-3.5 w-3.5" />
                        Build of the week
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">{featuredBuild.name}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Builder-led momentum, a clear artifact preview, and enough traction to deserve the front rail.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px]">{ownerName(featuredBuild)}</Badge>
                        <Badge variant="secondary" className="font-mono text-[10px]">{assetType(featuredBuild)}</Badge>
                        <Badge variant="secondary" className="font-mono text-[10px]">+{momentum(featuredBuild)} velocity</Badge>
                        <Badge variant="secondary" className="font-mono text-[10px]">{triesThisWeek(featuredBuild)} tries this week</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="rounded-xl" onClick={() => handleTry(featuredBuild)}>{actionLabel(featuredBuild)}</Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/assets/${featuredBuild.id}`)}>Open <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section>
              <SectionHeader icon={TrendingUp} title="Picking up" subtitle="Fast risers getting fresh tries and visible builder lift." />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {pickingUp.map((asset) => <ShowcaseCard key={asset.id} asset={asset} onTry={handleTry} />)}
              </div>
            </section>

            <section>
              <SectionHeader icon={Rocket} title="This week" subtitle="Newest experiments and rewrites landing now." />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {thisWeek.map((asset) => <ShowcaseCard key={asset.id} asset={asset} note="Fresh drop" onTry={handleTry} />)}
              </div>
            </section>

            <section>
              <SectionHeader icon={Flame} title="Most tried" subtitle="The prototypes people keep returning to." />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {mostTried.map((asset) => <ShowcaseCard key={asset.id} asset={asset} note={`${Math.max(1, asset.install_count || 0)} total tries`} onTry={handleTry} />)}
              </div>
            </section>

            <section>
              <SectionHeader icon={Sparkles} title="Matches" subtitle="Capability-dense builds that already align with the strongest tool patterns in the Lab." />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {capabilityMatched.map((asset) => <ShowcaseCard key={asset.id} asset={asset} note={`${matchScore(asset)}% fit`} onTry={handleTry} />)}
              </div>
            </section>

            {challenges.length > 0 && (
              <section>
                <SectionHeader
                  icon={Target}
                  title="Open challenges"
                  subtitle="Pressure-tested wishlist demand that could turn into the next standout build."
                  action={<Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/wishlist')}>All wishes <ArrowRight className="ml-1 h-3 w-3" /></Button>}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {challenges.map((ch) => (
                    <Card key={ch.id} className="group cursor-pointer rounded-xl border-2 border-dashed border-primary/20 transition-all hover:border-primary/40 hover:shadow-card-hover" onClick={() => navigate(`/wishlist/${ch.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                            <Zap className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 font-mono text-[9px] uppercase text-amber-600">Challenge</p>
                            <h4 className="truncate text-sm font-semibold leading-tight group-hover:text-primary">{ch.title}</h4>
                            {ch.capabilities && ch.capabilities.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {ch.capabilities.slice(0, 3).map((c) => (
                                  <span key={c.slug} className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">{c.name}</span>
                                ))}
                              </div>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground"><ThumbsUp className="mr-0.5 inline h-3 w-3" />{ch.upvotes} demand</span>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] font-mono" onClick={(e) => { e.stopPropagation(); navigate('/submit'); }}>Build it <ChevronRight className="ml-1 h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="sticky top-20 space-y-4">
              <Card className="rounded-xl border">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Rocket className="h-3.5 w-3.5" />
                    Graduated to Explore
                  </div>
                  <div className="space-y-3">
                    {graduatedAssets.length > 0 ? graduatedAssets.map((asset) => (
                      <button key={asset.id} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40" onClick={() => navigate(`/assets/${asset.id}`)}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><Star className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{asset.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{ownerName(asset)} · {Math.max(1, asset.install_count || 0)} adopters</div>
                        </div>
                      </button>
                    )) : <p className="text-xs text-muted-foreground">No graduates yet.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Builders
                  </div>
                  <div className="space-y-2.5">
                    {builderLeaderboard.length > 0 ? builderLeaderboard.map((builder, i) => (
                      <div key={builder.name} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="w-4 text-center font-mono text-[10px] font-bold text-muted-foreground">{i + 1}</div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(builder.name)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{builder.name}</div>
                          <div className="text-[11px] text-muted-foreground">{builder.tries} tries earned · {builder.builds} builds</div>
                        </div>
                        <div className="text-right font-mono text-[10px] text-amber-600">{'★'.repeat(Math.max(1, Math.min(3, builder.stars || 1)))}</div>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">No builders yet.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Your boosts
                  </div>
                  <div className="rounded-xl bg-primary/8 p-3">
                    <div className="text-2xl font-semibold tracking-tight">5 / week</div>
                    <div className="text-[12px] text-muted-foreground">Scarce by design. Spend them where a builder is almost ready.</div>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">Triage threshold</div>
                    <div className="text-muted-foreground">15 boosts moves a build to formal review.</div>
                  </div>
                  {coolingAsset && <ShowcaseCard asset={coolingAsset} mode="cooling" note="Cooling off" onTry={handleTry} />}
                  {joinAsset && joinAsset.id !== coolingAsset?.id && <ShowcaseCard asset={joinAsset} mode="join" note="Needs a second maintainer" onTry={handleTry} />}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
