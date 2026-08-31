import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, TrendingUp, Flame, Users, ArrowRight, ThumbsUp, Sparkles } from 'lucide-react';
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
  type_name: string;
  category: string;
  maturity: string;
  install_count: number;
  latest_version: string | null;
  created_by: string | null;
  created_at: string;
  capabilities?: CapChip[];
}

const DOMAIN_FILTERS = [
  { id: null, label: 'All' },
  { id: 'application', label: 'AI & Apps' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'data', label: 'Data' },
];

// Pre-production maturity stages only
const LAB_MATURITIES = ['idea', 'triaged', 'poc', 'validating'];

function LabCard({ asset, onUpvote }: { asset: LabAsset; onUpvote: (id: string) => void }) {
  const navigate = useNavigate();
  const [heroError, setHeroError] = useState(false);
  const config = MATURITY_CONFIG[asset.maturity] || MATURITY_CONFIG.idea;
  const stageIndex = LAB_MATURITIES.indexOf(asset.maturity);
  const progress = ((stageIndex + 1) / LAB_MATURITIES.length) * 100;

  return (
    <Card
      className="group relative overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-1 transition-all duration-200 cursor-pointer border rounded-xl"
      onClick={() => navigate(`/assets/${asset.id}`)}
    >
      {/* Gradient header with maturity progress */}
      <div className="relative h-[80px] overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="flex items-end h-full p-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {asset.type_name}
            </span>
          </div>
        </div>
        {/* Maturity progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div
            className={cn('h-full transition-all', config.barColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <CardContent className="p-4">
        <div className="mb-2">
          <h3 className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
            {asset.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border-0', config.color)}
              style={{ backgroundColor: `${config.color}15` }}
            >
              {config.label}
            </Badge>
            {asset.latest_version && (
              <span className="text-[10px] font-mono text-muted-foreground">v{asset.latest_version}</span>
            )}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-2 min-h-[2.5em]">
          {asset.description || 'No description yet — new experiment in progress.'}
        </p>

        {/* Capability chips */}
        {asset.capabilities && asset.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {asset.capabilities.slice(0, 3).map((cap) => {
              const catColor = cap.category === 'data'
                ? 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800'
                : cap.category === 'ai'
                ? 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800'
                : 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800';
              return (
                <span key={cap.slug} className={cn('px-1.5 py-0.5 text-[9px] font-mono rounded border', catColor)}>
                  {cap.name}
                </span>
              );
            })}
            {asset.capabilities.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{asset.capabilities.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-dashed">
          <div className="flex items-center gap-3">
            {asset.created_by && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                {asset.created_by}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] font-mono uppercase gap-1 hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onUpvote(asset.id); }}
          >
            <ThumbsUp className="h-3 w-3" />
            {asset.install_count}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
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
  const [heroImages, setHeroImages] = useState<Record<string, { image_url: string }>>({}); 
  const [capMap, setCapMap] = useState<Record<string, CapChip[]>>({});

  const fetchLab = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, heroes, capsRes] = await Promise.all([
        apiGet<any>('/api/dpz/marketplace'),
        apiGet<any>('/api/dpz/images/heroes'),
        apiGet<any>('/api/dpz/asset-capabilities-bulk'),
      ]);
      if (!assetsRes.error && assetsRes.data) {
        // Combine all marketplace results and filter to lab maturities
        const all = [
          ...(assetsRes.data.featured || []),
          ...(assetsRes.data.trending || []),
          ...(assetsRes.data.recent_releases || []),
        ];
        // Dedupe by id
        const seen = new Set<string>();
        const labAssets = all.filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return LAB_MATURITIES.includes(a.maturity);
        });
        // Merge capabilities from bulk fetch
        const capData = (!capsRes.error && capsRes.data?.by_asset) ? capsRes.data.by_asset : {};
        const enriched = labAssets.map((a: any) => ({ ...a, capabilities: capData[a.id] || [] }));
        setAssets(enriched);
      }
      if (!heroes.error && heroes.data?.heroes) setHeroImages(heroes.data.heroes);
      if (!capsRes.error && capsRes.data?.by_asset) setCapMap(capsRes.data.by_asset);
    } catch {} finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Lab');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => { fetchLab(); }, [fetchLab]);

  const handleUpvote = async (assetId: string) => {
    const resp = await apiPost<any>('/api/dpz/install', { asset_id: assetId });
    if (!resp.error) {
      toast({ title: '\uD83D\uDC4D Upvoted!', description: 'Your signal of interest has been recorded.' });
      fetchLab();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const filtered = domainFilter
    ? assets.filter(a => a.category === domainFilter)
    : assets;

  // Sort: most recently created first, then by upvotes
  const sorted = [...filtered].sort((a, b) => b.install_count - a.install_count);
  const hot = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Leaderboard: top builders by asset count
  const builders = assets.reduce<Record<string, number>>((acc, a) => {
    const owner = a.created_by || 'Unknown';
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});
  const topBuilders = Object.entries(builders)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

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
          <p className="text-sm text-muted-foreground max-w-xl">
            Experimental builds, vibe projects, and community contributions.
            Everything here is pre-production — upvote what excites you, and the best work graduates to Explore.
          </p>
        </div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-primary/3 rounded-full blur-2xl" />
      </div>

      {/* Domain filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DOMAIN_FILTERS.map((d) => (
          <button
            key={d.id || 'all'}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wide transition-colors border',
              domainFilter === d.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted border-transparent'
            )}
            onClick={() => setDomainFilter(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8">
          <div className="space-y-8 min-w-0">
            {/* Hot this week */}
            {hot.length > 0 && (
              <section>
                <SectionHeader icon={Flame} title="Hot This Week" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {hot.map((a, i) => (
                    <div key={a.id} className="relative">
                      {i === 0 && (
                        <div className="absolute -top-2 -left-2 z-10 bg-primary text-primary-foreground text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow">
                          #1
                        </div>
                      )}
                      <LabCard asset={a} onUpvote={handleUpvote} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All lab projects */}
            {rest.length > 0 && (
              <section>
                <SectionHeader
                  icon={Sparkles}
                  title="All Lab Projects"
                  action={
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/submit')}>
                      Submit yours <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rest.map((a) => <LabCard key={a.id} asset={a} onUpvote={handleUpvote} />)}
                </div>
              </section>
            )}

            {/* Empty state */}
            {assets.length === 0 && (
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
            )}
          </div>

          {/* Leaderboard sidebar */}
          <aside className="space-y-4">
            <div className="rounded-xl border p-4 sticky top-20">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Top Builders
              </h3>
              {topBuilders.length > 0 ? (
                <div className="space-y-2">
                  {topBuilders.map(([name, count], i) => (
                    <div key={name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          'text-[10px] font-mono font-bold w-4 text-center',
                          i === 0 ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {i + 1}
                        </span>
                        <span className="text-sm truncate">{name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                        {count} {count === 1 ? 'project' : 'projects'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No builders yet</p>
              )}
            </div>

            {/* Maturity legend */}
            <div className="rounded-xl border p-4">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Lab Stages
              </h3>
              <div className="space-y-1.5">
                {LAB_MATURITIES.map((m) => {
                  const c = MATURITY_CONFIG[m];
                  return (
                    <div key={m} className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', c.barColor)} />
                      <span className="text-xs">{c.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">→ Explore</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
