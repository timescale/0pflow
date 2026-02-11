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

  // Show all integrations: merge Nango-configured + DAG-declared, used ones first
  const availableIntegrations = useMemo(() => {
    const allIds = new Set(usedIntegrationIds);
    for (const i of nangoIntegrations) {
      allIds.add(i.id);
    }
    return Array.from(allIds).sort((a, b) => {
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
