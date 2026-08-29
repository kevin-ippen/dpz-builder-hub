import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb, Plus, ThumbsUp, ArrowRight, Sparkles, CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface WishlistItem {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  status: string;
  priority: string;
  category?: string;
  upvotes: number;
  signals_count: number;
  linked_asset_id?: string;
  created_at?: string;
  capabilities?: { name: string; slug: string; icon: string }[];
}

const PRIORITY_BADGE: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  medium: { label: 'Med', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  low: { label: 'Low', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
};

const STATUS_BADGE: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: 'Open', icon: Sparkles, color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'in-review': { label: 'In Review', icon: Clock, color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  matched: { label: 'Matched', icon: CheckCircle2, color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  closed: { label: 'Closed', icon: CheckCircle2, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const CATEGORY_FILTERS = [
  { id: null, label: 'All' },
  { id: 'application', label: 'AI & Apps' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'data', label: 'Data' },
  { id: 'integration', label: 'Integration' },
];

export default function WishlistView() {
  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const navigate = useNavigate();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('application');

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Wishlist');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet<any>('/api/dpz/wishlist');
      if (!resp.error) setItems(resp.data?.items ?? []);
    } catch {} finally { setLoading(false); }
  }, [apiGet]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const resp = await apiPost<any>('/api/dpz/wishlist', { title, description, priority, category });
    if (!resp.error) {
      toast({ title: 'Wish submitted!', description: `"${title}" added to the wishlist.` });
      setTitle(''); setDescription(''); setPriority('medium'); setCategory('application');
      setDialogOpen(false);
      fetchWishlist();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const handleUpvote = async (id: string) => {
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/upvote`, {});
    if (!resp.error) {
      toast({ title: '\uD83D\uDC4D Upvoted!' });
      fetchWishlist();
    }
  };

  const filtered = categoryFilter
    ? items.filter(i => i.category === categoryFilter)
    : items;

  // Group: open first (sorted by upvotes), then in-review, then matched/closed
  const openItems = filtered.filter(i => i.status === 'open').sort((a, b) => b.upvotes - a.upvotes);
  const reviewItems = filtered.filter(i => i.status === 'in-review');
  const matchedItems = filtered.filter(i => i.status === 'matched' || i.status === 'closed');

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />Wishlist
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">What teams need next</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} wish{items.length !== 1 ? 'es' : ''} — upvote to signal demand
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Make a Wish</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>What do you wish existed?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Real-time delivery ETA API"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Why do you need it?</Label>
                <Textarea
                  placeholder="What problem does it solve? Who benefits?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application">AI & Apps</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={!title.trim()}>
                Submit Wish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.id || 'all'}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wide transition-colors border',
              categoryFilter === c.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted border-transparent'
            )}
            onClick={() => setCategoryFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1,2,3,4].map(i => <Card key={i} className="h-24 animate-pulse bg-muted/50" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <Lightbulb className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h3 className="text-lg font-semibold">The wishlist is empty</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              What do you wish existed? Submit the first wish and rally the team.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="mt-2">Make a wish</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Open wishes */}
          {openItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Open — {openItems.length}
              </h2>
              <div className="grid gap-2">
                {openItems.map((item, i) => (
                  <WishCard key={item.id} item={item} rank={i + 1} onUpvote={handleUpvote} />
                ))}
              </div>
            </section>
          )}

          {/* In review */}
          {reviewItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-purple-500" /> In Review — {reviewItems.length}
              </h2>
              <div className="grid gap-2">
                {reviewItems.map((item) => (
                  <WishCard key={item.id} item={item} onUpvote={handleUpvote} />
                ))}
              </div>
            </section>
          )}

          {/* Matched */}
          {matchedItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Matched — {matchedItems.length}
              </h2>
              <div className="grid gap-2">
                {matchedItems.map((item) => (
                  <WishCard key={item.id} item={item} onUpvote={handleUpvote} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function WishCard({ item, rank, onUpvote }: { item: WishlistItem; rank?: number; onUpvote: (id: string) => void }) {
  const navigate = useNavigate();
  const priBadge = PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.medium;
  const statusBadge = STATUS_BADGE[item.status] || STATUS_BADGE.open;
  const StatusIcon = statusBadge.icon;

  return (
    <Card
      className="group hover:shadow-card-hover hover:border-primary/20 transition-all cursor-pointer"
      onClick={() => navigate(`/wishlist/${item.id}`)}
    >
      <CardContent className="py-4 px-5 flex items-start gap-4">
        {/* Upvote column */}
        <button
          onClick={(e) => { e.stopPropagation(); onUpvote(item.id); }}
          className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 hover:text-primary transition-colors"
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="text-sm font-bold">{item.upvotes}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {rank && rank <= 3 && (
              <span className={cn(
                'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full',
                rank === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                #{rank}
              </span>
            )}
            <span className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
              {item.title}
            </span>
          </div>
          {item.description && (
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-[9px] font-mono uppercase border-0 px-1.5 py-0', priBadge.color)}>
              {priBadge.label}
            </Badge>
            <Badge className={cn('text-[9px] font-mono uppercase border-0 px-1.5 py-0 gap-1', statusBadge.color)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {statusBadge.label}
            </Badge>
            {item.category && (
              <span className="text-[10px] font-mono text-muted-foreground">{item.category}</span>
            )}
            {item.capabilities && item.capabilities.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {item.capabilities.slice(0, 3).map(c => c.name).join(' · ')}
                {item.capabilities.length > 3 && ` +${item.capabilities.length - 3}`}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {item.created_by}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
