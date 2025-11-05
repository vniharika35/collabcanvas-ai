"use client";

import { useMemo, useState } from "react";

import type { ClusterResponse, OutlineResponse } from "@collabcanvas/shared";

import { Button } from "@/components/ui/button";
import { aiClient } from "@/lib/ai-client";

interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: string;
}

const sampleNodes = [
  { id: "n1", label: "Launch plan" },
  { id: "n2", label: "Outline blog" },
  { id: "n3", label: "Demo video" },
  { id: "n4", label: "Customer story" },
];

export default function AiPreviewPage() {
  const [clusterState, setClusterState] = useState<AsyncState<ClusterResponse>>({
    loading: false,
  });
  const [outlineState, setOutlineState] = useState<AsyncState<OutlineResponse>>({
    loading: false,
  });
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>("cluster-0");

  const sampleNodeIds = useMemo(() => sampleNodes.map((node) => node.id), []);

  const runCluster = async () => {
    setClusterState({ loading: true });
    try {
      const data = await aiClient.cluster({ boardId: "demo-board", nodeIds: sampleNodeIds });
      setClusterState({ loading: false, data });
      setSelectedClusterId(data.assignments[0]?.clusterId ?? null);
    } catch (error) {
      setClusterState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const runOutline = async () => {
    if (!selectedClusterId) {
      setOutlineState({
        loading: false,
        error: "Run the cluster sample first so we know which cluster to outline.",
      });
      return;
    }

    setOutlineState({ loading: true });
    try {
      const data = await aiClient.outline({
        boardId: "demo-board",
        clusterId: selectedClusterId,
        style: "concise",
      });
      setOutlineState({ loading: false, data });
    } catch (error) {
      setOutlineState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-6 py-16">
      <div className="w-full max-w-4xl space-y-10">
        <header className="flex flex-col gap-3 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Dev preview</p>
          <h1 className="text-3xl font-semibold tracking-tight">AI Broker smoke tests</h1>
          <p className="text-sm text-muted-foreground">
            Use the buttons below to call the local FastAPI service. Responses come from the
            placeholder logic in `services/ai-broker` and prove the shared client works end to end.
          </p>
        </header>

        <section className="grid gap-6 rounded-3xl border border-border/60 bg-card/60 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Cluster sample</h2>
              <p className="text-sm text-muted-foreground">
                Sends four sticky note ids to `/cluster` and returns cluster assignments.
              </p>
            </div>
            <Button onClick={runCluster} disabled={clusterState.loading}>
              {clusterState.loading ? "Running..." : "Run cluster sample"}
            </Button>
          </div>
          <ResultPanel state={clusterState} />
        </section>

        <section className="grid gap-6 rounded-3xl border border-border/60 bg-card/60 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Outline sample</h2>
              <p className="text-sm text-muted-foreground">
                Uses the first cluster assignment to request outline suggestions.
              </p>
            </div>
            <Button onClick={runOutline} disabled={outlineState.loading}>
              {outlineState.loading ? "Running..." : "Run outline sample"}
            </Button>
          </div>
          <ResultPanel state={outlineState} />
        </section>
      </div>
    </main>
  );
}

function ResultPanel<T>({ state }: { state: AsyncState<T> }) {
  if (state.loading) {
    return <div className="text-sm text-muted-foreground">Awaiting response...</div>;
  }

  if (state.error) {
    return (
      <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-600">
        {state.error}
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/60 p-4 text-sm text-muted-foreground">
        No response yet. Start the AI broker and run the sample.
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-2xl border border-border/40 bg-background p-4 text-xs">
      {JSON.stringify(state.data, null, 2)}
    </pre>
  );
}
