/**
 * Temporary dev route for previewing the column-based lineage view.
 * Usage: /dev/lineage?type=DataProduct&id=some-uuid
 * Remove this file and its route in Phase 3.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BusinessLineageView } from './index';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function DevLineageRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramType = searchParams.get('type') || '';
  const paramId = searchParams.get('id') || '';

  const [entityType, setEntityType] = useState(paramType);
  const [entityId, setEntityId] = useState(paramId);
  const [activeType, setActiveType] = useState(paramType);
  const [activeId, setActiveId] = useState(paramId);

  const handleLoad = () => {
    setActiveType(entityType);
    setActiveId(entityId);
    setSearchParams({ type: entityType, id: entityId });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Entity Type:</span>
        <Input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="e.g. DataProduct"
          className="w-48"
        />
        <span className="text-sm font-medium text-muted-foreground">Entity ID:</span>
        <Input
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="e.g. uuid"
          className="w-80"
        />
        <Button onClick={handleLoad} size="sm">Load</Button>
      </div>

      {activeType && activeId ? (
        <BusinessLineageView
          entityType={activeType}
          entityId={activeId}
          className="h-[600px]"
        />
      ) : (
        <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-md text-muted-foreground text-sm">
          Enter an entity type and ID above, then click Load
        </div>
      )}
    </div>
  );
}
