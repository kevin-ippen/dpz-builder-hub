/**
 * Toolbar for the column-based lineage view — direction, depth, controls.
 */

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, ArrowRight, ArrowLeftRight, Maximize, ZoomIn, ZoomOut, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type LineageDirection = 'upstream' | 'downstream' | 'both';

interface LineageToolbarProps {
  direction: LineageDirection;
  onDirectionChange: (d: LineageDirection) => void;
  maxDepth: number;
  onMaxDepthChange: (d: number) => void;
  nestingDepth: number;
  onNestingDepthChange: (d: number) => void;
  nodeCount: number;
  edgeCount: number;
  showLegend: boolean;
  onToggleLegend: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const DIRECTIONS: { value: LineageDirection; icon: React.ElementType; label: string }[] = [
  { value: 'upstream', icon: ArrowLeft, label: 'Upstream' },
  { value: 'both', icon: ArrowLeftRight, label: 'Both' },
  { value: 'downstream', icon: ArrowRight, label: 'Downstream' },
];

export default function LineageToolbar({
  direction,
  onDirectionChange,
  maxDepth,
  onMaxDepthChange,
  nestingDepth,
  onNestingDepthChange,
  nodeCount,
  edgeCount,
  showLegend,
  onToggleLegend,
  onFitView,
  onZoomIn,
  onZoomOut,
}: LineageToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 rounded-t-md flex-wrap">
      {/* Direction toggle */}
      <div className="flex items-center rounded-md border bg-background p-0.5">
        {DIRECTIONS.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-xs rounded-sm',
              direction === value && 'bg-accent text-accent-foreground shadow-sm',
            )}
            onClick={() => onDirectionChange(value)}
          >
            <Icon className="h-3.5 w-3.5 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {/* Breadth selector (BFS hops) */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Breadth:</span>
        <Select
          value={String(maxDepth)}
          onValueChange={(v) => onMaxDepthChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-14 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((d) => (
              <SelectItem key={d} value={String(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nesting depth selector (containment levels) */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Nesting:</span>
        <Select
          value={String(nestingDepth)}
          onValueChange={(v) => onNestingDepthChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-14 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((d) => (
              <SelectItem key={d} value={String(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entity count */}
      <Badge variant="secondary" className="text-xs font-normal">
        {nodeCount} entities · {edgeCount} edges
      </Badge>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Legend toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleLegend}
        className={showLegend ? 'bg-accent' : ''}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" onClick={onZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onFitView}>
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
