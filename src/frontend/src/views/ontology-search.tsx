import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import useBreadcrumbStore from '@/stores/breadcrumb-store';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KGSearch from '@/components/search/kg-search';
import ConceptsSearch from '@/components/search/concepts-search';
import PropertiesSearch from '@/components/search/properties-search';

type SearchMode = 'concepts' | 'properties' | 'kg';

const VALID_TABS = new Set<SearchMode>(['concepts', 'properties', 'kg']);

function getTabFromParams(search: string): SearchMode {
  const params = new URLSearchParams(search);
  const tab = params.get('tab') as SearchMode | null;
  if (tab && VALID_TABS.has(tab)) return tab;
  // Auto-select KG tab when KG-specific params are present
  if (params.has('path') || params.has('prefix') || params.has('sparql')) return 'kg';
  return 'concepts';
}

export default function OntologySearchView() {
  const { t } = useTranslation(['search', 'semantic-models', 'common']);
  const location = useLocation();
  const navigate = useNavigate();
  const setStaticSegments = useBreadcrumbStore((state) => state.setStaticSegments);
  const setDynamicTitle = useBreadcrumbStore((state) => state.setDynamicTitle);

  const searchMode = getTabFromParams(location.search);

  const params = new URLSearchParams(location.search);

  const pageTitle = t('search:tabs.searchConcepts', { defaultValue: 'Search Concepts' });
  const pageSubtitle = t('search:subtitles.searchConcepts', { defaultValue: 'Search and browse ontology concepts and properties' });

  useEffect(() => {
    setStaticSegments([]);
    setDynamicTitle(pageTitle);
    return () => {
      setStaticSegments([]);
      setDynamicTitle(null);
    };
  }, [setStaticSegments, setDynamicTitle, pageTitle]);

  const handleTabChange = useCallback((newTab: string) => {
    const nextParams = new URLSearchParams(location.search);
    if (newTab === 'concepts') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', newTab);
    }
    const qs = nextParams.toString();
    navigate(qs ? `${location.pathname}?${qs}` : location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const query = params.get('query') || '';
  const iri = params.get('iri');

  const kgPrefix = params.get('prefix') || '';
  const kgPath = params.get('path')?.split('|').filter(Boolean) || [];
  const kgSparql = params.get('sparql') || 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10';
  const kgDirection = (params.get('direction') as 'all' | 'incoming' | 'outgoing') || 'all';
  const kgConceptsOnly = params.get('concepts_only') === 'true';

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="w-8 h-8" />
          {pageTitle}
        </h1>
        <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
      </div>

      <Tabs value={searchMode} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="concepts">{t('search:tabs.concepts', { defaultValue: 'Concepts' })}</TabsTrigger>
          <TabsTrigger value="properties">{t('search:tabs.properties', { defaultValue: 'Properties' })}</TabsTrigger>
          <TabsTrigger value="kg">{t('search:tabs.knowledgeGraph', { defaultValue: 'Knowledge Graph' })}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {searchMode === 'concepts' && (
          <ConceptsSearch
            initialQuery={query}
            initialSelectedConcept={iri ? {
              value: iri,
              label: iri.split('/').pop() || iri.split('#').pop() || iri,
              type: 'class' as const,
            } : null}
          />
        )}
        {searchMode === 'properties' && (
          <PropertiesSearch
            initialQuery={query}
            initialSelectedProperty={iri ? {
              value: iri,
              label: iri.split('/').pop() || iri.split('#').pop() || iri,
              type: 'property' as const,
            } : null}
          />
        )}
        {searchMode === 'kg' && (
          <KGSearch
            initialPrefix={kgPrefix}
            initialPath={kgPath}
            initialSparql={kgSparql}
            initialDirectionFilter={kgDirection}
            initialShowConceptsOnly={kgConceptsOnly}
          />
        )}
      </div>
    </div>
  );
}
