import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, TrendingUp, Activity, ShieldCheck, Lightbulb,
  FlaskConical, Package, ThumbsUp, ArrowRight, CheckCircle2,
  Clock, X, GitPullRequest,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';
import { MATURITY_CONFIG, MATURITY_ORDER } from '@/components/assets/asset-card';

// ─── Types ───
interface PortfolioData {
  total: number;
  by_maturity: { stage: string; count: number }[];
  by_type: { type: string; count: number }[];
  by_scope: { scope: string; count: number }[];
  by_health: { health: string; count: number }[];
}
interface AdoptionData {
  recent_activity: { id: string; name: string; type_name: string; maturity: string; scope: string; updated_at: string }[];
  scope_distribution: { scope: string; count: number }[];
}
interface HealthItem { id: string; name: string; type_name: string; health: string; maturity: string; }
interface EvidenceItem {
  id: string; name: string; type_name: string; maturity: string; health: string;
  total_signals: number; signal_types: number; last_signal_at: string | null; evidence_score: number;
}
interface WishItem { id: string; title: string; status: string; priority: string; upvotes: number; category?: string; capabilities?: { name: string; slug: string }[]; }
interface CapItem { slug: string; name: string; category: string; }

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-green-500', degraded: 'text-amber-500', unknown: 'text-muted-foreground',
};
const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-green-500', degraded: 'bg-amber-500', unknown: 'bg-gray-400',
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardView() {
  const navigate = useNavigate();
  const { get: apiGet, put: apiPut } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [adoption, setAdoption] = useState<AdoptionData | null>(null);
  const [health, setHealth] = useState<HealthItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [capabilities, setCapabilities] = useState<CapItem[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Dashboard');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const [pR, aR, hR, eR, wR, cR, prR, actR] = await Promise.all([
        apiGet<PortfolioData>('/api/dpz/portfolio'),
        apiGet<AdoptionData>('/api/dpz/adoption'),
        apiGet<any>('/api/dpz/health'),
        apiGet<any>('/api/dpz/evidence'),
        apiGet<any>('/api/dpz/wishlist'),
        apiGet<any>('/api/dpz/capabilities'),
        apiGet<any>('/api/dpz/promotions'),
        apiGet<any>('/api/dpz/activity?limit=20'),
      ]);
      if (!pR.error && pR.data) setPortfolio(pR.data);
      if (!aR.error && aR.data) setAdoption(aR.data);
      if (!hR.error && hR.data) setHealth(hR.data.items ?? []);
      if (!eR.error && eR.data) setEvidence(eR.data.items ?? []);
      if (!wR.error && wR.data?.items) setWishlist(wR.data.items);
      if (!cR.error && cR.data?.items) setCapabilities(cR.data.items);
      if (!prR.error && prR.data?.items) setPromotions(prR.data.items);
      if (!actR.error && actR.data?.items) setActivity(actR.data.items);
    })();
  }, [apiGet]);

  // Derived stats
  const prodCount = useMemo(() => portfolio?.by_maturity.find(m => m.stage === 'production')?.count || 0, [portfolio]);
  const labCount = useMemo(() => {
    const labStages = ['idea', 'triaged', 'poc'];
    return portfolio?.by_maturity.filter(m => labStages.includes(m.stage)).reduce((s, m) => s + m.count, 0) || 0;
  }, [portfolio]);
  const openWishes = useMemo(() => wishlist.filter(w => w.status === 'open').length, [wishlist]);
  const totalUpvotes = useMemo(() => wishlist.reduce((s, w) => s + w.upvotes, 0), [wishlist]);

  // Capability coverage: how many wishes need each capability
  const capCoverage = useMemo(() => {
    const counts: Record<string, number> = {};
    wishlist.forEach(w => {
      w.capabilities?.forEach((c: any) => {
        counts[c.slug] = (counts[c.slug] || 0) + 1;
      });
    });
    return capabilities
      .map(c => ({ ...c, demand_count: counts[c.slug] || 0 }))
      .filter(c => c.demand_count > 0)
      .sort((a, b) => b.demand_count - a.demand_count);
  }, [wishlist, capabilities]);

  // Health grouped
  const healthGrouped = health.reduce<Record<string, HealthItem[]>>((acc, item) => {
    if (!acc[item.health]) acc[item.health] = [];
    acc[item.health].push(item);
    return acc;
  }, {});

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-2">
          <span className="w-4 h-px bg-primary inline-block" />Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio Health & Demand</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {portfolio ? `${portfolio.total} assets` : 'Loading...'} across the organization
        </p>
      </div>

      {/* ═══ Top Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Assets" value={portfolio?.total || 0} icon={Package} sub={`${prodCount} production`} />
        <StatCard label="In Lab" value={labCount} icon={FlaskConical} sub="Pre-production" />
        <StatCard label="Open Wishes" value={openWishes} icon={Lightbulb} sub={`${totalUpvotes} total upvotes`} />
        <StatCard label="Evidence Score" value={evidence.length > 0 ? `${Math.round(evidence.reduce((s, e) => s + e.evidence_score, 0) / evidence.length)}%` : '—'} icon={ShieldCheck} sub="Avg across assets" />
      </div>

      {/* ═══ Maturity Pipeline ═══ */}
      {portfolio && (
        <div className="flex items-center gap-px bg-muted rounded-lg overflow-hidden border">
          {MATURITY_ORDER.map(stage => {
            const config = MATURITY_CONFIG[stage];
            const count = portfolio.by_maturity.find(m => m.stage === stage)?.count || 0;
            return (
              <div key={stage} className="flex-1 py-2.5 px-2 text-center relative">
                <div className="text-sm font-bold tracking-tight">{count}</div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{config.label}</div>
                {count > 0 && <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', config.barColor)} />}
              </div>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="demand" className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Demand
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Health
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex items-center gap-1.5">
            <GitPullRequest className="h-3.5 w-3.5" /> Promotions{promotions.filter(p => p.status === 'pending').length > 0 ? ` (${promotions.filter(p => p.status === 'pending').length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview ─── */}
        <TabsContent value="overview" className="pt-4">
          {!portfolio ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">By Type</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.by_type.map(t => (
                      <div key={t.type} className="flex items-center justify-between">
                        <span className="text-sm">{t.type}</span>
                        <Badge variant="secondary" className="font-mono text-[10px]">{t.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Publication Scope</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.by_scope.map(s => (
                      <div key={s.scope} className="flex items-center justify-between">
                        <span className="text-sm">{s.scope}</span>
                        <Badge variant="secondary" className="font-mono text-[10px]">{s.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Evidence Coverage</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {evidence.slice(0, 8).map(e => (
                      <div key={e.id} className="rounded-lg border p-3 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate(`/assets/${e.id}`)}>
                        <p className="text-sm font-medium truncate">{e.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground font-mono">{e.total_signals} signals</span>
                          <Badge variant={e.evidence_score >= 70 ? 'default' : 'secondary'} className="text-[9px] font-mono">{e.evidence_score}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── Demand (Wishlist + Capability Heatmap) ─── */}
        <TabsContent value="demand" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Top Wishes by Demand</CardTitle>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/wishlist')}>
                      View all <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {wishlist.slice(0, 8).map((w, i) => (
                      <button
                        key={w.id}
                        className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 hover:border-primary/20 transition-all group"
                        onClick={() => navigate(`/wishlist/${w.id}`)}
                      >
                        <span className={cn('text-[10px] font-mono font-bold w-4 text-center shrink-0', i === 0 ? 'text-primary' : 'text-muted-foreground')}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{w.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {w.capabilities?.slice(0, 2).map((c: any) => (
                              <span key={c.slug} className="text-[9px] font-mono text-muted-foreground">{c.name}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-bold">{w.upvotes}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Capability demand heatmap */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                    Most Wanted Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {capCoverage.length > 0 ? (
                    <div className="space-y-2">
                      {capCoverage.slice(0, 10).map(cap => (
                        <div key={cap.slug} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{cap.name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(cap.demand_count, 5) }).map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full bg-primary" />
                            ))}
                            {cap.demand_count > 5 && <span className="text-[9px] font-mono text-muted-foreground">+{cap.demand_count - 5}</span>}
                          </div>
                          <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                            {cap.demand_count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground py-4 text-center">No capability demand yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                    Wish Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {[
                    { status: 'open', label: 'Open', color: 'bg-blue-500' },
                    { status: 'in-review', label: 'In Review', color: 'bg-purple-500' },
                    { status: 'matched', label: 'Matched', color: 'bg-green-500' },
                  ].map(({ status, label, color }) => {
                    const count = wishlist.filter(w => w.status === status).length;
                    return (
                      <div key={status} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', color)} />
                          <span className="text-[12px]">{label}</span>
                        </div>
                        <span className="text-[12px] font-mono font-bold">{count}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── Health ─── */}
        <TabsContent value="health" className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {(['healthy', 'degraded', 'unknown'] as const).map(h => (
              <Card key={h}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('w-2.5 h-2.5 rounded-full', HEALTH_BG[h])} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{h}</span>
                  </div>
                  <div className="text-2xl font-semibold">{healthGrouped[h]?.length || 0}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {health.map(item => {
              const hc = HEALTH_COLORS[item.health] || 'text-muted-foreground';
              return (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-all"
                  onClick={() => navigate(`/assets/${item.id}`)}
                >
                  <CheckCircle2 className={cn('h-4 w-4 shrink-0', hc)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.type_name}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono">{item.health}</Badge>
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Activity ─── */}
        {/* Promotions review queue */}
        <TabsContent value="promotions" className="pt-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Promotion Requests</h3>
            {promotions.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No promotion requests yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {promotions.map((p: any) => (
                  <Card key={p.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium hover:text-primary transition-colors"
                            onClick={() => navigate(`/assets/${p.asset_id}`)}
                          >
                            {p.asset_name}
                          </button>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] font-mono">{p.from_maturity}</Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge className="text-[9px] font-mono bg-blue-600 text-white">{p.to_maturity}</Badge>
                            <span className="text-[11px] text-muted-foreground ml-2">by {p.requested_by?.split('@')[0]}</span>
                          </div>
                          {p.request_notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.request_notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs h-7"
                                onClick={async () => {
                                  await apiPut<any>(`/api/dpz/promotions/${p.id}/review`, {
                                    decision: 'approved', review_notes: '',
                                  });
                                  const resp = await apiGet<any>('/api/dpz/promotions');
                                  if (!resp.error && resp.data?.items) setPromotions(resp.data.items);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 text-destructive"
                                onClick={async () => {
                                  await apiPut<any>(`/api/dpz/promotions/${p.id}/review`, {
                                    decision: 'rejected', review_notes: '',
                                  });
                                  const resp = await apiGet<any>('/api/dpz/promotions');
                                  if (!resp.error && resp.data?.items) setPromotions(resp.data.items);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] font-mono',
                                p.status === 'approved' ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500'
                              )}
                            >
                              {p.status === 'approved' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              {p.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain Events */}
            <div>
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Event Log</h3>
              {activity.length > 0 ? (
                <div className="space-y-2">
                  {activity.map((evt: any) => {
                    const label = (evt.event_type || '').replace(/\./g, ' ').replace(/^\w/, (c: string) => c.toUpperCase());
                    const actor = evt.payload?.actor?.split('@')[0] || 'system';
                    const detail = evt.payload?.asset_name || evt.payload?.wish_title || evt.payload?.title || '';
                    const colors: Record<string, string> = {
                      'asset.created': 'bg-blue-500', 'asset.promoted': 'bg-green-500',
                      'wish.created': 'bg-purple-500', 'wish.matched': 'bg-emerald-500',
                      'promotion.requested': 'bg-amber-500', 'promotion.approved': 'bg-green-500',
                      'promotion.rejected': 'bg-red-500',
                    };
                    return (
                      <div key={evt.id} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', colors[evt.event_type] || 'bg-gray-400')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium">{label}</p>
                          {detail && <p className="text-[11px] text-muted-foreground truncate">{detail}</p>}
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{actor}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {evt.emitted_at ? <RelativeDate date={evt.emitted_at} /> : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-[12px] text-muted-foreground">No events recorded yet.</p>
                </div>
              )}
            </div>

            {/* Recently Updated Assets */}
            <div>
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Recently Updated</h3>
              {adoption ? (
                <div className="space-y-2">
                  {adoption.recent_activity.map(a => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-all"
                      onClick={() => navigate(`/assets/${a.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{a.type_name} · {a.maturity}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        <RelativeDate date={a.updated_at} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
