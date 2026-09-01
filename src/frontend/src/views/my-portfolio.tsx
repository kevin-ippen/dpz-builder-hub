import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, ArrowRight, TrendingUp, Activity, CheckCircle2,
  FlaskConical, Package, Upload, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';
import { MATURITY_CONFIG, MATURITY_ORDER } from '@/components/assets/asset-card';

interface PortfolioAsset {
  id: string; name: string; description?: string;
  type_name: string; category: string; maturity: string;
  install_count: number; scope: string; health: string;
  created_at?: string; updated_at?: string;
}

const HEALTH_ICON: Record<string, { icon: any; color: string }> = {
  healthy: { icon: CheckCircle2, color: 'text-green-500' },
  degraded: { icon: Activity, color: 'text-amber-500' },
  unhealthy: { icon: Activity, color: 'text-red-500' },
  unknown: { icon: Activity, color: 'text-muted-foreground' },
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-xl border p-4 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
    </div>
  );
}

export default function MyPortfolioView() {
  const navigate = useNavigate();
  const { get: apiGet } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [capMap, setCapMap] = useState<Record<string, { slug: string; name: string; category: string }[]>>({});
  const [staleness, setStaleness] = useState<Record<string, { score: number; label: string }>>({});
  const [user, setUser] = useState('');

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('My Portfolio');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchMyAssets = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, capsResp] = await Promise.all([
        apiGet<any>('/api/dpz/portfolio/my-assets'),
        apiGet<any>('/api/dpz/asset-capabilities-bulk'),
      ]);
      if (!resp.error && resp.data) {
        setAssets(resp.data.items || []);
        setUser(resp.data.user || '');
      }
      if (!capsResp.error && capsResp.data?.by_asset) setCapMap(capsResp.data.by_asset);
      const staleResp = await apiGet<any>('/api/dpz/staleness');
      if (!staleResp.error && staleResp.data?.by_asset) setStaleness(staleResp.data.by_asset);
    } catch {} finally { setLoading(false); }
  }, [apiGet]);

  useEffect(() => { fetchMyAssets(); }, [fetchMyAssets]);

  // Stats
  const totalAdoptions = useMemo(() => assets.reduce((s, a) => s + (a.install_count || 0), 0), [assets]);
  const prodCount = useMemo(() => assets.filter(a => a.maturity === 'production').length, [assets]);
  const labCount = useMemo(() => assets.filter(a => ['idea', 'triaged', 'poc'].includes(a.maturity)).length, [assets]);
  const staleCount = useMemo(() => assets.filter(a => staleness[a.id]?.label === 'stale').length, [assets, staleness]);
  const coolingCount = useMemo(() => assets.filter(a => staleness[a.id]?.label === 'cooling').length, [assets, staleness]);

  // Group by maturity
  const grouped = useMemo(() => {
    const g: Record<string, PortfolioAsset[]> = {};
    for (const a of assets) {
      const stage = a.maturity || 'unset';
      if (!g[stage]) g[stage] = [];
      g[stage].push(a);
    }
    return g;
  }, [assets]);

  const orderedStages = [...MATURITY_ORDER, 'unset'].filter(s => grouped[s]?.length);

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />My Portfolio
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Your assets & contributions</h1>
          {user && <p className="text-sm text-muted-foreground mt-0.5">{user}</p>}
        </div>
        <Button onClick={() => navigate('/submit')} size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Submit New
        </Button>
      </div>

      {/* Stats row */}
      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Assets" value={assets.length} icon={Briefcase} />
          <StatCard label="Total Adoptions" value={totalAdoptions} icon={TrendingUp} />
          <StatCard label="In Production" value={prodCount} icon={CheckCircle2} />
          <StatCard label="In Lab" value={labCount} icon={FlaskConical} />
        </div>
      )}

      {/* Needs attention banner */}
      {!loading && (staleCount > 0 || coolingCount > 0) && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {staleCount > 0 && <span className="text-red-600">{staleCount} stale</span>}
                {staleCount > 0 && coolingCount > 0 && ' and '}
                {coolingCount > 0 && <span className="text-amber-600">{coolingCount} cooling</span>}
                {' '}asset{staleCount + coolingCount !== 1 ? 's' : ''} in your portfolio
              </p>
              <p className="text-[11px] text-muted-foreground">
                Consider updating signals, publishing a new version, or promoting to the next maturity stage.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maturity pipeline */}
      {!loading && assets.length > 0 && (
        <div className="flex items-center gap-px bg-muted rounded-lg overflow-hidden border">
          {MATURITY_ORDER.map((stage) => {
            const config = MATURITY_CONFIG[stage];
            const count = grouped[stage]?.length || 0;
            return (
              <div key={stage} className="flex-1 py-2 px-2 text-center relative">
                <div className="text-sm font-bold tracking-tight">{count}</div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  {config.label}
                </div>
                {count > 0 && <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', config.barColor)} />}
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="grid gap-3">
          {[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-muted/50" />)}
        </div>
      )}

      {!loading && assets.length === 0 && (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h3 className="text-lg font-semibold">No assets yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Submit your first idea, POC, or production asset to start building your portfolio.
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <Button onClick={() => navigate('/submit')}>Submit your first asset</Button>
              <Button variant="outline" onClick={() => navigate('/lab')}>
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Explore the Lab
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset lanes by maturity */}
      {orderedStages.map(stage => {
        const config = MATURITY_CONFIG[stage] || { label: stage, barColor: 'bg-gray-400', color: 'bg-gray-100 text-gray-700' };
        const items = grouped[stage];
        return (
          <section key={stage} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-2.5 h-2.5 rounded-full', config.barColor)} />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                {config.label}
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground/60">{items.length}</span>
            </div>
            <div className="grid gap-2">
              {items.map(asset => {
                const hi = HEALTH_ICON[asset.health] || HEALTH_ICON.unknown;
                const HealthIcon = hi.icon;
                return (
                  <button
                    key={asset.id}
                    className="w-full text-left rounded-xl border p-4 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5 transition-all group flex items-center gap-4"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {asset.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                          {asset.type_name}
                        </Badge>
                      </div>
                      {asset.description && (
                        <p className="text-[12px] text-muted-foreground truncate">{asset.description}</p>
                      )}
                      {capMap[asset.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {capMap[asset.id].slice(0, 3).map(c => {
                            const clr = c.category === 'data' ? 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800' : c.category === 'ai' ? 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800' : 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800';
                            return <span key={c.slug} className={cn('px-1.5 py-0.5 text-[9px] font-mono rounded border', clr)}>{c.name}</span>;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-semibold">{asset.install_count}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">adopts</div>
                      </div>
                      <HealthIcon className={cn('h-4 w-4', hi.color)} />
                      {staleness[asset.id] && staleness[asset.id].label !== 'active' && (
                        <AlertTriangle className={cn('h-3.5 w-3.5',
                          staleness[asset.id].label === 'stale' ? 'text-red-500' : 'text-amber-500'
                        )} />
                      )}
                      {asset.scope && asset.scope !== 'draft' && (
                        <Badge variant="secondary" className="text-[9px] font-mono">{asset.scope}</Badge>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
