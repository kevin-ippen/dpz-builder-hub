import { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, ExternalLink, FileText, GitBranch, Megaphone,
  BookOpen, Search, Calendar, Plus, Users, Radio, Layers,
  Database, Bot, Shield, Layout, ChevronRight, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

// ─── Types ──────────────────────────────────────────────────────────────
interface LearnItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  tags?: string[];
  date?: string;
  author?: string;
  channel?: string;
  relevance_capabilities?: string[];
  track_slug?: string;
  track_order?: number;
}

interface Track {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  items: LearnItem[];
}

type Channel = 'team' | 'platform' | 'tracks';

const SOURCE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  blog:     { label: 'Blog',          icon: FileText,  color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  repo:     { label: 'Repository',    icon: GitBranch, color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  release:  { label: 'Release Note',  icon: Megaphone, color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  howto:    { label: 'How-To',        icon: BookOpen,  color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  external: { label: 'External',      icon: ExternalLink, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const CHANNEL_TABS: { id: Channel; label: string; icon: any; desc: string }[] = [
  { id: 'team', label: 'From Your Team', icon: Users, desc: 'Blogs, repos, and guides published by your colleagues' },
  { id: 'platform', label: 'Platform Pulse', icon: Radio, desc: 'Databricks release notes and feature announcements' },
  { id: 'tracks', label: 'Skill Tracks', icon: Layers, desc: 'Curated learning paths by domain' },
];

const TRACK_ICONS: Record<string, any> = {
  database: Database, bot: Bot, shield: Shield, layout: Layout,
};

const SOURCE_FILTER_TABS = [
  { id: null, label: 'All' },
  { id: 'blog', label: 'Blogs' },
  { id: 'repo', label: 'Repos' },
  { id: 'release', label: 'Releases' },
  { id: 'howto', label: 'How-Tos' },
];



// ─── Learn Card ─────────────────────────────────────────────────────
function LearnCard({ item, showRelevance }: { item: LearnItem; showRelevance?: boolean }) {
  const cfg = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.external;
  const Icon = cfg.icon;
  const caps = item.relevance_capabilities || [];
  return (
    <Card
      className="group overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/25 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border rounded-xl"
      onClick={() => item.url !== '#' && window.open(item.url, '_blank')}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border-0', cfg.color)}>
                {cfg.label}
              </Badge>
              {showRelevance && caps.length > 0 && (
                <Badge variant="outline" className="text-[9px] font-mono gap-1 border-primary/30 text-primary">
                  <Zap className="h-2.5 w-2.5" /> {caps.length} cap{caps.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {item.date && (
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors mb-1">
              {item.title}
              {item.url !== '#' && <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />}
            </h3>
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
              {item.description}
            </p>
            {showRelevance && caps.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {caps.slice(0, 4).map(c => (
                  <span key={c} className="px-1.5 py-0.5 text-[9px] font-mono rounded border bg-primary/5 text-primary/80 border-primary/20">
                    {c.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            {!showRelevance && item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.map(t => (
                  <span key={t} className="px-1.5 py-0.5 text-[9px] font-mono rounded border bg-muted/50 text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.author && (
              <p className="text-[10px] text-muted-foreground mt-2">
                by {item.author}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Track Card ─────────────────────────────────────────────────────
function TrackCard({ track, expanded, onToggle }: { track: Track; expanded: boolean; onToggle: () => void }) {
  const TIcon = TRACK_ICONS[track.icon] || BookOpen;
  const catColors: Record<string, string> = {
    data: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800',
    ai: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800',
    platform: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800',
  };
  return (
    <Card className="overflow-hidden border rounded-xl">
      <button className="w-full text-left p-5 hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <TIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-semibold tracking-tight">{track.title}</h3>
              <Badge className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border', catColors[track.category] || catColors.platform)}>
                {track.category}
              </Badge>
            </div>
            <p className="text-[12px] text-muted-foreground line-clamp-1">{track.description}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-mono text-muted-foreground">{track.items.length} lessons</span>
              <div className="flex items-center gap-1">
                {track.items.map((_, i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                ))}
              </div>
            </div>
          </div>
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-1', expanded && 'rotate-90')} />
        </div>
      </button>
      {expanded && (
        <div className="border-t px-5 py-4 space-y-2 bg-muted/10">
          {track.items.map((item, idx) => {
            const cfg = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.howto;
            const SIcon = cfg.icon;
            return (
              <button
                key={item.id}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary/20 hover:bg-card transition-all group/item"
                onClick={() => item.url !== '#' && window.open(item.url, '_blank')}
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-full border text-[10px] font-mono font-bold text-muted-foreground shrink-0">
                  {idx + 1}
                </div>
                <SIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover/item:text-primary transition-colors">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                </div>
                {item.url !== '#' && <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Learn View ─────────────────────────────────────────────────────
export default function LearnView() {
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();

  // Data
  const [teamItems, setTeamItems] = useState<LearnItem[]>([]);
  const [platformItems, setPlatformItems] = useState<LearnItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stats, setStats] = useState<{ team: number; platform: number; track: number }>({ team: 0, platform: 0, track: 0 });
  const [loading, setLoading] = useState(true);

  // UI
  const [channel, setChannel] = useState<Channel>('team');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSource, setNewSource] = useState('blog');
  const [newUrl, setNewUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Learn');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  // Load all channels in parallel
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [teamR, platR, tracksR, statsR] = await Promise.all([
          apiGet<any>('/api/dpz/learn?channel=team'),
          apiGet<any>('/api/dpz/learn?channel=platform'),
          apiGet<any>('/api/dpz/learn/tracks'),
          apiGet<any>('/api/dpz/learn/stats'),
        ]);
        if (!teamR.error && teamR.data?.items) setTeamItems(teamR.data.items);
        if (!platR.error && platR.data?.items) setPlatformItems(platR.data.items);
        if (!tracksR.error && tracksR.data?.tracks) setTracks(tracksR.data.tracks);
        if (!statsR.error && statsR.data) setStats(statsR.data);
      } catch {} finally { setLoading(false); }
    })();
  }, [apiGet]);

  // Filter logic
  const filterItems = (items: LearnItem[]) => items.filter(item => {
    if (sourceFilter && item.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q)
        || (item.tags || []).some(t => t.toLowerCase().includes(q))
        || (item.relevance_capabilities || []).some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredTeam = useMemo(() => filterItems(teamItems), [teamItems, sourceFilter, search]);
  const filteredPlatform = useMemo(() => filterItems(platformItems), [platformItems, sourceFilter, search]);

  const filteredTracks = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.map(t => ({
      ...t,
      items: t.items.filter(i =>
        i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
        || (i.tags || []).some(tg => tg.toLowerCase().includes(q))
      ),
    })).filter(t => t.items.length > 0 || t.title.toLowerCase().includes(q));
  }, [tracks, search]);

  const activeTab = CHANNEL_TABS.find(t => t.id === channel)!;

  return (
    <div className="py-6 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary font-bold">Learn</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            Your team, the platform, your skills
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mb-4">
            Three channels of knowledge — what your team has built, what Databricks has shipped,
            and curated learning paths to level up —
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
            <span>{stats.team} team items</span>
            <span className="w-px h-3 bg-border" />
            <span>{stats.platform} platform updates</span>
            <span className="w-px h-3 bg-border" />
            <span>{tracks.length} skill tracks</span>
          </div>
        </div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-2 border-b pb-px">
        {CHANNEL_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const active = channel === tab.id;
          return (
            <button
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
              onClick={() => { setChannel(tab.id); setSourceFilter(null); }}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
                <Plus className="h-3 w-3" /> Share Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Share with the team</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Title *</Label>
                  <Input placeholder="e.g. How We Built X" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea placeholder="Brief summary..." value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={newSource} onValueChange={setNewSource}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blog">Blog</SelectItem>
                        <SelectItem value="repo">Repository</SelectItem>
                        <SelectItem value="howto">How-To</SelectItem>
                        <SelectItem value="release">Release Note</SelectItem>
                        <SelectItem value="external">External</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Author</Label>
                    <Input placeholder="Your name or team" value={newAuthor} onChange={e => setNewAuthor(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>URL</Label>
                  <Input placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Tags (comma-separated)</Label>
                  <Input placeholder="agents, mlflow, governance" value={newTags} onChange={e => setNewTags(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!newTitle.trim()} onClick={async () => {
                  const resp = await apiPost<any>('/api/dpz/learn', {
                    title: newTitle, description: newDesc, source: newSource,
                    url: newUrl || '#', author: newAuthor || undefined,
                    tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                    channel: 'team',
                  });
                  if (!resp.error) {
                    toast({ title: 'Shared!', description: `"${newTitle}" added to Learn.` });
                    setAddOpen(false); setNewTitle(''); setNewDesc(''); setNewUrl(''); setNewTags(''); setNewAuthor('');
                    const r2 = await apiGet<any>('/api/dpz/learn?channel=team');
                    if (!r2.error && r2.data?.items) setTeamItems(r2.data.items);
                  }
                }}>
                  Publish
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Channel description + search */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{activeTab.desc}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={channel === 'tracks' ? 'Search tracks and lessons...' : 'Search content...'}
              className="pl-9 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {channel !== 'tracks' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {SOURCE_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id || 'all'}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wide transition-colors border',
                    sourceFilter === tab.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card hover:bg-muted border-border'
                  )}
                  onClick={() => setSourceFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/50" />)}
        </div>
      )}

      {/* Channel: From Your Team */}
      {!loading && channel === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTeam.map((item) => (
            <LearnCard key={item.id} item={item} />
          ))}
          {filteredTeam.length === 0 && (
            <div className="col-span-2 text-center py-16 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No team content matches your search.</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={() => setAddOpen(true)}>
                <Plus className="h-3 w-3" /> Be the first to share
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Channel: Platform Pulse */}
      {!loading && channel === 'platform' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlatform.map((item) => (
            <LearnCard key={item.id} item={item} showRelevance />
          ))}
          {filteredPlatform.length === 0 && (
            <div className="col-span-2 text-center py-16 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No platform updates match your search.</p>
            </div>
          )}
        </div>
      )}

      {/* Channel: Skill Tracks */}
      {!loading && channel === 'tracks' && (
        <div className="space-y-4">
          {filteredTracks.map((track) => (
            <TrackCard
              key={track.slug}
              track={track}
              expanded={expandedTrack === track.slug}
              onToggle={() => setExpandedTrack(expandedTrack === track.slug ? null : track.slug)}
            />
          ))}
          {filteredTracks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tracks match your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
