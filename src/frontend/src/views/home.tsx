import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Package, Star, Users, ArrowRight, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MATURITY_CONFIG } from '@/components/assets/asset-card';
import { UnityCatalogLogo } from '@/components/unity-catalog-logo';
import SearchBar from '@/components/ui/search-bar';
import { useUICustomizationStore } from '@/stores/ui-customization-store';

interface MarketplaceAsset {
  id: string;
  name: string;
  description: string | null;
  type_name: string;
  category: string;
  icon: string;
  maturity: string;
  install_count: number;
  latest_version: string | null;
  featured: boolean;
  publication_scope: string;
  created_by: string | null;
}

interface MarketplaceStats {
  total_assets: number;
  total_versions: number;
  total_installs: number;
  contributors: number;
}

const CATEGORY_FILTERS = [
  { id: null, label: 'All' },
  { id: 'application', label: 'AI & Apps' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'governance', label: 'Governance' },
  { id: 'data', label: 'Data' },
];

function StatCounter({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 text-primary mb-0.5">
        <Icon className="h-4 w-4" />
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function AssetCard({ asset, onInstall, heroUrl }: { asset: MarketplaceAsset; onInstall: (id: string) => void; heroUrl?: string }) {
  const navigate = useNavigate();
  const config = MATURITY_CONFIG[asset.maturity] || MATURITY_CONFIG.idea;

  return (
    <Card
      className="group relative overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-1 transition-all duration-200 cursor-pointer border rounded-xl"
      onClick={() => navigate(`/assets/${asset.id}`)}
    >
      {/* Hero image */}
      <div className="relative h-[120px] overflow-hidden bg-gradient-to-br from-muted/60 to-muted">
        {heroUrl ? (
          <img src={heroUrl} alt={asset.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex items-end h-full p-3 bg-[radial-gradient(circle_at_80%_12%,rgba(68,98,201,0.15),transparent_36%),linear-gradient(145deg,hsl(var(--muted)),hsl(var(--card)))]">
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">{asset.type_name}</span>
          </div>
        )}
        <div className={cn('absolute bottom-0 left-0 right-0 h-[3px]', config.barColor)} />
        {asset.featured && (
          <Star className="absolute top-2 right-2 h-3.5 w-3.5 text-amber-500 fill-amber-500 drop-shadow" />
        )}
      </div>

      <CardContent className="p-4">
        <div className="mb-2">
          <h3 className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
            {asset.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[9px] font-mono uppercase px-1.5 py-0">
              {asset.type_name}
            </Badge>
            {asset.latest_version && (
              <span className="text-[10px] font-mono text-muted-foreground">v{asset.latest_version}</span>
            )}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 mb-3 min-h-[2.5em]">
          {asset.description || 'No description available.'}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-dashed">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Download className="h-3 w-3" />
              <span className="tabular-nums">{asset.install_count}</span>
            </div>
            <Badge
              className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border-0', config.color)}
              style={{ backgroundColor: `${config.color}15` }}
            >
              {config.label}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] font-mono uppercase opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onInstall(asset.id); }}
          >
            Adopt
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

export default function Home() {
  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const navigate = useNavigate();
  const appName = useUICustomizationStore((s) => s.getAppName());

  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [featured, setFeatured] = useState<MarketplaceAsset[]>([]);
  const [trending, setTrending] = useState<MarketplaceAsset[]>([]);
  const [recent, setRecent] = useState<MarketplaceAsset[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImages, setHeroImages] = useState<Record<string, { image_url: string }>>({});

  const fetchData = useCallback(async (cat: string | null) => {
    setLoading(true);
    try {
      const params = cat ? `?category=${cat}` : '';
      const [mkt, st, heroes] = await Promise.all([
        apiGet<any>(`/api/dpz/marketplace${params}`),
        apiGet<MarketplaceStats>('/api/dpz/marketplace/stats'),
        apiGet<any>('/api/dpz/images/heroes'),
      ]);
      if (!mkt.error && mkt.data) {
        setFeatured(mkt.data.featured || []);
        setTrending(mkt.data.trending || []);
        setRecent(mkt.data.recent_releases || []);
      }
      if (!st.error && st.data) setStats(st.data);
      if (!heroes.error && heroes.data?.heroes) setHeroImages(heroes.data.heroes);
    } catch {} finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    fetchData(categoryFilter);
  }, [categoryFilter, fetchData]);

  const handleInstall = async (assetId: string) => {
    const resp = await apiPost<any>('/api/dpz/install', { asset_id: assetId });
    if (!resp.error) {
      toast({ title: 'Adopted!', description: `Install recorded. Total: ${resp.data?.install_count}` });
      fetchData(categoryFilter);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };
  return (
    <div className="py-6 space-y-8">
      {/* Hero — identity + search + stats */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <UnityCatalogLogo className="h-10 w-10" />
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {appName}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mb-5">
            Discover, adopt, and reuse production-ready accelerators from across the organization.
            Every asset is versioned, governed, and tracked.
          </p>
          <div className="max-w-xl">
            <SearchBar variant="large" placeholder="Search accelerators, agents, pipelines…" />
          </div>

          {stats && (
            <div className="flex items-center gap-8 mt-6 pt-4 border-t border-dashed">
              <StatCounter icon={Package} value={stats.total_assets} label="Assets" />
              <StatCounter icon={Download} value={stats.total_installs} label="Adoptions" />
              <StatCounter icon={Star} value={stats.total_versions} label="Releases" />
              <StatCounter icon={Users} value={stats.contributors} label="Contributors" />
            </div>
          )}
        </div>
        {/* Background decoration */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-primary/3 rounded-full blur-2xl" />
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat.id || 'all'}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wide transition-colors border',
              categoryFilter === cat.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted border-transparent'
            )}
            onClick={() => setCategoryFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-52 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <>
          {/* Featured */}
          {featured.length > 0 && (
            <section>
              <SectionHeader icon={Sparkles} title="Featured" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featured.map((a) => <AssetCard key={a.id} asset={a} onInstall={handleInstall} heroUrl={heroImages[a.id]?.image_url} />)}
              </div>
            </section>
          )}

          {/* Trending */}
          {trending.length > 0 && (
            <section>
              <SectionHeader
                icon={TrendingUp}
                title="Trending"
                action={
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/assets')}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trending.map((a) => <AssetCard key={a.id} asset={a} onInstall={handleInstall} heroUrl={heroImages[a.id]?.image_url} />)}
              </div>
            </section>
          )}

          {/* Recently Released */}
          {recent.length > 0 && (
            <section>
              <SectionHeader icon={Clock} title="Recently Released" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recent.map((a) => <AssetCard key={a.id} asset={a} onInstall={handleInstall} heroUrl={heroImages[a.id]?.image_url} />)}
              </div>
            </section>
          )}

          {/* Empty state */}
          {featured.length === 0 && trending.length === 0 && recent.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <Package className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-semibold">No assets yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Assets appear here once they have a published version. Submit an asset to get started.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
