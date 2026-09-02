import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Database, GitBranch, FolderOpen, Loader2, Wand2, Eye,
  MessageSquare, ShieldAlert, Users, ArrowRight, Info, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/use-api';
import { useUserStore } from '@/stores/user-store';
import { cn } from '@/lib/utils';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

// ─── Types ──────────────────────────────────────────────────────────
interface AssetTypeOption { id: string; name: string; category: string; }
interface CapItem { id: string; slug: string; name: string; category: string; description: string; }
interface EvidenceField { value: string; source: string; confidence: 'high' | 'medium' | 'low'; reason: string; }
interface CapEvidence { slug: string; source: string; confidence: string; reason: string; }
interface UcRef { catalog: string; schema: string; table: string; direction: string; }
interface Overlap { asset_id: string; name: string; type_name: string; maturity: string; score: number; }
interface InterviewQ { field: string; question: string; why: string; }
interface DiscoverResult {
  source: string;
  evidence: Record<string, EvidenceField>;
  capabilities: CapEvidence[];
  uc_refs: UcRef[];
  overlaps: Overlap[];
  maturity_proposal: { value: string; confidence: string; reasons: string[]; };
  interview_questions: InterviewQ[];
  limits: string[];
  suggested_backers: string[];
  raw: Record<string, any>;
  error?: string;
}

const CONF_COLORS: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};
const CONF_LABEL: Record<string, string> = { high: 'confirmed', medium: 'review', low: 'unverified' };

// ─── Sub-components ─────────────────────────────────────────────────

function ConfBadge({ confidence }: { confidence: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider', CONF_COLORS[confidence] || CONF_COLORS.low)}>
      {CONF_LABEL[confidence] || 'unknown'}
    </span>
  );
}

function EvidenceRow({ label, ev, editable, value, onChange }: {
  label: string; ev?: EvidenceField; editable?: boolean;
  value?: string; onChange?: (v: string) => void;
}) {
  const [showProv, setShowProv] = useState(false);
  const display = value ?? ev?.value ?? '';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {ev && (
          <div className="flex items-center gap-1.5">
            <ConfBadge confidence={ev.confidence} />
            <button type="button" onClick={() => setShowProv(!showProv)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {showProv && ev && (
        <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[10px] text-muted-foreground space-y-0.5">
          <p><span className="font-medium">Source:</span> {ev.source}</p>
          {ev.reason && <p><span className="font-medium">Note:</span> {ev.reason}</p>}
        </div>
      )}
      {editable ? (
        <Input value={display} onChange={(e) => onChange?.(e.target.value)} className="text-sm" />
      ) : (
        <p className="text-sm">{display || <span className="text-muted-foreground italic">Not detected</span>}</p>
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export default function SubmitAssetView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { get: apiGet, post: apiPost } = useApi();
  const currentUser = useUserStore((s) => s.userInfo);
  const setStaticSegments = useBreadcrumbStore((s) => s.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((s) => s.setDynamicTitle);

  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);
  const [allCapabilities, setAllCapabilities] = useState<CapItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Phase: 'input' -> 'evidence'
  const [phase, setPhase] = useState<'input' | 'evidence'>('input');
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discoverPath, setDiscoverPath] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoverResult | null>(null);

  // Editable form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [maturity, setMaturity] = useState('idea');
  const [hypothesis, setHypothesis] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [selectedCapIds, setSelectedCapIds] = useState<Set<string>>(new Set());
  const [showCaps, setShowCaps] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const [showUcRefs, setShowUcRefs] = useState(false);

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Register an Asset');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const [tr, cr] = await Promise.all([
        apiGet<AssetTypeOption[]>('/api/asset-types'),
        apiGet<any>('/api/dpz/capabilities'),
      ]);
      if (!tr.error && Array.isArray(tr.data)) setAssetTypes(tr.data);
      if (!cr.error && cr.data?.items) setAllCapabilities(cr.data.items);
    })();
  }, [apiGet]);

  // ── Discovery ──
  const handleDiscover = useCallback(async () => {
    const input = discoverUrl.trim() || discoverPath.trim();
    if (!input) return;
    setDiscovering(true);
    try {
      const payload = discoverUrl.trim()
        ? { repo_url: discoverUrl.trim() }
        : { workspace_path: discoverPath.trim() };
      const resp = await apiPost<any>('/api/dpz/discover', payload);
      if (resp.error) throw new Error(resp.error);
      const d = resp.data as DiscoverResult;
      if (d.error) toast({ variant: 'destructive', title: 'Discovery issue', description: d.error });
      setDiscovery(d);

      // Pre-fill: high/medium confidence only
      const nameEv = d.evidence?.name;
      if (nameEv?.value && nameEv.confidence !== 'low') setName(nameEv.value);
      const descEv = d.evidence?.description;
      if (descEv?.value && descEv.confidence !== 'low') setDescription(descEv.value);
      const typeEv = d.evidence?.type;
      if (typeEv?.value && typeEv.confidence !== 'low' && assetTypes.length > 0) {
        const m = assetTypes.find(t => t.name.toLowerCase().includes(typeEv.value) || t.category?.toLowerCase().includes(typeEv.value));
        if (m) setAssetTypeId(m.id);
      }
      if (d.maturity_proposal?.value) setMaturity(d.maturity_proposal.value);
      // Capabilities: accept high-confidence only
      if (d.capabilities?.length > 0 && allCapabilities.length > 0) {
        const slugs = new Set(d.capabilities.filter(c => c.confidence === 'high').map(c => c.slug));
        const ids = new Set<string>();
        allCapabilities.forEach(c => { if (slugs.has(c.slug)) ids.add(c.id); });
        if (ids.size > 0) setSelectedCapIds(ids);
      }
      setPhase('evidence');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Discovery failed', description: err.message });
    } finally { setDiscovering(false); }
  }, [discoverUrl, discoverPath, apiPost, toast, assetTypes, allCapabilities]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { toast({ variant: 'destructive', title: 'Required', description: 'Asset name is required.' }); return; }
    if (!hypothesis.trim()) { toast({ variant: 'destructive', title: 'Required', description: 'Value hypothesis is required.' }); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(), description: description.trim() || undefined,
        asset_type_id: assetTypeId || undefined, maturity, status: 'active',
        properties: {
          value_hypothesis: hypothesis.trim(),
          ...(targetAudience ? { target_audience: targetAudience } : {}),
          ...(discovery?.raw?.repo_url ? { repo_url: discovery.raw.repo_url } : {}),
          ...(selectedCapIds.size > 0 ? { capability_ids: Array.from(selectedCapIds) } : {}),
          ...(discovery?.evidence?.owner_email?.value ? { owner_email: discovery.evidence.owner_email.value } : {}),
          ...(discovery?.uc_refs?.length ? { uc_refs: discovery.uc_refs } : {}),
          ...(discovery?.limits?.length ? { known_limits: discovery.limits } : {}),
        },
      };
      const resp = await apiPost<any>('/api/assets', payload);
      if (resp.error) throw new Error(resp.error);
      toast({ title: 'Registered!', description: `"${name}" registered as ${maturity}.` });
      navigate(`/assets/${resp.data.id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally { setSubmitting(false); }
  }, [name, description, assetTypeId, maturity, hypothesis, targetAudience, selectedCapIds, discovery, apiPost, toast, navigate]);

  // Derived
  const appTypes = assetTypes.filter(t => t.category === 'application' || t.category === 'infrastructure');
  const dataTypes = assetTypes.filter(t => t.category === 'data' || t.category === 'analytics');
  const otherTypes = assetTypes.filter(t => !['application', 'infrastructure', 'data', 'analytics'].includes(t.category || ''));
  const highCaps = discovery?.capabilities?.filter(c => c.confidence === 'high') || [];
  const medCaps = discovery?.capabilities?.filter(c => c.confidence !== 'high') || [];

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center justify-center gap-2">
          <span className="w-4 h-px bg-primary inline-block" />Register an Asset
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {phase === 'input' ? 'Point us at your work' : 'Review & register'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {phase === 'input'
            ? "Paste a repo URL or workspace path. We'll read the code and fill in what we can."
            : 'Everything below was inferred from your code. Correct anything wrong, then answer the two questions only you can answer.'}
        </p>
      </div>

      {/* ═══ Phase 1: Source Input ═══ */}
      {phase === 'input' && (
        <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><GitBranch className="h-3 w-3" /> GitHub Repo URL</Label>
                <Input placeholder="https://github.com/org/repo" value={discoverUrl} onChange={(e) => { setDiscoverUrl(e.target.value); setDiscoverPath(''); }} className="text-sm" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><FolderOpen className="h-3 w-3" /> Workspace Path</Label>
                <Input placeholder="/Workspace/Users/.../my-project" value={discoverPath} onChange={(e) => { setDiscoverPath(e.target.value); setDiscoverUrl(''); }} className="text-sm" />
              </div>
            </div>
            <Button onClick={handleDiscover} disabled={discovering || (!discoverUrl.trim() && !discoverPath.trim())} className="w-full">
              {discovering ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading code & building evidence...</> : <><Wand2 className="h-4 w-4 mr-2" /> Discover</>}
            </Button>
            <Separator />
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center" onClick={() => setPhase('evidence')}>
              Or register manually without discovery &rarr;
            </button>
          </CardContent>
        </Card>
      )}

      {/* ═══ Phase 2: Evidence Panel ═══ */}
      {phase === 'evidence' && (
        <>
          {/* Overlap warning — fires BEFORE form investment */}
          {discovery && discovery.overlaps.length > 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{discovery.overlaps.length} existing asset{discovery.overlaps.length > 1 ? 's' : ''} already overlap{discovery.overlaps.length === 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {discovery.overlaps.map(m => (
                  <div key={m.asset_id} className="flex items-center justify-between py-1.5 px-2 rounded bg-white dark:bg-gray-900 border cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/assets/${m.asset_id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.type_name}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{m.maturity}</Badge>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Interview: human-only knowledge ─── */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-primary" />
                Only you can answer these
              </CardTitle>
              <CardDescription className="text-xs">Everything else was inferred. These require human judgment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {discovery?.interview_questions?.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <Label className="text-xs font-medium">{q.question}</Label>
                  <p className="text-[10px] text-muted-foreground italic">{q.why}</p>
                  {q.field === 'value_hypothesis' ? (
                    <Textarea value={hypothesis} onChange={e => setHypothesis(e.target.value)} rows={2} placeholder="One sentence: what problem does this solve?" className="text-sm" />
                  ) : q.field === 'target_audience' ? (
                    <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Store Ops managers, Marketing analysts" className="text-sm" />
                  ) : null}
                </div>
              )) || (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">What problem does this solve that nothing else here does?</Label>
                    <Textarea value={hypothesis} onChange={e => setHypothesis(e.target.value)} rows={2} placeholder="One sentence" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Who would install or use this?</Label>
                    <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Store Ops, Marketing" className="text-sm" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ─── Inferred identity with provenance ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3 w-3" /> Inferred from code
              </CardTitle>
              <CardDescription className="text-xs">Click <Info className="h-2.5 w-2.5 inline" /> to see where each field came from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <EvidenceRow label="Name *" ev={discovery?.evidence?.name} editable value={name} onChange={setName} />
              <EvidenceRow label="Description" ev={discovery?.evidence?.description} editable value={description} onChange={setDescription} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Asset Type</Label>
                    {discovery?.evidence?.type && <ConfBadge confidence={discovery.evidence.type.confidence} />}
                  </div>
                  {discovery?.evidence?.type?.reason && <p className="text-[10px] text-muted-foreground">{discovery.evidence.type.reason}</p>}
                  <Select value={assetTypeId} onValueChange={setAssetTypeId}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {appTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">AI & Applications</div>{appTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                      {dataTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Data Assets</div>{dataTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                      {otherTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other</div>{otherTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Maturity (proposed)</Label>
                    {discovery?.maturity_proposal && <ConfBadge confidence={discovery.maturity_proposal.confidence} />}
                  </div>
                  {discovery?.maturity_proposal?.reasons && <p className="text-[10px] text-muted-foreground">{discovery.maturity_proposal.reasons.join(', ')}</p>}
                  <Select value={maturity} onValueChange={setMaturity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idea">Idea</SelectItem>
                      <SelectItem value="poc">POC</SelectItem>
                      <SelectItem value="validating">Validating</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Capabilities: collapsed summary ─── */}
          {(highCaps.length > 0 || medCaps.length > 0) && (
            <Card>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowCaps(!showCaps)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Zap className="h-3 w-3 text-primary" />
                    {selectedCapIds.size} accepted{medCaps.length > 0 ? `, ${medCaps.length} to review` : ''}
                  </CardTitle>
                  {showCaps ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showCaps && (
                <CardContent className="space-y-2 pt-0">
                  {discovery?.capabilities?.map((cap, i) => {
                    const capObj = allCapabilities.find(c => c.slug === cap.slug);
                    const accepted = capObj ? selectedCapIds.has(capObj.id) : false;
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded border text-xs">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => {
                            if (!capObj) return;
                            const next = new Set(selectedCapIds);
                            if (accepted) next.delete(capObj.id); else next.add(capObj.id);
                            setSelectedCapIds(next);
                          }} className={cn('w-4 h-4 rounded-sm border flex items-center justify-center transition-colors', accepted ? 'bg-primary border-primary text-white' : 'hover:border-primary')}>
                            {accepted && <CheckCircle2 className="h-2.5 w-2.5" />}
                          </button>
                          <span className={accepted ? 'font-medium' : 'text-muted-foreground'}>{capObj?.name || cap.slug}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{cap.source}</span>
                          <ConfBadge confidence={cap.confidence} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          )}

          {/* ─── UC Table References ─── */}
          {discovery && discovery.uc_refs.length > 0 && (
            <Card>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowUcRefs(!showUcRefs)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Database className="h-3 w-3" /> {discovery.uc_refs.length} UC table{discovery.uc_refs.length > 1 ? 's' : ''} detected in code
                  </CardTitle>
                  {showUcRefs ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showUcRefs && (
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {discovery.uc_refs.map((ref, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-muted/30 text-xs font-mono">
                        <span>{ref.catalog}.{ref.schema}.{ref.table}</span>
                        <Badge variant={ref.direction === 'write' ? 'destructive' : 'secondary'} className="text-[9px]">{ref.direction}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ─── Auto-drafted limits ─── */}
          {discovery && discovery.limits.length > 0 && (
            <Card>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowLimits(!showLimits)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <ShieldAlert className="h-3 w-3 text-amber-500" /> {discovery.limits.length} limitation{discovery.limits.length > 1 ? 's' : ''} detected
                  </CardTitle>
                  {showLimits ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showLimits && (
                <CardContent className="pt-0">
                  <p className="text-[10px] text-muted-foreground mb-2">These will be published with the asset.</p>
                  <div className="space-y-1">
                    {discovery.limits.map((lim, i) => (
                      <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-amber-50 dark:bg-amber-950/20 text-xs">
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /> <span>{lim}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ─── Suggested backers ─── */}
          {discovery && discovery.suggested_backers.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Suggested first audience
              </p>
              <div className="flex flex-wrap gap-1.5">
                {discovery.suggested_backers.map((b, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono">{b}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* ─── Submit ─── */}
          <div className="space-y-3">
            <Button className="w-full" size="lg" disabled={!name.trim() || !hypothesis.trim() || submitting} onClick={handleSubmit}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</> : <>Register Asset <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            {!hypothesis.trim() && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center">
                Value hypothesis is required &mdash; this is the one field only you can write.
              </p>
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center" onClick={() => setPhase('input')}>
              &larr; Back to discovery
            </button>
          </div>
        </>
      )}
    </div>
  );
}
