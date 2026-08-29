import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, FlaskConical, Upload, BarChart3, ArrowRight,
  TrendingUp, Zap, Search, Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UnityCatalogLogo } from '@/components/unity-catalog-logo';
import { useApi } from '@/hooks/use-api';
import { useUICustomizationStore } from '@/stores/ui-customization-store';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────
interface MarketplaceAsset {
  id: string; name: string; description: string | null;
  type_name: string; category: string; maturity: string;
  install_count: number; latest_version: string | null;
  created_by: string | null; created_at: string;
}

interface Signal {
  id: string; asset_id: string; signal_type: string;
  title: string; created_at: string;
}

interface Stats { total: number; featured: number; production: number; }

// ─── Maturity config (inline, small) ────────────────────────────────────
const MATURITY_BADGES: Record<string, { label: string; color: string }> = {
  idea: { label: 'Idea', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  triaged: { label: 'Triaged', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  poc: { label: 'POC', color: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  validating: { label: 'Validating', color: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  production_candidate: { label: 'Prod Candidate', color: 'bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  production: { label: 'Production', color: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' },
};

// ─── Compact asset card for featured spotlight ──────────────────────────
function SpotlightCard({ asset }: { asset: MarketplaceAsset }) {
  const navigate = useNavigate();
  const badge = MATURITY_BADGES[asset.maturity] || MATURITY_BADGES.idea;
  return (
    <Card
      className="group overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-1 transition-all duration-200 cursor-pointer border rounded-xl"
      onClick={() => navigate(`/assets/${asset.id}`)}
    >
      <div className="relative h-[100px] overflow-hidden bg-gradient-to-br from-primary/8 via-background to-primary/15">
        <div className="flex items-end h-full p-4">
          <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {asset.type_name}
          </span>
        </div>
        <div className="absolute top-2.5 left-2.5">
          <Badge className={cn('text-[9px] font-mono uppercase border-0 px-1.5 py-0', badge.color)}>
            {badge.label}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors mb-1">
          {asset.name}
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5em]">
          {asset.description || 'No description provided.'}
        </p>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed text-[11px] text-muted-foreground">
          <span className="truncate max-w-[100px]">{asset.created_by || 'Unknown'}</span>
          <span className="font-mono">{asset.install_count} adopts</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick-link tile ────────────────────────────────────────────────────
function QuickLink({ icon: Icon, title, desc, to }: { icon: any; title: string; desc: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="group text-left rounded-xl border p-5 space-y-2 hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-0.5 transition-all duration-200 bg-card"
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{title}</p>
      <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── Section header ─────────────────────────────────────────────────────
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

// ─── Home View ──────────────────────────────────────────────────────────
export default function HomeView() {
  const { get: apiGet } = useApi();
  const navigate = useNavigate();
  const appName = useUICustomizationStore((s) => s.appName) || 'Builder Hub';

  const [featured, setFeatured] = useState<MarketplaceAsset[]>([]);
  const [trending, setTrending] = useState<MarketplaceAsset[]>([]);
  const [recent, setRecent] = useState<MarketplaceAsset[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const [mp, st, sig] = await Promise.all([
        apiGet<any>('/api/dpz/marketplace'),
        apiGet<any>('/api/dpz/marketplace/stats'),
        apiGet<any>('/api/dpz/signals?limit=8'),
      ]);
      if (!mp.error && mp.data) {
        setFeatured((mp.data.featured || []).slice(0, 3));
        setTrending((mp.data.trending || []).slice(0, 4));
        setRecent((mp.data.recent_releases || []).slice(0, 4));
      }
      if (!st.error && st.data) setStats(st.data);
      if (!sig.error && Array.isArray(sig.data?.items)) setSignals(sig.data.items.slice(0, 6));
      else if (!sig.error && Array.isArray(sig.data)) setSignals(sig.data.slice(0, 6));
    } catch {} finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => { fetchHome(); }, [fetchHome]);

  const handleSearch = () => {
    if (search.trim()) navigate(`/assets?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="py-6 space-y-10">
      {/* ═══ Hero ═══ */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <UnityCatalogLogo className="h-10 w-10" />
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary font-bold">{appName}</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            Discover, adopt, and ship<br />what the team is building.
          </h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg">
            Production-ready accelerators in Explore. Experimental builds and vibe projects in the Lab.
            Everything governed, everything reusable.
          </p>
          {/* Search */}
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                className="pl-9 h-11 rounded-xl bg-background/80 shadow-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button className="h-11 rounded-xl px-5" onClick={handleSearch}>Search</Button>
          </div>
          {/* Stats */}
          {stats && (
            <div className="flex gap-6 mt-6 text-[11px] font-mono text-muted-foreground">
              <span><strong className="text-foreground text-sm font-semibold">{stats.total}</strong> total assets</span>
              <span><strong className="text-foreground text-sm font-semibold">{stats.production}</strong> production</span>
              <span><strong className="text-foreground text-sm font-semibold">{stats.featured}</strong> featured</span>
            </div>
          )}
        </div>
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* ═══ Quick Links ═══ */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink icon={Box} title="Explore" desc="Browse certified, production-ready assets." to="/assets" />
          <QuickLink icon={FlaskConical} title="The Lab" desc="Experimental builds and vibe projects." to="/lab" />
          <QuickLink icon={Upload} title="Submit" desc="Register a new accelerator or project." to="/submit" />
          <QuickLink icon={BarChart3} title="Dashboard" desc="Portfolio health and adoption metrics." to="/dashboard" />
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-52 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <>
          {/* ═══ Featured Spotlight ═══ */}
          {featured.length > 0 && (
            <section>
              <SectionHeader
                icon={Zap}
                title="Featured"
                action={
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/assets')}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featured.map((a) => <SpotlightCard key={a.id} asset={a} />)}
              </div>
            </section>
          )}

          {/* ═══ Two-column: Trending + Recent Signals ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Trending */}
            {trending.length > 0 && (
              <section>
                <SectionHeader icon={TrendingUp} title="Trending" />
                <div className="space-y-2">
                  {trending.map((a, i) => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 hover:border-primary/20 transition-all group"
                      onClick={() => navigate(`/assets/${a.id}`)}
                    >
                      <span className={cn(
                        'text-[10px] font-mono font-bold w-4 text-center shrink-0',
                        i === 0 ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{a.type_name} · {a.install_count} adopts</p>
                      </div>
                      <Badge className={cn('text-[8px] font-mono uppercase border-0 shrink-0', (MATURITY_BADGES[a.maturity] || MATURITY_BADGES.idea).color)}>
                        {(MATURITY_BADGES[a.maturity] || MATURITY_BADGES.idea).label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Signals */}
            <section>
              <SectionHeader icon={Zap} title="Recent Signals" />
              {signals.length > 0 ? (
                <div className="space-y-2">
                  {signals.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.signal_type}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-[12px] text-muted-foreground">No recent signals yet.</p>
                </div>
              )}
            </section>
          </div>

          {/* ═══ Recently Released ═══ */}
          {recent.length > 0 && (
            <section>
              <SectionHeader
                icon={Package}
                title="Recently Released"
                action={
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/assets')}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {recent.map((a) => (
                  <button
                    key={a.id}
                    className="text-left rounded-xl border p-4 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5 transition-all group"
                    onClick={() => navigate(`/assets/${a.id}`)}
                  >
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.type_name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{a.description || ''}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
