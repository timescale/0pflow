import { useState, useCallback } from "react";
import type { WorkflowRun, TraceResult, OperationTrace } from "../types";

interface RunHistoryTabProps {
  runs: WorkflowRun[];
  loading: boolean;
  selectedRunId: string | null;
  trace: TraceResult | null;
  traceLoading: boolean;
  selectRun: (runId: string | null) => void;
  refresh: () => void;
}

const runStatusConfig: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  SUCCESS: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Success" },
  ERROR: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  PENDING: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
  RETRIES_EXCEEDED: { bg: "bg-red-50", text: "text-red-700", label: "Retries Exceeded" },
};

export function RunHistoryTab({
  runs,
  loading,
  selectedRunId,
  trace,
  traceLoading,
  selectRun,
  refresh,
}: RunHistoryTabProps) {
  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading runs...
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-[13px] text-foreground/60">No runs yet</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-[240px]">
            Workflow runs will appear here with their status, duration, and step-by-step trace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between border-b border-border">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {runs.length} run{runs.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={refresh}
          className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Run list */}
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-1">
        {runs.map((run) => (
          <RunCard
            key={run.workflow_uuid}
            run={run}
            isExpanded={selectedRunId === run.workflow_uuid}
            trace={selectedRunId === run.workflow_uuid ? trace : null}
            traceLoading={selectedRunId === run.workflow_uuid && traceLoading}
            onToggle={() =>
              selectRun(selectedRunId === run.workflow_uuid ? null : run.workflow_uuid)
            }
          />
        ))}
      </div>
    </div>
  );
}

// ---- RunCard ----

function RunCard({
  run,
  isExpanded,
  trace,
  traceLoading,
  onToggle,
}: {
  run: WorkflowRun;
  isExpanded: boolean;
  trace: TraceResult | null;
  traceLoading: boolean;
  onToggle: () => void;
}) {
  const statusCfg = runStatusConfig[run.status] ?? {
    bg: "bg-gray-50",
    text: "text-gray-700",
    label: run.status,
  };
  const duration = trace?.workflow?.duration_ms;
  const createdAt = parseTimestamp(run.created_at);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        run.status === "PENDING" ? "border-amber-200" : "border-border"
      } bg-muted`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
      >
        <span className="text-muted-foreground text-[10px] shrink-0">
          {isExpanded ? "\u25BE" : "\u25B8"}
        </span>

        {/* Status badge */}
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}
        >
          {statusCfg.label}
        </span>

        {/* Workflow name */}
        <span className="text-[12px] font-medium text-foreground truncate">
          {run.name}
        </span>

        <div className="flex-1" />

        {/* Duration */}
        {duration != null && (
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {formatDuration(duration)}
          </span>
        )}

        {/* Relative time */}
        <span className="text-[11px] text-muted-foreground shrink-0">
          {formatRelativeTime(createdAt)}
        </span>
      </button>

      {/* Expanded trace */}
      {isExpanded && (
        <div className="border-t border-border px-3 py-2">
          {traceLoading ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              Loading trace...
            </p>
          ) : trace && trace.operations.length > 0 ? (
            <TraceTree operations={trace.operations} rootWorkflowId={run.workflow_uuid} />
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-3 italic">
              No operations recorded.
            </p>
          )}

          {/* Error */}
          {run.error && (
            <div className="mt-2">
              <pre className="text-[10px] font-mono text-red-600 bg-red-50 rounded p-1.5 whitespace-pre-wrap break-all">
                {run.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- TraceTree ----

function TraceTree({
  operations,
  rootWorkflowId,
}: {
  operations: OperationTrace[];
  rootWorkflowId: string;
}) {
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());

  const toggleOp = useCallback((key: string) => {
    setExpandedOps((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Group operations by parent workflow
  const byWorkflow = new Map<string, OperationTrace[]>();
  for (const op of operations) {
    const list = byWorkflow.get(op.workflow_uuid) ?? [];
    list.push(op);
    byWorkflow.set(op.workflow_uuid, list);
  }

  const mainOps = byWorkflow.get(rootWorkflowId) ?? [];

  // Find child workflows with DBOS.getResult to avoid showing duplicate start ops
  const childWorkflowsWithGetResult = new Set<string>();
  for (const op of mainOps) {
    if (op.function_name === "DBOS.getResult" && op.child_workflow_id) {
      childWorkflowsWithGetResult.add(op.child_workflow_id);
    }
  }

  const filteredOps = mainOps.filter((op) => {
    if (!op.child_workflow_id) return true;
    if (op.function_name === "DBOS.getResult") return true;
    if (childWorkflowsWithGetResult.has(op.child_workflow_id)) return false;
    return true;
  });

  return (
    <div className="space-y-0.5">
      {filteredOps.map((op) => {
        // For DBOS.getResult with child workflow, show the child workflow name instead
        let displayName = op.function_name;
        if (op.function_name === "DBOS.getResult" && op.child_workflow_id) {
          const startOp = mainOps.find(
            (o) =>
              o.child_workflow_id === op.child_workflow_id &&
              o.function_name !== "DBOS.getResult",
          );
          if (startOp) displayName = startOp.function_name;
        }

        const hasDetail = !!(op.output_preview || op.error || op.child_workflow_id);
        const opKey = `${op.workflow_uuid}-${op.function_id}`;
        const isExpanded = expandedOps.has(opKey);
        const childOps = op.child_workflow_id
          ? byWorkflow.get(op.child_workflow_id) ?? []
          : [];

        return (
          <div key={opKey}>
            <button
              onClick={() => hasDetail && toggleOp(opKey)}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
                hasDetail ? "cursor-pointer hover:bg-accent" : "cursor-default"
              } ${op.error ? "bg-red-50/30" : ""}`}
            >
              {hasDetail ? (
                <span className="text-muted-foreground text-[9px] w-3 shrink-0">
                  {isExpanded ? "\u25BE" : "\u25B8"}
                </span>
              ) : (
                <span className="w-3 shrink-0" />
              )}

              {/* Status indicator */}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  op.error
                    ? "bg-red-500"
                    : op.duration_ms != null
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                }`}
              />

              <span
                className={`text-[12px] font-medium truncate flex-1 ${
                  op.error ? "text-red-700" : "text-foreground"
                }`}
              >
                {displayName}
              </span>

              {op.duration_ms != null && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatDuration(op.duration_ms)}
                </span>
              )}
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="ml-7 mt-0.5 mb-1 space-y-1">
                {op.error && (
                  <pre className="text-[10px] font-mono text-red-600 bg-red-50 rounded p-1.5 whitespace-pre-wrap break-all">
                    {op.error}
                  </pre>
                )}

                {/* Child workflow operations */}
                {childOps.length > 0 && (
                  <div className="space-y-0.5 border-l-2 border-border pl-2">
                    {childOps.map((childOp) => (
                      <OperationRow
                        key={`${childOp.workflow_uuid}-${childOp.function_id}`}
                        op={childOp}
                      />
                    ))}
                  </div>
                )}

                {op.output_preview && !op.error && (
                  <pre className="text-[10px] font-mono text-muted-foreground bg-background rounded p-1.5 whitespace-pre-wrap break-all max-h-[100px] overflow-auto">
                    {formatOutputPreview(op.output_preview)}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Simple operation row for child workflows ----

function OperationRow({ op }: { op: OperationTrace }) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-0.5 rounded text-[11px] ${
        op.error ? "bg-red-50/30" : ""
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          op.error
            ? "bg-red-500"
            : op.duration_ms != null
              ? "bg-emerald-500"
              : "bg-amber-400"
        }`}
      />
      <span className={`truncate flex-1 ${op.error ? "text-red-700" : "text-foreground/80"}`}>
        {op.function_name}
      </span>
      {op.duration_ms != null && (
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          {formatDuration(op.duration_ms)}
        </span>
      )}
    </div>
  );
}

// ---- Utilities ----

/** Parse a timestamp that may be an epoch-ms number, numeric string, or ISO date string */
function parseTimestamp(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Numeric string (epoch ms from pg bigint)
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    // ISO date string
    const ms = new Date(value).getTime();
    if (!isNaN(ms)) return ms;
  }
  return Date.now();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOutputPreview(output: string | null): string {
  if (!output) return "";
  try {
    const parsed = JSON.parse(output);
    const str = JSON.stringify(parsed, null, 2);
    return str.length > 200 ? str.slice(0, 197) + "..." : str;
  } catch {
    return output.length > 200 ? output.slice(0, 197) + "..." : output;
  }
}
