import { useEffect } from 'react';
import { useCopilotStore, type CopilotEntity } from '@/stores/copilot-store';

/**
 * Sets the Copilot page context so the panel can include it in LLM messages.
 * Automatically clears context on unmount.
 */
export function useCopilotContext(
  pageName: string,
  pageUrl: string,
  selectedEntity?: CopilotEntity | null,
  featureId?: string,
) {
  const { setContext, clearContext } = useCopilotStore((s) => s.actions);

  useEffect(() => {
    setContext(pageName, pageUrl, selectedEntity ?? undefined, featureId);
    return () => clearContext();
  }, [pageName, pageUrl, selectedEntity?.type, selectedEntity?.name, selectedEntity?.id, featureId, setContext, clearContext]);
}
