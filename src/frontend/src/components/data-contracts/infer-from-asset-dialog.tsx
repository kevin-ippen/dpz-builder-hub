import { useState } from 'react';
import { AssetSelector } from '@/components/common/asset-selector';
import type { SelectedAsset } from '@/components/common/asset-selector';
import { useToast } from '@/hooks/use-toast';

export interface InferredSchemaObject {
  name: string;
  physicalName: string;
  description: string;
  physicalType: string;
  properties: Array<{
    name: string;
    physicalType: string;
    logicalType: string;
    required: boolean;
    description: string;
    partitioned: boolean;
  }>;
}

interface InferFromAssetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInfer: (schemas: InferredSchemaObject[]) => void;
}

const TARGET_ASSET_TYPES = ['Dataset', 'Table', 'View', 'Schema', 'Function', 'Metric'];

export default function InferFromAssetDialog({
  isOpen,
  onOpenChange,
  onInfer,
}: InferFromAssetDialogProps) {
  const [isInferring, setIsInferring] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async (assets: SelectedAsset[]) => {
    if (assets.length === 0) return;
    setIsInferring(true);
    try {
      const results = await Promise.all(
        assets.map(async (asset) => {
          const resp = await fetch(`/api/assets/${asset.id}/infer-schema`);
          if (!resp.ok) throw new Error(`Failed to infer schema from "${asset.name}"`);
          return resp.json() as Promise<InferredSchemaObject[]>;
        }),
      );
      const merged = results.flat();
      if (merged.length > 0) {
        onInfer(merged);
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'No schemas found', description: 'The selected assets did not contain any inferrable schema structure.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Schema inference failed', description: err.message });
    } finally {
      setIsInferring(false);
    }
  };

  return (
    <AssetSelector
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onConfirm={handleConfirm}
      targetAssetTypes={TARGET_ASSET_TYPES}
      title="Infer Schema from Assets"
      description="Search for existing assets and import their structure as contract schemas."
      confirmLabel={isInferring ? 'Inferring...' : 'Infer Schema'}
      closeOnConfirm={false}
      confirmDisabled={isInferring}
    />
  );
}
