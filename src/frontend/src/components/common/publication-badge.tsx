import { Globe, Lock, Eye, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PUBLICATION_SCOPE_LABELS, type PublicationScope } from '@/types/lifecycle';

interface PublicationBadgeProps {
  publicationScope: string | null | undefined;
  publishedAt?: string | null;
  publishedBy?: string | null;
}

const SCOPE_ICONS: Record<string, typeof Globe> = {
  none: Lock,
  domain: Building2,
  organization: Eye,
  external: Globe,
};

const SCOPE_COLORS: Record<string, string> = {
  none: '',
  domain: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  organization: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  external: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function PublicationBadge({
  publicationScope,
  publishedAt,
  publishedBy,
}: PublicationBadgeProps) {
  const scope = (publicationScope || 'none') as PublicationScope;
  if (scope === 'none') return null;

  const label = PUBLICATION_SCOPE_LABELS[scope] || scope;
  const IconComponent = SCOPE_ICONS[scope] || Globe;
  const colorClass = SCOPE_COLORS[scope] || '';

  const tooltipLines = [
    `Published: ${label}`,
    publishedBy ? `By: ${publishedBy}` : null,
    publishedAt ? `On: ${new Date(publishedAt).toLocaleDateString()}` : null,
  ].filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${colorClass} cursor-default`}>
            <IconComponent className="h-3 w-3 mr-1" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            {tooltipLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
