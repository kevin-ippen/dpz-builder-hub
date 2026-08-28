import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/use-api';
import useBreadcrumbStore from '@/stores/breadcrumb-store';

interface AssetTypeOption {
  id: string;
  name: string;
  category: string;
}

export default function SubmitAssetView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { get: apiGet, post: apiPost } = useApi();
  const setStaticSegments = useBreadcrumbStore((state) => state.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((state) => state.setDynamicTitle);

  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Anti-duplication: similar asset matches
  interface SimilarMatch {
    asset_id: string;
    name: string;
    type_name: string;
    maturity: string;
    score: number;
  }
  const [similarMatches, setSimilarMatches] = useState<SimilarMatch[]>([]);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const dupeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle('Submit an Asset');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<AssetTypeOption[]>('/api/asset-types');
      if (!resp.error && Array.isArray(resp.data)) {
        setAssetTypes(resp.data);
      }
    })();
  }, [apiGet]);

  // Debounced similarity check — fires 600ms after user stops typing
  const checkSimilarity = useCallback((searchText: string) => {
    if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    if (searchText.length < 8) { setSimilarMatches([]); return; }
    dupeTimerRef.current = setTimeout(async () => {
      setCheckingDupes(true);
      try {
        const resp = await apiPost<any>('/api/dpz/similar', { text: searchText });
        if (!resp.error && resp.data?.matches) {
          setSimilarMatches(resp.data.matches);
        }
      } catch {} finally { setCheckingDupes(false); }
    }, 600);
  }, [apiPost]);

  // Trigger similarity check when name or description changes
  useEffect(() => {
    const text = `${name} ${description}`.trim();
    checkSimilarity(text);
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
        status: 'active',
        properties: {
          ...(hypothesis ? { value_hypothesis: hypothesis } : {}),
          ...(repoUrl ? { repo_url: repoUrl } : {}),
          ...(demoUrl ? { demo_url: demoUrl } : {}),
        },
      };
      const resp = await apiPost<any>('/api/assets', payload);
      if (resp.error) throw new Error(resp.error);
      toast({ title: 'Submitted!', description: `"${name}" registered as an idea.` });
      navigate(`/assets/${resp.data.id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSubmitting(false);
    }
  }, [name, description, assetTypeId, hypothesis, repoUrl, demoUrl, apiPost, toast, navigate]);

  // Group types by category for the selector
  const appTypes = assetTypes.filter(t => t.category === 'application' || t.category === 'infrastructure');
  const dataTypes = assetTypes.filter(t => t.category === 'data' || t.category === 'analytics');
  const otherTypes = assetTypes.filter(t => !['application', 'infrastructure', 'data', 'analytics'].includes(t.category || ''));

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2"><span className="w-4 h-px bg-primary inline-block" />Submit an Asset</p>
        <h1 className="text-2xl font-bold tracking-tight">Propose something new</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Register an idea, POC, or production asset. It starts at maturity <Badge variant="outline" className="text-xs">idea</Badge> and can be promoted through reviews.
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">What are you building?</CardTitle>
          <CardDescription>Start simple — you can add detail later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Store Demand Forecaster, Churn Prevention Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Asset Type *</Label>
            <Select value={assetTypeId} onValueChange={setAssetTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a type..." />
              </SelectTrigger>
              <SelectContent>
                {appTypes.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">AI & Applications</div>
                    {appTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </>
                )}
                {dataTypes.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Data Assets</div>
                    {dataTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </>
                )}
                {otherTypes.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other</div>
                    {otherTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Brief description of what this does or will do..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Anti-Duplication Advisor */}
          {similarMatches.length > 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Similar assets already exist</span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Consider reusing or contributing to an existing asset instead of creating a new one.
              </p>
              <div className="space-y-1.5 pt-1">
                {similarMatches.map(m => (
                  <div
                    key={m.asset_id}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-white dark:bg-gray-900 border cursor-pointer hover:border-primary transition-colors"
                    onClick={() => navigate(`/assets/${m.asset_id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.type_name}</Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">{Math.round(m.score * 100)}% match</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value Hypothesis */}
          <div className="space-y-2">
            <Label htmlFor="hypothesis">
              <Sparkles className="inline h-3.5 w-3.5 mr-1" />
              Value Hypothesis
            </Label>
            <Textarea
              id="hypothesis"
              placeholder="What business value will this deliver? Who benefits?"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              rows={2}
            />
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="repo">Repo / Workspace Path</Label>
              <Input
                id="repo"
                placeholder="/Workspace/... or https://github.com/..."
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo">Demo URL</Label>
              <Input
                id="demo"
                placeholder="https://my-app.databricksapps.com"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !assetTypeId}
          >
            {submitting ? 'Submitting...' : 'Register Asset'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
