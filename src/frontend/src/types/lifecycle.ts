/**
 * Shared lifecycle types used across all entity types.
 *
 * EntityStatus replaces DataProductStatus, ContractStatus, DatasetStatus, AssetStatus.
 * PublicationScope replaces the boolean `published` flag.
 */

export type EntityStatus =
  | 'draft'
  | 'sandbox'
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'deprecated'
  | 'retired';

export type PublicationScope = 'none' | 'domain' | 'organization' | 'external';

export interface CertificationInfo {
  certification_level: number | null;
  inherited_certification_level: number | null;
  certified_at: string | null;
  certified_by: string | null;
  certification_expires_at: string | null;
  certification_notes: string | null;
}

export interface PublicationInfo {
  publication_scope: PublicationScope;
  published_at: string | null;
  published_by: string | null;
}

export interface CertificationLevel {
  id: string;
  level_order: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

export const ENTITY_STATUS_LABELS: Record<EntityStatus, string> = {
  draft: 'Draft',
  sandbox: 'Sandbox',
  proposed: 'Proposed',
  under_review: 'Under Review',
  approved: 'Approved',
  active: 'Active',
  deprecated: 'Deprecated',
  retired: 'Retired',
};

export const ENTITY_STATUS_COLORS: Record<EntityStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  sandbox: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  proposed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  deprecated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  retired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export const PUBLICATION_SCOPE_LABELS: Record<PublicationScope, string> = {
  none: 'Not Published',
  domain: 'Domain',
  organization: 'Organization',
  external: 'External',
};
