import { useState, useEffect, useCallback } from 'react';
import { Target, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { RelativeDate } from '@/components/common/relative-date';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface Demand {
  id: string;
  title: string;
  description?: string;
  requester: string;
  status: string;
  priority: string;
  created_at?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function DemandsView() {
  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Demands');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet<any>('/api/dpz/demands');
      if (!resp.error) setDemands(resp.data?.items ?? []);
    } catch {} finally { setLoading(false); }
  }, [apiGet]);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const resp = await apiPost<any>('/api/dpz/demands', { title, description, priority });
    if (!resp.error) {
      toast({ title: 'Demand submitted', description: `"${title}" registered.` });
      setTitle(''); setDescription(''); setPriority('medium');
      setDialogOpen(false);
      fetchDemands();
    }
  };

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />Demands</p>
            <h1 className="text-2xl font-bold tracking-tight">What teams need built</h1>
            <p className="text-sm text-muted-foreground">"I need X" — signals that get matched to existing assets</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Demand</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit a Demand</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>What do you need?</Label>
                <Input placeholder="e.g. A churn prediction model for breakfast daypart" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Context</Label>
                <Textarea placeholder="Why do you need it? What problem does it solve?" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={!title.trim()}>Submit Demand</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-center text-muted-foreground py-8">Loading...</p>}
      {!loading && demands.length === 0 && (
        <Card className="text-center py-12"><CardContent><p className="text-muted-foreground">No demands yet. Submit the first one.</p></CardContent></Card>
      )}
      {demands.map(d => (
        <Card key={d.id}>
          <CardContent className="py-4 px-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.title}</span>
                  <Badge className={`text-xs ${PRIORITY_COLORS[d.priority] || ''}`}>{d.priority}</Badge>
                  <Badge variant={d.status === 'open' ? 'default' : 'secondary'} className="text-xs">{d.status}</Badge>
                </div>
                {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                <p className="text-xs text-muted-foreground">by {d.requester}{d.created_at && <> — <RelativeDate date={d.created_at} /></>}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
