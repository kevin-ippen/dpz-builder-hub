import { Badge } from '@/components/ui/badge';
import { Building2, Eye, Globe, Lock } from 'lucide-react';
import {
  PUBLICATION_SCOPE_LABELS,
  type PublicationScope,
} from '@/types/lifecycle';

interface PublicationScopeBadgeProps {
  scope: PublicationScope | string | null | undefined;
  publishedAt?: string | null;
  publishedBy?: string | null;
  size?: 'sm' | 'md';
}

const SCOPE_ICONS: Record<string, typeof Globe> = {
  none: Lock,
  domain: Building2,
  organization: Eye,
  external: Globe,
};

export default function PublicationScopeBadge({
  scope,
  publishedAt,
  publishedBy,
  size = 'sm',
}: PublicationScopeBadgeProps) {
  const effectiveScope = (scope || 'none') as PublicationScope;
  const label = PUBLICATION_SCOPE_LABELS[effectiveScope] || effectiveScope;
  const Icon = SCOPE_ICONS[effectiveScope] || Lock;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  const titleParts = [
    `Scope: ${label}`,
    publishedBy ? `By: ${publishedBy}` : null,
    publishedAt ? `On: ${new Date(publishedAt).toLocaleDateString()}` : null,
  ].filter(Boolean) as string[];

  return (
    <Badge
      variant={effectiveScope === 'none' ? 'secondary' : 'outline'}
      className="text-xs"
      title={titleParts.join(' • ')}
    >
      <Icon className={`${iconSize} mr-1`} />
      {label}
    </Badge>
  );
}
