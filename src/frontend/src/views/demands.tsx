import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb, Plus, ThumbsUp, ArrowRight, Sparkles, CheckCircle2, Clock,
  ChevronRight, AlertTriangle, BarChart3, Users, TrendingUp, X,
  Rocket, Ban, Undo2, ArrowUpRight, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  description?: string | null;
  created_by: string;
  status: string;
  priority?: string;
  category?: string | null;
  upvotes: number;
  signals_count: number;
  linked_asset_id?: string | null;
  linked_asset_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  capabilities?: { name: string; slug: string; icon?: string }[];
  source?: string | null;
  workaround?: string | null;
  frequency?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  decline_reason?: string | null;
  declined_by?: string | null;
}

interface GapItem {
  slug: string; name: string; category: string;
  demand_count: number; asset_count: number; gap_score: number;
}

const FREQUENCY_OPTIONS = [
  { id: 'daily', label: 'A few times a day' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'period', label: 'Every period close' },
  { id: 'yearly', label: 'A few times a year' },
];

const SORT_OPTIONS = [
  { id: 'ready', label: 'Ready to build' },
  { id: 'backed', label: 'Most backed' },
  { id: 'newest', label: 'Newest' },
  { id: 'waiting', label: 'Waiting longest' },
  { id: 'no-supply', label: 'No supply at all' },
];

const REVIEW_THRESHOLD = 15;

/* ── Deterministic seeded-random helpers (same pattern as lab.tsx) ── */
function seeded(id: string, salt: number, min: number, max: number) {
  const text = `${id}:${salt}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.round(min + (Math.abs(hash % 1000) / 1000) * (max - min));
}

function daysSince(dateStr?: string | null) {
  if (!dateStr) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

function ownerShort(email?: string | null) {
  return (email || 'unknown').split('@')[0];
}

function initials(name: string) {
  return name.split(/[._ -]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '??';
}

function backerFaces(item: WishlistItem) {
  const owner = ownerShort(item.created_by);
  const count = Math.max(1, item.upvotes);
  const names = [owner];
  const pool = ['DO', 'SP', 'JW', 'MT', 'RT', 'KW', 'AL', 'NB'];
  for (let i = 0; names.length < Math.min(count, 5); i++) {
    const face = pool[seeded(item.id, 50 + i, 0, pool.length - 1)];
    if (!names.includes(face)) names.push(face);
    else names.push(pool[(i + 3) % pool.length]);
  }
  return { faces: names.slice(0, 5), total: count, teams: Math.max(1, Math.ceil(count / 3)) };
}

function weeklyMotion(item: WishlistItem) {
  return seeded(item.id, 71, 0, Math.max(1, Math.round(item.upvotes * 0.4)));
}

function readyScore(item: WishlistItem, gaps: GapItem[]) {
  const days = daysSince(item.created_at);
  const backers = item.upvotes;
  const teams = backerFaces(item).teams;
  const capGaps = (item.capabilities || []).filter((c) => gaps.some((g) => g.slug === c.slug && g.gap_score > 0)).length;
  return backers * teams * Math.log2(days + 2) + capGaps * 10;
}

/* ────────────────────────── WishRow ────────────────────────── */
function WishRow({ item, gaps, onBack, onClaim }: {
  item: WishlistItem;
  gaps: GapItem[];
  onBack: (id: string) => void;
  onClaim: (item: WishlistItem) => void;
}) {
  const navigate = useNavigate();
  const days = daysSince(item.created_at);
  const bf = backerFaces(item);
  const motion = weeklyMotion(item);
  const stale = daysSince(item.updated_at || item.created_at) > 21;
  const threshold = Math.max(0, REVIEW_THRESHOLD - item.upvotes);
  const isOpen = item.status === 'open';
  const isClaimed = item.status === 'in-review' || item.status === 'claimed';
  const isShipped = item.status === 'matched' || item.status === 'shipped';
  const isDeclined = item.status === 'declined' || item.status === 'closed';

  const capGapSlugs = new Set(gaps.filter((g) => g.gap_score > 0).map((g) => g.slug));

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 grid gap-4 items-start transition-all',
      'grid-cols-[64px_minmax(0,1fr)_172px]',
      isClaimed && 'border-blue-200 dark:border-blue-800',
      isShipped && 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
      isDeclined && 'bg-muted/30 border-dashed opacity-70',
    )}>
      {/* Backer button */}
      <div className="text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onBack(item.id); }}
          className={cn(
            'w-14 rounded-xl border px-0 py-2 transition-colors block mx-auto',
            item.upvotes >= REVIEW_THRESHOLD
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-card border-border hover:border-primary hover:text-primary',
          )}
        >
          <span className="text-lg font-semibold leading-none block">{item.upvotes}</span>
          <span className="text-[10px] font-mono tracking-wide text-muted-foreground">BACKED</span>
        </button>
        {isOpen && threshold > 0 && (
          <span className="text-[10.5px] font-mono text-muted-foreground/60 mt-1.5 block leading-tight">
            {threshold} more<br />to trigger review
          </span>
        )}
        {isClaimed && (
          <span className="text-[10.5px] font-mono text-muted-foreground/60 mt-1.5 block leading-tight">
            threshold met
          </span>
        )}
        {isShipped && (
          <span className="text-[10.5px] font-mono text-emerald-600 mt-1.5 block leading-tight">
            shipped<br />in {seeded(item.id, 88, 20, 90)}d
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 cursor-pointer" onClick={() => navigate(`/wishlist/${item.id}`)}>
        <h3 className="text-[15px] font-semibold leading-tight flex items-center gap-2 flex-wrap">
          {item.title}
          {isOpen && (
            <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
              open · {days}d
            </span>
          )}
          {isClaimed && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-mono text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              being built
            </span>
          )}
          {isShipped && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              shipped
            </span>
          )}
          {isDeclined && (
            <span className="rounded-full border bg-muted px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
              not building this
            </span>
          )}
        </h3>

        {item.description && (
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
        )}

        {item.workaround && isOpen && (
          <p className="mt-2 text-[12.5px] text-muted-foreground border-l-2 border-border pl-2.5">
            <b className="text-foreground/80 font-medium">Today instead:</b> {item.workaround}
          </p>
        )}

        {isDeclined && item.decline_reason && (
          <p className="mt-2 text-[12.5px] text-muted-foreground border-l-2 border-border pl-2.5">
            <b className="text-foreground/80 font-medium">Reason given:</b> {item.decline_reason}
          </p>
        )}

        {/* Backer faces + motion */}
        {(isOpen || isClaimed) && (
          <div className="flex items-center gap-3 flex-wrap mt-3 text-[12px] text-muted-foreground">
            <div className="flex -space-x-1.5">
              {bf.faces.map((f, i) => (
                <span key={i} className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-card bg-muted text-[9.5px] font-semibold text-muted-foreground">
                  {initials(f)}
                </span>
              ))}
              {bf.total > 5 && (
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-card bg-foreground text-[9px] text-background font-semibold">
                  +{bf.total - 5}
                </span>
              )}
            </div>
            <span>{bf.total} backers across <b className="text-foreground font-medium">{bf.teams} teams</b></span>
            {motion > 0 && !stale && <span className="font-mono text-[11.5px] text-emerald-600">+{motion} this week</span>}
            {stale && <span className="font-mono text-[11.5px] text-amber-600">no new backers in {Math.round(daysSince(item.updated_at || item.created_at) / 7)} weeks</span>}
          </div>
        )}

        {isDeclined && item.declined_by && (
          <div className="mt-2 text-[12px] text-muted-foreground">
            Decided by <b className="font-medium text-foreground/80">{ownerShort(item.declined_by)}</b> · {item.upvotes} backers notified with this reason
          </div>
        )}

        {/* Capabilities */}
        {item.capabilities && item.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.capabilities.map((cap) => (
              <span
                key={cap.slug}
                className={cn(
                  'rounded-md border px-2 py-0.5 font-mono text-[10.5px]',
                  capGapSlugs.has(cap.slug)
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-border text-muted-foreground',
                )}
              >
                {cap.name}{capGapSlugs.has(cap.slug) && ' · no supply'}
              </span>
            ))}
          </div>
        )}

        {/* Claimed link row */}
        {isClaimed && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t text-[12.5px]">
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-[11px] dark:bg-blue-900 dark:text-blue-300">→</span>
            <span className="text-muted-foreground">
              Claimed by <b className="font-medium text-foreground/80">{ownerShort(item.claimed_by || item.created_by)}</b>
              {' '}{daysSince(item.claimed_at || item.updated_at)}d ago
              {item.linked_asset_name && (
                <> · now <a className="text-blue-600 hover:underline dark:text-blue-400" onClick={(e) => { e.stopPropagation(); if (item.linked_asset_id) navigate(`/assets/${item.linked_asset_id}`); }}>{item.linked_asset_name}</a>, at prototype stage</>
              )}
            </span>
          </div>
        )}

        {/* Shipped link row */}
        {isShipped && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t text-[12.5px]">
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-[11px] dark:bg-emerald-900 dark:text-emerald-300">✓</span>
            <span className="text-muted-foreground">
              Shipped as{' '}
              {item.linked_asset_id ? (
                <a className="text-blue-600 hover:underline dark:text-blue-400" onClick={(e) => { e.stopPropagation(); navigate(`/assets/${item.linked_asset_id}`); }}>{item.linked_asset_name || item.title}</a>
              ) : (
                <b className="font-medium text-foreground/80">{item.linked_asset_name || item.title}</b>
              )}
              {' '}· {seeded(item.id, 99, 8, 60)} adopters
            </span>
          </div>
        )}
      </div>

      {/* Side actions */}
      <div className="grid gap-2">
        {isOpen && (
          <>
            <Button size="sm" className="w-full justify-center text-[11px] h-8 rounded-lg" onClick={() => onClaim(item)}>Claim this wish</Button>
            <Button size="sm" variant="outline" className="w-full justify-center text-[11px] h-8 rounded-lg" onClick={(e) => { e.stopPropagation(); onBack(item.id); }}>Back it</Button>
            <p className="text-[11.5px] text-muted-foreground leading-snug">Claiming opens it as an idea in the Lab with these {item.upvotes} backers carried over.</p>
          </>
        )}
        {isClaimed && (
          <>
            <Button size="sm" variant="outline" className="w-full justify-center text-[11px] h-8 rounded-lg">Follow progress</Button>
            <Button size="sm" variant="outline" className="w-full justify-center text-[11px] h-8 rounded-lg">Join as maintainer</Button>
            <p className="text-[11.5px] text-muted-foreground leading-snug">Backers get notified at each stage change.</p>
          </>
        )}
        {isShipped && (
          <>
            <Button size="sm" variant="outline" className="w-full justify-center text-[11px] h-8 rounded-lg" onClick={() => item.linked_asset_id && navigate(`/assets/${item.linked_asset_id}`)}>Open the asset</Button>
            <p className="text-[11.5px] text-muted-foreground leading-snug">All {item.upvotes} backers were notified at launch.</p>
          </>
        )}
        {isDeclined && (
          <>
            <Button size="sm" variant="outline" className="w-full justify-center text-[11px] h-8 rounded-lg gap-1"><Undo2 className="h-3 w-3" /> Reopen with new info</Button>
            <p className="text-[11.5px] text-muted-foreground leading-snug">Reopening asks for what changed since the decision.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── GapCard ────────────────────────── */
function GapCard({ gap, selected, onClick }: { gap: GapItem; selected: boolean; onClick: () => void }) {
  const isGap = gap.gap_score > 0;
  const total = gap.demand_count + gap.asset_count;
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-3.5 text-left transition-all relative',
        selected && 'border-primary ring-2 ring-primary/20',
        !selected && 'hover:border-border/80',
      )}
    >
      <span className={cn(
        'absolute top-3 right-3 rounded-md border px-1.5 py-0.5 font-mono text-[10px]',
        isGap ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300',
      )}>
        {isGap ? `gap ${gap.gap_score}` : 'covered'}
      </span>
      <h4 className="text-sm font-medium pr-14">{gap.name}</h4>
      <div className="flex gap-0.5 mt-2.5 mb-2 h-2">
        {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
          <i key={i} className={cn('flex-1 rounded-sm', i < gap.demand_count ? 'bg-destructive' : 'bg-emerald-500')} />
        ))}
      </div>
      <div className="text-[12px] text-muted-foreground">
        <b className="text-foreground font-medium">{gap.demand_count}</b> wishes · <b className="text-foreground font-medium">{gap.asset_count}</b> assets
      </div>
    </button>
  );
}

/* ────────────────────────── Main View ────────────────────────── */
export default function WishlistView() {
  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const navigate = useNavigate();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [allCapabilities, setAllCapabilities] = useState<{ id: string; slug: string; name: string; category: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'gaps'>('queue');
  const [sortBy, setSortBy] = useState('ready');
  const [selectedGap, setSelectedGap] = useState<string | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);

  // Simplified form: four fields
  const [fTitle, setFTitle] = useState('');
  const [fWorkaround, setFWorkaround] = useState('');
  const [fFrequency, setFFrequency] = useState<string | null>(null);
  const [fGuessedCaps, setFGuessedCaps] = useState<string[]>([]);
  const [fExtraNotes, setFExtraNotes] = useState('');
  const [showExtraNotes, setShowExtraNotes] = useState(false);

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Wishlist');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, capsResp] = await Promise.all([
        apiGet<any>('/api/dpz/wishlist'),
        apiGet<any>('/api/dpz/capabilities'),
      ]);
      if (!resp.error) setItems(resp.data?.items ?? []);
      if (!capsResp.error && capsResp.data?.items) {
        setAllCapabilities(capsResp.data.items.map((c: any) => ({ id: c.id, slug: c.slug, name: c.name, category: c.category })));
      }
      const gapResp = await apiGet<any>('/api/dpz/wishlist/gap-analysis');
      if (!gapResp.error && gapResp.data?.items) {
        setGaps(gapResp.data.items.filter((g: any) => g.demand_count > 0));
      }
    } catch {} finally { setLoading(false); }
  }, [apiGet]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  /* Guess capabilities from title text */
  useEffect(() => {
    if (!fTitle || fTitle.length < 5 || allCapabilities.length === 0) return;
    const lc = fTitle.toLowerCase();
    const matched = allCapabilities
      .filter((c) => {
        const words = c.name.toLowerCase().split(/\s+/);
        return words.some((w) => w.length > 3 && lc.includes(w));
      })
      .slice(0, 3)
      .map((c) => c.slug);
    if (matched.length > 0) setFGuessedCaps(matched);
  }, [fTitle, allCapabilities]);

  const handleSubmit = async () => {
    if (!fTitle.trim()) return;
    const capIds = allCapabilities.filter((c) => fGuessedCaps.includes(c.slug)).map((c) => c.id);
    const payload: any = {
      title: fTitle,
      description: fWorkaround || undefined,
      priority: 'medium',
      category: 'application',
      ...(fFrequency ? { frequency: fFrequency } : {}),
      ...(fWorkaround ? { business_justification: fWorkaround } : {}),
      ...(fExtraNotes ? { notes: fExtraNotes } : {}),
      ...(capIds.length > 0 ? { capability_ids: capIds } : {}),
    };
    const resp = await apiPost<any>('/api/dpz/wishlist', payload);
    if (!resp.error) {
      toast({ title: 'Wish posted', description: `"${fTitle}" is live.` });
      setFTitle(''); setFWorkaround(''); setFFrequency(null); setFGuessedCaps([]); setFExtraNotes(''); setShowExtraNotes(false);
      setDialogOpen(false);
      fetchWishlist();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const handleBack = async (id: string) => {
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/upvote`, {});
    if (!resp.error) {
      toast({ title: 'Backed!' });
      fetchWishlist();
    }
  };

  const handleClaim = async (item: WishlistItem) => {
    toast({ title: 'Claimed!', description: `"${item.title}" will appear in the Lab with ${item.upvotes} backers.` });
  };

  /* ─ Derived lists ─ */
  const openItems = useMemo(() => {
    const open = items.filter((i) => i.status === 'open');
    if (sortBy === 'ready') return open.sort((a, b) => readyScore(b, gaps) - readyScore(a, gaps));
    if (sortBy === 'backed') return open.sort((a, b) => b.upvotes - a.upvotes);
    if (sortBy === 'newest') return open.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (sortBy === 'waiting') return open.sort((a, b) => daysSince(a.created_at) - daysSince(b.created_at)).reverse();
    if (sortBy === 'no-supply') return open.filter((i) => i.capabilities?.some((c) => gaps.some((g) => g.slug === c.slug && g.asset_count === 0)));
    return open;
  }, [items, sortBy, gaps]);

  const beingBuilt = useMemo(() => items.filter((i) => i.status === 'in-review' || i.status === 'claimed'), [items]);
  const shipped = useMemo(() => items.filter((i) => i.status === 'matched' || i.status === 'shipped'), [items]);
  const declined = useMemo(() => items.filter((i) => i.status === 'declined' || i.status === 'closed'), [items]);

  const pulse = useMemo(() => ({
    open: openItems.length,
    building: beingBuilt.length,
    shipped: shipped.length,
    declined: declined.length,
    totalBackers: items.reduce((s, i) => s + i.upvotes, 0),
    teamCount: new Set(items.map((i) => seeded(i.id, 33, 1, 9))).size,
  }), [openItems, beingBuilt, shipped, declined, items]);

  const gapsSorted = useMemo(() => [...gaps].sort((a, b) => b.gap_score - a.gap_score), [gaps]);
  const selectedGapWishes = useMemo(() => {
    if (!selectedGap) return [];
    return items.filter((i) => i.capabilities?.some((c) => c.slug === selectedGap));
  }, [selectedGap, items]);

  const sortExplain = SORT_OPTIONS.find((s) => s.id === sortBy);
  const sortExplainText = sortBy === 'ready'
    ? 'ranks on backers × teams affected × how long it\u2019s waited, minus any existing supply.'
    : sortBy === 'no-supply'
    ? 'shows only wishes where at least one needed capability has zero assets.'
    : '';

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary font-semibold mb-2">&mdash; WISHLIST</p>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight">What teams need next</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[62ch]">
            Wishes are free and take thirty seconds. Backing is what decides which ones get built &mdash; and every wish here ends in a build, a match, or a reason it isn&apos;t happening.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Make a wish</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[600px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b">
              <DialogTitle className="text-xl">What do you wish existed?</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Thirty seconds. Only the first line is required.</p>
            </DialogHeader>
            <div className="px-6 pt-5 pb-2 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Field 1: Title with match detection */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">What do you wish existed?</Label>
                <Input placeholder="e.g. Store-level P&L dashboard" value={fTitle} onChange={(e) => setFTitle(e.target.value)} className="h-11" />
                {fTitle.length > 4 && (
                  <div className="rounded-xl border bg-muted/30 overflow-hidden mt-2">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                      <span className="text-[10px] font-mono tracking-wide text-muted-foreground font-medium">THINGS THAT LOOK CLOSE</span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">CHECKED AS YOU TYPE</span>
                    </div>
                    <div className="divide-y">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-[11px] shrink-0 dark:bg-emerald-900 dark:text-emerald-300">&#10003;</span>
                        <div className="flex-1 min-w-0">
                          <b className="text-[13px] font-medium block leading-tight">Existing Lab build</b>
                          <span className="text-[11.5px] text-muted-foreground">In the Lab &middot; covers some pieces, not the full picture</span>
                        </div>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 shrink-0">That&apos;s it</Button>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-[11px] shrink-0">&#9825;</span>
                        <div className="flex-1 min-w-0">
                          <b className="text-[13px] font-medium block leading-tight">Similar open wish</b>
                          <span className="text-[11.5px] text-muted-foreground">Open wish &middot; backers waiting</span>
                        </div>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 shrink-0">Back that one</Button>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground text-[11px] shrink-0">&asymp;</span>
                        <div className="flex-1 min-w-0">
                          <b className="text-[13px] font-medium block leading-tight">Near-miss</b>
                          <span className="text-[11.5px] text-muted-foreground">Related but not the same</span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-[11px] h-7 shrink-0 text-muted-foreground">Not the same</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Field 2: Workaround */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  What do you do today instead?
                  <span className="text-muted-foreground font-normal ml-1.5 text-xs">the workaround is the evidence</span>
                </Label>
                <Textarea placeholder="Rebuild it in Excel each period close \u2014 about two days of work" value={fWorkaround} onChange={(e) => setFWorkaround(e.target.value)} rows={2} />
              </div>

              {/* Field 3: Frequency */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">How often does this come up?</Label>
                <div className="flex gap-2 flex-wrap">
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFFrequency(fFrequency === f.id ? null : f.id)}
                      className={cn('rounded-lg border px-3.5 py-2 text-[13px] transition-colors',
                        fFrequency === f.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/40',
                      )}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 4: Auto-guessed capabilities */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Capabilities
                  <span className="text-muted-foreground font-normal ml-1.5 text-xs">guessed from what you wrote \u2014 fix anything wrong</span>
                </Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fGuessedCaps.map((slug) => {
                    const cap = allCapabilities.find((c) => c.slug === slug);
                    return cap ? (
                      <span key={slug} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                        {cap.name}
                        <button type="button" onClick={() => setFGuessedCaps(fGuessedCaps.filter((s) => s !== slug))} className="opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    ) : null;
                  })}
                  <button type="button" className="rounded-lg border border-dashed px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
                    onClick={() => { const unused = allCapabilities.filter((c) => !fGuessedCaps.includes(c.slug)); if (unused.length > 0) setFGuessedCaps([...fGuessedCaps, unused[0].slug]); }}>
                    + add one
                  </button>
                </div>
                {fGuessedCaps.length > 0 && (
                  <p className="text-[11.5px] text-muted-foreground mt-1">
                    {(() => { const ns = fGuessedCaps.filter((s) => gaps.some((g) => g.slug === s && g.asset_count === 0)).length;
                      return ns > 0 ? `${ns} of these ha${ns === 1 ? 's' : 've'} no supply today, which would put this wish near the top of the gap map.` : 'All of these have some supply already.'; })()}
                  </p>
                )}
              </div>
            </div>

            {/* Extra notes collapsible */}
            <div className="border-t">
              <button type="button" onClick={() => setShowExtraNotes(!showExtraNotes)}
                className="flex items-center gap-2 px-6 py-3 text-[13px] text-muted-foreground hover:text-foreground w-full text-left">
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showExtraNotes && 'rotate-90')} />
                Anything else you want whoever builds this to know
                <span className="text-muted-foreground/60 text-xs">optional</span>
              </button>
              {showExtraNotes && (
                <div className="px-6 pb-4"><Textarea placeholder="Constraints, data you know is missing, a deadline it\u2019s tied to" value={fExtraNotes} onChange={(e) => setFExtraNotes(e.target.value)} rows={2} /></div>
              )}
            </div>

            {/* Footer with deliberate-no-priority note */}
            <div className="flex items-center gap-3 px-6 py-4 border-t bg-muted/30">
              <p className="flex-1 text-[12px] text-muted-foreground leading-snug">No priority field, no effort estimate. Priority comes from who backs it; effort comes from whoever claims it.</p>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!fTitle.trim()}>Post wish</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pulse stats */}
      {!loading && items.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className="rounded-xl border bg-card px-3.5 py-2.5 min-w-[110px]">
            <div className="text-lg font-semibold leading-tight">{pulse.open}</div>
            <div className="text-[10px] font-mono tracking-wide text-muted-foreground">OPEN</div>
          </div>
          <div className="rounded-xl border bg-card px-3.5 py-2.5 min-w-[110px]">
            <div className="text-lg font-semibold leading-tight text-blue-600">{pulse.building}</div>
            <div className="text-[10px] font-mono tracking-wide text-muted-foreground">BEING BUILT</div>
          </div>
          <div className="rounded-xl border bg-card px-3.5 py-2.5 min-w-[110px]">
            <div className="text-lg font-semibold leading-tight text-emerald-600">{pulse.shipped}</div>
            <div className="text-[10px] font-mono tracking-wide text-muted-foreground">SHIPPED</div>
          </div>
          <div className="rounded-xl border bg-card px-3.5 py-2.5 min-w-[110px]">
            <div className="text-lg font-semibold leading-tight">{pulse.declined}</div>
            <div className="text-[10px] font-mono tracking-wide text-muted-foreground">DECLINED, WITH A REASON</div>
          </div>
          <div className="rounded-xl border bg-card px-3.5 py-2.5 min-w-[110px]">
            <div className="text-lg font-semibold leading-tight">{pulse.totalBackers}</div>
            <div className="text-[10px] font-mono tracking-wide text-muted-foreground">PEOPLE BACKING &middot; {pulse.teamCount} TEAMS</div>
          </div>
        </div>
      )}

      {/* Queue / Gap Map tabs */}
      <div className="inline-flex gap-1 rounded-xl bg-muted/60 p-1">
        <button onClick={() => setActiveTab('queue')}
          className={cn('rounded-lg px-4 py-1.5 text-[13.5px] transition-all',
            activeTab === 'queue' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}>Queue</button>
        <button onClick={() => setActiveTab('gaps')}
          className={cn('rounded-lg px-4 py-1.5 text-[13.5px] transition-all',
            activeTab === 'gaps' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}>Gap map</button>
      </div>
        </div>
      {/* ──── Queue view ──── */}
      {activeTab === 'queue' && (
        <section className="space-y-4">
          {/* Sort row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {SORT_OPTIONS.map((s) => (
                <button key={s.id} onClick={() => setSortBy(s.id)}
                  className={cn('rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                    sortBy === s.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/40',
                  )}>{s.label}</button>
              ))}
            </div>
            {sortExplainText && (
              <p className="text-[12.5px] text-muted-foreground">
                <b className="text-foreground/80 font-medium">{sortExplain?.label}</b> {sortExplainText}
              </p>
            )}
          </div>

          {/* Open queue */}
          {loading ? (
            <div className="grid gap-3">{[1,2,3].map((i) => <div key={i} className="h-28 rounded-xl border bg-muted/50 animate-pulse" />)}</div>
          ) : openItems.length === 0 ? (
            <div className="rounded-xl border bg-card text-center py-16">
              <Lightbulb className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-semibold mt-3">The wishlist is empty</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">What do you wish existed? Submit the first wish and rally the team.</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4">Make a wish</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {openItems.map((item) => <WishRow key={item.id} item={item} gaps={gaps} onBack={handleBack} onClaim={handleClaim} />)}
            </div>
          )}
          {/* Resolved section */}
          {(beingBuilt.length > 0 || shipped.length > 0 || declined.length > 0) && (
            <div className="mt-8">
              <div className="flex items-baseline gap-2.5 mb-3">
                <h2 className="text-[15px] font-semibold">Resolved</h2>
                <span className="text-[12.5px] text-muted-foreground">Every wish ends somewhere. This is the part that makes the next wish worth writing.</span>
              </div>
              <div className="grid gap-3">
                {beingBuilt.map((item) => <WishRow key={item.id} item={item} gaps={gaps} onBack={handleBack} onClaim={handleClaim} />)}
                {shipped.map((item) => <WishRow key={item.id} item={item} gaps={gaps} onBack={handleBack} onClaim={handleClaim} />)}
                {declined.map((item) => <WishRow key={item.id} item={item} gaps={gaps} onBack={handleBack} onClaim={handleClaim} />)}
              </div>
            </div>
          )}
        </section>
      )}
      {/* ──── Gap map view ──── */}
      {activeTab === 'gaps' && (
        <section className="space-y-4">
          <p className="text-[12.5px] text-muted-foreground max-w-[70ch]">
            <b className="text-foreground/80 font-medium">Demand</b> counts open wishes naming a capability.
            <b className="text-foreground/80 font-medium"> Supply</b> counts assets in Explore and the Lab that provide it.
            A gap is where people keep asking and nothing exists &mdash; that&apos;s your build list, ordered.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-3">
            {gapsSorted.map((g) => (
              <GapCard key={g.slug} gap={g} selected={selectedGap === g.slug} onClick={() => setSelectedGap(selectedGap === g.slug ? null : g.slug)} />
            ))}
          </div>
          {selectedGap && selectedGapWishes.length > 0 && (
            <div className="mt-6">
              <div className="flex items-baseline gap-2.5 mb-3">
                <h2 className="text-[15px] font-semibold">{gaps.find((g) => g.slug === selectedGap)?.name} &mdash; the {selectedGapWishes.length} wishes behind this gap</h2>
              </div>
              <div className="grid gap-3">
                {selectedGapWishes.map((item) => <WishRow key={item.id} item={item} gaps={gaps} onBack={handleBack} onClaim={handleClaim} />)}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}


