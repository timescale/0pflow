import { useState, useEffect, useCallback } from "react";

export type Page = "dashboard" | "canvas" | "credentials";

export interface ConnectTarget {
  integrationId: string;
  workflowName: string;
  nodeName: string;
}

interface RouterState {
  page: Page;
  workflow: string | null;
  connectTarget: ConnectTarget | null;
}

function parseHash(): RouterState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "dashboard") {
    return { page: "dashboard", workflow: null, connectTarget: null };
  }
  if (!hash) {
    return { page: "canvas", workflow: null, connectTarget: null };
  }
  if (hash === "credentials") {
    return { page: "credentials", workflow: null, connectTarget: null };
  }
  // credentials/<integration>/<workflow>/<node> — deep-link to add connection
  if (hash.startsWith("credentials/")) {
    const parts = hash.slice("credentials/".length).split("/").map(decodeURIComponent);
    if (parts.length >= 3 && parts[0]) {
      return {
        page: "credentials",
        workflow: null,
        connectTarget: { integrationId: parts[0], workflowName: parts[1], nodeName: parts[2] },
      };
    }
    if (parts[0]) {
      return {
        page: "credentials",
        workflow: null,
        connectTarget: { integrationId: parts[0], workflowName: "*", nodeName: "*" },
      };
    }
    return { page: "credentials", workflow: null, connectTarget: null };
  }
  if (hash === "canvas") {
    return { page: "canvas", workflow: null, connectTarget: null };
  }
  if (hash.startsWith("canvas/")) {
    return { page: "canvas", workflow: decodeURIComponent(hash.slice("canvas/".length)) || null, connectTarget: null };
  }
  return { page: "canvas", workflow: null, connectTarget: null };
}

function buildHash(page: Page, workflow: string | null): string {
  if (page === "dashboard") return "#/dashboard";
  if (page === "credentials") return "#/credentials";
  if (page === "canvas" && workflow) return `#/canvas/${encodeURIComponent(workflow)}`;
  return "#/canvas";
}

export function useHashRouter() {
  const [state, setState] = useState<RouterState>(parseHash);

  // Listen for back/forward
  useEffect(() => {
    const onPopState = () => setState(parseHash());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((page: Page, workflow?: string | null) => {
    const wf = workflow !== undefined ? workflow : state.workflow;
    const newHash = buildHash(page, page === "canvas" ? wf : null);
    if (newHash !== window.location.hash) {
      window.history.pushState(null, "", newHash);
    }
    setState({ page, workflow: page === "canvas" ? wf : state.workflow, connectTarget: null });
  }, [state.workflow]);

  const selectWorkflow = useCallback((workflowName: string) => {
    const newHash = buildHash("canvas", workflowName);
    window.history.pushState(null, "", newHash);
    setState({ page: "canvas", workflow: workflowName, connectTarget: null });
  }, []);

  return {
    page: state.page,
    selectedWorkflow: state.workflow,
    connectTarget: state.connectTarget,
    navigate,
    selectWorkflow,
  };
}
