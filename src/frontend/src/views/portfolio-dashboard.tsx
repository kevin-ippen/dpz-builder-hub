import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface PortfolioData {
  total: number;
  by_maturity: { stage: string; count: number }[];
  by_type: { type: string; count: number }[];
  by_scope: { scope: string; count: number }[];
  by_health: { health: string; count: number }[];
}

const MATURITY_COLORS: Record<string, string> = {
  production: 'bg-green-600', production_candidate: 'bg-purple-600',
  validating: 'bg-blue-600', poc: 'bg-yellow-600',
  triaged: 'bg-slate-600', idea: 'bg-slate-400', unset: 'bg-gray-300',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-green-500', degraded: 'bg-yellow-500',
  unknown: 'bg-gray-400', unsupported: 'bg-red-400', retired: 'bg-gray-600',
};

export default function PortfolioDashboard() {
  const { get: apiGet } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);
  const [data, setData] = useState<PortfolioData | null>(null);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Portfolio');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<PortfolioData>('/api/dpz/portfolio');
      if (!resp.error && resp.data) setData(resp.data);
    })();
  }, [apiGet]);

  if (!data) return <p className="text-center text-muted-foreground py-12">Loading portfolio...</p>;

  return (
    <div className="py-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">{data.total} assets across all maturity stages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Maturity */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">By Maturity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.by_maturity.map(m => (
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

        {/* By Type */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">By Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.by_type.map(t => (
                <div key={t.type} className="flex items-center justify-between">
                  <span className="text-sm">{t.type}</span>
                  <Badge variant="secondary">{t.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Scope */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">By Publication Scope</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.by_scope.map(s => (
                <div key={s.scope} className="flex items-center justify-between">
                  <span className="text-sm">{s.scope}</span>
                  <Badge variant="secondary">{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Health */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Operational Health</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.by_health.map(h => (
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
    </div>
  );
}
