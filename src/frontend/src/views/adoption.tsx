import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface AdoptionData {
  recent_activity: { id: string; name: string; type_name: string; maturity: string; scope: string; updated_at: string }[];
  scope_distribution: { scope: string; count: number }[];
}

export default function AdoptionView() {
  const navigate = useNavigate();
  const { get: apiGet } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);
  const [data, setData] = useState<AdoptionData | null>(null);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Adoption');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<AdoptionData>('/api/dpz/adoption');
      if (!resp.error && resp.data) setData(resp.data);
    })();
  }, [apiGet]);

  if (!data) return <p className="text-center text-muted-foreground py-12">Loading...</p>;

  const totalScoped = data.scope_distribution.reduce((s, d) => s + d.count, 0);

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />Observe</p>
          <h1 className="text-2xl font-bold tracking-tight">Adoption</h1>
          <p className="text-sm text-muted-foreground">Usage signals and engagement patterns</p>
        </div>
      </div>

      {/* Scope Distribution */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Publication Scope Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            {data.scope_distribution.map(s => (
              <div key={s.scope} className="text-center px-4 py-2 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs text-muted-foreground">{s.scope}</div>
                <div className="text-xs text-muted-foreground">{totalScoped > 0 ? Math.round(s.count / totalScoped * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recent_activity.map(a => (
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
                  <span className="text-xs text-muted-foreground"><RelativeDate date={a.updated_at} /></span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
