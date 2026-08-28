import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { RelativeDate } from '@/components/common/relative-date';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface PortfolioAsset {
  id: string;
  name: string;
  description?: string;
  asset_type_name?: string;
  status: string;
  maturity?: string;
  publication_scope?: string;
  operational_health?: string;
  updated_at?: string;
}

const MATURITY_COLORS: Record<string, string> = {
  idea: 'bg-slate-500', triaged: 'bg-slate-600', poc: 'bg-yellow-600',
  validating: 'bg-blue-600', production_candidate: 'bg-purple-600', production: 'bg-green-600',
};

export default function MyPortfolioView() {
  const navigate = useNavigate();
  const { get: apiGet } = useApi();
  const { toast } = useToast();
  const setStaticSegments = useBreadcrumbStore((state) => state.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((state) => state.setDynamicTitle);

  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('My Portfolio');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchMyAssets = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet<any>('/api/assets?created_by=me&limit=100');
      if (resp.error) throw new Error(resp.error);
      setAssets(resp.data?.items ?? []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [apiGet, toast]);

  useEffect(() => {
    fetchMyAssets();
  }, [fetchMyAssets]);

  // Group by maturity stage
  const grouped = assets.reduce<Record<string, PortfolioAsset[]>>((acc, a) => {
    const stage = (a as any).maturity || 'unset';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(a);
    return acc;
  }, {});

  const stageOrder = ['production', 'production_candidate', 'validating', 'poc', 'triaged', 'idea', 'unset'];
  const orderedStages = stageOrder.filter(s => grouped[s]?.length > 0);

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />My Portfolio</p>
            <h1 className="text-2xl font-bold tracking-tight">Your assets & contributions</h1>
            <p className="text-sm text-muted-foreground">{assets.length} asset{assets.length !== 1 ? 's' : ''} you\'ve registered</p>
          </div>
        </div>
        <Button onClick={() => navigate('/submit')} size="sm">
          + Submit New
        </Button>
      </div>

      {loading && <p className="text-muted-foreground text-center py-12">Loading...</p>}

      {!loading && assets.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">You haven't submitted any assets yet.</p>
            <Button onClick={() => navigate('/submit')}>Submit your first idea</Button>
          </CardContent>
        </Card>
      )}

      {/* Grouped by maturity */}
      {orderedStages.map(stage => (
        <div key={stage} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={`text-xs text-white ${MATURITY_COLORS[stage] || 'bg-gray-500'}`}>
              {stage === 'unset' ? 'no maturity set' : stage}
            </Badge>
            <span className="text-xs text-muted-foreground">{grouped[stage].length}</span>
          </div>
          <div className="grid gap-2">
            {grouped[stage].map(asset => (
              <Card
                key={asset.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/assets/${asset.id}`)}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{asset.name}</span>
                      {asset.asset_type_name && (
                        <Badge variant="outline" className="text-xs shrink-0">{asset.asset_type_name}</Badge>
                      )}
                    </div>
                    {asset.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{asset.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {(asset as any).publication_scope && (asset as any).publication_scope !== 'draft' && (
                      <Badge variant="secondary" className="text-xs">{(asset as any).publication_scope}</Badge>
                    )}
                    {asset.updated_at && (
                      <span className="text-xs text-muted-foreground">
                        <RelativeDate date={asset.updated_at} />
                      </span>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
