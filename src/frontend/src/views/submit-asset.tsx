import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, ArrowRight, Sparkles, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Database, Link2, Users, GitBranch, FolderOpen, Loader2, Wand2 } from 'lucide-react';
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

interface AssetTypeOption { id: string; name: string; category: string; }
interface CapItem { id: string; slug: string; name: string; category: string; description: string; }

const EFFORT_OPTIONS = [
  { value: 'spike', label: 'Spike (< 1 week)' },
  { value: 'small', label: 'Small (1–2 weeks)' },
  { value: 'medium', label: 'Medium (2–4 weeks)' },
  { value: 'large', label: 'Large (1–3 months)' },
  { value: 'epic', label: 'Epic (3+ months)' },
];

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-discover
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discoverPath, setDiscoverPath] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(false);

  // Anti-duplication
  interface SimilarMatch { asset_id: string; name: string; type_name: string; maturity: string; score: number; }
  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const dupeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ═══ Form state ═══
  // Identity
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [maturity, setMaturity] = useState('idea');
  // Value
  const [hypothesis, setHypothesis] = useState('');
  const [businessImpact, setBusinessImpact] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  // Capabilities
  const [selectedCapIds, setSelectedCapIds] = useState<Set<string>>(new Set());
  // Ownership (auto-filled from current user)
  const [ownerEmail, setOwnerEmail] = useState('');
  const [team, setTeam] = useState('');
  const [domain, setDomain] = useState('');
  const [costCenter, setCostCenter] = useState('');
  // Lakehouse refs
  const [ucCatalog, setUcCatalog] = useState('');
  const [ucSchema, setUcSchema] = useState('');
  const [ucTable, setUcTable] = useState('');
  // External links
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [slackChannel, setSlackChannel] = useState('');

  useEffect(() => {
    setStaticSegments([]); setDynamicTitle('Submit an Asset');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    if (currentUser?.email && !ownerEmail) setOwnerEmail(currentUser.email);
  }, [currentUser, ownerEmail]);

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
      const d = resp.data;
      if (d.error) {
        toast({ variant: 'destructive', title: 'Discovery issue', description: d.error });
      }
      // Auto-fill form
      if (d.name) setName(d.name);
      if (d.description) setDescription(d.description);
      if (d.repo_url) setRepoUrl(d.repo_url);
      if (d.workspace_path) {
        // Store in properties area
      }
      // Auto-select type if we can match
      if (d.type_suggestion && assetTypes.length > 0) {
        const match = assetTypes.find(t =>
          t.name.toLowerCase().includes(d.type_suggestion) ||
          t.category?.toLowerCase().includes(d.type_suggestion)
        );
        if (match) setAssetTypeId(match.id);
      }
      // Auto-tag capabilities
      if (d.capabilities?.length > 0 && allCapabilities.length > 0) {
        const slugSet = new Set(d.capabilities as string[]);
        const matchedIds = new Set<string>();
        allCapabilities.forEach(c => {
          if (slugSet.has(c.slug)) matchedIds.add(c.id);
        });
        if (matchedIds.size > 0) setSelectedCapIds(matchedIds);
      }
      setDiscovered(true);
      toast({ title: 'Discovered!', description: `Pre-filled from ${d.source}. Review and submit.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Discovery failed', description: err.message });
    } finally { setDiscovering(false); }
  }, [discoverUrl, discoverPath, apiPost, toast, assetTypes, allCapabilities]);

  useEffect(() => {
    (async () => {
      const [typesResp, capsResp] = await Promise.all([
        apiGet<AssetTypeOption[]>('/api/asset-types'),
        apiGet<any>('/api/dpz/capabilities'),
      ]);
      if (!typesResp.error && Array.isArray(typesResp.data)) setAssetTypes(typesResp.data);
      if (!capsResp.error && capsResp.data?.items) setAllCapabilities(capsResp.data.items);
    })();
  }, [apiGet]);

  // Debounced similarity check
  const checkSimilarity = useCallback((searchText: string) => {
    if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    if (searchText.length < 8) { setSimilarMatches([]); return; }
    dupeTimerRef.current = setTimeout(async () => {
      setCheckingDupes(true);
      try {
        const resp = await apiPost<any>('/api/dpz/similar', { text: searchText });
        if (!resp.error && resp.data?.matches) setSimilarMatches(resp.data.matches);
      } catch {} finally { setCheckingDupes(false); }
    }, 600);
  }, [apiPost]);

  useEffect(() => {
    checkSimilarity(`${name} ${description}`.trim());
  }, [name, description, checkSimilarity]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !assetTypeId) {
      toast({ variant: 'destructive', title: 'Required', description: 'Name and Type are required.' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        asset_type_id: assetTypeId,
        maturity,
        status: 'active',
        properties: {
          ...(hypothesis ? { value_hypothesis: hypothesis } : {}),
          ...(repoUrl ? { repo_url: repoUrl } : {}),
          ...(demoUrl ? { demo_url: demoUrl } : {}),
          ...(selectedCapIds.size > 0 ? { capability_ids: Array.from(selectedCapIds) } : {}),
          // Enterprise fields stored in properties for now (backend can unpack)
          ...(ownerEmail ? { owner_email: ownerEmail } : {}),
          ...(team ? { team } : {}),
          ...(domain ? { domain } : {}),
          ...(businessImpact ? { business_impact: businessImpact } : {}),
          ...(targetAudience ? { target_audience: targetAudience } : {}),
          ...(ucCatalog ? { uc_catalog: ucCatalog } : {}),
          ...(ucSchema ? { uc_schema: ucSchema } : {}),
          ...(ucTable ? { uc_table: ucTable } : {}),
          ...(jiraKey ? { jira_key: jiraKey } : {}),
          ...(slackChannel ? { slack_channel: slackChannel } : {}),
          ...(costCenter ? { cost_center: costCenter } : {}),
        },
      };
      const resp = await apiPost<any>('/api/assets', payload);
      if (resp.error) throw new Error(resp.error);
      toast({ title: 'Submitted!', description: `"${name}" registered as ${maturity}.` });
      navigate(`/assets/${resp.data.id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally { setSubmitting(false); }
  }, [name, description, assetTypeId, maturity, hypothesis, repoUrl, demoUrl, selectedCapIds, ownerEmail, team, domain, businessImpact, targetAudience, ucCatalog, ucSchema, ucTable, jiraKey, slackChannel, costCenter, apiPost, toast, navigate]);

  // Group types
  const appTypes = assetTypes.filter(t => t.category === 'application' || t.category === 'infrastructure');
  const dataTypes = assetTypes.filter(t => t.category === 'data' || t.category === 'analytics');
  const otherTypes = assetTypes.filter(t => !['application', 'infrastructure', 'data', 'analytics'].includes(t.category || ''));

  // Group capabilities by category
  const capsByCategory = useMemo(() => {
    const grouped: Record<string, CapItem[]> = {};
    allCapabilities.forEach(c => {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    });
    return grouped;
  }, [allCapabilities]);

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center justify-center gap-2">
          <span className="w-4 h-px bg-primary inline-block" />Submit an Asset
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Register a new asset</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Starts at maturity <Badge variant="outline" className="text-xs">{maturity}</Badge> — can be promoted through governance reviews.
        </p>
      </div>

      {/* ═══ Auto-Discover Panel ═══ */}
      <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            Quick Import
          </CardTitle>
          <CardDescription className="text-xs">
            Paste a GitHub repo URL or workspace path — we'll auto-fill name, description, type, and capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <GitBranch className="h-3 w-3" /> GitHub Repo URL
              </Label>
              <Input
                placeholder="https://github.com/org/repo"
                value={discoverUrl}
                onChange={(e) => { setDiscoverUrl(e.target.value); setDiscoverPath(''); }}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3" /> Workspace Path
              </Label>
              <Input
                placeholder="/Workspace/Users/.../my-project"
                value={discoverPath}
                onChange={(e) => { setDiscoverPath(e.target.value); setDiscoverUrl(''); }}
                className="text-sm"
              />
            </div>
          </div>
          <Button
            onClick={handleDiscover}
            disabled={discovering || (!discoverUrl.trim() && !discoverPath.trim())}
            size="sm"
            className="w-full"
          >
            {discovering ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Discovering...</>
            ) : discovered ? (
              <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Re-discover</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Discover & Auto-Fill</>
            )}
          </Button>
          {discovered && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Form pre-filled — review below and submit.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══ Section 1: Identity ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">What are you building?</CardTitle>
          <CardDescription>Name, type, and starting maturity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="e.g. Store Demand Forecaster" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Asset Type *</Label>
              <Select value={assetTypeId} onValueChange={setAssetTypeId}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {appTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">AI & Applications</div>{appTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                  {dataTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Data Assets</div>{dataTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                  {otherTypes.length > 0 && (<><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other</div>{otherTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Starting Maturity</Label>
              <Select value={maturity} onValueChange={setMaturity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea — concept only</SelectItem>
                  <SelectItem value="poc">POC — working prototype</SelectItem>
                  <SelectItem value="validating">Validating — under evaluation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" placeholder="What does this do or will do?" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Anti-Duplication Advisor */}
          {similarMatches.length > 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Similar assets already exist</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {similarMatches.map(m => (
                  <div key={m.asset_id} className="flex items-center justify-between py-1.5 px-2 rounded bg-white dark:bg-gray-900 border cursor-pointer hover:border-primary transition-colors" onClick={() => navigate(`/assets/${m.asset_id}`)}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.type_name}</Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">{Math.round(m.score * 100)}%</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Section 2: Value & Impact ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Value & Impact
          </CardTitle>
          <CardDescription>Why should the organization invest in this?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Value Hypothesis</Label>
            <Textarea placeholder="What business value will this deliver? Who benefits?" value={hypothesis} onChange={e => setHypothesis(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Business Impact</Label>
              <Select value={businessImpact} onValueChange={setBusinessImpact}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue generating</SelectItem>
                  <SelectItem value="cost-savings">Cost savings</SelectItem>
                  <SelectItem value="risk-reduction">Risk reduction</SelectItem>
                  <SelectItem value="efficiency">Operational efficiency</SelectItem>
                  <SelectItem value="compliance">Compliance / regulatory</SelectItem>
                  <SelectItem value="enablement">Team enablement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Input placeholder="e.g. Store Ops, Marketing" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Section 3: Capabilities ═══ */}
      {allCapabilities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Platform Capabilities</CardTitle>
            <CardDescription>What Lakehouse capabilities does this leverage?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(capsByCategory).map(([cat, caps]) => (
                <div key={cat}>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {caps.map(cap => {
                      const active = selectedCapIds.has(cap.id);
                      return (
                        <button key={cap.id} type="button"
                          className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors', active ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')}
                          onClick={() => { const next = new Set(selectedCapIds); if (active) next.delete(cap.id); else next.add(cap.id); setSelectedCapIds(next); }}
                        >
                          {active ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border shrink-0" />}
                          <span className="truncate">{cap.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Section 4: Ownership & Governance (collapsible) ═══ */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Ownership, Integrations & Governance
              </CardTitle>
              <CardDescription>Owner, team, Lakehouse refs, Jira, Slack — for SA/admin tracking.</CardDescription>
            </div>
            {showAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="space-y-5 pt-0">
            {/* Ownership */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Ownership</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Owner Email</Label>
                  <Input placeholder="owner@company.com" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Team</Label>
                  <Input placeholder="e.g. Data Engineering" value={team} onChange={e => setTeam(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Domain</Label>
                  <Input placeholder="e.g. Supply Chain" value={domain} onChange={e => setDomain(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cost Center</Label>
                  <Input placeholder="e.g. CC-4200" value={costCenter} onChange={e => setCostCenter(e.target.value)} />
                </div>
              </div>
            </div>
            <Separator />

            {/* Lakehouse References */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Database className="h-3 w-3" /> Unity Catalog References
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Catalog</Label>
                  <Input placeholder="my_catalog" value={ucCatalog} onChange={e => setUcCatalog(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Schema</Label>
                  <Input placeholder="my_schema" value={ucSchema} onChange={e => setUcSchema(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Table / Volume</Label>
                  <Input placeholder="my_table" value={ucTable} onChange={e => setUcTable(e.target.value)} />
                </div>
              </div>
            </div>
            <Separator />

            {/* External Integrations */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Link2 className="h-3 w-3" /> External Integrations
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Repo / Workspace Path</Label>
                  <Input placeholder="/Workspace/... or https://github.com/..." value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Demo URL</Label>
                  <Input placeholder="https://my-app.databricksapps.com" value={demoUrl} onChange={e => setDemoUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jira Key</Label>
                  <Input placeholder="DPZ-1234" value={jiraKey} onChange={e => setJiraKey(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slack Channel</Label>
                  <Input placeholder="#team-data-eng" value={slackChannel} onChange={e => setSlackChannel(e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Submit */}
      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || !name.trim() || !assetTypeId}>
        {submitting ? 'Submitting...' : 'Register Asset'}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
