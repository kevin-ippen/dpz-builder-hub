import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, FlaskConical, Upload, BarChart3, ArrowRight,
  TrendingUp, Zap, Search, Package, ThumbsUp, Lightbulb,
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
  asset_name: string; signal_source: string;
  value_numeric: number | null; observed_at: string;
  title?: string; created_at?: string;
}

interface CapChip { slug: string; name: string; category: string; }
interface WishTeaser { id: string; title: string; upvotes: number; status: string; }
interface Stats { total: number; featured: number; production: number; }

const AV_COLORS = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-teal-500'];
function avColor(s: string) { let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); return AV_COLORS[Math.abs(h)%AV_COLORS.length]; }

const CAP_CLR: Record<string,string> = {
  data: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800',
  ai: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800',
  platform: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800',
};

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
function SpotlightCard({ asset, caps }: { asset: MarketplaceAsset; caps?: CapChip[] }) {
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
        {caps && caps.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {caps.slice(0, 3).map(c => (
              <span key={c.slug} className={cn('px-1.5 py-0.5 text-[9px] font-mono rounded border', CAP_CLR[c.category] || CAP_CLR.platform)}>{c.name}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed text-[11px] text-muted-foreground">
          {asset.created_by ? (
            <div className="flex items-center gap-1.5">
              <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0', avColor(asset.created_by))}>
                {asset.created_by.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[80px]">{asset.created_by.split('@')[0]}</span>
            </div>
          ) : <span>Unknown</span>}
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
  const [capMap, setCapMap] = useState<Record<string, CapChip[]>>({});
  const [topWishes, setTopWishes] = useState<WishTeaser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const [mp, st, sig, capsRes, wishRes] = await Promise.all([
        apiGet<any>('/api/dpz/marketplace'),
        apiGet<any>('/api/dpz/marketplace/stats'),
        apiGet<any>('/api/dpz/signals?limit=8'),
        apiGet<any>('/api/dpz/asset-capabilities-bulk'),
        apiGet<any>('/api/dpz/wishlist'),
      ]);
      if (!mp.error && mp.data) {
        setFeatured((mp.data.featured || []).slice(0, 3));
        setTrending((mp.data.trending || []).slice(0, 4));
        setRecent((mp.data.recent_releases || []).slice(0, 4));
      }
      if (!st.error && st.data) setStats(st.data);
      if (!sig.error && Array.isArray(sig.data?.items)) setSignals(sig.data.items.slice(0, 6));
      else if (!sig.error && Array.isArray(sig.data)) setSignals(sig.data.slice(0, 6));
      if (!capsRes.error && capsRes.data?.by_asset) setCapMap(capsRes.data.by_asset);
      if (!wishRes.error && wishRes.data?.items) setTopWishes(wishRes.data.items.filter((w: any) => w.status === 'open').slice(0, 3));
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
                {featured.map((a) => <SpotlightCard key={a.id} asset={a} caps={capMap[a.id]} />)}
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{a.type_name} · {a.install_count} adopts</span>
                          {capMap[a.id]?.slice(0, 2).map(c => (
                            <span key={c.slug} className={cn('px-1 py-0 text-[8px] font-mono rounded border hidden md:inline', CAP_CLR[c.category] || CAP_CLR.platform)}>{c.name}</span>
                          ))}
                        </div>
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
                    <button key={s.id} className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 hover:border-primary/20 transition-all" onClick={() => navigate(`/assets/${s.asset_id}`)}>
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Zap className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate">{s.asset_name || s.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {s.signal_type.replace(/_/g, ' ')}
                          {s.value_numeric != null && <span className="ml-1 text-foreground">{s.value_numeric % 1 === 0 ? s.value_numeric : s.value_numeric.toFixed(1)}</span>}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {new Date(s.observed_at || s.created_at || '').toLocaleDateString()}
                      </span>
                    </button>
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{a.name}</p>
                      {a.latest_version && (
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0 px-1.5 py-0">v{a.latest_version}</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.type_name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{a.description || ''}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
          {/* ═══ Top Wishes ═══ */}
          {topWishes.length > 0 && (
            <section>
              <SectionHeader
                icon={Lightbulb}
                title="Top Wishes"
                action={
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/wishlist')}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topWishes.map(w => (
                  <button
                    key={w.id}
                    className="text-left rounded-xl border p-4 hover:shadow-card-hover hover:border-primary/20 transition-all group"
                    onClick={() => navigate(`/wishlist/${w.id}`)}
                  >
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{w.title}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <ThumbsUp className="h-3 w-3" />
                      <span className="font-mono font-semibold text-foreground">{w.upvotes}</span> upvotes
                    </div>
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
