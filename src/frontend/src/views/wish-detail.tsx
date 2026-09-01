import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ThumbsUp, Sparkles, Clock, CheckCircle2, AlertTriangle,
  Brain, Database, Zap, Shield, Server, Search, BarChart, Layout,
  Activity, MapPin, Eye, MessageCircle, GitBranch, Package, Bot,
  Columns, Plus, X, Link2, Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

// ─── Types ──────────────────────────────────────────────────────────────
interface Capability {
  id: string; slug: string; name: string; description: string;
  category: string; platform_feature: string; icon: string;
}

interface WishDetail {
  id: string; title: string; description?: string;
  created_by: string; status: string; priority: string;
  category?: string; upvotes: number; signals_count: number;
  linked_asset_id?: string; linked_asset?: { id: string; name: string; type_name: string };
  created_at?: string; updated_at?: string;
  capabilities: Capability[];
}

// ─── Constants ──────────────────────────────────────────────────────────
const PRIORITY_BADGE: Record<string, { label: string; color: string }> = {
  high: { label: 'High Priority', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  medium: { label: 'Medium Priority', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  low: { label: 'Low Priority', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
};

const STATUS_BADGE: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: 'Open', icon: Sparkles, color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'in-review': { label: 'In Review', icon: Clock, color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  matched: { label: 'Matched', icon: CheckCircle2, color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  closed: { label: 'Closed', icon: CheckCircle2, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const CAP_CATEGORY_LABELS: Record<string, string> = {
  data: 'Data & Storage',
  ai: 'AI & ML',
  platform: 'Platform',
};

const ICON_MAP: Record<string, any> = {
  database: Database, activity: Activity, columns: Columns, search: Search,
  brain: Brain, zap: Zap, clock: Clock, sparkles: Sparkles,
  bot: Bot, shield: Shield, 'git-branch': GitBranch, layout: Layout,
  'bar-chart': BarChart, server: Server, 'map-pin': MapPin, eye: Eye,
  'message-circle': MessageCircle, package: Package,
};

function CapIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = ICON_MAP[name || ''] || Package;
  return <Icon className={className} />;
}

// ─── Component ──────────────────────────────────────────────────────────
export default function WishDetailView() {
  const { wishId } = useParams<{ wishId: string }>();
  const navigate = useNavigate();
  const { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete } = useApi();
  const { toast } = useToast();
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [wish, setWish] = useState<WishDetail | null>(null);
  const [allCapabilities, setAllCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchQuery, setMatchQuery] = useState('');
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [matchScore, setMatchScore] = useState<{ match_score: number; capabilities: any[]; best_matches: any[] } | null>(null);

  useEffect(() => {
    setStaticSegments([{ label: 'Wishlist', path: '/wishlist' }]);
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const fetchWish = useCallback(async () => {
    if (!wishId) return;
    setLoading(true);
    try {
      const [wishResp, capsResp] = await Promise.all([
        apiGet<WishDetail>(`/api/dpz/wishlist/${wishId}`),
        apiGet<any>('/api/dpz/capabilities'),
      ]);
      if (!wishResp.error && wishResp.data) {
        setWish(wishResp.data);
        setDynamicTitle(wishResp.data.title);
      }
      if (!capsResp.error && capsResp.data?.items) {
        setAllCapabilities(capsResp.data.items);
      }
      // Fetch match score
      const scoreResp = await apiGet<any>(`/api/dpz/wishlist/${wishId}/match-score`);
      if (!scoreResp.error && scoreResp.data) {
        setMatchScore(scoreResp.data);
      }
    } catch {} finally { setLoading(false); }
  }, [wishId, apiGet, setDynamicTitle]);

  useEffect(() => { fetchWish(); }, [fetchWish]);

  const handleUpvote = async () => {
    if (!wish) return;
    const resp = await apiPost<any>(`/api/dpz/wishlist/${wish.id}/upvote`, {});
    if (!resp.error) {
      toast({ title: '\uD83D\uDC4D Upvoted!' });
      fetchWish();
    }
  };

  const toggleCapability = async (capId: string) => {
    if (!wish) return;
    const current = wish.capabilities.map(c => c.id);
    const next = current.includes(capId)
      ? current.filter(id => id !== capId)
      : [...current, capId];
    const resp = await apiPut<any>(`/api/dpz/wishlist/${wish.id}/capabilities`, {
      capability_ids: next,
    });
    if (!resp.error) fetchWish();
  };

  if (loading) {
    return (
      <div className="py-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted/50 animate-pulse rounded" />
        <div className="h-64 bg-muted/50 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!wish) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Wish not found</h2>
        <Button variant="ghost" className="mt-3" onClick={() => navigate('/wishlist')}>Back to Wishlist</Button>
      </div>
    );
  }

  const priBadge = PRIORITY_BADGE[wish.priority] || PRIORITY_BADGE.medium;
  const statusBadge = STATUS_BADGE[wish.status] || STATUS_BADGE.open;
  const StatusIcon = statusBadge.icon;

  // Group capabilities by category
  const capsByCategory = allCapabilities.reduce<Record<string, Capability[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});
  const linkedCapIds = new Set(wish.capabilities.map(c => c.id));

  return (
    <div className="py-6 max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => navigate('/wishlist')}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Wishlist
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{wish.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-[10px] font-mono uppercase border-0 px-2 py-0.5 gap-1', statusBadge.color)}>
              <StatusIcon className="h-3 w-3" /> {statusBadge.label}
            </Badge>
            <Badge className={cn('text-[10px] font-mono uppercase border-0 px-2 py-0.5', priBadge.color)}>
              {priBadge.label}
            </Badge>
            {wish.category && (
              <Badge variant="outline" className="text-[10px] font-mono">{wish.category}</Badge>
            )}
          </div>
        </div>
        <Button onClick={handleUpvote} variant="outline" className="gap-2 shrink-0">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-lg font-bold">{wish.upvotes}</span>
        </Button>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div className="space-y-6">
          {/* Description */}
          {wish.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{wish.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Capabilities */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Required Capabilities
                </CardTitle>
                <Dialog open={capDialogOpen} onOpenChange={setCapDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      <Plus className="h-3 w-3" /> Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Tag Required Capabilities</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mb-4">
                      What technical capabilities does this wish depend on?
                    </p>
                    {Object.entries(capsByCategory).map(([cat, caps]) => (
                      <div key={cat} className="mb-4">
                        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                          {CAP_CATEGORY_LABELS[cat] || cat}
                        </h3>
                        <div className="grid gap-1.5">
                          {caps.map(cap => {
                            const active = linkedCapIds.has(cap.id);
                            return (
                              <button
                                key={cap.id}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-all text-sm',
                                  active
                                    ? 'bg-primary/5 border-primary/30'
                                    : 'hover:bg-muted/50'
                                )}
                                onClick={() => toggleCapability(cap.id)}
                              >
                                <CapIcon name={cap.icon} className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn('font-medium', active && 'text-primary')}>{cap.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{cap.description}</p>
                                </div>
                                {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {wish.capabilities.length > 0 ? (
                <div className="grid gap-2">
                  {wish.capabilities.map(cap => (
                    <div
                      key={cap.id}
                      className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CapIcon name={cap.icon} className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{cap.name}</p>
                        <p className="text-[11px] text-muted-foreground">{cap.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {CAP_CATEGORY_LABELS[cap.category] || cap.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">No capabilities tagged yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setCapDialogOpen(true)} className="gap-1">
                    <Plus className="h-3 w-3" /> Add capabilities
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coverage Score */}
          {matchScore && matchScore.capabilities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Capability Coverage Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Score ring */}
                <div className="flex items-center gap-6 mb-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        className={matchScore.match_score >= 80 ? 'stroke-green-500' : matchScore.match_score >= 40 ? 'stroke-amber-500' : 'stroke-red-500'}
                        strokeWidth="3" strokeDasharray={`${matchScore.match_score} ${100 - matchScore.match_score}`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{matchScore.match_score}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {matchScore.capabilities.filter(c => c.covered).length} of {matchScore.capabilities.length} capabilities covered
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {matchScore.match_score >= 80 ? 'Strong coverage — existing assets address most needs'
                       : matchScore.match_score >= 40 ? 'Partial coverage — some capabilities need new builds'
                       : 'Low coverage — significant gap, new build recommended'}
                    </p>
                  </div>
                </div>
                {/* Per-capability coverage */}
                <div className="space-y-1.5">
                  {matchScore.capabilities.map(c => (
                    <div key={c.slug} className="flex items-center gap-2 text-sm">
                      {c.covered ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      )}
                      <span className={c.covered ? '' : 'text-muted-foreground'}>{c.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {c.asset_count} asset{c.asset_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Best matching assets */}
                {matchScore.best_matches.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Best Matches</p>
                    <div className="space-y-1.5">
                      {matchScore.best_matches.map(b => (
                        <button
                          key={b.id}
                          className="flex items-center gap-2 w-full text-left rounded-lg border p-2.5 hover:border-primary/20 transition-colors text-sm"
                          onClick={() => navigate(`/assets/${b.id}`)}
                        >
                          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="flex-1 truncate font-medium">{b.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                            {b.coverage_pct}% match
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linked asset (match) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {wish.linked_asset ? 'Matched Asset' : 'Match to Asset'}
                </CardTitle>
                {!wish.linked_asset && (
                  <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs gap-1">
                        <Link2 className="h-3 w-3" /> Find Match
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Match Wish to Asset</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground mb-3">
                        Search for an existing asset that addresses this wish.
                      </p>
                      <input
                        className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
                        placeholder="Search assets..."
                        value={matchQuery}
                        onChange={async (e) => {
                          setMatchQuery(e.target.value);
                          if (e.target.value.length >= 2) {
                            const resp = await apiGet<any>(`/api/dpz/search?q=${encodeURIComponent(e.target.value)}`);
                            if (!resp.error) setMatchResults((resp.data?.results || []).filter((r: any) => r.type === 'asset'));
                          } else {
                            setMatchResults([]);
                          }
                        }}
                      />
                      <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                        {matchResults.map((r: any) => (
                          <button
                            key={r.id}
                            className="flex items-center gap-3 w-full rounded-lg border p-3 text-left hover:border-primary/20 transition-colors text-sm"
                            onClick={async () => {
                              const resp = await apiPost<any>(`/api/dpz/wishlist/${wish.id}/match`, { asset_id: r.id });
                              if (!resp.error) {
                                toast({ title: 'Matched!', description: `Linked to ${r.title}` });
                                setMatchDialogOpen(false);
                                setMatchQuery('');
                                fetchWish();
                              }
                            }}
                          >
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{r.title}</p>
                              <p className="text-[11px] text-muted-foreground">{r.description}</p>
                            </div>
                          </button>
                        ))}
                        {matchQuery.length >= 2 && matchResults.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-4">No assets found</p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {wish.linked_asset ? (
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-3 rounded-lg border p-3 w-full text-left hover:border-primary/20 transition-colors"
                    onClick={() => navigate(`/assets/${wish.linked_asset!.id}`)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{wish.linked_asset.name}</p>
                      <p className="text-[11px] text-muted-foreground">{wish.linked_asset.type_name}</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">View</Badge>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground gap-1"
                    onClick={async () => {
                      const resp = await apiDelete<any>(`/api/dpz/wishlist/${wish.id}/match`);
                      if (!resp.error) {
                        toast({ title: 'Unmatched' });
                        fetchWish();
                      }
                    }}
                  >
                    <Unlink className="h-3 w-3" /> Remove match
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg">
                  <Link2 className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">No asset matched yet</p>
                  <Button variant="outline" size="sm" onClick={() => setMatchDialogOpen(true)} className="gap-1">
                    <Search className="h-3 w-3" /> Find matching asset
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Submitted by</p>
                <p className="text-sm">{wish.created_by}</p>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Signals</p>
                <p className="text-sm font-semibold">{wish.signals_count} people interested</p>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                <p className="text-sm">
                  {wish.created_at ? new Date(wish.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  }) : 'Unknown'}
                </p>
              </div>
              {wish.updated_at && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Updated</p>
                    <p className="text-sm">
                      {new Date(wish.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Platform mapping (for logged-in admin context) */}
          {wish.capabilities.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Platform Mapping</p>
                <div className="space-y-1.5">
                  {wish.capabilities.map(cap => (
                    <div key={cap.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{cap.name}</span>
                      <span className="font-mono text-[10px] text-primary/70 shrink-0 ml-2">{cap.platform_feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
