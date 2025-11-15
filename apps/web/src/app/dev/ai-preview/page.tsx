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
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white sm:px-12">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Dev preview</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI broker smoke tests</h1>
          <p className="text-sm text-slate-300">
            Call the FastAPI stub directly to verify schemas and network wiring before hopping into the
            realtime board.
          </p>
        </header>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-white">Cluster sample</h2>
              <p className="text-sm text-slate-300">
                Sends four sticky note ids to `/cluster` and returns cluster assignments.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={runCluster}
              disabled={clusterState.loading}
              className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              {clusterState.loading ? "Running..." : "Run cluster sample"}
            </Button>
          </div>
          <ResultPanel state={clusterState} />
        </section>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-white">Outline sample</h2>
              <p className="text-sm text-slate-300">
                Uses the first cluster assignment to request outline suggestions.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={runOutline}
              disabled={outlineState.loading}
              className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
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
    return <div className="text-sm text-slate-300">Awaiting response...</div>;
  }

  if (state.error) {
    return (
      <div className="rounded-2xl border border-red-400/60 bg-red-500/10 p-4 text-sm text-red-200">
        {state.error}
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        No response yet. Start the AI broker and run the sample.
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs text-emerald-200">
      {JSON.stringify(state.data, null, 2)}
    </pre>
  );
}
