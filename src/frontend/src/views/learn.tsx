import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, ExternalLink, FileText, GitBranch, Megaphone,
  BookOpen, Search, Filter, Calendar, Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

// ─── Types ──────────────────────────────────────────────────────────────
interface LearnItem {
  id: string;
  title: string;
  description: string;
  source: 'blog' | 'repo' | 'release' | 'howto' | 'external';
  url: string;
  tags?: string[];
  date?: string;
  author?: string;
}

const SOURCE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  blog:     { label: 'Blog',          icon: FileText,  color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  repo:     { label: 'Repository',    icon: GitBranch, color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  release:  { label: 'Release Note',  icon: Megaphone, color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  howto:    { label: 'How-To',        icon: BookOpen,  color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  external: { label: 'External',      icon: ExternalLink, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const FILTER_TABS = [
  { id: null, label: 'All' },
  { id: 'blog', label: 'Blogs' },
  { id: 'repo', label: 'Repos' },
  { id: 'release', label: 'Releases' },
  { id: 'howto', label: 'How-Tos' },
];

// ─── Static seed content (will be replaced by API) ──────────────────
const SEED_CONTENT: LearnItem[] = [
  {
    id: '1', title: 'Building AI Agents on Databricks',
    description: 'End-to-end guide for building, evaluating, and deploying AI agents using MLflow, Unity Catalog, and Model Serving.',
    source: 'howto', url: '#', tags: ['agents', 'mlflow', 'serving'], date: '2026-08-15', author: 'Platform Team',
  },
  {
    id: '2', title: 'Lakebase Autoscale: Zero-to-Production',
    description: 'How to set up Lakebase Autoscale with scale-to-zero, branching, and reverse ETL for your Databricks Apps.',
    source: 'blog', url: '#', tags: ['lakebase', 'apps', 'postgres'], date: '2026-08-20', author: 'Data Engineering',
  },
  {
    id: '3', title: 'dpz-builder-hub',
    description: 'Source repository for the DPZ Builder Hub — internal enablement and asset management platform.',
    source: 'repo', url: 'https://github.com/kevin-ippen/dpz-builder-hub', tags: ['hub', 'react', 'fastapi'], date: '2026-08-31',
  },
  {
    id: '4', title: 'SOA Marketing Agent v16 Released',
    description: 'Deploy gate passed — all 3 deterministic scorers at 1.000, 35/35 stress battery, 25% faster latency.',
    source: 'release', url: '#', tags: ['soa', 'agents', 'eval'], date: '2026-05-30',
  },
  {
    id: '5', title: 'Metric Views: Semantic Layer for Everything',
    description: 'How to define governed business metrics in YAML and reuse them across dashboards, notebooks, SQL, and AI tools.',
    source: 'howto', url: '#', tags: ['metrics', 'governance', 'sql'], date: '2026-07-10', author: 'Analytics Team',
  },
  {
    id: '6', title: 'Crystal Ball Forecast: Governed Canary Rollout',
    description: 'Production governance pattern — canary rollout with WMAPE-based automatic rollback and cost guardrails.',
    source: 'blog', url: '#', tags: ['mlops', 'governance', 'forecasting'], date: '2026-07-22', author: 'ML Platform',
  },
];

// ─── Learn Card ─────────────────────────────────────────────────────
function LearnCard({ item }: { item: LearnItem }) {
  const cfg = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.external;
  const Icon = cfg.icon;
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
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('text-[9px] font-mono uppercase px-1.5 py-0 border-0', cfg.color)}>
                {cfg.label}
              </Badge>
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
            {item.tags && item.tags.length > 0 && (
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

// ─── Learn View ─────────────────────────────────────────────────────
export default function LearnView() {
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [items] = useState<LearnItem[]>(SEED_CONTENT);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Learn');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  const filtered = items.filter(item => {
    if (sourceFilter && item.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q)
        || (item.tags || []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

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
            Guides, repos, and release notes
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Everything the team has published — blogs, code repositories, how-to guides, and release
            announcements — all in one searchable hub.
          </p>
        </div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search guides, repos, releases..."
            className="pl-9 h-10 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => (
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
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <LearnCard key={item.id} item={item} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16 text-muted-foreground">
            <GraduationCap className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No content matches your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
