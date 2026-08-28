import { Shield, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CertificationLevel } from '@/types/lifecycle';

interface CertificationBadgeProps {
  certificationLevel: number | null | undefined;
  inheritedCertificationLevel?: number | null;
  certifiedAt?: string | null;
  certifiedBy?: string | null;
  levels: CertificationLevel[];
  size?: 'sm' | 'md';
}

const COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

export default function CertificationBadge({
  certificationLevel,
  inheritedCertificationLevel,
  certifiedAt,
  certifiedBy,
  levels,
  size = 'sm',
}: CertificationBadgeProps) {
  const effectiveLevel = Math.max(certificationLevel ?? 0, inheritedCertificationLevel ?? 0);
  if (!effectiveLevel) return null;

  const levelDef = levels.find(l => l.level_order === effectiveLevel);
  if (!levelDef) return null;

  const isInherited = !certificationLevel && !!inheritedCertificationLevel;
  const colorClass = COLOR_MAP[levelDef.color || 'amber'] || COLOR_MAP.amber;
  const IconComponent = levelDef.icon === 'shield' ? Shield : ShieldCheck;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  const tooltipLines = [
    `Level: ${levelDef.name}`,
    isInherited ? '(Inherited)' : null,
    certifiedBy ? `By: ${certifiedBy}` : null,
    certifiedAt ? `On: ${new Date(certifiedAt).toLocaleDateString()}` : null,
  ].filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${colorClass} cursor-default`}>
            <IconComponent className={`${iconSize} mr-1`} />
            {levelDef.name}
            {isInherited && <span className="ml-1 opacity-60 text-[10px]">↓</span>}
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
