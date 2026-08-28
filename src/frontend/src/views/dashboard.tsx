import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Activity, ShieldCheck, DollarSign, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

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

interface HealthItem {
  id: string; name: string; type_name: string; health: string; maturity: string;
}

interface EvidenceItem {
  id: string; name: string; type_name: string; maturity: string; health: string;
  total_signals: number; signal_types: number; last_signal_at: string | null; evidence_score: number;
}

interface HealthEvidenceData {
  freshness: { bucket: string; count: number }[];
  quality: { bucket: string; count: number }[];
  cost: { bucket: string; count: number }[];
}

// ─── Constants ───
const MATURITY_COLORS: Record<string, string> = {
  production: 'bg-green-600', production_candidate: 'bg-purple-600',
  validating: 'bg-blue-600', poc: 'bg-yellow-600',
  triaged: 'bg-slate-600', idea: 'bg-slate-400', unset: 'bg-gray-300',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-green-500', degraded: 'bg-yellow-500',
  unknown: 'bg-gray-400', unsupported: 'bg-red-400', retired: 'bg-gray-600',
};

const HEALTH_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  healthy: 'default', degraded: 'destructive', unknown: 'outline',
  unsupported: 'destructive', retired: 'secondary',
};

export default function DashboardView() {
  const navigate = useNavigate();
  const { get: apiGet } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [adoption, setAdoption] = useState<AdoptionData | null>(null);
  const [health, setHealth] = useState<HealthItem[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [healthEvidence, setHealthEvidence] = useState<HealthEvidenceData | null>(null);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Dashboard');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const [pResp, aResp, hResp, eResp, heResp] = await Promise.all([
        apiGet<PortfolioData>('/api/dpz/portfolio'),
        apiGet<AdoptionData>('/api/dpz/adoption'),
        apiGet<any>('/api/dpz/health'),
        apiGet<any>('/api/dpz/evidence'),
        apiGet<HealthEvidenceData>('/api/dpz/health-evidence'),
      ]);
      if (!pResp.error && pResp.data) setPortfolio(pResp.data);
      if (!aResp.error && aResp.data) setAdoption(aResp.data);
      if (!hResp.error && hResp.data) setHealth(hResp.data.items ?? []);
      if (!eResp.error && eResp.data) setEvidence(eResp.data.items ?? []);
      if (!heResp.error && heResp.data) setHealthEvidence(heResp.data);
    })();
  }, [apiGet]);

  // Group health items
  const healthGrouped = health.reduce<Record<string, HealthItem[]>>((acc, item) => {
    if (!acc[item.health]) acc[item.health] = [];
    acc[item.health].push(item);
    return acc;
  }, {});
  const healthOrder = ['healthy', 'degraded', 'unknown', 'unsupported', 'retired'];
  const orderedHealthGroups = healthOrder.filter(h => healthGrouped[h]?.length > 0);

  return (
    <div className="py-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />Observe</p>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {portfolio ? `${portfolio.total} assets` : 'Loading...'} — portfolio health, adoption, and quality at a glance
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Health
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Evidence
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="pt-4">
          {!portfolio ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">By Maturity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.by_maturity.map(m => (
                      <div key={m.stage} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${MATURITY_COLORS[m.stage] || 'bg-gray-400'}`} />
                          <span className="text-sm">{m.stage}</span>
                        </div>
                        <Badge variant="secondary">{m.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">By Type</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.by_type.map(t => (
                      <div key={t.type} className="flex items-center justify-between">
                        <span className="text-sm">{t.type}</span>
                        <Badge variant="secondary">{t.count}</Badge>
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
                        <Badge variant="secondary">{s.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Operational Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.by_health.map(h => (
                      <div key={h.health} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${HEALTH_COLORS[h.health] || 'bg-gray-400'}`} />
                          <span className="text-sm">{h.health}</span>
                        </div>
                        <Badge variant="secondary">{h.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── Activity Tab ─── */}
        <TabsContent value="activity" className="pt-4">
          {!adoption ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="space-y-4">
              {/* Scope Distribution */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Scope Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-3 flex-wrap">
                    {adoption.scope_distribution.map(s => {
                      const total = adoption.scope_distribution.reduce((sum, d) => sum + d.count, 0);
                      return (
                        <div key={s.scope} className="text-center px-4 py-2 rounded-lg bg-muted">
                          <div className="text-2xl font-bold">{s.count}</div>
                          <div className="text-xs text-muted-foreground">{s.scope}</div>
                          <div className="text-xs text-muted-foreground">{total > 0 ? Math.round(s.count / total * 100) : 0}%</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {adoption.recent_activity.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(`/assets/${a.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{a.name}</span>
                          <Badge variant="outline" className="text-xs">{a.type_name}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.maturity && <Badge className="text-xs bg-blue-600 text-white">{a.maturity}</Badge>}
                          {a.updated_at && <span className="text-xs text-muted-foreground"><RelativeDate date={a.updated_at} /></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── Health Tab ─── */}
        <TabsContent value="health" className="pt-4">
          {health.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Operational health grouped by support posture and lifecycle stage.</p>
              {orderedHealthGroups.map(h => (
                <Card key={h}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
                       <Badge variant={HEALTH_VARIANT[h] || 'outline'}>{h}</Badge>
                       <span className="text-[10px] text-muted-foreground font-normal">
                        {healthGrouped[h].length} asset{healthGrouped[h].length !== 1 ? 's' : ''}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {healthGrouped[h].map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => navigate(`/assets/${item.id}`)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            <Badge variant="outline" className="text-xs">{item.type_name}</Badge>
                          </div>
                          {item.maturity && <Badge className="text-xs bg-blue-600 text-white">{item.maturity}</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Evidence Tab ─── */}
        <TabsContent value="evidence" className="pt-4">
          {!healthEvidence ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-primary" /> Evidence Freshness</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {healthEvidence.freshness.map(f => (
                        <div key={f.bucket} className="flex items-center justify-between">
                          <span className="text-sm">{f.bucket}</span>
                          <Badge variant="secondary">{f.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Quality Coverage</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {healthEvidence.quality.map(q => (
                        <div key={q.bucket} className="flex items-center justify-between">
                          <span className="text-sm">{q.bucket}</span>
                          <Badge variant="secondary">{q.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-primary" /> Cost Visibility</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {healthEvidence.cost.map(c => (
                        <div key={c.bucket} className="flex items-center justify-between">
                          <span className="text-sm">{c.bucket}</span>
                          <Badge variant="secondary">{c.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Evidence Leaderboard</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {evidence.slice(0, 12).map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(`/assets/${item.id}`)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          <Badge variant="outline" className="text-xs">{item.type_name}</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          <Badge variant={item.evidence_score >= 4 ? 'default' : item.evidence_score >= 2 ? 'secondary' : 'outline'} className="text-xs">{item.evidence_score}/5</Badge>
                          <span className="text-xs text-muted-foreground">{item.signal_types} types</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
