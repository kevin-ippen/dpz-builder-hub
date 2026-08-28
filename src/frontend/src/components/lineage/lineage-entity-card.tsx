/**
 * ERD-style entity card for column lineage view.
 *
 * Renders as a table-like block: colored header bar with entity name/type,
 * and child rows below — each with its own left/right ReactFlow Handle
 * for column-to-column edge routing.
 *
 * ┌══════════════════════════════════┐
 * ║  📊 Sales Analytics     Dataset ║  ← Colored header bar
 * ╠══════════════════════════════════╣
 * │ ○ Retail Events Stream    Table ○│  ← Child rows with ports
 * │ ○ Sales Metrics MV        View  ○│
 * │ ○ Customer Dim            Table ○│
 * └──────────────────────────────────┘
 */

import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ChevronDown, ChevronRight, Box } from 'lucide-react';
import { TYPE_COLOR, ICON_MAP, humanizeType, DEFAULT_HEX } from './constants';
import type { LineageGraphNode } from '@/types/ontology-schema';
import type { LayoutConfig } from './layout';
import { DEFAULT_CONFIG } from './layout';

export interface GroupCardData {
  node: LineageGraphNode;
  children: LineageGraphNode[];
  /** Containment depth per child (0=direct, 1=grandchild). Parallel to children array. */
  childDepths?: number[];
  isCenter: boolean;
  system?: string;
  config: LayoutConfig;
  onClick: (entityType: string, entityId: string) => void;
}

const LineageEntityCard = memo(({ data }: NodeProps<GroupCardData>) => {
  const { node, children, childDepths, isCenter, system, config = DEFAULT_CONFIG, onClick } = data;
  const colors = TYPE_COLOR[node.entity_type];
  const borderHex = colors?.hex || DEFAULT_HEX;
  const IconComponent = (node.icon && ICON_MAP[node.icon]) || Box;

  const maxShown = config.maxChildrenShown;
  const [expanded, setExpanded] = useState(false);
  const visibleChildren = expanded ? children : children.slice(0, maxShown);
  const hasOverflow = children.length > maxShown;

  const width = config.nodeWidth;
  const headerH = config.headerHeight;
  const rowH = config.childRowHeight;

  return (
    <div
      className={`
        relative rounded-lg overflow-hidden border shadow-sm
        transition-shadow hover:shadow-md
        ${isCenter ? 'ring-2 ring-amber-400/60 dark:ring-amber-500/40 shadow-md' : ''}
      `}
      style={{ width }}
    >
      {/* ── Parent-level handles (fallback for parent-to-parent edges) ── */}
      <Handle
        type="target"
        position={Position.Left}
        id="parent"
        className="!w-2 !h-2 !border-2 !border-background !-left-[5px] !opacity-0"
        style={{ background: borderHex, top: headerH / 2 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="parent"
        className="!w-2 !h-2 !border-2 !border-background !-right-[5px] !opacity-0"
        style={{ background: borderHex, top: headerH / 2 }}
      />

      {/* ── Colored header bar ───────────────────────────────────── */}
      <div
        className="cursor-pointer px-3 flex items-center gap-2"
        style={{
          height: headerH,
          backgroundColor: borderHex,
        }}
        onClick={() => onClick(node.entity_type, node.entity_id)}
      >
        <IconComponent className="h-4 w-4 shrink-0 text-white/90" />
        <span className="text-sm font-semibold truncate flex-1 min-w-0 text-white">
          {node.name}
        </span>
        <span className="text-[10px] font-medium text-white/75 shrink-0 uppercase tracking-wide">
          {humanizeType(node.entity_type)}
        </span>
      </div>

      {/* ── System badge (subtle, below header) ──────────────────── */}
      {system && (
        <div className="px-3 py-0.5 bg-muted/30 text-[10px] text-muted-foreground truncate border-b">
          {system}
        </div>
      )}

      {/* ── Children rows ────────────────────────────────────────── */}
      {children.length > 0 && (
        <div className="bg-card">
          {visibleChildren.map((child, index) => {
            const ChildIcon = (child.icon && ICON_MAP[child.icon]) || Box;
            const childColors = TYPE_COLOR[child.entity_type];
            const childHex = childColors?.hex || DEFAULT_HEX;
            const depth = childDepths?.[index] ?? 0;
            const indentPx = depth * 16; // 16px per nesting level

            // Y position of this row's center relative to node top
            const systemBarH = system ? 20 : 0;
            const rowCenterY = headerH + systemBarH + (index * rowH) + (rowH / 2);

            return (
              <div
                key={child.id}
                className={`
                  relative flex items-center gap-2 cursor-pointer
                  hover:bg-muted/50 transition-colors
                  ${index > 0 ? 'border-t border-border/30' : ''}
                  ${depth > 0 ? 'bg-muted/20' : ''}
                `}
                style={{ height: rowH, paddingLeft: 12 + indentPx, paddingRight: 12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(child.entity_type, child.entity_id);
                }}
              >
                {/* Left handle (target) for this child row */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`child-${index}`}
                  className="!w-2 !h-2 !rounded-full !border !border-border !-left-[5px]"
                  style={{ background: childHex, top: rowCenterY }}
                />

                <ChildIcon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: childHex }}
                />
                <span className="text-xs truncate flex-1 min-w-0">
                  {child.name}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {humanizeType(child.entity_type)}
                </span>

                {/* Right handle (source) for this child row */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`child-${index}`}
                  className="!w-2 !h-2 !rounded-full !border !border-border !-right-[5px]"
                  style={{ background: childHex, top: rowCenterY }}
                />
              </div>
            );
          })}

          {/* Overflow toggle */}
          {hasOverflow && (
            <button
              className="flex items-center gap-1 px-3 w-full text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/30"
              style={{ height: rowH }}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  +{children.length - maxShown} more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Status indicator ─────────────────────────────────────── */}
      {node.status && node.status !== 'active' && (
        <div className="absolute top-1 right-1">
          <span
            className={`
              inline-block w-2 h-2 rounded-full
              ${node.status === 'deprecated' ? 'bg-red-500' : 'bg-yellow-500'}
            `}
            title={node.status}
          />
        </div>
      )}
    </div>
  );
});

LineageEntityCard.displayName = 'LineageEntityCard';

export default LineageEntityCard;
