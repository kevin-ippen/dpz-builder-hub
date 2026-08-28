export type EntityKind = 'data_domain' | 'data_product' | 'data_contract' | 'asset';

export type QualityDimension =
  | 'accuracy'
  | 'completeness'
  | 'conformity'
  | 'consistency'
  | 'coverage'
  | 'timeliness'
  | 'uniqueness'
  | 'other';

export type QualitySource =
  | 'manual'
  | 'dbt'
  | 'dqx'
  | 'great_expectations'
  | 'soda'
  | 'external';

export const QUALITY_DIMENSIONS: QualityDimension[] = [
  'accuracy', 'completeness', 'conformity', 'consistency',
  'coverage', 'timeliness', 'uniqueness', 'other',
];

export const QUALITY_SOURCES: QualitySource[] = [
  'manual', 'dbt', 'dqx', 'great_expectations', 'soda', 'external',
];

export interface QualityItem {
  id: string;
  entity_id: string;
  entity_type: EntityKind;
  title?: string | null;
  description?: string | null;
  dimension: QualityDimension;
  source: QualitySource;
  score_percent: number;
  checks_passed?: number | null;
  checks_total?: number | null;
  measured_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityItemCreate {
  entity_id: string;
  entity_type: EntityKind;
  title?: string | null;
  description?: string | null;
  dimension: QualityDimension;
  source?: QualitySource;
  score_percent: number;
  checks_passed?: number | null;
  checks_total?: number | null;
  measured_at?: string | null;
}

export interface QualityItemUpdate extends Partial<Omit<QualityItemCreate, 'entity_id' | 'entity_type'>> {}

export interface QualitySummary {
  overall_score_percent: number;
  items_count: number;
  by_dimension: Record<string, number>;
  by_source: Record<string, number>;
  measured_at?: string | null;
}

export const dimensionColors: Record<QualityDimension, string> = {
  accuracy: '#3b82f6',
  completeness: '#22c55e',
  conformity: '#8b5cf6',
  consistency: '#f59e0b',
  coverage: '#06b6d4',
  timeliness: '#ec4899',
  uniqueness: '#f97316',
  other: '#64748b',
};

export function scoreColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}
