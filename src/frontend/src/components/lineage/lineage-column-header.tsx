/**
 * Non-interactive column header node for the lineage column view.
 */

import { memo } from 'react';
import type { NodeProps } from 'reactflow';

export interface ColumnHeaderData {
  label: string;
}

const LineageColumnHeader = memo(({ data }: NodeProps<ColumnHeaderData>) => {
  return (
    <div className="flex items-center justify-center px-4 py-1.5 rounded-md bg-muted/40 dark:bg-muted/20 min-w-[180px]">
      <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
        {data.label}
      </span>
    </div>
  );
});

LineageColumnHeader.displayName = 'LineageColumnHeader';

export default LineageColumnHeader;
