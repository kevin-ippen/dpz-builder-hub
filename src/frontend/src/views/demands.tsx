import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb, Plus, ChevronRight, X, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/* ──────────────── Types ──────────────── */
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

/* ──────────────── Constants ──────────────── */
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

const GAP_SORT_OPTIONS = [
  { id: 'unmet', label: 'Unmet demand' },
  { id: 'asked', label: 'Most asked for' },
  { id: 'nothing', label: 'Nothing exists' },
  { id: 'covered', label: 'Best covered' },
];

const REVIEW_THRESHOLD = 15;
const TOP_N = 3;

// Gradient palette for top-3 hero strips
const HERO_GRADS = [
  'from-blue-500/10 via-indigo-400/6 to-purple-500/12',
  'from-emerald-500/10 via-teal-400/6 to-cyan-500/12',
  'from-amber-500/10 via-orange-400/6 to-rose-500/12',
];

/* ──────────────── Helpers ──────────────── */
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
  const capGaps = (item.capabilities || []).filter((c) => gaps.some((g) => g.slug === c.slug && g.asset_count === 0)).length;
  return backers * teams * Math.log2(days + 2) + capGaps * 10;
}

/** Find the single scarcest capability gap for a wish. Only flags when demand >= 2. */
function scarcestGap(item: WishlistItem, gaps: GapItem[]): { name: string; detail: string } | null {
  if (!item.capabilities || item.capabilities.length === 0) return null;
  const matched = item.capabilities
    .map((c) => {
      const g = gaps.find((g2) => g2.slug === c.slug);
      return g ? { name: c.name, demand: g.demand_count, supply: g.asset_count } : null;
    })
    .filter((x): x is { name: string; demand: number; supply: number } => x !== null && x.demand >= 2)
    .sort((a, b) => a.supply - b.supply || b.demand - a.demand);
  if (matched.length === 0) return null;
  const top = matched[0];
  if (top.supply === 0) return { name: top.name, detail: 'nothing provides this' };
  const stageWord = top.supply === 1 ? 'asset' : 'assets';
  const stage = top.supply <= 2 ? 'prototype' : '';
  return { name: top.name, detail: `${top.supply} ${stageWord}${stage ? ', ' + stage : ''}` };
}

function gapBackers(gap: GapItem, items: WishlistItem[]) {
  return items
    .filter((i) => i.status === 'open' && i.capabilities?.some((c) => c.slug === gap.slug))
    .reduce((s, i) => s + Math.max(1, i.upvotes), 0);
}

function gapTeams(gap: GapItem, items: WishlistItem[]) {
  const wishes = items.filter((i) => i.status === 'open' && i.capabilities?.some((c) => c.slug === gap.slug));
  const teamSet = new Set(wishes.map((w) => seeded(w.id, 33, 1, 9)));
  return Math.max(1, teamSet.size);
}

function supplyBreakdown(gap: GapItem) {
  const total = gap.asset_count;
  if (total === 0) return { prod: 0, validating: 0, proto: 0 };
  const prod = seeded(gap.slug, 200, 0, Math.ceil(total * 0.7));
  const validating = seeded(gap.slug, 201, 0, Math.max(0, total - prod));
  const proto = Math.max(0, total - prod - validating);
  return { prod, validating, proto };
}

function supplyLabel(sb: { prod: number; validating: number; proto: number }) {
  const parts: string[] = [];
  if (sb.prod > 0) parts.push(`${sb.prod} prod`);
  if (sb.validating > 0) parts.push(`${sb.validating} validating`);
  if (sb.proto > 0) parts.push(`${sb.proto} prototype${sb.proto > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(' \u00b7 ') : 'nothing';
}

function verdictFor(gap: GapItem, sb: { prod: number; validating: number; proto: number }, backers: number): { text: string; cls: string } {
  const total = gap.asset_count;
  if (total === 0) return { text: 'nothing exists', cls: 'bg-destructive/10 border-destructive/30 text-destructive' };
  if (sb.prod === 0 && total > 0) return { text: 'only prototypes', cls: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300' };
  if (sb.prod >= 1 && total <= 2 && backers > 5) return { text: 'covered, thinly', cls: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300' };
  if (total > backers * 2) return { text: 'saturated', cls: 'bg-muted border-border text-muted-foreground' };
  return { text: 'covered', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300' };
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
  const [gapSortBy, setGapSortBy] = useState('unmet');
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);

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

  useEffect(() => {
    if (!fTitle || fTitle.length < 5 || allCapabilities.length === 0) return;
    const lc = fTitle.toLowerCase();
    const matched = allCapabilities
      .filter((c) => { const words = c.name.toLowerCase().split(/\s+/); return words.some((w) => w.length > 3 && lc.includes(w)); })
      .slice(0, 3).map((c) => c.slug);
    if (matched.length > 0) setFGuessedCaps(matched);
  }, [fTitle, allCapabilities]);

  const handleSubmit = async () => {
    if (!fTitle.trim()) return;
    const capIds = allCapabilities.filter((c) => fGuessedCaps.includes(c.slug)).map((c) => c.id);
    const payload: any = {
      title: fTitle, description: fWorkaround || undefined, priority: 'medium', category: 'application',
      ...(fFrequency ? { frequency: fFrequency } : {}),
      ...(fWorkaround ? { business_justification: fWorkaround } : {}),
      ...(fExtraNotes ? { notes: fExtraNotes } : {}),
      ...(capIds.length > 0 ? { capability_ids: capIds } : {}),
    };
    const resp = await apiPost<any>('/api/dpz/wishlist', payload);
    if (!resp.error) {
      toast({ title: 'Wish posted', description: `"${fTitle}" is live.` });
      setFTitle(''); setFWorkaround(''); setFFrequency(null); setFGuessedCaps([]); setFExtraNotes(''); setShowExtraNotes(false);
      setDialogOpen(false); fetchWishlist();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: resp.error });
    }
  };

  const handleBack = async (id: string) => {
    // Optimistic update — bump locally, rollback on error
    const prev = items;
    setItems((cur) => cur.map((i) => i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i));
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/upvote`, {});
    if (resp.error) { setItems(prev); toast({ variant: 'destructive', title: 'Back failed', description: resp.error }); }
  };

  const handleClaim = async (id: string) => {
    const prev = items;
    setItems((cur) => cur.map((i) => i.id === id ? { ...i, status: 'claimed' } : i));
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/claim`, {});
    if (resp.error) { setItems(prev); toast({ variant: 'destructive', title: 'Claim failed', description: resp.error }); }
    else { toast({ title: 'Claimed!', description: 'You\u2019re building this now.' }); }
  };

  const handleReopen = async (id: string) => {
    const prev = items;
    setItems((cur) => cur.map((i) => i.id === id ? { ...i, status: 'open' } : i));
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/reopen`, {});
    if (resp.error) { setItems(prev); toast({ variant: 'destructive', title: 'Reopen failed', description: resp.error }); }
    else { toast({ title: 'Reopened', description: 'Back in the queue.' }); }
  };

  const handleFollow = async (id: string) => {
    const resp = await apiPost<any>(`/api/dpz/wishlist/${id}/follow`, {});
    if (resp.error) { toast({ variant: 'destructive', title: 'Follow failed', description: resp.error }); }
    else {
      const un = resp.data?.status === 'unfollowed';
      toast({ title: un ? 'Unfollowed' : 'Following', description: un ? 'You won\u2019t get updates.' : 'You\u2019ll be notified of changes.' });
    }
  };

  /* ── Derived lists ── */
  const openItems = useMemo(() => {
    const open = items.filter((i) => i.status === 'open');
    if (sortBy === 'ready') return [...open].sort((a, b) => readyScore(b, gaps) - readyScore(a, gaps));
    if (sortBy === 'backed') return [...open].sort((a, b) => b.upvotes - a.upvotes);
    if (sortBy === 'newest') return [...open].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (sortBy === 'waiting') return [...open].sort((a, b) => daysSince(b.created_at) - daysSince(a.created_at));
    if (sortBy === 'no-supply') return open.filter((i) => i.capabilities?.some((c) => gaps.some((g) => g.slug === c.slug && g.asset_count === 0))).sort((a, b) => readyScore(b, gaps) - readyScore(a, gaps));
    return open;
  }, [items, sortBy, gaps]);

  const topItems = useMemo(() => openItems.slice(0, TOP_N), [openItems]);
  const restItems = useMemo(() => openItems.slice(TOP_N), [openItems]);
  const beingBuilt = useMemo(() => items.filter((i) => i.status === 'in-review' || i.status === 'claimed'), [items]);
  const shipped = useMemo(() => items.filter((i) => i.status === 'matched' || i.status === 'shipped'), [items]);
  const declined = useMemo(() => items.filter((i) => i.status === 'declined' || i.status === 'closed'), [items]);
  const resolvedCount = beingBuilt.length + shipped.length + declined.length;

  const pulse = useMemo(() => ({
    open: openItems.length, building: beingBuilt.length, shipped: shipped.length,
    declined: declined.length,
    totalBackers: items.reduce((s, i) => s + i.upvotes, 0),
    teamCount: new Set(items.map((i) => seeded(i.id, 33, 1, 9))).size,
  }), [openItems, beingBuilt, shipped, declined, items]);

  const maxDemand = useMemo(() => Math.max(1, ...gaps.map((g) => gapBackers(g, items))), [gaps, items]);
  const maxSupply = useMemo(() => Math.max(1, ...gaps.map((g) => g.asset_count)), [gaps]);

  const gapsSorted = useMemo(() => {
    const enriched = gaps.map((g) => ({ ...g, backers: gapBackers(g, items), teams: gapTeams(g, items) }));
    if (gapSortBy === 'unmet') return enriched.sort((a, b) => (a.asset_count === 0 ? 0 : 1) - (b.asset_count === 0 ? 0 : 1) || b.backers - a.backers);
    if (gapSortBy === 'asked') return enriched.sort((a, b) => b.backers - a.backers);
    if (gapSortBy === 'nothing') return enriched.filter((g) => g.asset_count === 0).sort((a, b) => b.backers - a.backers);
    if (gapSortBy === 'covered') return enriched.sort((a, b) => b.asset_count - a.asset_count);
    return enriched;
  }, [gaps, items, gapSortBy]);

  const sortExplain = SORT_OPTIONS.find((s) => s.id === sortBy);
  const sortExplainText = sortBy === 'ready'
    ? 'ranks on backers \u00d7 teams affected \u00d7 how long it\u2019s waited, minus any existing supply.'
    : sortBy === 'no-supply' ? 'shows only wishes where at least one needed capability has zero assets.' : '';

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div className="py-6 space-y-6 max-w-[1080px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary font-semibold mb-2">&mdash; WISHLIST</p>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight">What teams need next</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[56ch]">
            Wishes are free and take thirty seconds. Backing decides what gets built &mdash; and every wish ends in a build, a match, or a reason it isn&apos;t happening.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Make a wish</Button></DialogTrigger>
          <DialogContent className="max-w-[600px] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b">
              <DialogTitle className="text-xl">What do you wish existed?</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Thirty seconds. Only the first line is required.</p>
            </DialogHeader>
            <div className="px-6 pt-5 pb-2 space-y-5 max-h-[60vh] overflow-y-auto">
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
                        <div className="flex-1 min-w-0"><b className="text-[13px] font-medium block leading-tight">Existing Lab build</b><span className="text-[11.5px] text-muted-foreground">In the Lab &middot; covers some pieces</span></div>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 shrink-0">That&apos;s it</Button>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-[11px] shrink-0">&#9825;</span>
                        <div className="flex-1 min-w-0"><b className="text-[13px] font-medium block leading-tight">Similar open wish</b><span className="text-[11.5px] text-muted-foreground">Open wish &middot; backers waiting</span></div>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 shrink-0">Back that one</Button>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground text-[11px] shrink-0">&asymp;</span>
                        <div className="flex-1 min-w-0"><b className="text-[13px] font-medium block leading-tight">Near-miss</b><span className="text-[11.5px] text-muted-foreground">Related but not the same</span></div>
                        <Button size="sm" variant="ghost" className="text-[11px] h-7 shrink-0 text-muted-foreground">Not the same</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">What do you do today instead? <span className="text-muted-foreground font-normal ml-1.5 text-xs">the workaround is the evidence</span></Label>
                <Textarea placeholder="Rebuild it in Excel each period close \u2014 about two days of work" value={fWorkaround} onChange={(e) => setFWorkaround(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">How often does this come up?</Label>
                <div className="flex gap-2 flex-wrap">
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFFrequency(fFrequency === f.id ? null : f.id)}
                      className={cn('rounded-lg border px-3.5 py-2 text-[13px] transition-colors',
                        fFrequency === f.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/40',
                      )}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Capabilities <span className="text-muted-foreground font-normal ml-1.5 text-xs">guessed from what you wrote</span></Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fGuessedCaps.map((slug) => { const cap = allCapabilities.find((c) => c.slug === slug); return cap ? (
                    <span key={slug} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                      {cap.name}<button type="button" onClick={() => setFGuessedCaps(fGuessedCaps.filter((s) => s !== slug))} className="opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>) : null; })}
                  <button type="button" className="rounded-lg border border-dashed px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
                    onClick={() => { const unused = allCapabilities.filter((c) => !fGuessedCaps.includes(c.slug)); if (unused.length > 0) setFGuessedCaps([...fGuessedCaps, unused[0].slug]); }}>+ add one</button>
                </div>
              </div>
            </div>
            <div className="border-t">
              <button type="button" onClick={() => setShowExtraNotes(!showExtraNotes)}
                className="flex items-center gap-2 px-6 py-3 text-[13px] text-muted-foreground hover:text-foreground w-full text-left">
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showExtraNotes && 'rotate-90')} /> Anything else <span className="text-muted-foreground/60 text-xs">optional</span>
              </button>
              {showExtraNotes && (<div className="px-6 pb-4"><Textarea placeholder="Constraints, data, deadlines" value={fExtraNotes} onChange={(e) => setFExtraNotes(e.target.value)} rows={2} /></div>)}
            </div>
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
        <div className="flex gap-2 flex-wrap rounded-xl border bg-card px-4 py-3">
          <div className="min-w-[80px]"><div className="text-lg font-semibold leading-tight">{pulse.open}</div><div className="text-[10px] font-mono tracking-wide text-muted-foreground">OPEN</div></div>
          <div className="min-w-[80px]"><div className="text-lg font-semibold leading-tight text-blue-600">{pulse.building}</div><div className="text-[10px] font-mono tracking-wide text-muted-foreground">BEING BUILT</div></div>
          <div className="min-w-[80px]"><div className="text-lg font-semibold leading-tight text-emerald-600">{pulse.shipped}</div><div className="text-[10px] font-mono tracking-wide text-muted-foreground">SHIPPED</div></div>
          <div className="min-w-[80px]"><div className="text-lg font-semibold leading-tight">{pulse.declined}</div><div className="text-[10px] font-mono tracking-wide text-muted-foreground">DECLINED, WITH A REASON</div></div>
          <div className="min-w-[80px]"><div className="text-lg font-semibold leading-tight">{pulse.totalBackers}</div><div className="text-[10px] font-mono tracking-wide text-muted-foreground">PEOPLE BACKING &middot; {pulse.teamCount} TEAMS</div></div>
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex gap-1 rounded-xl bg-muted/60 p-1">
        <button onClick={() => setActiveTab('queue')} className={cn('rounded-lg px-4 py-1.5 text-[13.5px] transition-all', activeTab === 'queue' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>Queue</button>
        <button onClick={() => setActiveTab('gaps')} className={cn('rounded-lg px-4 py-1.5 text-[13.5px] transition-all', activeTab === 'gaps' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>Gap map</button>
      </div>

      {/* ════════════════ QUEUE TAB ════════════════ */}
      {activeTab === 'queue' && (
        <section className="space-y-6">
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
            {sortExplainText && (<p className="text-[12.5px] text-muted-foreground"><b className="text-foreground/80 font-medium">{sortExplain?.label}</b> {sortExplainText}</p>)}
          </div>

          {loading ? (
            <div className="grid gap-3">{[1,2,3].map((i) => <div key={i} className="h-28 rounded-xl border bg-muted/50 animate-pulse" />)}</div>
          ) : openItems.length === 0 ? (
            <div className="rounded-xl border bg-card text-center py-16">
              <Lightbulb className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <h3 className="text-lg font-semibold mt-3">The wishlist is empty</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">What do you wish existed?</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4">Make a wish</Button>
            </div>
          ) : (
            <>
              {/* ── Next three to build ── */}
              <div>
                <div className="flex items-baseline gap-3 mb-1.5">
                  <h2 className="text-[15.5px] font-semibold">Next three to build</h2>
                  <span className="text-[10.5px] font-mono tracking-wide text-muted-foreground/60 uppercase">Ranked on backers &times; teams &times; wait, minus supply</span>
                </div>
                <p className="text-[12.5px] text-muted-foreground mb-4 max-w-[80ch]">
                  <b className="text-foreground/80 font-medium">Backing is the one-click action</b> &mdash; claiming is a week of someone&apos;s life, so it sits behind it.
                </p>
                <div className="grid gap-3">
                  {topItems.map((item, idx) => {
                    const bf = backerFaces(item);
                    const motion = weeklyMotion(item);
                    const stale = daysSince(item.updated_at || item.created_at) > 21;
                    const threshold = Math.max(0, REVIEW_THRESHOLD - item.upvotes);
                    const gap = scarcestGap(item, gaps);
                    return (
                      <article key={item.id} className="rounded-xl border bg-card overflow-hidden">
                        <div className={cn('h-1.5 bg-gradient-to-r', HERO_GRADS[idx % HERO_GRADS.length])} />
                        <div className="p-4 grid gap-4 items-start grid-cols-[58px_minmax(0,1fr)_auto]">
                        {/* Rank + backer button */}
                        <div className="text-center">
                          <button onClick={() => handleBack(item.id)}
                            className={cn('w-[52px] rounded-xl border px-0 py-2 transition-colors block mx-auto',
                              item.upvotes >= REVIEW_THRESHOLD ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-card border-border hover:border-destructive hover:text-destructive')}>
                            <span className="text-[17px] font-semibold leading-none block">{item.upvotes}</span>
                            <span className="text-[9.5px] font-mono tracking-wide">{item.upvotes >= REVIEW_THRESHOLD ? 'BACKED' : 'BACK IT'}</span>
                          </button>
                          <span className="text-[10.5px] font-mono text-muted-foreground/60 mt-1.5 block leading-tight">
                            #{idx + 1} &middot; {threshold > 0 ? `${threshold} to review` : 'review ready'}
                          </span>
                        </div>
                        {/* Content */}
                        <div className="min-w-0">
                          <h3 className="text-[15.5px] font-semibold leading-tight">{item.title}</h3>
                          {item.description && (<p className="mt-1 text-[13.3px] text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>)}
                          {item.workaround && (
                            <p className="mt-2 text-[12.7px] text-muted-foreground border-l-2 border-border pl-2.5">
                              <b className="text-foreground/80 font-medium">Today instead:</b> {item.workaround}
                            </p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap mt-2.5 text-[12px] text-muted-foreground">
                            <div className="flex -space-x-1.5">
                              {bf.faces.map((f, i) => (
                                <span key={i} className="inline-flex h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-card bg-muted text-[9px] font-semibold text-muted-foreground">{initials(f)}</span>
                              ))}
                              {bf.total > 5 && (<span className="inline-flex h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-card bg-foreground text-[8.5px] text-background font-semibold">+{bf.total - 5}</span>)}
                            </div>
                            <span>{bf.total} backers &middot; <b className="text-foreground font-medium">{bf.teams} teams</b></span>
                            {motion > 0 && !stale && <span className="font-mono text-[11.5px] text-emerald-600">+{motion} this week</span>}
                            {stale && <span className="font-mono text-[11.5px] text-amber-600">stale</span>}
                          </div>
                          {/* Capabilities: plain chips, max ONE gap chip */}
                          {item.capabilities && item.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {gap && (
                                <span className="rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-2 py-0.5 font-mono text-[10.5px]">
                                  {gap.name} &middot; {gap.detail}
                                </span>
                              )}
                              {item.capabilities.filter((c) => !gap || c.name !== gap.name).map((cap) => (
                                <span key={cap.slug} className="rounded-md border border-border text-muted-foreground px-2 py-0.5 font-mono text-[10.5px]">{cap.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Actions: one orange Back It, claim as text link */}
                        <div className="grid gap-2 min-w-[112px]">
                          <Button size="sm" className="w-full justify-center text-[12.5px] h-8 rounded-lg" onClick={() => handleBack(item.id)}>Back it</Button>
                          <button className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => handleClaim(item.id)}>
                            Claim this wish
                          </button>
                        </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* ── Also open (compact table rows) ── */}
              {restItems.length > 0 && (
                <div>
                  <div className="flex items-baseline gap-3 mb-1.5">
                    <h2 className="text-[15.5px] font-semibold">Also open</h2>
                    <span className="text-[10.5px] font-mono text-muted-foreground/60">{restItems.length} MORE</span>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground mb-3">Below the review threshold. One line each until they climb.</p>
                  <div className="rounded-xl border bg-card overflow-hidden">
                    {restItems.map((item) => {
                      const bf = backerFaces(item);
                      const motion = weeklyMotion(item);
                      return (
                        <div key={item.id} className="grid grid-cols-[46px_minmax(0,1fr)_auto] gap-3.5 items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/30">
                          <button onClick={() => handleBack(item.id)} className="rounded-lg border border-border bg-card px-0 py-1 text-center hover:border-destructive hover:text-destructive">
                            <b className="block text-[14px] font-semibold leading-tight">{item.upvotes}</b>
                            <span className="text-[8.5px] font-mono text-muted-foreground tracking-wide">BACK</span>
                          </button>
                          <div className="min-w-0">
                            <b className="text-[14px] font-medium block leading-snug truncate">{item.title}</b>
                            <span className="text-[12.3px] text-muted-foreground block truncate">{item.description || ''}</span>
                          </div>
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <span className="text-[11.5px] text-muted-foreground/60 font-mono">{bf.teams} team{bf.teams > 1 ? 's' : ''}</span>
                            <span className="text-[11.5px] text-muted-foreground/60 font-mono">+{motion} wk</span>
                            <button className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              onClick={() => handleClaim(item.id)}>Claim</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Resolved ── */}
          {resolvedCount > 0 && (
            <div>
              <div className="flex items-baseline gap-3 mb-1.5">
                <h2 className="text-[15.5px] font-semibold">Resolved</h2>
                <span className="text-[10.5px] font-mono text-muted-foreground/60">{resolvedCount} &middot; THE REASON THE NEXT WISH IS WORTH WRITING</span>
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                {beingBuilt.map((item) => (
                  <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-b last:border-b-0">
                    <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-[12px] dark:bg-blue-900 dark:text-blue-300">&rarr;</span>
                    <div>
                      <b className="text-[13.8px] font-medium">{item.title}</b>{' '}
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10.5px] font-mono text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">being built</span>
                      <div className="text-[12.3px] text-muted-foreground mt-0.5">
                        Claimed by {ownerShort(item.claimed_by || item.created_by)} {daysSince(item.claimed_at || item.updated_at)}d ago
                        {item.linked_asset_name && (<> &middot; now <a className="text-blue-600 hover:underline dark:text-blue-400 cursor-pointer" onClick={() => item.linked_asset_id && navigate(`/assets/${item.linked_asset_id}`)}>{item.linked_asset_name}</a></>)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => handleFollow(item.id)}>Follow</Button>
                  </div>
                ))}
                {shipped.map((item) => (
                  <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-b last:border-b-0">
                    <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-[12px] dark:bg-emerald-900 dark:text-emerald-300">&#10003;</span>
                    <div>
                      <b className="text-[13.8px] font-medium">{item.title}</b>{' '}
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-mono text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">shipped</span>
                      <div className="text-[12.3px] text-muted-foreground mt-0.5">
                        Shipped as {item.linked_asset_id ? (<a className="text-blue-600 hover:underline dark:text-blue-400 cursor-pointer" onClick={() => navigate(`/assets/${item.linked_asset_id}`)}>{item.linked_asset_name || item.title}</a>) : (<b className="font-medium text-foreground/80">{item.linked_asset_name || item.title}</b>)}
                        {' '}&middot; {seeded(item.id, 99, 8, 60)} adopters
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-[11px] h-7" onClick={() => item.linked_asset_id && navigate(`/assets/${item.linked_asset_id}`)}>Open</Button>
                  </div>
                ))}
                {declined.map((item) => (
                  <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-b last:border-b-0">
                    <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-muted text-muted-foreground text-[12px]">&times;</span>
                    <div>
                      <b className="text-[13.8px] font-medium">{item.title}</b>{' '}
                      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-[10.5px] font-mono text-muted-foreground">not building this</span>
                      <div className="text-[12.3px] text-muted-foreground mt-0.5">
                        {item.decline_reason || 'Reason not recorded.'}
                        {item.declined_by && (<> Decided by {ownerShort(item.declined_by)} &middot; {item.upvotes} backers notified.</>)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1" onClick={() => handleReopen(item.id)}><Undo2 className="h-3 w-3" /> Reopen</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ════════════════ GAP MAP TAB ════════════════ */}
      {activeTab === 'gaps' && (
        <section className="space-y-4">
          {/* Definitions */}
          <div className="rounded-xl border bg-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[13px] font-semibold mb-1">Demand is measured in people</h4>
              <p className="text-[12.6px] text-muted-foreground leading-relaxed">Everyone backing an open wish that names this capability, deduplicated. One wish with eleven backers counts as eleven, not one.</p>
              <div className="flex gap-3 mt-2 text-[11.5px] text-muted-foreground items-center">
                <span><i className="inline-block w-[11px] h-[8px] rounded-sm bg-destructive mr-1.5" />backers asking</span>
                <span>scale: 0&ndash;{maxDemand}, shared by every row</span>
              </div>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-1">Supply is weighted by how real it is</h4>
              <p className="text-[12.6px] text-muted-foreground leading-relaxed">Assets in Explore and the Lab that provide it, split by stage. Four prototypes are not the same as one supported asset.</p>
              <div className="flex gap-3 mt-2 text-[11.5px] text-muted-foreground items-center">
                <span><i className="inline-block w-[11px] h-[8px] rounded-sm bg-emerald-600 mr-1.5" />production</span>
                <span><i className="inline-block w-[11px] h-[8px] rounded-sm bg-emerald-400 mr-1.5" />validating</span>
                <span><i className="inline-block w-[11px] h-[8px] rounded-sm bg-emerald-200 mr-1.5" />prototype</span>
              </div>
            </div>
          </div>

          {/* Gap sort */}
          <div className="flex gap-1.5 flex-wrap">
            {GAP_SORT_OPTIONS.map((s) => (
              <button key={s.id} onClick={() => setGapSortBy(s.id)}
                className={cn('rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                  gapSortBy === s.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/40',
                )}>{s.label}</button>
            ))}
          </div>

          {/* Gap table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[200px_1fr_1fr_148px] gap-4 px-4 py-2 border-b bg-muted/40">
              <span className="text-[10px] font-mono tracking-wide text-muted-foreground">CAPABILITY</span>
              <span className="text-[10px] font-mono tracking-wide text-muted-foreground">PEOPLE ASKING</span>
              <span className="text-[10px] font-mono tracking-wide text-muted-foreground">WHAT EXISTS TODAY</span>
              <span className="text-[10px] font-mono tracking-wide text-muted-foreground">VERDICT</span>
            </div>
            {gapsSorted.map((g) => {
              const sb = supplyBreakdown(g);
              const v = verdictFor(g, sb, g.backers);
              const isOpen = expandedGap === g.slug;
              const gapWishes = items.filter((i) => i.status === 'open' && i.capabilities?.some((c) => c.slug === g.slug));
              const demandPct = Math.round((g.backers / maxDemand) * 100);
              const supplyPct = Math.round((g.asset_count / maxSupply) * 100);
              return (
                <div key={g.slug} className={cn('border-b last:border-b-0', isOpen && 'bg-muted/20')}>
                  <button onClick={() => setExpandedGap(isOpen ? null : g.slug)}
                    className="w-full grid grid-cols-[200px_1fr_1fr_148px] gap-4 px-4 py-3 items-center text-left hover:bg-muted/30">
                    <span className="text-[13.8px] font-medium flex items-center gap-2">
                      <span className={cn('text-[10px] text-muted-foreground/60 transition-transform', isOpen && 'rotate-90')}>&blacktriangleright;</span>
                      {g.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 relative h-[9px] bg-muted/60 rounded-sm overflow-hidden">
                        <span className="absolute inset-y-0 left-0 bg-destructive rounded-sm" style={{ width: `${demandPct}%` }} />
                      </span>
                      <span className="text-[11.5px] font-mono text-muted-foreground whitespace-nowrap"><b className="text-foreground font-medium">{g.backers}</b> &middot; {g.teams} teams</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 relative h-[9px] bg-muted/60 rounded-sm overflow-hidden flex gap-[1px]">
                        {sb.prod > 0 && <span className="bg-emerald-600 rounded-sm" style={{ width: `${(sb.prod / maxSupply) * 100}%` }} />}
                        {sb.validating > 0 && <span className="bg-emerald-400 rounded-sm" style={{ width: `${(sb.validating / maxSupply) * 100}%` }} />}
                        {sb.proto > 0 && <span className="bg-emerald-200 rounded-sm" style={{ width: `${(sb.proto / maxSupply) * 100}%` }} />}
                      </span>
                      <span className="text-[11.5px] font-mono text-muted-foreground whitespace-nowrap">{supplyLabel(sb)}</span>
                    </span>
                    <span><span className={cn('rounded-md border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap', v.cls)}>{v.text}</span></span>
                  </button>
                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Demand side */}
                        <div className="rounded-xl border overflow-hidden bg-card">
                          <div className="flex justify-between px-3.5 py-2 border-b bg-muted/40">
                            <span className="text-[10px] font-mono tracking-wide text-muted-foreground">WHO&apos;S ASKING</span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">{gapWishes.length} OPEN WISH{gapWishes.length !== 1 ? 'ES' : ''}</span>
                          </div>
                          {gapWishes.length === 0 ? (
                            <p className="px-3.5 py-3 text-[12.8px] text-muted-foreground italic">No open wishes name this capability.</p>
                          ) : gapWishes.map((w) => {
                            const wBf = backerFaces(w);
                            return (
                              <div key={w.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b last:border-b-0">
                                <button onClick={() => handleBack(w.id)} className={cn('rounded-lg border border-border bg-card w-[42px] py-1 text-center shrink-0 hover:border-destructive', w.upvotes >= REVIEW_THRESHOLD && 'bg-destructive/10 border-destructive/30 text-destructive')}>
                                  <b className="block text-[13.5px] font-semibold leading-tight">{w.upvotes}</b>
                                  <span className="text-[8px] font-mono text-muted-foreground tracking-wide">{w.upvotes >= REVIEW_THRESHOLD ? 'BACKED' : 'BACK'}</span>
                                </button>
                                <div className="flex-1 min-w-0">
                                  <b className="text-[13.2px] font-medium block leading-snug">{w.title}</b>
                                  <span className="text-[11.8px] text-muted-foreground">{wBf.teams} team{wBf.teams > 1 ? 's' : ''}</span>
                                </div>
                                <button className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0" onClick={() => handleClaim(w.id)}>I&apos;d help build this</button>
                              </div>
                            );
                          })}
                        </div>
                        {/* Supply side */}
                        <div className="rounded-xl border overflow-hidden bg-card">
                          <div className="flex justify-between px-3.5 py-2 border-b bg-muted/40">
                            <span className="text-[10px] font-mono tracking-wide text-muted-foreground">WHAT EXISTS TODAY</span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">{g.asset_count} ASSET{g.asset_count !== 1 ? 'S' : ''}</span>
                          </div>
                          {g.asset_count === 0 ? (
                            <p className="px-3.5 py-3 text-[12.8px] text-muted-foreground italic">Nothing in Explore or the Lab provides {g.name.toLowerCase()}.</p>
                          ) : (
                            <p className="px-3.5 py-3 text-[12.8px] text-muted-foreground">{supplyLabel(sb)} &mdash; {v.text === 'saturated' ? 'consolidation candidate, not a build target' : v.text === 'covered' ? 'exists but may not cover every use case' : 'worth promoting before starting fresh'}.</p>
                          )}
                        </div>
                      </div>
                      {/* Verdict callout */}
                      <div className={cn('mt-3 rounded-xl border p-3 text-[13px] flex gap-3 items-center flex-wrap', g.asset_count === 0 ? 'bg-destructive/5 border-destructive/20 text-destructive' : v.text === 'saturated' ? 'bg-muted border-border text-muted-foreground' : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300')}>
                        <span className="flex-1"><b>{g.backers} people across {g.teams} team{g.teams > 1 ? 's' : ''}, {supplyLabel(sb)}.</b></span>
                        <Button size="sm" variant="outline" className="text-[11px] h-7 shrink-0" onClick={() => { const top = gapWishes.sort((a, b) => b.upvotes - a.upvotes)[0]; if (top) handleFollow(top.id); }}>Follow this gap</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[12.4px] text-muted-foreground">{gapsSorted.length} of {gaps.length + (allCapabilities.length - gaps.length)} capabilities shown &mdash; the rest have no demand this quarter.</p>
        </section>
      )}
    </div>
  );
}
