import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface HealthItem {
  id: string; name: string; type_name: string; health: string; maturity: string;
}

const HEALTH_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  healthy: 'default', degraded: 'destructive', unknown: 'outline',
  unsupported: 'destructive', retired: 'secondary',
};

export default function CostQualityView() {
  const navigate = useNavigate();
  const { get: apiGet } = useApi();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);
  const [items, setItems] = useState<HealthItem[]>([]);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Cost & Quality');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<any>('/api/dpz/health');
      if (!resp.error && resp.data) setItems(resp.data.items ?? []);
    })();
  }, [apiGet]);

  // Group by health status
  const grouped = items.reduce<Record<string, HealthItem[]>>((acc, item) => {
    if (!acc[item.health]) acc[item.health] = [];
    acc[item.health].push(item);
    return acc;
  }, {});
  const order = ['healthy', 'degraded', 'unknown', 'unsupported', 'retired'];
  const orderedGroups = order.filter(h => grouped[h]?.length > 0);

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />Observe</p>
          <h1 className="text-2xl font-bold tracking-tight">Cost & Quality</h1>
          <p className="text-sm text-muted-foreground">Operational health overview — Gateway costs & MLflow evals coming in Sprint E</p>
        </div>
      </div>

      {orderedGroups.map(health => (
        <Card key={health}>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
               <Badge variant={HEALTH_VARIANT[health] || 'outline'}>{health}</Badge>
               <span className="text-[10px] text-muted-foreground font-normal">{grouped[health].length} asset{grouped[health].length !== 1 ? 's' : ''}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {grouped[health].map(item => (
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

      {items.length === 0 && <p className="text-center text-muted-foreground py-8">Loading...</p>}
    </div>
  );
}
