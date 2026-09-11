import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database, ChevronRight, ChevronDown, Check, Loader2,
  Search, FolderTree, Sparkles, Rocket, ArrowRight, ArrowLeft,
  Table2, Eye, BrainCircuit, Box, BarChart3, Shield, Lightbulb,
  Users, Target, AlertCircle, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

// ── Types ────────────────────────────────────────────────────────────────

interface ObjectMeta {
  name: string;
  object_type: string;
  path: string;
  description?: string;
  owner?: string;
  tags: string[];
  last_modified?: string;
  row_count?: number;
  has_quality_monitor: boolean;
  has_lineage: boolean;
  inferred_maturity: number;
}

interface SchemaNode {
  name: string;
  path: string;
  children_count: number;
  children: ObjectMeta[];
}

interface CatalogNode {
  name: string;
  path: string;
  children_count: number;
  schemas: SchemaNode[];
}

interface ScanResponse {
  scan_id: string;
  summary: {
    catalogs: number;
    schemas: number;
    objects: number;
    by_type: Record<string, number>;
  };
  tree: CatalogNode[];
}

interface ProposedDomain {
  name: string;
  schemas: string[];
  asset_count: number;
}

interface ProposedCapability {
  name: string;
  matched_assets: number;
  reason: string;
}

interface ProposedTeam {
  name: string;
  source: string;
  member_count: number;
  owned_assets: number;
}

interface AnalyzeResponse {
  proposed_domains: ProposedDomain[];
  proposed_capabilities: ProposedCapability[];
  proposed_teams: ProposedTeam[];
  maturity_distribution: Record<string, number>;
  quick_wins: { action: string; count: number; impact: string }[];
}

interface CommitResponse {
  created: Record<string, number>;
  duration_seconds: number;
}

type WizardStep = 'scan' | 'select' | 'review' | 'done';

const MATURITY_LABELS: Record<string, { label: string; color: string }> = {
  L1_accessible: { label: 'Accessible', color: 'bg-blue-500' },
  L2_described:  { label: 'Described',  color: 'bg-cyan-500' },
  L3_defined:    { label: 'Defined',    color: 'bg-green-500' },
  L4_monitored:  { label: 'Monitored',  color: 'bg-amber-500' },
  L5_trusted:    { label: 'Trusted',    color: 'bg-purple-500' },
};

const TYPE_ICONS: Record<string, typeof Table2> = {
  TABLE: Table2,
  VIEW: Eye,
  MODEL: BrainCircuit,
  FUNCTION: Box,
  VOLUME: Database,
  DASHBOARD: BarChart3,
};

// ── Catalog Tree Component ───────────────────────────────────────────────

function CatalogTree({
  tree, selected, onToggle, filter,
}: {
  tree: CatalogNode[];
  selected: Set<string>;
  onToggle: (path: string, type: 'catalog' | 'schema' | 'object') => void;
  filter: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const isSchemaSelected = (schema: SchemaNode) =>
    selected.has(schema.path) ||
    schema.children.every(c => selected.has(c.path));

  const isSchemaPartial = (schema: SchemaNode) =>
    !isSchemaSelected(schema) &&
    schema.children.some(c => selected.has(c.path) || selected.has(schema.path));

  const lf = filter.toLowerCase();

  return (
    <div className="space-y-1">
      {tree.map(cat => {
        const catSchemas = cat.schemas.filter(s =>
          !lf || s.name.toLowerCase().includes(lf) ||
          s.children.some(c => c.name.toLowerCase().includes(lf))
        );
        if (catSchemas.length === 0) return null;
        const isExp = expanded.has(cat.path);

        return (
          <div key={cat.path}>
            <button
              onClick={() => toggle(cat.path)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium rounded hover:bg-accent text-left"
            >
              {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Database className="w-4 h-4 text-blue-500" />
              <span className="flex-1">{cat.name}</span>
              <Badge variant="secondary" className="text-xs">{cat.children_count}</Badge>
            </button>

            {isExp && catSchemas.map(schema => {
              const schExp = expanded.has(schema.path);
              const selState = isSchemaSelected(schema);
              const partial = isSchemaPartial(schema);

              const filteredChildren = schema.children.filter(c =>
                !lf || c.name.toLowerCase().includes(lf)
              );

              return (
                <div key={schema.path} className="ml-6">
                  <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent">
                    <Checkbox
                      checked={selState ? true : partial ? 'indeterminate' : false}
                      onCheckedChange={() => onToggle(schema.path, 'schema')}
                    />
                    <button
                      onClick={() => toggle(schema.path)}
                      className="flex items-center gap-2 flex-1 text-sm text-left"
                    >
                      {schExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <FolderTree className="w-4 h-4 text-muted-foreground" />
                      <span>{schema.name}</span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {schema.children_count}
                      </Badge>
                    </button>
                  </div>

                  {schExp && (
                    <div className="ml-8 space-y-0.5">
                      {filteredChildren.map(obj => {
                        const Icon = TYPE_ICONS[obj.object_type] || Table2;
                        const checked = selected.has(obj.path) || selected.has(schema.path);
                        return (
                          <div
                            key={obj.path}
                            className={cn(
                              'flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-accent',
                              checked && 'bg-accent/50'
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => onToggle(obj.path, 'object')}
                            />
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="flex-1 truncate" title={obj.path}>
                              {obj.name}
                            </span>
                            {obj.description && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {obj.description}
                              </span>
                            )}
                            <MaturityDot level={obj.inferred_maturity} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MaturityDot({ level }: { level: number }) {
  const colors = ['', 'bg-blue-400', 'bg-cyan-400', 'bg-green-400', 'bg-amber-400', 'bg-purple-400'];
  const labels = ['', 'L1', 'L2', 'L3', 'L4', 'L5'];
  return (
    <span
      className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold', colors[level] || 'bg-gray-300')}
      title={`Maturity: ${labels[level]}`}
    >
      {labels[level]}
    </span>
  );
}

// ── Maturity Bar ─────────────────────────────────────────────────────────

function MaturityBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-2">
      {Object.entries(MATURITY_LABELS).map(([key, { label, color }]) => {
        const count = distribution[key] || 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-24 text-muted-foreground">{label}</span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-16 text-right tabular-nums">{count} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────────────────

export default function BootstrapWizardView() {
  const { get: apiGet, post: apiPost, loading } = useApi();
  const { toast } = useToast();
  const setStaticSegments = useBreadcrumbStore(s => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore(s => s.setDynamicTitle);

  const [step, setStep] = useState<WizardStep>('scan');
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  // Domain/cap/team toggles for review step
  const [enabledDomains, setEnabledDomains] = useState<Set<string>>(new Set());
  const [enabledCaps, setEnabledCaps] = useState<Set<string>>(new Set());
  const [enabledTeams, setEnabledTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStaticSegments([{ label: 'Settings', path: '/settings' }]);
    setDynamicTitle('Bootstrap Wizard');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  // ── Selection logic ──
  const onToggle = useCallback((path: string, type: 'catalog' | 'schema' | 'object') => {
    setSelected(prev => {
      const next = new Set(prev);
      if (type === 'schema') {
        // Toggle entire schema
        if (next.has(path)) {
          next.delete(path);
          // Also remove individual children if schema was selected
          const cat = scanData?.tree.find(c => c.schemas.some(s => s.path === path));
          const schema = cat?.schemas.find(s => s.path === path);
          schema?.children.forEach(c => next.delete(c.path));
        } else {
          next.add(path);
        }
      } else if (type === 'object') {
        next.has(path) ? next.delete(path) : next.add(path);
      }
      return next;
    });
  }, [scanData]);

  const selectedCount = useMemo(() => {
    if (!scanData) return 0;
    let count = 0;
    for (const cat of scanData.tree) {
      for (const schema of cat.schemas) {
        if (selected.has(schema.path)) {
          count += schema.children_count;
        } else {
          count += schema.children.filter(c => selected.has(c.path)).length;
        }
      }
    }
    return count;
  }, [scanData, selected]);

  // ── Step 1: Scan ──
  const doScan = async () => {
    setScanning(true);
    const res = await apiPost<ScanResponse>('/api/bootstrap/scan', {
      catalogs: ['*'],
      include_types: ['TABLE', 'VIEW', 'MODEL', 'FUNCTION', 'VOLUME'],
      exclude_patterns: ['*_tmp', '*_temp', '*_staging', '__*'],
    });
    setScanning(false);
    if (res.error) {
      toast({ title: 'Scan failed', description: res.error, variant: 'destructive' });
      return;
    }
    setScanData(res.data);
    // Auto-expand and move to select
    setStep('select');
  };

  // ── Step 2 → 3: Analyze ──
  const doAnalyze = async () => {
    if (!scanData) return;
    setAnalyzing(true);
    const paths = Array.from(selected);
    const res = await apiPost<AnalyzeResponse>('/api/bootstrap/analyze', {
      scan_id: scanData.scan_id,
      selected_paths: paths,
    });
    setAnalyzing(false);
    if (res.error) {
      toast({ title: 'Analysis failed', description: res.error, variant: 'destructive' });
      return;
    }
    setAnalysis(res.data);
    // Enable all proposals by default
    setEnabledDomains(new Set(res.data.proposed_domains.map(d => d.name)));
    setEnabledCaps(new Set(res.data.proposed_capabilities.map(c => c.name)));
    setEnabledTeams(new Set(res.data.proposed_teams.map(t => t.name)));
    setStep('review');
  };

  // ── Step 3 → 4: Commit ──
  const doCommit = async () => {
    if (!scanData || !analysis) return;
    setCommitting(true);
    const res = await apiPost<CommitResponse>('/api/bootstrap/commit', {
      scan_id: scanData.scan_id,
      selected_paths: Array.from(selected),
      domains: analysis.proposed_domains
        .filter(d => enabledDomains.has(d.name))
        .map(d => ({ name: d.name, schemas: d.schemas })),
      capabilities: analysis.proposed_capabilities
        .filter(c => enabledCaps.has(c.name))
        .map(c => ({ name: c.name, reason: c.reason })),
      teams: analysis.proposed_teams
        .filter(t => enabledTeams.has(t.name))
        .map(t => ({ name: t.name })),
    });
    setCommitting(false);
    if (res.error) {
      toast({ title: 'Import failed', description: res.error, variant: 'destructive' });
      return;
    }
    setCommitResult(res.data);
    setStep('done');
    toast({ title: 'Bootstrap complete', description: `Created ${res.data.created.assets} assets in ${res.data.duration_seconds}s` });
  };

  // ── Stepper Header ──
  const steps: { key: WizardStep; label: string; icon: typeof Database }[] = [
    { key: 'scan',   label: 'Discover',  icon: Database },
    { key: 'select', label: 'Select',    icon: FolderTree },
    { key: 'review', label: 'Review',    icon: Sparkles },
    { key: 'done',   label: 'Complete',  icon: Rocket },
  ];

  const stepIdx = steps.findIndex(s => s.key === step);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === stepIdx;
          const isDone = i < stepIdx;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                isActive ? 'border-primary bg-primary text-primary-foreground' :
                isDone ? 'border-green-500 bg-green-500 text-white' :
                'border-muted-foreground/30 text-muted-foreground'
              )}>
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={cn('text-sm font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {s.label}
              </span>
              {i < steps.length - 1 && <Separator className="flex-1 mx-2" />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Scan ── */}
      {step === 'scan' && (
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Bootstrap Your Workspace</CardTitle>
            <CardDescription className="text-base max-w-lg mx-auto">
              Scan your Unity Catalog to discover existing tables, views, and models.
              Then select what to bring into Builder Hub.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Database className="w-12 h-12 text-white" />
            </div>
            <Button size="lg" onClick={doScan} disabled={scanning} className="gap-2">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {scanning ? 'Scanning workspace...' : 'Scan My Workspace'}
            </Button>
            {scanning && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Enumerating catalogs, schemas, and objects...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Select ── */}
      {step === 'select' && scanData && (
        <>
          {/* Summary bar */}
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{scanData.summary.catalogs}</div>
                  <div className="text-xs text-muted-foreground">Catalogs</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{scanData.summary.schemas}</div>
                  <div className="text-xs text-muted-foreground">Schemas</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{scanData.summary.objects}</div>
                  <div className="text-xs text-muted-foreground">Objects</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                {Object.entries(scanData.summary.by_type).map(([type, count]) => {
                  const Icon = TYPE_ICONS[type] || Table2;
                  return (
                    <div key={type} className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{count} {type.toLowerCase()}s</span>
                    </div>
                  );
                })}
              </div>
              <Badge variant="default" className="text-sm">
                {selectedCount} selected
              </Badge>
            </CardContent>
          </Card>

          {/* Tree + Filter */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select Assets to Import</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter schemas or tables..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto pr-2">
                <CatalogTree
                  tree={scanData.tree}
                  selected={selected}
                  onToggle={onToggle}
                  filter={filter}
                />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('scan')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button onClick={doAnalyze} disabled={selectedCount === 0 || analyzing} className="gap-2">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : `Analyze ${selectedCount} Objects`}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Review ── */}
      {step === 'review' && analysis && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maturity Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Maturity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MaturityBar distribution={analysis.maturity_distribution} />
              </CardContent>
            </Card>

            {/* Quick Wins */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Quick Wins
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.quick_wins.length === 0 && (
                  <p className="text-sm text-muted-foreground">No quick wins identified.</p>
                )}
                {analysis.quick_wins.map((qw, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">{qw.count} objects</span>:{' '}
                      <span className="text-muted-foreground">{qw.impact}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Proposed Domains */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4" /> Proposed Domains ({analysis.proposed_domains.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.proposed_domains.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <Checkbox
                      checked={enabledDomains.has(d.name)}
                      onCheckedChange={() => {
                        setEnabledDomains(prev => {
                          const n = new Set(prev);
                          n.has(d.name) ? n.delete(d.name) : n.add(d.name);
                          return n;
                        });
                      }}
                    />
                    <span className="text-sm font-medium flex-1">{d.name}</span>
                    <Badge variant="outline" className="text-xs">{d.asset_count} assets</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Proposed Capabilities */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" /> Proposed Capabilities ({analysis.proposed_capabilities.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.proposed_capabilities.length === 0 && (
                  <p className="text-sm text-muted-foreground">No capabilities inferred from naming patterns.</p>
                )}
                {analysis.proposed_capabilities.map(c => (
                  <div key={c.name} className="flex items-center gap-3">
                    <Checkbox
                      checked={enabledCaps.has(c.name)}
                      onCheckedChange={() => {
                        setEnabledCaps(prev => {
                          const n = new Set(prev);
                          n.has(c.name) ? n.delete(c.name) : n.add(c.name);
                          return n;
                        });
                      }}
                    />
                    <span className="text-sm font-medium flex-1">{c.name}</span>
                    <Badge variant="outline" className="text-xs">{c.matched_assets} matches</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Proposed Teams */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Proposed Teams ({analysis.proposed_teams.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {analysis.proposed_teams.map(t => (
                    <div key={t.name} className="flex items-center gap-3">
                      <Checkbox
                        checked={enabledTeams.has(t.name)}
                        onCheckedChange={() => {
                          setEnabledTeams(prev => {
                            const n = new Set(prev);
                            n.has(t.name) ? n.delete(t.name) : n.add(t.name);
                            return n;
                          });
                        }}
                      />
                      <span className="text-sm flex-1 truncate">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.owned_assets} assets</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commit summary */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm">
                Will create: <strong>{selectedCount}</strong> assets,{' '}
                <strong>{enabledDomains.size}</strong> domains,{' '}
                <strong>{enabledCaps.size}</strong> capabilities,{' '}
                <strong>{enabledTeams.size}</strong> teams
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('select')} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button onClick={doCommit} disabled={committing} className="gap-2">
                  {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {committing ? 'Importing...' : 'Commit Bootstrap'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Step 4: Done ── */}
      {step === 'done' && commitResult && (
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Bootstrap Complete</CardTitle>
            <CardDescription>
              Imported in {commitResult.duration_seconds}s
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {Object.entries(commitResult.created).map(([key, count]) => (
                <div key={key} className="space-y-1">
                  <div className="text-3xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground capitalize">{key}</div>
                </div>
              ))}
            </div>

            {analysis && analysis.quick_wins.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">Recommended Next Steps</h3>
                  <div className="space-y-2">
                    {analysis.quick_wins.map((qw, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <ArrowRight className="w-4 h-4 text-primary" />
                        <span>{qw.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={() => window.location.href = '/assets'}>
                View Assets
              </Button>
              <Button onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
