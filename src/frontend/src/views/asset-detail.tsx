import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle,
  MapPin, Globe, Calendar, User, Tag, FileJson,
  Blocks, Building2, Database, ExternalLink, Shield,
  TrendingUp, CheckCircle2, X, Clock, Link2,
  AlertTriangle, Activity, ThumbsUp, Zap,
  Bot, Plug, MessageCircle, FileCode, Package,
  LayoutDashboard, GitBranch, BookOpen, Copy,
  Lightbulb, FlaskConical, Users, Award, Play,
  Server, Table2, Cpu, Terminal, ChevronRight,
  Hand, Beaker, Eye, Rocket, Check, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TabsDetailSkeleton } from '@/components/common/list-view-skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import DomainBadgeList from '@/components/ui/domain-badge-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetRead } from '@/types/asset';



import { useTranslation } from 'react-i18next';
import { useApi } from '@/hooks/use-api';
import { RelativeDate } from '@/components/common/relative-date';
import { OwnershipPanel } from '@/components/common/ownership-panel';
import { CommentSidebar } from '@/components/comments';
import { RatingPanel } from '@/components/ratings';


import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/stores/permissions-store';
import { FeatureAccessLevel } from '@/types/settings';
import useBreadcrumbStore from '@/stores/breadcrumb-store';
import { MaturityContract } from '@/components/assets/maturity-contract';
import { MATURITY_ORDER } from '@/components/assets/asset-card';
import { SimilarAssets } from '@/components/assets/similar-assets';
import { VersionTimeline } from '@/components/assets/version-timeline';
import { SignalTimeline } from '@/components/assets/signal-timeline';
import { EvidenceScoreCard } from '@/components/assets/evidence-score-card';
import { ImageCarousel } from '@/components/assets/image-carousel';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  active: 'default',
  deprecated: 'secondary',
  archived: 'destructive',
};

function PropertyValue({ value }: { value: any }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>;
  }
  if (typeof value === 'object') {
    return (
      <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40 font-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-sm">{String(value)}</span>;
}

function PropertiesCard({ properties }: { properties?: Record<string, any> | null }) {
  if (!properties || Object.keys(properties).length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Properties
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {Object.entries(properties).map(([key, value]) => (
            <div key={key} className="grid grid-cols-3 gap-2 items-start">
              <Label className="text-sm font-medium text-muted-foreground col-span-1 pt-1">
                {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Label>
              <div className="col-span-2">
                <PropertyValue value={value} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Type-specific context card ─── */
const TYPE_ICON: Record<string, any> = {
  Agent: Bot, 'MCP Server': Plug, 'Genie Space': MessageCircle,
  Pipeline: Server, Stream: Server, Notebook: FileCode,
  Library: Package, Dashboard: LayoutDashboard, Repository: GitBranch,
  Cookbook: BookOpen, Template: Copy, App: Play, 'ML Model': Cpu,
  Table: Table2, Dataset: Database, Skill: Terminal,
};

const TYPE_FIELDS: Record<string, { key: string; label: string; mono?: boolean }[]> = {
  Agent: [
    { key: 'target_model', label: 'Model' },
    { key: 'tools_needed', label: 'Tools' },
    { key: 'endpoint_name', label: 'Endpoint' },
    { key: 'framework', label: 'Framework' },
  ],
  'MCP Server': [
    { key: 'tools_exposed', label: 'Tools exposed' },
    { key: 'protocol_version', label: 'Protocol' },
    { key: 'transport', label: 'Transport' },
    { key: 'connected_agents', label: 'Connected agents' },
  ],
  'Genie Space': [
    { key: 'genie_space_id', label: 'Space ID', mono: true },
    { key: 'tables', label: 'Tables' },
    { key: 'certified_queries', label: 'Certified queries' },
    { key: 'avg_questions_per_week', label: 'Avg questions/week' },
  ],
  Stream: [
    { key: 'schedule', label: 'Schedule' },
    { key: 'tables_written', label: 'Tables written' },
    { key: 'avg_runtime_min', label: 'Avg runtime' },
    { key: 'source', label: 'Source', mono: true },
    { key: 'dlt_pipeline_id', label: 'Pipeline ID', mono: true },
  ],
  Notebook: [
    { key: 'notebook_id', label: 'Notebook ID', mono: true },
    { key: 'language', label: 'Language' },
    { key: 'runtime', label: 'Runtime' },
    { key: 'parameters', label: 'Parameters' },
    { key: 'parameterized', label: 'Parameterized' },
  ],
  Library: [
    { key: 'package_name', label: 'Package', mono: true },
    { key: 'latest_version', label: 'Version' },
    { key: 'install', label: 'Install', mono: true },
    { key: 'python_requires', label: 'Python' },
    { key: 'downloads_last_30d', label: 'Downloads (30d)' },
  ],
  Dashboard: [
    { key: 'visualization_type', label: 'Type' },
    { key: 'refresh_interval_sec', label: 'Refresh (sec)' },
    { key: 'data_sources', label: 'Sources' },
  ],
  Template: [
    { key: 'template_engine', label: 'Engine' },
    { key: 'languages', label: 'Languages' },
    { key: 'includes', label: 'Files included' },
    { key: 'times_used', label: 'Times used' },
  ],
  'ML Model': [
    { key: 'model_name', label: 'Model name', mono: true },
    { key: 'endpoint_name', label: 'Endpoint', mono: true },
    { key: 'framework', label: 'Framework' },
    { key: 'metrics', label: 'Metrics' },
  ],
  App: [
    { key: 'app_url', label: 'URL' },
    { key: 'framework', label: 'Framework' },
    { key: 'active_users', label: 'Active users' },
  ],
};

function TypeContextCard({ typeName, properties }: { typeName: string; properties?: Record<string, any> | null }) {
  const fields = TYPE_FIELDS[typeName];
  if (!fields || !properties) return null;
  const populated = fields.filter(f => {
    const v = properties[f.key];
    return v !== null && v !== undefined && v !== '';
  });
  if (populated.length === 0) return null;

  const Icon = TYPE_ICON[typeName] || Blocks;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {typeName} Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {populated.map(f => {
            const val = properties[f.key];
            const display = Array.isArray(val) ? val.join(', ') : String(val);
            return (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <p className={`text-sm mt-1 ${f.mono ? 'font-mono' : ''} truncate`} title={display}>{display}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Lifecycle rail (horizontal stepper) ─── */
const LIFECYCLE_STEPS = [
  { id: 'idea', label: 'Idea', gate: 'triaged →' },
  { id: 'poc', label: 'Prototype', gate: 'validated →' },
  { id: 'validating', label: 'Validating', gate: 'promoted →' },
  { id: 'production', label: 'Production', gate: '' },
];

function LifecycleRail({ maturity }: { maturity: string }) {
  const currentIdx = LIFECYCLE_STEPS.findIndex(s => s.id === maturity);
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground mb-2.5">Lifecycle</div>
      <div className="flex gap-0">
        {LIFECYCLE_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const now = i === currentIdx;
          return (
            <div key={step.id} className="flex-1 min-w-0">
              <div className={`h-1 rounded-full mb-1.5 ${i > 0 ? 'ml-1' : ''} ${
                now ? 'bg-primary' : done ? 'bg-muted-foreground/30' : 'bg-muted/60'
              }`} />
              <div className={`text-xs ${i > 0 ? 'pl-1' : ''} ${
                now ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}>{step.label}</div>
              {step.gate && (
                <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{step.gate}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Contract band (the trust-setting component) ─── */
const CONTRACT_DATA: Record<string, {
  headline: string;
  borderClass: string; headBg: string; headText: string;
  get: string[]; dont: string[];
  terms: string;
}> = {
  idea: {
    headline: 'This is an idea. No code exists.',
    borderClass: 'border-amber-200 dark:border-amber-800',
    headBg: 'bg-amber-50 dark:bg-amber-950/40',
    headText: 'text-amber-800 dark:text-amber-300',
    terms: 'IDEA TERMS',
    get: [
      'Read the description and understand the concept.',
      'Back it \u2014 backing decides what gets triaged first.',
      'Comment with the use case that makes it yours too.',
    ],
    dont: [
      'Nothing to run, install, or call.',
      'No owner has committed to build it.',
      'May be merged into a similar initiative.',
    ],
  },
  poc: {
    headline: 'Code exists. Nothing is promised.',
    borderClass: 'border-border',
    headBg: 'bg-muted/50',
    headText: 'text-foreground',
    terms: 'PROTOTYPE TERMS',
    get: [
      'Read the code and run it in your own sandbox.',
      "The author's own list of limits, signed below.",
      'A maintainer who answers best-effort.',
    ],
    dont: [
      'No eval, no SLA, no on-call \u2014 it can break silently.',
      'May read production data \u2014 check your own grants first.',
      'No commitment to keep the interface stable.',
    ],
  },
  validating: {
    headline: 'In validation. Being tested against a real decision.',
    borderClass: 'border-blue-200 dark:border-blue-800',
    headBg: 'bg-blue-50 dark:bg-blue-950/40',
    headText: 'text-blue-800 dark:text-blue-300',
    terms: 'PILOT TERMS',
    get: [
      'A frozen interface for the length of the pilot.',
      'Eval results republished on every change.',
      'Two maintainers and a two-day response target.',
    ],
    dont: [
      'Not supported outside the pilot teams.',
      'Numbers are for review, not for the board deck.',
      'Can still be withdrawn if the pilot fails.',
    ],
  },
  production: {
    headline: 'Supported. On-call, with SLA.',
    borderClass: 'border-green-200 dark:border-green-800',
    headBg: 'bg-green-50 dark:bg-green-950/40',
    headText: 'text-green-800 dark:text-green-300',
    terms: 'SERVICE TERMS',
    get: [
      'Response within one business day.',
      '90 days\u2019 notice on any breaking change.',
      'Eval published on every release; adopters alerted on regression.',
    ],
    dont: [
      'Deprecation still possible with two quarters\u2019 notice.',
      'Cost may be charged back above threshold.',
      'Not tier-1 unless explicitly upgraded.',
    ],
  },
  certified: {
    headline: 'Certified. Approved for broad organizational use.',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    headBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    headText: 'text-emerald-800 dark:text-emerald-300',
    terms: 'CERTIFIED TERMS',
    get: [
      'Passed formal review with compliance guarantees.',
      'Full audit trail and certification seal.',
      'Covered by organizational SLA and support.',
    ],
    dont: [
      'Recertification required on schedule.',
      'Changes go through formal change management.',
      'Deprecation requires successor to be named first.',
    ],
  },
};

function ContractBand({ maturity, asset }: { maturity: string; asset: Record<string, any> }) {
  const data = CONTRACT_DATA[maturity];
  if (!data) return null;
  return (
    <div className={`rounded-xl border overflow-hidden ${data.borderClass}`}>
      <div className={`flex items-baseline justify-between px-4 py-3 border-b ${data.borderClass} ${data.headBg}`}>
        <span className={`text-sm font-semibold ${data.headText}`}>{data.headline}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{data.terms}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 bg-card">
        <div className="p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground mb-2">WHAT YOU GET</div>
          <ul className="space-y-1.5">
            {data.get.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
                <span className="text-muted-foreground/50 font-mono shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`p-4 border-t sm:border-t-0 sm:border-l ${data.borderClass}`}>
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground mb-2">DON'T EXPECT</div>
          <ul className="space-y-1.5">
            {data.dont.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
                <span className="text-muted-foreground/50 font-mono shrink-0">×</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Hypothesis callout for idea/poc */}
      {(maturity === 'idea' || maturity === 'poc') && asset.value_hypothesis && (
        <div className={`px-4 py-3 border-t ${data.borderClass} bg-card`}>
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground mb-1">VALUE HYPOTHESIS</div>
          <p className="text-sm italic text-muted-foreground">\"{asset.value_hypothesis}\"</p>
        </div>
      )}
    </div>
  );
}

/* ─── Stage-appropriate action buttons ─── */
const STAGE_ACTIONS: Record<string, { primary: string; secondary: string; note: string }> = {
  idea: { primary: 'Back this idea', secondary: 'Claim as owner', note: 'Backing closes the moment this gets funded. Votes freeze as the record of who asked.' },
  poc: { primary: 'Run in my sandbox', secondary: 'Join as maintainer', note: 'One maintainer is a single point of failure. A second moves this to community-supported.' },
  validating: { primary: 'Pilot with my team', secondary: 'Read eval report', note: 'Pilot slots are capped so maintainers can hold the response target.' },
  production: { primary: 'Adopt this asset', secondary: 'Request promotion', note: 'Adopting registers your team as a dependency \u2014 you get breaking-change notice and regression alerts.' },
  certified: { primary: 'Adopt this asset', secondary: 'View audit trail', note: 'Certified assets have full organizational support and compliance guarantees.' },
};

/* ─── Gate checklist for evidence tab ─── */
const GATE_CHECKLISTS: Record<string, { title: string; items: { text: string; done: boolean; blocker?: string }[] }> = {
  idea: {
    title: 'What triage needs',
    items: [
      { text: 'A problem statement in the poster\'s own words', done: true },
      { text: 'A named audience', done: true },
      { text: 'Three or more backers', done: true },
      { text: 'An owner willing to spend a week on it', done: false },
      { text: 'Overlap with existing assets resolved', done: false },
    ],
  },
  poc: {
    title: 'What validation needs',
    items: [
      { text: 'Runnable from a clean sandbox', done: true },
      { text: 'Signed limits statement', done: false },
      { text: 'A second maintainer', done: false },
      { text: 'An eval suite with a stated pass bar', done: false },
      { text: 'One team willing to pilot against a real decision', done: false },
      { text: 'Interface frozen for the pilot window', done: false },
    ],
  },
  validating: {
    title: 'Promotion gates',
    items: [
      { text: 'Eval pass rate above 85% for two weeks', done: true },
      { text: 'Two pilot teams reporting', done: true },
      { text: 'Two maintainers named', done: true },
      { text: 'Cost under ceiling', done: true },
      { text: 'Confidence calibrated against manual reviews', done: false, blocker: 'Blocked on pilot volume' },
      { text: 'On-call rotation staffed', done: false, blocker: 'Blocked on staffing review' },
      { text: 'Known data gaps resolved or documented', done: false },
    ],
  },
};

function GateChecklist({ maturity }: { maturity: string }) {
  const gates = GATE_CHECKLISTS[maturity];
  if (!gates) return null;
  const done = gates.items.filter(i => i.done).length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            {gates.title}
          </CardTitle>
          <span className="text-[11px] font-mono text-muted-foreground">{done} of {gates.items.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {gates.items.map((item, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <div className={`mt-0.5 h-4 w-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-mono ${
              item.done
                ? 'bg-green-600 text-white'
                : 'border border-muted-foreground/30'
            }`}>
              {item.done && <Check className="h-2.5 w-2.5" />}
            </div>
            <div className="min-w-0">
              <div className={`text-[13px] ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.text}</div>
              {item.blocker && (
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">{item.blocker}</div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AssetDetailView() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<AssetRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false);
  const [evidenceSummary, setEvidenceSummary] = useState<any | null>(null);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [governance, setGovernance] = useState<any>({});
  const [promoHistory, setPromoHistory] = useState<any[]>([]);
  const [linkedWishes, setLinkedWishes] = useState<any[]>([]);
  const [staleness, setStaleness] = useState<{ score: number; label: string } | null>(null);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoNotes, setPromoNotes] = useState('');

  const { get: apiGet, post: apiPost } = useApi();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const setStaticSegments = useBreadcrumbStore((state) => state.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((state) => state.setDynamicTitle);


  const entityType = asset?.asset_type_name || 'Asset';



  const fetchAsset = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const [assetRes, evidenceRes, capsRes, govRes, promoRes, wishRes] = await Promise.all([
        apiGet<AssetRead>(`/api/assets/${assetId}`),
        apiGet<any>(`/api/dpz/evidence`),
        apiGet<any>(`/api/dpz/assets/${assetId}/capabilities`),
        apiGet<any>(`/api/dpz/assets/${assetId}/detail`),
        apiGet<any>(`/api/dpz/assets/${assetId}/promotions`),
        apiGet<any>(`/api/dpz/assets/${assetId}/wishes`),
      ]);
      if (assetRes.error) throw new Error(assetRes.error);
      const assetData = assetRes.data ?? null;
      setAsset(assetData);
      if (assetData && Array.isArray(evidenceRes.data?.items)) {
        setEvidenceSummary(evidenceRes.data.items.find((x: any) => x.id === assetData.id) ?? null);
      }
      if (!capsRes.error && capsRes.data?.items) setCapabilities(capsRes.data.items);
      if (!govRes.error && govRes.data) setGovernance(govRes.data);
      if (!promoRes.error && promoRes.data?.items) setPromoHistory(promoRes.data.items);
      if (!wishRes.error && wishRes.data?.items) setLinkedWishes(wishRes.data.items);
      // Fetch staleness for this asset
      const staleRes = await apiGet<any>('/api/dpz/staleness');
      if (!staleRes.error && staleRes.data?.by_asset && assetId) {
        setStaleness(staleRes.data.by_asset[assetId] || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load asset');
    } finally {
      setLoading(false);
    }
  }, [assetId, apiGet]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  useEffect(() => {
    if (asset) {
      setStaticSegments([
        { label: 'Explore', path: '/assets' },
      ]);
      setDynamicTitle(asset.name);

    }
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [asset, setStaticSegments, setDynamicTitle]);

  if (loading) {
    // Asset Detail uses a tabbed layout (Overview / Relationships / Lineage /
    // Impact) above a hero title row. Match that structure.
    return <TabsDetailSkeleton tabs={1} actionButtons={2} contentVariant="two-col" />;
  }

  if (error || !asset) {
    return (
      <div className="py-6 space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)} size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Asset not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate(-1)} size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <CommentSidebar
            entityType="asset"
            entityId={assetId!}
            isOpen={isCommentSidebarOpen}
            onToggle={() => setIsCommentSidebarOpen(!isCommentSidebarOpen)}
            className="h-8"
          />

        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <Badge variant={STATUS_VARIANT[asset.status] ?? 'outline'}>
            {asset.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">{entityType}</Badge>
          {asset.platform && (
            <>
              <span className="text-muted-foreground">&middot;</span>
              <span>{asset.platform}</span>
            </>
          )}
        </div>
        {asset.description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{asset.description}</p>
        )}
        {/* Compact status badges (health + staleness only — maturity is in the rail now) */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(asset as any).operational_health && (asset as any).operational_health !== 'unknown' && (
            <Badge variant={(asset as any).operational_health === 'healthy' ? 'default' : 'destructive'}
              className={`text-xs ${(asset as any).operational_health === 'healthy' ? 'bg-green-600' : ''}`}>
              {(asset as any).operational_health}
            </Badge>
          )}
          {staleness && staleness.label !== 'active' && (
            <Badge
              variant="outline"
              className={`text-xs gap-1 ${staleness.label === 'stale' ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' : 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'}`}
            >
              <AlertTriangle className="h-3 w-3" />
              {staleness.label} ({Math.round(staleness.score * 100)}%)
            </Badge>
          )}
        </div>

        {/* Capability tags */}
        {capabilities.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Blocks className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {capabilities.map((cap: any) => {
              const catColor = cap.category === 'data' ? 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800'
                : cap.category === 'ai' ? 'bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800'
                : 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800';
              return (
                <Badge key={cap.slug} variant="outline" className={`text-[10px] font-medium ${catColor}`}>
                  {cap.name}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Lifecycle rail + Contract band */}
      <LifecycleRail maturity={(asset as any).maturity || 'idea'} />
      <ContractBand maturity={(asset as any).maturity || 'idea'} asset={asset as any} />

      {/* 2-column layout: main + rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Main column */}
      <div className="min-w-0 space-y-6">

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="governance">
            <Shield className="h-3 w-3 mr-1" />Governance
          </TabsTrigger>
          <TabsTrigger value="evidence">
            <TrendingUp className="h-3 w-3 mr-1" />Evidence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Core metadata card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {asset.location && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Location
                    </Label>
                    <p className="text-sm font-mono mt-1 truncate">{asset.location}</p>
                  </div>
                )}
                {asset.platform && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Platform
                    </Label>
                    <p className="text-sm mt-1">{asset.platform}</p>
                  </div>
                )}
                {((asset.domains && asset.domains.length > 0) || asset.domain_id) && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {asset.domains && asset.domains.length > 1 ? 'Domains' : 'Domain'}
                    </Label>
                    <div className="mt-1">
                      <DomainBadgeList
                        domains={asset.domains}
                        domainIds={asset.domain_id ? [asset.domain_id] : []}
                        primaryDomainId={asset.primary_domain_id ?? asset.domain_id}
                        onDomainClick={undefined}
                      />
                    </div>
                  </div>
                )}
                {asset.created_by && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Created By
                    </Label>
                    <p className="text-sm mt-1">{asset.created_by}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Created
                  </Label>
                  <div className="text-sm mt-1">
                    <RelativeDate date={asset.created_at} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Updated
                  </Label>
                  <div className="text-sm mt-1">
                    <RelativeDate date={asset.updated_at} />
                  </div>
                </div>
              </div>

              {/* Tags */}
              {asset.tags && asset.tags.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <Tag className="h-3 w-3" /> Tags
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}


            </CardContent>
          </Card>

          {/* Type-specific context */}
          <TypeContextCard typeName={entityType} properties={asset.properties as any} />

          {/* Properties (raw fallback for anything not covered above) */}
          <PropertiesCard properties={asset.properties} />

        </TabsContent>

        {/* ─── Governance Tab ─── */}
        <TabsContent value="governance" className="mt-4 space-y-6">
          {(governance.owner_email || governance.team || governance.uc_catalog || governance.jira_key || governance.sla_tier) ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Enterprise Metadata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {governance.owner_email && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Owner</Label>
                      <p className="text-sm mt-1">{governance.owner_email}</p>
                    </div>
                  )}
                  {governance.team && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Team</Label>
                      <p className="text-sm mt-1">{governance.team}</p>
                    </div>
                  )}
                  {governance.domain && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Domain</Label>
                      <p className="text-sm mt-1">{governance.domain}</p>
                    </div>
                  )}
                  {governance.uc_catalog && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" /> UC Path</Label>
                      <p className="text-sm font-mono mt-1">
                        {governance.uc_catalog}
                        {governance.uc_schema ? `.${governance.uc_schema}` : ''}
                        {governance.uc_table ? `.${governance.uc_table}` : ''}
                      </p>
                    </div>
                  )}
                  {governance.jira_key && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Jira</Label>
                      <p className="text-sm font-mono mt-1">{governance.jira_key}</p>
                    </div>
                  )}
                  {governance.sla_tier && governance.sla_tier !== 'none' && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> SLA Tier</Label>
                      <Badge variant="outline" className="text-xs mt-1">{governance.sla_tier}</Badge>
                    </div>
                  )}
                  {governance.cost_center && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Cost Center</Label>
                      <p className="text-sm font-mono mt-1">{governance.cost_center}</p>
                    </div>
                  )}
                  {governance.business_impact && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Business Impact</Label>
                      <Badge variant="secondary" className="text-xs mt-1">{governance.business_impact}</Badge>
                    </div>
                  )}
                  {governance.target_audience && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Target Audience</Label>
                      <p className="text-sm mt-1">{governance.target_audience}</p>
                    </div>
                  )}
                  {governance.slack_channel && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Slack</Label>
                      <p className="text-sm font-mono mt-1">{governance.slack_channel}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No governance metadata configured yet.</p>
            </div>
          )}
        </TabsContent>

        {/* ─── Evidence Tab (stage-gated) ─── */}
        <TabsContent value="evidence" className="mt-4 space-y-6">
          {(asset as any).maturity === 'idea' ? (
            /* Ideas: no signals exist */
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-3xl font-bold text-muted-foreground/30 mb-2">—</div>
                <p className="text-sm text-muted-foreground">No signals. An idea has nothing running to measure.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Evidence starts accruing the day code lands.</p>
              </CardContent>
            </Card>
          ) : (asset as any).maturity === 'poc' ? (
            /* POC: first signals + "sufficient for this stage" */
            <>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-end gap-4">
                    <span className="text-2xl font-bold text-amber-600">Sufficient</span>
                    <span className="text-xs text-muted-foreground mb-1">Complete for a prototype: it runs, and its limits are signed.</span>
                  </div>
                </CardContent>
              </Card>
              <EvidenceScoreCard
                evidenceScore={evidenceSummary?.evidence_score}
                signalTypes={evidenceSummary?.signal_types}
                totalSignals={evidenceSummary?.total_signals}
                lastSignalAt={evidenceSummary?.last_signal_at}
              />
              <SignalTimeline assetId={asset.id} />
            </>
          ) : (
            /* Validating + Production: full evidence */
            <>
              <EvidenceScoreCard
                evidenceScore={evidenceSummary?.evidence_score}
                signalTypes={evidenceSummary?.signal_types}
                totalSignals={evidenceSummary?.total_signals}
                lastSignalAt={evidenceSummary?.last_signal_at}
              />
              <SignalTimeline assetId={asset.id} />
            </>
          )}
          {/* Gate checklist (idea/poc/validating only) */}
          <GateChecklist maturity={(asset as any).maturity || 'idea'} />
        </TabsContent>

      </Tabs>

      {/* Ownership Panel */}
      <OwnershipPanel objectType="asset" objectId={assetId!} canAssign={false} className="mb-6" />

      {/* Ratings Panel */}
      <RatingPanel
        entityType="asset"
        entityId={assetId!}
        title="Ratings & Reviews"
        showDistribution
        allowSubmit
      />

      </div>{/* end main column */}

      {/* Right rail — sticky */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        {/* Operational Status card */}
        <div className="rounded-xl border p-4 space-y-3">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Status
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="text-lg font-bold">{(asset as any).install_count ?? 0}</div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Adopters</div>
            </div>
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="text-lg font-bold">{evidenceSummary?.evidence_score ?? 0}%</div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Evidence</div>
            </div>
            <div className="text-center rounded-lg bg-muted/50 p-2">
              <div className="text-lg font-bold">{evidenceSummary?.total_signals ?? 0}</div>
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Signals</div>
            </div>
            <div className="text-center rounded-lg bg-muted/50 p-2">
              {staleness ? (
                <>
                  <div className={`text-lg font-bold ${staleness.label === 'stale' ? 'text-red-500' : staleness.label === 'cooling' ? 'text-amber-500' : 'text-green-500'}`}>
                    {staleness.label === 'active' ? '●' : staleness.label === 'cooling' ? '◐' : '○'}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground uppercase">{staleness.label}</div>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold text-green-500">●</div>
                  <div className="text-[9px] font-mono text-muted-foreground uppercase">Active</div>
                </>
              )}
            </div>
          </div>
          {(asset as any).latest_version && (
            <div className="flex items-center justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground">Latest version</span>
              <Badge variant="outline" className="text-[9px] font-mono">{(asset as any).latest_version}</Badge>
            </div>
          )}
        </div>

        {/* Image carousel */}
        <ImageCarousel assetId={asset.id} />

        {/* Stage-appropriate actions */}
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Actions</h3>
          {(() => {
            const stageActions = STAGE_ACTIONS[(asset as any).maturity || 'idea'] || STAGE_ACTIONS.production;
            return (
              <>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={async () => {
                    const resp = await apiPost<any>('/api/dpz/install', { asset_id: asset.id });
                    if (!resp.error) toast({ title: (asset as any).maturity === 'idea' ? 'Backed!' : 'Adopted!', description: `Install count: ${resp.data?.install_count}` });
                  }}
                >
                  {stageActions.primary}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{stageActions.note}</p>
              </>
            );
          })()}

          {/* Promotion request */}
          {(() => {
            const currentIdx = MATURITY_ORDER.indexOf((asset as any).maturity || 'idea');
            const nextMaturity = currentIdx >= 0 && currentIdx < MATURITY_ORDER.length - 1
              ? MATURITY_ORDER[currentIdx + 1] : null;
            if (!nextMaturity) return null;
            return (
              <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" size="sm" variant="outline">
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Request Promotion
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Request Maturity Promotion</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="outline">{(asset as any).maturity}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge className="bg-blue-600 text-white">{nextMaturity}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs">Justification</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Why is this asset ready for promotion?"
                        value={promoNotes}
                        onChange={(e) => setPromoNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={!promoNotes.trim()}
                      onClick={async () => {
                        const resp = await apiPost<any>('/api/dpz/promotions', {
                          asset_id: asset.id,
                          from_maturity: (asset as any).maturity,
                          to_maturity: nextMaturity,
                          notes: promoNotes,
                        });
                        if (!resp.error) {
                          toast({ title: 'Promotion requested', description: `${(asset as any).maturity} → ${nextMaturity}` });
                          setPromoDialogOpen(false);
                          setPromoNotes('');
                          // Refresh promos
                          const pr = await apiGet<any>(`/api/dpz/assets/${assetId}/promotions`);
                          if (!pr.error && pr.data?.items) setPromoHistory(pr.data.items);
                        }
                      }}
                    >
                      Submit Request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}
        </div>

        {/* Promotion history */}
        {promoHistory.length > 0 && (
          <div className="rounded-xl border p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Promotion History</h3>
            <div className="space-y-2">
              {promoHistory.map((p: any) => (
                <div key={p.id} className="flex items-start gap-2 text-xs">
                  {p.status === 'approved' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  ) : p.status === 'rejected' ? (
                    <X className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{p.from_maturity} → {p.to_maturity}</p>
                    <p className="text-muted-foreground">
                      {p.status} · {p.requested_by?.split('@')[0]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked wishes (demands this asset addresses) */}
        {linkedWishes.length > 0 && (
          <div className="rounded-xl border p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
              <Link2 className="h-3 w-3 inline mr-1" />Addresses Wishes
            </h3>
            <div className="space-y-1.5">
              {linkedWishes.map((w: any) => (
                <button
                  key={w.id}
                  className="flex items-center gap-2 w-full text-left rounded-lg p-2 hover:bg-muted/50 transition-colors text-xs"
                  onClick={() => navigate(`/wishlist/${w.id}`)}
                >
                  <span className="flex-1 truncate font-medium">{w.title}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{w.upvotes}↑</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Version timeline */}
        <VersionTimeline assetId={asset.id} />




        {/* Similar assets */}
        <SimilarAssets
          assetName={asset.name}
          assetDescription={asset.description || undefined}
          currentAssetId={asset.id}
        />




      </aside>
      </div>{/* end 2-column grid */}


    </div>
  );
}
