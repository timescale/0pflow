import { useMemo, useState, useEffect } from "react";
import { IntegrationSection } from "./IntegrationSection";
import type { useConnections } from "../hooks/useConnections";
import { useNangoIntegrations, useNangoConnections } from "../hooks/useConnections";
import type { WorkflowDAG } from "../types";

/** Invisible probe: reports whether an integration has connections */
function ConnectionProbe({ integrationId, onResult }: {
  integrationId: string;
  onResult: (id: string, has: boolean) => void;
}) {
  const { nangoConnections, loading } = useNangoConnections(integrationId);
  const hasConnections = nangoConnections.length > 0;
  useEffect(() => {
    if (!loading) onResult(integrationId, hasConnections);
  }, [loading, hasConnections, integrationId, onResult]);
  return null;
}

interface CredentialsPageProps {
  workflows: WorkflowDAG[];
  connectionsApi: ReturnType<typeof useConnections>;
  onBack: () => void;
}

export function CredentialsPage({ workflows, connectionsApi, onBack }: CredentialsPageProps) {
  const { integrations: nangoIntegrations, loading } = useNangoIntegrations();
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});

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

  const allIntegrationIds = useMemo(() => {
    const allIds = new Set(usedIntegrationIds);
    for (const i of nangoIntegrations) {
      allIds.add(i.id);
    }
    return Array.from(allIds).sort((a, b) => a.localeCompare(b));
  }, [nangoIntegrations, usedIntegrationIds]);

  const handleProbeResult = useMemo(() => {
    return (id: string, has: boolean) => {
      setConnectionStatus((prev) => {
        if (prev[id] === has) return prev;
        return { ...prev, [id]: has };
      });
    };
  }, []);

  const connectedIds = useMemo(
    () => allIntegrationIds.filter((id) => connectionStatus[id]),
    [allIntegrationIds, connectionStatus],
  );
  const unconnectedIds = useMemo(
    () => allIntegrationIds.filter((id) => connectionStatus[id] === false),
    [allIntegrationIds, connectionStatus],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-[700px]">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-[#787068] hover:text-[#1a1a1a] transition-colors cursor-pointer mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Page header */}
        <h1 className="text-2xl font-light tracking-tight text-[#1a1a1a]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          Connections
        </h1>
        <p className="text-sm text-[#787068] mt-1 tracking-wide">
          Manage connections and credentials for your integrations.
        </p>

        {/* Divider */}
        <div className="h-px bg-[#e8e4df] my-6" />

        {/* Invisible probes to determine which integrations have connections */}
        {allIntegrationIds.map((id) => (
          <ConnectionProbe
            key={id}
            integrationId={id}
            onResult={handleProbeResult}
          />
        ))}

        {loading ? (
          <div className="rounded-lg border border-[#e8e4df] bg-white p-4">
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#f0ece7] animate-pulse" />
                  <div className="flex-1">
                    <div className="h-3.5 w-24 bg-[#f0ece7] rounded animate-pulse" />
                    <div className="h-3 w-40 bg-[#f0ece7] rounded animate-pulse mt-1.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : allIntegrationIds.length === 0 ? (
          <div className="rounded-lg border border-[#e8e4df] bg-white p-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-lg bg-[#f0ece7] flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8a099" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <p className="text-[13px] text-[#1a1a1a] font-medium">No integrations available</p>
            <p className="text-[11px] text-[#a8a099] mt-1">
              Add integrations to your workflow nodes to configure connections here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Connected integrations */}
            {connectedIds.length > 0 && (
              <div className="flex flex-col gap-3">
                {connectedIds.map((integrationId) => (
                  <div key={integrationId} className="rounded-lg border border-[#e8e4df] bg-white px-4 py-3.5">
                    <IntegrationSection
                      integrationId={integrationId}
                      workflowName="*"
                      nodeName="*"
                      connectionsApi={connectionsApi}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Unconnected integrations — compact */}
            {unconnectedIds.length > 0 && (
              <div>
                <p className="text-[11px] text-[#a8a099] mb-2">Available integrations</p>
                <div className="flex flex-wrap gap-1.5">
                  {unconnectedIds.map((integrationId) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
