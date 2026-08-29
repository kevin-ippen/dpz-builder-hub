import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle,
  MapPin, Globe, Calendar, User, Tag, FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
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

export default function AssetDetailView() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<AssetRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false);
  const [evidenceSummary, setEvidenceSummary] = useState<any | null>(null);

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
      const [assetRes, evidenceRes] = await Promise.all([
        apiGet<AssetRead>(`/api/assets/${assetId}`),
        apiGet<any>(`/api/dpz/evidence`),
      ]);
      if (assetRes.error) throw new Error(assetRes.error);
      const assetData = assetRes.data ?? null;
      setAsset(assetData);
      if (assetData && Array.isArray(evidenceRes.data?.items)) {
        setEvidenceSummary(evidenceRes.data.items.find((x: any) => x.id === assetData.id) ?? null);
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
        {/* DPZ Lifecycle Badges */}
        {(asset as any).maturity && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(asset as any).maturity && (
              <Badge variant="default" className="text-xs bg-blue-600">
                {(asset as any).maturity}
              </Badge>
            )}
            {(asset as any).publication_scope && (asset as any).publication_scope !== 'draft' && (
              <Badge variant="secondary" className="text-xs">
                {(asset as any).publication_scope}
              </Badge>
            )}
            {(asset as any).operational_health && (asset as any).operational_health !== 'unknown' && (
              <Badge variant={(asset as any).operational_health === 'healthy' ? 'default' : 'destructive'}
                className={`text-xs ${(asset as any).operational_health === 'healthy' ? 'bg-green-600' : ''}`}>
                {(asset as any).operational_health}
              </Badge>
            )}
            {(asset as any).delivery_status && (asset as any).delivery_status !== 'unfunded' && (
              <Badge variant="outline" className="text-xs">
                {(asset as any).delivery_status}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Contract block */}
      <MaturityContract maturity={(asset as any).maturity} />

      {/* 2-column layout: main + rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Main column */}
      <div className="min-w-0 space-y-6">

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>


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

          {/* Properties */}
          <PropertiesCard properties={asset.properties} />


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
        {/* Image carousel */}
        <ImageCarousel assetId={asset.id} />

        {/* Adopt + Promote actions */}
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Actions</h3>
          <Button
            className="w-full"
            size="sm"
            onClick={async () => {
              const resp = await apiPost<any>('/api/dpz/install', { asset_id: asset.id });
              if (!resp.error) toast({ title: 'Adopted!', description: `Install count: ${resp.data?.install_count}` });
            }}
          >
            Adopt this asset
          </Button>
        </div>

        {/* Version timeline */}
        <VersionTimeline assetId={asset.id} />

        {/* Signals & Evidence */}
        <EvidenceScoreCard
          evidenceScore={evidenceSummary?.evidence_score}
          signalTypes={evidenceSummary?.signal_types}
          totalSignals={evidenceSummary?.total_signals}
          lastSignalAt={evidenceSummary?.last_signal_at}
        />
        <SignalTimeline assetId={asset.id} />


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
