import { useState, useEffect, useCallback } from 'react';
import { Blocks, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface Capability {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  platform_feature: string;
  icon: string;
  sort_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  data: 'Data',
  ai: 'AI & ML',
  platform: 'Platform',
};

export default function SettingsCapabilitiesView() {
  const { get: apiGet, post: apiPost, put: apiPut } = useApi();
  const { toast } = useToast();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCap, setEditingCap] = useState<Capability | null>(null);

  // Form
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('platform');
  const [platformFeature, setPlatformFeature] = useState('');

  useEffect(() => {
    setStaticSegments([{ label: 'Settings', path: '/settings' }]);
    setDynamicTitle('Capabilities');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchCapabilities = useCallback(async () => {
    setLoading(true);
    const resp = await apiGet<any>('/api/dpz/capabilities');
    if (!resp.error && resp.data?.items) setCapabilities(resp.data.items);
    setLoading(false);
  }, [apiGet]);

  useEffect(() => { fetchCapabilities(); }, [fetchCapabilities]);

  const openEdit = (cap: Capability) => {
    setEditingCap(cap);
    setSlug(cap.slug);
    setName(cap.name);
    setDescription(cap.description || '');
    setCategory(cap.category);
    setPlatformFeature(cap.platform_feature || '');
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingCap(null);
    setSlug(''); setName(''); setDescription(''); setCategory('platform'); setPlatformFeature('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!slug.trim() || !name.trim()) {
      toast({ variant: 'destructive', title: 'Required', description: 'Slug and Name are required.' });
      return;
    }
    const payload = { slug, name, description, category, platform_feature: platformFeature };
    let resp;
    if (editingCap) {
      resp = await apiPut<any>(`/api/dpz/capabilities/${editingCap.id}`, payload);
    } else {
      resp = await apiPost<any>('/api/dpz/capabilities', payload);
    }
    if (!resp.error) {
      toast({ title: editingCap ? 'Updated' : 'Created', description: `Capability "${name}" saved.` });
      setDialogOpen(false);
      fetchCapabilities();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const grouped = capabilities.reduce<Record<string, Capability[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />Catalog
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Capability Taxonomy</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {capabilities.length} capabilities — tagged on assets and wishes to map platform coverage
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Add Capability
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCap ? 'Edit Capability' : 'New Capability'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Slug *</Label>
                  <Input placeholder="e.g. batch-etl" value={slug} onChange={e => setSlug(e.target.value)} disabled={!!editingCap} />
                </div>
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input placeholder="e.g. Batch Data Processing" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea placeholder="What does this capability cover?" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="ai">AI & ML</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Platform Feature</Label>
                  <Input placeholder="e.g. Lakeflow Jobs + SDP" value={platformFeature} onChange={e => setPlatformFeature(e.target.value)} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={!slug.trim() || !name.trim()}>
                {editingCap ? 'Save Changes' : 'Create Capability'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {['data', 'ai', 'platform'].map(cat => {
            const items = grouped[cat] || [];
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  {CATEGORY_LABELS[cat] || cat} ({items.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.sort((a, b) => a.sort_order - b.sort_order).map(cap => (
                    <div key={cap.id} className="flex items-start gap-3 rounded-lg border p-3 hover:border-primary/20 transition-colors group">
                      <Blocks className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cap.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">{cap.slug}</Badge>
                        </div>
                        {cap.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{cap.description}</p>}
                        {cap.platform_feature && (
                          <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{cap.platform_feature}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(cap)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}