import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { KnowledgeCollection } from '@/types/ontology';
import { Loader2, Upload, FileUp, X } from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.ttl,.rdf,.xml,.owl,.n3,.nt,.jsonld,.json';

interface ImportConceptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: KnowledgeCollection[];
  onImported: () => void;
}

export const ImportConceptsDialog: React.FC<ImportConceptsDialogProps> = ({
  open,
  onOpenChange,
  collections,
  onImported,
}) => {
  const { t } = useTranslation(['semantic-models', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCollectionIri, setSelectedCollectionIri] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ triples_imported: number } | null>(null);

  const editableCollections = collections.filter((c) => c.is_editable);

  const flattenCollections = (
    colls: KnowledgeCollection[],
    level = 0
  ): Array<{ iri: string; label: string; level: number }> => {
    let items: Array<{ iri: string; label: string; level: number }> = [];
    for (const c of colls) {
      if (c.is_editable) {
        items.push({ iri: c.iri, label: c.label, level });
      }
      if (c.child_collections?.length) {
        items = items.concat(flattenCollections(c.child_collections, level + 1));
      }
    }
    return items;
  };

  const flatOptions = flattenCollections(collections);

  const resetState = () => {
    setSelectedFile(null);
    setSelectedCollectionIri('');
    setError(null);
    setResult(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setResult(null);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedCollectionIri) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(
        `/api/knowledge/collections/${encodeURIComponent(selectedCollectionIri)}/import`,
        { method: 'POST', body: formData }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Import failed (${response.status})`);
      }

      const data = await response.json();
      setResult(data);
      onImported();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = !!selectedFile && !!selectedCollectionIri && !isUploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('semantic-models:import.title', 'Import Concepts')}</DialogTitle>
          <DialogDescription>
            {t(
              'semantic-models:import.description',
              'Upload an RDF file (Turtle, RDF/XML, OWL, JSON-LD) to import concepts into a collection.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Collection selector */}
            <div className="grid gap-2">
              <Label>{t('semantic-models:import.targetCollection', 'Target Collection')}</Label>
              <Select
                value={selectedCollectionIri}
                onValueChange={setSelectedCollectionIri}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('semantic-models:import.selectCollection', 'Select a collection…')} />
                </SelectTrigger>
                <SelectContent>
                  {flatOptions.map((opt) => (
                    <SelectItem key={opt.iri} value={opt.iri}>
                      {'—'.repeat(opt.level)}{opt.level > 0 ? ' ' : ''}{opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editableCollections.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('semantic-models:import.noEditableCollections', 'No editable collections available. Create one first.')}
                </p>
              )}
            </div>

            {/* File picker */}
            <div className="grid gap-2">
              <Label>{t('semantic-models:import.file', 'File')}</Label>
              {selectedFile ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('semantic-models:import.chooseFile', 'Choose file…')}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground">
                {t('semantic-models:import.supportedFormats', 'Supported: Turtle (.ttl), RDF/XML (.rdf, .xml), OWL (.owl), N-Triples (.nt), N3 (.n3), JSON-LD (.jsonld, .json)')}
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success */}
            {result && (
              <Alert>
                <AlertDescription>
                  {t('semantic-models:import.success', {
                    count: result.triples_imported,
                    defaultValue: 'Successfully imported {{count}} triples.',
                  })}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
            >
              {result ? t('common:actions.close', 'Close') : t('common:actions.cancel', 'Cancel')}
            </Button>
            {!result && (
              <Button type="submit" disabled={!canSubmit}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="h-4 w-4 mr-2" />
                {t('semantic-models:import.submit', 'Import')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportConceptsDialog;
