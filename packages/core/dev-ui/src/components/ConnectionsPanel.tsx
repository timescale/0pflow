import { useMemo } from "react";
import { IntegrationSection } from "./IntegrationSection";
import type { useConnections } from "../hooks/useConnections";
import { useNangoIntegrations } from "../hooks/useConnections";
import type { WorkflowDAG } from "../types";

interface ConnectionsPanelProps {
  workflows: WorkflowDAG[];
  connectionsApi: ReturnType<typeof useConnections>;
}

export function ConnectionsPanel({ workflows, connectionsApi }: ConnectionsPanelProps) {
  const { integrations: nangoIntegrations, loading } = useNangoIntegrations();

  // Collect integration IDs referenced by DAG nodes (for context)
  const usedIntegrationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const wf of workflows) {
      for (const node of wf.nodes) {
        if (node.integrations) {
          for (const id of node.integrations) {
            ids.add(id);
          }
        }
      }
    }
    return ids;
  }, [workflows]);

  // Show Nango integrations that are either used by nodes or available to configure
  const availableIntegrations = useMemo(() => {
    if (nangoIntegrations.length === 0) {
      // Nango not configured or no integrations — fall back to DAG-declared ones
      return Array.from(usedIntegrationIds).sort();
    }
    // Show all Nango integrations, with used ones first
    return nangoIntegrations
      .map((i) => i.id)
      .sort((a, b) => {
        const aUsed = usedIntegrationIds.has(a) ? 0 : 1;
        const bUsed = usedIntegrationIds.has(b) ? 0 : 1;
        return aUsed - bUsed || a.localeCompare(b);
      });
  }, [nangoIntegrations, usedIntegrationIds]);

  if (loading) return null;
  if (availableIntegrations.length === 0) return null;

  return (
    <div className="border-t border-border pt-3">
      <p className="text-[11px] uppercase tracking-wider text-[#a8a099] mb-2 px-1">
        Global Connections
      </p>
      <div className="flex flex-col gap-3">
        {availableIntegrations.map((integrationId) => (
          <IntegrationSection
            key={integrationId}
            integrationId={integrationId}
            workflowName="*"
            nodeName="*"
            connectionsApi={connectionsApi}
          />
        ))}
      </div>
    </div>
  );
}
