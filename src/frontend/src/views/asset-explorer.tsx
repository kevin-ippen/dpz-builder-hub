import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ColumnDef, RowSelectionState, PaginationState } from '@tanstack/react-table';
import {
  Box, ChevronDown, MoreHorizontal, PlusCircle, AlertCircle, Trash2,
  Table2, Eye, Columns2, LayoutDashboard, Globe, FileCode, Brain, Activity,
  Server, Shield, BookOpen, Database, FolderOpen, Shapes, FileSpreadsheet, FileInput,
  LayoutGrid, List,
} from 'lucide-react';
import { SplitPaneSkeleton } from '@/components/common/list-view-skeleton';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AssetRead, AssetTypeRead } from '@/types/asset';
import { EntityTypeDefinition } from '@/types/ontology-schema';
import { AssetFormDialog } from '@/components/common/asset-form-dialog';
import EntityInfoDialog from '@/components/metadata/entity-info-dialog';
import AssetImportExportDialog from '@/components/assets/asset-import-export-dialog';
import { AssetDeleteDialog } from '@/components/assets/asset-delete-dialog';
import { useTranslation } from 'react-i18next';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import { RelativeDate } from '@/components/common/relative-date';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePermissions } from '@/stores/permissions-store';
import { FeatureAccessLevel } from '@/types/settings';
import useBreadcrumbStore from '@/stores/breadcrumb-store';
import { cn } from '@/lib/utils';
import { AssetCard, MATURITY_ORDER, MATURITY_CONFIG } from '@/components/assets/asset-card';

const ICON_MAP: Record<string, React.ElementType> = {
  Table2, Eye, Columns2, LayoutDashboard, Globe, FileCode, Brain, Activity,
  Server, Shield, BookOpen, Database, FolderOpen, Shapes, Box,
};

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; order: number }> = {
  application: { label: 'AI & Applications', icon: Brain, order: 1 },
  data: { label: 'Data Assets', icon: Database, order: 2 },
  analytics: { label: 'Analytics', icon: LayoutDashboard, order: 3 },
  infrastructure: { label: 'Infrastructure', icon: Server, order: 4 },
  integration: { label: 'Integration', icon: Globe, order: 5 },
  system: { label: 'Systems', icon: Server, order: 6 },
  custom: { label: 'Custom', icon: Shapes, order: 7 },
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  active: 'default',
  deprecated: 'secondary',
  archived: 'destructive',
};

function getIconComponent(iconName?: string | null): React.ElementType {
  if (!iconName) return Box;
  return ICON_MAP[iconName] || Box;
}

export default function AssetExplorerView() {
  const [assetTypes, setAssetTypes] = useState<AssetTypeRead[]>([]);
  const [assets, setAssets] = useState<AssetRead[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRead | null>(null);
  const [ontologyTypes, setOntologyTypes] = useState<EntityTypeDefinition[]>([]);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [nameFilter, setNameFilter] = useState('');
  const [debouncedNameFilter, setDebouncedNameFilter] = useState('');
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [previewAssetTitle, setPreviewAssetTitle] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [heroImages, setHeroImages] = useState<Record<string, { image_url: string; caption?: string }>>({});
  const [maturityFilter, setMaturityFilter] = useState<string | null>(null);
  const [funnelCounts, setFunnelCounts] = useState<Record<string, number>>({});

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { get: apiGet, delete: apiDelete, loading: apiIsLoading } = useApi();
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const setStaticSegments = useBreadcrumbStore((state) => state.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((state) => state.setDynamicTitle);

  const featureId = 'assets';
  const canRead = !permissionsLoading && hasPermission(featureId, FeatureAccessLevel.READ_ONLY);
  const canWrite = !permissionsLoading && hasPermission(featureId, FeatureAccessLevel.READ_WRITE);
  const canAdmin = !permissionsLoading && hasPermission(featureId, FeatureAccessLevel.ADMIN);



  const selectedAssetIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const hasSelection = selectedAssetIds.length > 0;

  const selectType = useCallback((typeId: string | null, typeName?: string) => {
    setSelectedTypeId(typeId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (typeId && typeName) {
        next.set('type', typeName);
      } else {
        next.delete('type');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchAssetTypes = useCallback(async () => {
    if (!canRead && !permissionsLoading) return;
    try {
      const response = await apiGet<AssetTypeRead[]>('/api/asset-types');
      if (response.error) throw new Error(response.error);
      const types = Array.isArray(response.data) ? response.data : [];
      setAssetTypes(types);
      if (selectedTypeId === null && types.length > 0) {
        const urlType = searchParams.get('type');
        if (urlType) {
          const match = types.find(t => t.name === urlType);
          if (match) setSelectedTypeId(match.id);
        }
      }
    } catch (err: any) {
      setComponentError(err.message || 'Failed to load asset types');
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  }, [canRead, permissionsLoading, apiGet, toast, searchParams, selectedTypeId]);

  interface PaginatedResponse {
    items: AssetRead[];
    total: number;
    skip: number;
    limit: number;
  }

  const fetchAssets = useCallback(async (typeId: string | null, page: PaginationState, nameSearch?: string, maturity?: string | null) => {
    setAssetsLoading(true);
    try {
      const skip = page.pageIndex * page.pageSize;
      const params = new URLSearchParams({ skip: String(skip), limit: String(page.pageSize) });
      if (typeId) params.set('asset_type_id', typeId);
      if (nameSearch) params.set('name', nameSearch);
      if (maturity) params.set('maturity', maturity);

      const response = await apiGet<PaginatedResponse>(`/api/assets?${params}`);
      if (response.error) throw new Error(response.error);
      const data = response.data;
      setAssets(data?.items ?? []);
      setAssetsTotal(data?.total ?? 0);
    } catch (err: any) {
      setAssets([]);
      setAssetsTotal(0);
      toast({ variant: 'destructive', title: 'Error loading assets', description: err.message });
    } finally {
      setAssetsLoading(false);
    }
  }, [apiGet, toast]);

  // Fetch hero images for card grid
  useEffect(() => {
    (async () => {
      const resp = await apiGet<any>('/api/dpz/images/heroes');
      if (!resp.error && resp.data?.heroes) setHeroImages(resp.data.heroes);
    })();
  }, [apiGet]);

  // Fetch maturity distribution for funnel (separate from paginated results)
  const fetchFunnelCounts = useCallback(async () => {
    try {
      const resp = await apiGet<any>('/api/dpz/portfolio');
      if (!resp.error && resp.data?.by_maturity) {
        const counts: Record<string, number> = {};
        for (const item of resp.data.by_maturity) {
          counts[item.stage] = item.count;
        }
        setFunnelCounts(counts);
      }
    } catch {}
  }, [apiGet]);

  const fetchOntologyTypes = useCallback(async () => {
    try {
      const response = await apiGet<EntityTypeDefinition[]>(`/api/ontology/entity-types?tier=asset&lang=${encodeURIComponent(i18n.language)}`);
      if (!response.error && Array.isArray(response.data)) {
        setOntologyTypes(response.data);
      }
    } catch { /* non-critical */ }
  }, [apiGet]);

  const getOntologyIri = useCallback((typeName: string): string | null => {
    const match = ontologyTypes.find(
      (t) => t.label === typeName || t.local_name === typeName
    );
    return match?.iri ?? null;
  }, [ontologyTypes]);

  useEffect(() => {
    fetchAssetTypes();
    fetchOntologyTypes();
    fetchFunnelCounts();
    setStaticSegments([]);
    setDynamicTitle('Asset Explorer');
    return () => { setStaticSegments([]); setDynamicTitle(null); };
  }, [fetchAssetTypes, fetchOntologyTypes, fetchFunnelCounts, setStaticSegments, setDynamicTitle]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNameFilter(nameFilter), 300);
    return () => clearTimeout(timer);
  }, [nameFilter]);

  useEffect(() => {
    setPagination(prev => prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 });
  }, [debouncedNameFilter]);

  useEffect(() => {
    fetchAssets(selectedTypeId, pagination, debouncedNameFilter, maturityFilter);
    setRowSelection({});
  }, [selectedTypeId, pagination, debouncedNameFilter, maturityFilter, fetchAssets]);

  const handleTypeChange = useCallback((typeId: string | null, typeName?: string) => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    selectType(typeId, typeName);
  }, [selectType]);

  const selectedType = useMemo(
    () => assetTypes.find(t => t.id === selectedTypeId),
    [assetTypes, selectedTypeId]
  );

  const visibleAssetTypes = assetTypes;

  const groupedTypes = useMemo(() => {
    const groups: Record<string, AssetTypeRead[]> = {};
    for (const t of visibleAssetTypes) {
      const cat = t.category || 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99));
  }, [visibleAssetTypes]);

  const totalAssetCount = useMemo(
    () => visibleAssetTypes.reduce((sum, t) => sum + (t.asset_count || 0), 0),
    [visibleAssetTypes]
  );

  const openDeleteDialog = (id: string) => {
    if (!canAdmin) {
      toast({ variant: 'destructive', title: 'Permission denied', description: 'Admin access required to delete assets' });
      return;
    }
    setDeletingId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleBulkDelete = async (selectedRows: AssetRead[]) => {
    if (!canAdmin) {
      toast({ variant: 'destructive', title: 'Permission denied', description: 'Admin access required to delete assets' });
      return;
    }
    const selectedIds = selectedRows.map(r => r.id).filter((id): id is string => !!id);
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} asset(s)? This action cannot be undone.`)) return;

    const results = await Promise.allSettled(selectedIds.map(async (id) => {
      const response = await apiDelete(`/api/assets/${id}`);
      if (response.error) throw new Error(response.error);
      return id;
    }));

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    if (successes > 0) {
      toast({ title: 'Assets deleted', description: `Successfully deleted ${successes} asset(s).` });
    }
    if (failures > 0) {
      const firstError = (results.find(r => r.status === 'rejected') as PromiseRejectedResult)?.reason?.message || 'Unknown error';
      toast({ variant: 'destructive', title: 'Some deletions failed', description: `${failures} asset(s) failed to delete: ${firstError}` });
    }
    setRowSelection({});
    fetchAssets(selectedTypeId, pagination, debouncedNameFilter, maturityFilter);
    fetchAssetTypes();
    fetchFunnelCounts();
  };

  const columns = useMemo<ColumnDef<AssetRead>[]>(() => {
    const cols: ColumnDef<AssetRead>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          {row.original.parent_name && (
            <div
              className="text-xs text-muted-foreground cursor-pointer hover:underline truncate max-w-sm"
              onClick={(e) => {
                e.stopPropagation();
                if (row.original.parent_id) navigate(`/assets/${row.original.parent_id}`);
              }}
            >
              in {row.original.parent_name}
            </div>
          )}
          {!row.original.parent_name && row.original.description && (
            <div className="text-xs text-muted-foreground truncate max-w-sm">{row.original.description}</div>
          )}
        </div>
      ),
    },
    ...(!selectedTypeId ? [{
      accessorKey: 'asset_type_name',
      header: 'Type',
      cell: ({ row }: { row: any }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.asset_type_name || '-'}
        </Badge>
      ),
    } as ColumnDef<AssetRead>] : []),
    {
      id: 'maturity',
      header: 'Maturity',
      cell: ({ row }) => {
        const m = (row.original as any).maturity;
        if (!m) return <span className="text-muted-foreground">-</span>;
        const colors: Record<string, string> = {
          idea: 'bg-slate-500', triaged: 'bg-slate-600', poc: 'bg-yellow-600',
          validating: 'bg-blue-600', production_candidate: 'bg-purple-600', production: 'bg-green-600',
        };
        return <Badge className={`text-xs text-white ${colors[m] || ''}`}>{m}</Badge>;
      },
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: ({ row }) => {
        const s = (row.original as any).publication_scope;
        if (!s || s === 'draft') return <span className="text-muted-foreground">draft</span>;
        return <Badge variant="secondary" className="text-xs">{s}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? 'outline'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.original.tags;
        if (!tags || tags.length === 0) return <span className="text-muted-foreground">-</span>;
        const visible = tags.slice(0, 2);
        const overflow = tags.slice(2);
        return (
          <div className="flex flex-wrap gap-1">
            {visible.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
            {overflow.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-default">+{overflow.length}</Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex flex-col gap-1">
                    {overflow.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Updated <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.updated_at
        ? <RelativeDate date={row.original.updated_at} />
        : '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigate(`/assets/${row.original.id}`)}
              >
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setPreviewAssetId(row.original.id ?? null); setPreviewAssetTitle(row.original.name ?? ''); }}
              >
                <Eye className="mr-2 h-4 w-4" /> Preview metadata
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canWrite}
                onClick={() => { setEditingAsset(row.original); setIsFormOpen(true); }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => openDeleteDialog(row.original.id)}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:text-red-400 dark:focus:bg-red-950"
                disabled={!canAdmin}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
    ];
    return cols;
  }, [canWrite, canAdmin, navigate, selectedTypeId]);

  if (apiIsLoading && assetTypes.length === 0) {
    // Asset Explorer uses a sidebar (asset type nav) + main DataTable layout
    return (
      <div className="py-6">
        <SplitPaneSkeleton
          sidebarVariant="list"
          sidebarItems={8}
          main="table"
          tableColumns={8}
          tableRows={6}
        />
      </div>
    );
  }

  if (!canRead && !permissionsLoading) {
    return (
      <div className="py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>You don't have access to view assets.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Funnel header — maturity distribution */}
      <div className="mb-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-2 flex items-center gap-2">
          <span className="w-4 h-px bg-primary inline-block" />
          Asset Explorer
        </p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          {totalAssetCount} assets across {visibleAssetTypes.length} types
        </h1>
        {/* Maturity funnel bar */}
        <div className="flex items-center gap-px mt-3 bg-muted rounded-lg overflow-hidden border">
          {MATURITY_ORDER.map((stage) => {
            const config = MATURITY_CONFIG[stage];
            const count = funnelCounts[stage] || 0;
            const isActive = maturityFilter === stage;
            return (
              <button
                key={stage}
                className={cn(
                  'flex-1 py-2.5 px-2 text-center transition-colors relative',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted-foreground/10',
                )}
                onClick={() => {
                  setMaturityFilter(isActive ? null : stage);
                  setPagination(prev => ({ ...prev, pageIndex: 0 }));
                }}
              >
                {isActive && <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', config.barColor)} />}
                <div className="text-sm font-bold tracking-tight">{count}</div>
                <div className={cn(
                  'text-[9px] font-mono uppercase tracking-wider',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}>{config.label}</div>
              </button>
            );
          })}
        </div>
        {maturityFilter && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs gap-1">
              Filtered: {MATURITY_CONFIG[maturityFilter]?.label || maturityFilter}
              <button className="ml-1 hover:text-destructive" onClick={() => setMaturityFilter(null)}>×</button>
            </Badge>
          </div>
        )}
      </div>

      {componentError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{componentError}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        {/* Sidebar: Asset Types grouped by category */}
        <div className="w-72 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Asset Types</CardTitle>
              <CardDescription className="text-xs">
                {assetTypes.length} types across {groupedTypes.length} categories
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="px-2 pb-2">
                  {/* "All" option */}
                  <button
                    onClick={() => handleTypeChange(null)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors mb-1',
                      !selectedTypeId
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <Shapes className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">All Assets</span>
                    <Badge variant={!selectedTypeId ? 'secondary' : 'outline'} className="text-xs ml-auto">
                      {totalAssetCount}
                    </Badge>
                  </button>

                  <Separator className="my-2" />

                  {groupedTypes.map(([category, types]) => {
                    const meta = CATEGORY_META[category] || CATEGORY_META.custom;
                    const CategoryIcon = meta.icon;
                    const categoryCount = types.reduce((s, t) => s + (t.asset_count || 0), 0);

                    return (
                      <div key={category} className="mb-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <CategoryIcon className="h-3.5 w-3.5" />
                          {meta.label}
                          <span className="ml-auto text-xs font-normal">{categoryCount}</span>
                        </div>
                        {types
                          .sort((a, b) => (b.asset_count || 0) - (a.asset_count || 0))
                          .map((assetType) => {
                            const TypeIcon = getIconComponent(assetType.icon);
                            const isSelected = selectedTypeId === assetType.id;
                            return (
                              <button
                                key={assetType.id}
                                onClick={() => handleTypeChange(assetType.id, assetType.name)}
                                className={cn(
                                  'w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted text-foreground'
                                )}
                              >
                                <TypeIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="flex-1 text-left truncate">{assetType.name}</span>
                                <Badge
                                  variant={isSelected ? 'secondary' : 'outline'}
                                  className="text-xs ml-auto"
                                >
                                  {assetType.asset_count || 0}
                                </Badge>
                              </button>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main content: Asset table */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedType && (() => {
                    const Icon = getIconComponent(selectedType.icon);
                    return <Icon className="h-5 w-5 text-muted-foreground" />;
                  })()}
                  <div>
                    <CardTitle className="text-sm font-semibold tracking-tight">
                      {selectedType ? selectedType.name : 'All Assets'}
                    </CardTitle>
                    {selectedType?.description && (
                      <CardDescription className="text-xs mt-0.5">
                        {selectedType.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedType?.category && (
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_META[selectedType.category]?.label || selectedType.category}
                    </Badge>
                  )}
                  <Badge variant="secondary">{selectedType ? selectedType.asset_count : totalAssetCount} assets</Badge>
                  {/* View toggle */}
                  <div className="flex border rounded-md overflow-hidden ml-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn('p-1.5 transition-colors', viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      id={asset.id}
                      name={asset.name}
                      description={asset.description || undefined}
                      typeName={asset.asset_type_name || undefined}
                      maturity={(asset as any).maturity || undefined}
                      publicationScope={(asset as any).publication_scope || undefined}
                      owner={asset.created_by || undefined}
                      updatedAt={asset.updated_at || undefined}
                      heroImageUrl={heroImages[asset.id]?.image_url}
                    />
                  ))}
                  {assets.length === 0 && !assetsLoading && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">No assets found.</div>
                  )}
                </div>
              ) : (
                <DataTable
                  isLoading={assetsLoading}
                  columns={columns}
                  data={assets}
                  searchColumn="name"
                  searchValue={nameFilter}
                  onSearchChange={setNameFilter}
                  storageKey={`asset-explorer-${selectedTypeId || 'all'}`}
                  onRowClick={(row) => navigate(`/assets/${row.id}`)}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  manualPagination
                  pageCount={Math.ceil(assetsTotal / pagination.pageSize)}
                  paginationState={pagination}
                  onPaginationChange={setPagination}
                  toolbarActions={
                    <div className="flex items-center gap-2">

                      {canRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => setIsImportExportOpen(true)}
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          {hasSelection ? `Export ${selectedAssetIds.length} Selected` : 'Import / Export'}
                        </Button>
                      )}
                      {canWrite && selectedType && (
                        <Button
                          size="sm"
                          className="h-9"
                          onClick={() => { setEditingAsset(null); setIsFormOpen(true); }}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add {selectedType.name}
                        </Button>
                      )}
                    </div>
                  }
                  bulkActions={(selectedRows) => (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-9 gap-1"
                      onClick={() => handleBulkDelete(selectedRows)}
                      disabled={selectedRows.length === 0 || !canAdmin}
                      title={canAdmin ? 'Delete selected assets' : 'Admin access required'}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete {selectedRows.length} Selected
                    </Button>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedType && (
        <AssetFormDialog
          isOpen={isFormOpen}
          onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingAsset(null); }}
          onSuccess={() => {
            fetchAssets(selectedTypeId, pagination, debouncedNameFilter, maturityFilter);
            fetchAssetTypes();
            fetchFunnelCounts();
          }}
          assetTypeId={selectedType.id}
          assetTypeName={selectedType.name}
          assetTypeIri={getOntologyIri(selectedType.name)}
          asset={editingAsset}
        />
      )}

      {deletingId && (
        <AssetDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setDeletingId(null);
          }}
          assetId={deletingId}
          assetName={assets.find(a => a.id === deletingId)?.name || ''}
          onDeleted={() => {
            fetchAssets(selectedTypeId, pagination, debouncedNameFilter, maturityFilter);
            fetchAssetTypes();
            fetchFunnelCounts();
            setDeletingId(null);
          }}
        />
      )}

      <EntityInfoDialog
        entityType="asset"
        entityId={previewAssetId}
        open={!!previewAssetId}
        onOpenChange={(o) => { if (!o) setPreviewAssetId(null); }}
        title={previewAssetTitle}
      />

      <AssetImportExportDialog
        isOpen={isImportExportOpen}
        onOpenChange={(open) => {
          setIsImportExportOpen(open);
          if (!open) setRowSelection({});
        }}
        selectedAssetTypeId={selectedTypeId}
        selectedAssetTypeName={selectedType?.name}
        selectedAssetIds={selectedAssetIds}
        canImport={canWrite}
        onImportComplete={() => {
          fetchAssets(selectedTypeId, pagination, debouncedNameFilter, maturityFilter);
          fetchAssetTypes();
          fetchFunnelCounts();
          setRowSelection({});
        }}
      />
    </div>
  );
}
