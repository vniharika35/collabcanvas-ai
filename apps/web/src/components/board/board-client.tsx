"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Board, Trace } from "@prisma/client";
import * as Y from "yjs";

import { Button } from "@/components/ui/button";
import { aiClient } from "@/lib/ai-client";
import { useRealtimePresence } from "@/lib/realtime-client";
import { cn } from "@/lib/utils";
import { Check, PenSquare, Plus, Sparkles, Undo2 } from "lucide-react";
import { computeCanvasMetrics } from "./metrics";

type CanvasNode = {
  id: string;
  kind: string;
  x: number;
  y: number;
  text: string;
  clusterId: string | null;
  ghost: boolean;
};

type CanvasTrace = Trace & {
  createdAt: Date;
};

type BoardWithData = Board & {
  nodes: Array<{
    id: string;
    kind: string;
    x: number;
    y: number;
    clusterId: string | null;
    content: unknown;
  }>;
  traces: Trace[];
};

interface PendingOutline {
  nodeIds: string[];
  clusterId: string;
}

interface TracePayload {
  action: "CLUSTER" | "OUTLINE";
  prompt: unknown;
  response: unknown;
  latencyMs: number | null;
  model: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

function parseTrace(trace: Trace): CanvasTrace {
  return {
    ...trace,
    createdAt: trace.createdAt instanceof Date ? trace.createdAt : new Date(trace.createdAt),
  };
}

function formatTraceAction(action: Trace["action"]): string {
  switch (action) {
    case "CLUSTER":
      return "Cluster";
    case "OUTLINE":
      return "Outline";
    default:
      return action.toLowerCase();
  }
}

function mapNodesFromDoc(doc: Y.Doc): CanvasNode[] {
  const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
  const next: CanvasNode[] = [];
  nodesMap.forEach((value, key) => {
    if (!(value instanceof Y.Map)) return;
    next.push({
      id: key,
      kind: String(value.get("kind") ?? "STICKY"),
      x: Number(value.get("x") ?? 0),
      y: Number(value.get("y") ?? 0),
      text: String(value.get("text") ?? ""),
      clusterId: value.get("clusterId") ? String(value.get("clusterId")) : null,
      ghost: Boolean(value.get("ghost")),
    });
  });
  return next;
}

function mapNodesFromPrisma(nodes: BoardWithData["nodes"]): CanvasNode[] {
  return nodes.map((node) => {
    let text = "";
    if (typeof node.content === "object" && node.content !== null) {
      const record = node.content as Record<string, unknown>;
      if (typeof record.text === "string") {
        text = record.text;
      }
    }

    return {
      id: node.id,
      kind: node.kind,
      x: node.x,
      y: node.y,
      text,
      clusterId: node.clusterId,
      ghost: false,
    };
  });
}

export function BoardClient({ board }: { board: BoardWithData }) {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => mapNodesFromPrisma(board.nodes));
  const [docReady, setDocReady] = useState(false);
  const [traces, setTraces] = useState<CanvasTrace[]>(() => board.traces.map(parseTrace));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingOutline, setPendingOutline] = useState<PendingOutline | null>(null);
  const [clusterInFlight, setClusterInFlight] = useState(false);
  const [outlineInFlight, setOutlineInFlight] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nodesRef = useRef<CanvasNode[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const boardId = board.id;
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const viewerIdentity = useMemo(() => {
    const baseId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${boardId}-${globalThis.location?.href ?? "local"}`;

    const palette = ["#2563eb", "#16a34a", "#f97316", "#9333ea", "#e11d48"] as const;
    const hash = baseId
      .split("")
      .reduce((acc, char) => (acc + char.charCodeAt(0)) % palette.length, 0);

    return {
      userId: `guest-${baseId.slice(0, 8)}`,
      name: "You",
      color: palette[hash],
    };
  }, [boardId]);

  const { clientId: realtimeClientId, doc, peers, updatePresence } = useRealtimePresence({
    boardId,
    self: {
      userId: viewerIdentity.userId,
      name: viewerIdentity.name,
      color: viewerIdentity.color,
      selection: [],
    },
  });

  const remotePeers = useMemo(
    () => peers.filter((peer) => peer.clientId !== realtimeClientId),
    [peers, realtimeClientId]
  );

  const remoteSelections = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const peer of remotePeers) {
      for (const nodeId of peer.selection) {
        const bucket = map.get(nodeId) ?? [];
        bucket.push(peer.color);
        map.set(nodeId, bucket);
      }
    }
    return map;
  }, [remotePeers]);

  const stickyCount = useMemo(
    () => nodes.filter((node) => node.kind === "STICKY").length,
    [nodes]
  );

  const clusterCount = useMemo(() => {
    const ids = new Set<string>();
    nodes.forEach((node) => {
      if (node.clusterId) ids.add(node.clusterId);
    });
    return ids.size;
  }, [nodes]);

  const outlineCount = useMemo(
    () => nodes.filter((node) => node.kind === "OUTLINE" && !node.ghost).length,
    [nodes]
  );

  const ghostCount = useMemo(() => nodes.filter((node) => node.ghost).length, [nodes]);

  const { width: canvasWidth, height: canvasHeight, offsetX, offsetY } = useMemo(
    () => computeCanvasMetrics(nodes.map(({ x, y }) => ({ x, y }))),
    [nodes]
  );

  const realtimeStatus = docReady ? "Synced" : "Connecting";
  const aiStatus = clusterInFlight || outlineInFlight ? "Calling" : "Idle";
  const persistenceStatus = pendingOutline ? "Awaiting approval" : "Auto-saving";

  const recordTrace = useCallback(
    async ({ action, prompt, response, latencyMs, model, tokensIn = null, tokensOut = null }: TracePayload) => {
      try {
        const res = await fetch(`/api/boards/${boardId}/traces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, prompt, response, latencyMs, model, tokensIn, tokensOut }),
        });

        if (!res.ok) {
          throw new Error(`Failed to record trace (status ${res.status})`);
        }

        const created = (await res.json()) as Trace;
        setTraces((prev) => [parseTrace(created), ...prev].slice(0, 10));
      } catch (error) {
        console.error("Failed to record trace", error);
      }
    },
    [boardId]
  );

  useEffect(() => {
    if (!doc) return;

    const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");

    const updateFromDoc = () => {
      const mapped = mapNodesFromDoc(doc);
      setNodes(mapped);
      setDocReady(true);
      setSelectedNodeId((current) =>
        current && mapped.some((node) => node.id === current) ? current : null
      );
      setPendingOutline((current) => {
        if (!current) return current;
        const exists = current.nodeIds.every((id) => nodesMap.has(id));
        return exists ? current : null;
      });
    };

    updateFromDoc();
    nodesMap.observe(updateFromDoc);

    return () => {
      nodesMap.unobserve(updateFromDoc);
    };
  }, [doc]);

  const palette = useMemo(
    () => ["bg-yellow-200/80", "bg-green-200/80", "bg-orange-200/80", "bg-blue-200/80"],
    []
  );

  const clusterPalette = useMemo(
    () => ["#fde68a", "#bae6fd", "#fbcfe8", "#bbf7d0", "#f5d0fe"],
    []
  );

  const clusterColors = useMemo(() => {
    const map = new Map<string, string>();
    let index = 0;
    nodes.forEach((node) => {
      if (node.clusterId && !map.has(node.clusterId)) {
        map.set(node.clusterId, clusterPalette[index % clusterPalette.length]);
        index += 1;
      }
    });
    return map;
  }, [clusterPalette, nodes]);

  const transact = useCallback(
    (fn: () => void) => {
      if (!doc || !docReady) return;
      doc.transact(fn, realtimeClientId ?? viewerIdentity.userId);
    },
    [doc, docReady, realtimeClientId, viewerIdentity.userId]
  );

  const addStickyNote = useCallback(() => {
    const baseNode = {
      id: "",
      kind: "STICKY",
      x: 40,
      y: 40,
      text: "New sticky note",
      clusterId: null,
      ghost: false,
    } satisfies CanvasNode;

    if (!doc || !docReady) {
      const fallbackId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${boardId}-${nodes.length + 1}`;
      setNodes((prev) => [...prev, { ...baseNode, id: fallbackId }]);
      setSelectedNodeId(fallbackId);
      return;
    }

    const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${boardId}-${nodesMap.size + 1}`;

    transact(() => {
      const node = new Y.Map();
      node.set("id", id);
      node.set("kind", "STICKY");
      node.set("x", 40);
      node.set("y", 40);
      node.set("text", "New sticky note");
      node.set("clusterId", null);
      node.set("ghost", false);
      nodesMap.set(id, node);
    });

    setSelectedNodeId(id);
  }, [boardId, doc, docReady, nodes.length, transact]);

  const updateNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!doc || !docReady) {
        setNodes((prev) =>
          prev.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
        );
        return;
      }
      const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
      const node = nodesMap.get(nodeId);
      if (!(node instanceof Y.Map)) return;

      transact(() => {
        node.set("x", x);
        node.set("y", y);
      });
    },
    [doc, docReady, transact]
  );

  const updateNodeText = useCallback(
    (nodeId: string, text: string) => {
      if (!doc || !docReady) {
        setNodes((prev) =>
          prev.map((node) => (node.id === nodeId ? { ...node, text } : node))
        );
        return;
      }
      const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
      const node = nodesMap.get(nodeId);
      if (!(node instanceof Y.Map)) return;

      transact(() => {
        node.set("text", text);
      });
    },
    [doc, docReady, transact]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!doc || !docReady) {
        setNodes((prev) => prev.filter((node) => node.id !== nodeId));
        setSelectedNodeId((current) => (current === nodeId ? null : current));
        return;
      }
      const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
      transact(() => {
        nodesMap.delete(nodeId);
      });
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [doc, docReady, transact]
  );

  const selectedClusterId = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((item) => item.id === selectedNodeId);
    if (!node || node.kind !== "STICKY") return null;
    return node.clusterId ?? null;
  }, [nodes, selectedNodeId]);

  const runCluster = useCallback(async () => {
    if (!doc || !docReady) return;
    const currentNodes = mapNodesFromDoc(doc).filter((node) => !node.ghost && node.kind === "STICKY");
    if (currentNodes.length === 0) {
      setActionError("No sticky notes available to cluster.");
      return;
    }

    setActionError(null);
    setClusterInFlight(true);

    try {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      const response = await aiClient.cluster({ boardId, nodeIds: currentNodes.map((node) => node.id) });
      const end = typeof performance !== "undefined" ? performance.now() : Date.now();

      const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
      transact(() => {
        response.assignments.forEach((assignment) => {
          const target = nodesMap.get(assignment.nodeId);
          if (target instanceof Y.Map) {
            target.set("clusterId", assignment.clusterId);
          }
        });
      });

      await recordTrace({
        action: "CLUSTER",
        prompt: { boardId, nodeIds: currentNodes.map((node) => node.id) },
        response,
        latencyMs: Math.round(end - start),
        model: "ai-broker-stub",
        tokensIn: null,
        tokensOut: null,
      });
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to cluster notes.");
    } finally {
      setClusterInFlight(false);
    }
  }, [boardId, doc, docReady, recordTrace, transact]);

  const runOutline = useCallback(async () => {
    if (!doc || !docReady) return;
    const clusterId = selectedClusterId;
    if (!clusterId) {
      setActionError("Select a clustered sticky note before running outline.");
      return;
    }

    setActionError(null);
    setOutlineInFlight(true);

    try {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      const response = await aiClient.outline({ boardId, clusterId, style: "concise" });
      const end = typeof performance !== "undefined" ? performance.now() : Date.now();

      const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
      const createdIds: string[] = [];

      transact(() => {
        nodesMap.forEach((value, key) => {
          if (value instanceof Y.Map && value.get("ghost")) {
            nodesMap.delete(key);
          }
        });

        response.outlineNodes.forEach((outline, index) => {
          const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${clusterId}-outline-${index}`;

          const node = new Y.Map();
          node.set("id", id);
          node.set("kind", "OUTLINE");
          node.set("x", outline.x);
          node.set("y", outline.y);
          node.set("text", outline.title);
          node.set("clusterId", clusterId);
          node.set("ghost", true);
          nodesMap.set(id, node);
          createdIds.push(id);
        });
      });

      setPendingOutline({ nodeIds: createdIds, clusterId });

      await recordTrace({
        action: "OUTLINE",
        prompt: { boardId, clusterId },
        response,
        latencyMs: Math.round(end - start),
        model: "ai-broker-stub",
        tokensIn: null,
        tokensOut: null,
      });
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to outline selection.");
    } finally {
      setOutlineInFlight(false);
    }
  }, [boardId, doc, docReady, recordTrace, selectedClusterId, transact]);

  const handleAcceptOutline = useCallback(() => {
    if (!doc || !docReady || !pendingOutline) return;
    const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
    transact(() => {
      pendingOutline.nodeIds.forEach((id) => {
        const node = nodesMap.get(id);
        if (node instanceof Y.Map) {
          node.set("ghost", false);
        }
      });
    });
    setPendingOutline(null);
    setSelectedNodeId((current) => {
      if (current && pendingOutline.nodeIds.includes(current)) {
        return current;
      }
      return pendingOutline.nodeIds[0] ?? current;
    });
    setActionError(null);
  }, [doc, docReady, pendingOutline, transact]);

  const handleUndoOutline = useCallback(() => {
    if (!doc || !docReady || !pendingOutline) return;
    const nodesMap = doc.getMap<Y.Map<unknown>>("nodes");
    transact(() => {
      pendingOutline.nodeIds.forEach((id) => {
        nodesMap.delete(id);
      });
    });
    setPendingOutline(null);
    setSelectedNodeId((current) => (current && pendingOutline.nodeIds.includes(current) ? null : current));
    setActionError(null);
  }, [doc, docReady, pendingOutline, transact]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, nodeId: string) => {
      event.preventDefault();
      if (!docReady) return;
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      if (node.ghost) return;

      setSelectedNodeId(nodeId);

      const startX = event.clientX;
      const startY = event.clientY;
      const originX = node.x;
      const originY = node.y;

      const handleMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        updateNodePosition(nodeId, originX + deltaX, originY + deltaY);
      };

      const handleUp = (endEvent: PointerEvent) => {
        endEvent.preventDefault();
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [docReady, updateNodePosition]
  );

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!docReady) return;
      const area = canvasAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      updatePresence({ cursor: { x, y } });
    },
    [docReady, updatePresence]
  );

  const handleCanvasPointerLeave = useCallback(() => {
    if (!docReady) return;
    updatePresence({ cursor: undefined });
  }, [docReady, updatePresence]);

  useEffect(() => {
    if (!realtimeClientId || !docReady) return;
    updatePresence({ selection: selectedNodeId ? [selectedNodeId] : [] });
  }, [docReady, realtimeClientId, selectedNodeId, updatePresence]);

  useEffect(() => {
    if (!docReady || !selectedNodeId) return;
    const root = canvasAreaRef.current;
    if (!root) return;
    const textarea = root.querySelector<HTMLTextAreaElement>(`[data-node-id="${selectedNodeId}"] textarea`);
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  }, [docReady, selectedNodeId]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, nodeId: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelectedNodeId(nodeId);
      }
    },
    []
  );

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-slate-950 text-white">
      <div className="flex flex-1 flex-col">
        <header className="border-b border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.45em] text-slate-400">Active board</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white">{board.title}</h1>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white">
                  {(peers.length || 1).toString()} teammate{(peers.length || 1) === 1 ? "" : "s"} online
                </span>
              </div>
              {actionError ? (
                <p className="text-sm text-red-300" role="status" aria-live="polite">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 text-slate-900 sm:w-auto">
              <Button
                data-testid="add-sticky"
                size="sm"
                onClick={addStickyNote}
                disabled={!docReady || clusterInFlight || outlineInFlight}
                className="bg-white text-slate-900 shadow hover:bg-white/90"
              >
                <Plus className="mr-2 h-4 w-4" /> Add sticky
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="run-cluster"
                onClick={runCluster}
                disabled={!docReady || clusterInFlight}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <Sparkles className="mr-2 h-4 w-4" /> {clusterInFlight ? "Clustering" : "/cluster"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="run-outline"
                onClick={runOutline}
                disabled={!docReady || outlineInFlight || !selectedClusterId}
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <PenSquare className="mr-2 h-4 w-4" /> {outlineInFlight ? "Outlining" : "/outline"}
              </Button>
              {pendingOutline ? (
                <>
                  <Button
                    data-testid="accept-outline"
                    size="sm"
                    onClick={handleAcceptOutline}
                    disabled={!docReady || outlineInFlight}
                    className="bg-emerald-500 text-white hover:bg-emerald-400"
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Accept
                  </Button>
                  <Button
                    data-testid="undo-outline"
                    variant="secondary"
                    size="sm"
                    onClick={handleUndoOutline}
                    disabled={outlineInFlight}
                    className="bg-slate-800/80 text-white hover:bg-slate-700"
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" /> Undo
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-live="polite">
            {[
              {
                label: "Sticky notes",
                value: stickyCount,
                hint: ghostCount ? `${ghostCount} ghost draft${ghostCount === 1 ? "" : "s"}` : "All live",
              },
              { label: "Clusters", value: clusterCount, hint: clusterCount === 0 ? "Run /cluster" : "Organised" },
              { label: "Outlines", value: outlineCount, hint: pendingOutline ? "Awaiting approval" : "Published" },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                <p className="text-xs text-slate-400">{card.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Realtime doc: {realtimeStatus}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">AI broker: {aiStatus}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Persistence: {persistenceStatus}</span>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Board guide</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-200">
                <li>
                  <span className="font-semibold text-white">1. Capture</span> — Add or drag sticky notes. Realtime sync keeps
                  teammates updated, and the persistence worker writes to Postgres every ~750 ms.
                </li>
                <li>
                  <span className="font-semibold text-white">2. Cluster</span> — Highlight a set of notes and hit /cluster. The FastAPI broker responds with
                  assignments that map back to Prisma nodes.
                </li>
                <li>
                  <span className="font-semibold text-white">3. Outline</span> — Select a clustered sticky, run /outline, and accept or undo the ghost
                  nodes before they persist.
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Where data lives</p>
              <ul className="mt-3 space-y-2">
                <li>Sticky + outline content → Prisma `Node` rows.</li>
                <li>AI broker payloads → Prisma `Trace` records.</li>
                <li>Cursors + selections → Redis-backed presence.</li>
              </ul>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex-1 bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.2),_transparent_60%)]">
            <div className="absolute inset-0 overflow-auto">
              <div
                ref={canvasAreaRef}
                className="relative"
                style={{ width: canvasWidth, height: canvasHeight }}
                onPointerMove={handleCanvasPointerMove}
                onPointerLeave={handleCanvasPointerLeave}
              >
                {nodes.map((node, index) => {
                const clusterColor = node.clusterId ? clusterColors.get(node.clusterId) : undefined;
                const backgroundClass = clusterColor ? "bg-white" : palette[index % palette.length];
                const isGhost = node.ghost;

                return (
                  <article
                    data-node-id={node.id}
                    key={node.id}
                    className={cn(
                      "absolute flex w-64 flex-col rounded-2xl border p-4 text-slate-800 shadow-xl transition duration-200",
                      isGhost ? "cursor-default" : "cursor-grab",
                      backgroundClass,
                      clusterColor ? "border-transparent" : "border-slate-300/70",
                      isGhost && "border-dashed border-2 opacity-80",
                      selectedNodeId === node.id && "ring-2 ring-emerald-400"
                    )}
                    style={{
                      transform: `translate(${node.x - offsetX}px, ${node.y - offsetY}px)`,
                      backgroundColor: clusterColor ?? undefined,
                      boxShadow:
                        remoteSelections.get(node.id)
                          ?.map((color, idx) => `0 0 0 ${2 + idx}px ${color}66`)
                          .join(", ") ?? undefined,
                    }}
                    onPointerDown={(event) => handlePointerDown(event, node.id)}
                    tabIndex={isGhost ? -1 : 0}
                    role="option"
                    aria-selected={selectedNodeId === node.id}
                    onKeyDown={(event) => handleCardKeyDown(event, node.id)}
                  >
                    <textarea
                      value={node.text}
                      data-testid="sticky-textarea"
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => updateNodeText(node.id, event.currentTarget.value)}
                      readOnly={isGhost}
                      className="h-32 w-full resize-none rounded-xl border border-transparent bg-transparent text-sm leading-relaxed text-slate-900 outline-none focus:border-slate-400 focus:bg-white/80 read-only:cursor-not-allowed read-only:opacity-70"
                    />
                    <footer className="mt-4 flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-2">
                        <span>#{String(index + 1).padStart(2, "0")}</span>
                        {node.clusterId ? (
                          <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
                            {node.clusterId}
                          </span>
                        ) : null}
                        {isGhost ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-600">
                            Ghost
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteNode(node.id)}
                        className="rounded-full px-3 py-1 text-xs text-red-600 transition hover:bg-red-50"
                        disabled={isGhost}
                      >
                        Delete
                      </button>
                    </footer>
                  </article>
                );
              })}
                {remotePeers
                  .filter((peer) => peer.cursor)
                  .map((peer) => (
                    <div
                      key={peer.clientId}
                      className="pointer-events-none absolute flex flex-col items-center"
                      style={{
                        transform: `translate(${(peer.cursor?.x ?? 0) - 8}px, ${(peer.cursor?.y ?? 0) - 8}px)`,
                      }}
                    >
                      <span
                        className="block h-4 w-4 rotate-45"
                        style={{ backgroundColor: peer.color }}
                      />
                      <span className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                        {peer.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <aside className="flex w-full flex-col border-t border-white/10 bg-slate-900/70 backdrop-blur lg:w-80 lg:border-t-0 lg:border-l">
            <div className="border-b border-white/5 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-300">Trace</h2>
              <p className="mt-1 text-xs text-slate-500">Latest AI + human actions (auto-updating).</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm" aria-live="polite">
              {traces.length === 0 ? (
                <p className="text-slate-400">Run /cluster or /outline to populate this panel.</p>
              ) : (
                traces.map((trace) => (
                  <div
                    key={trace.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{formatTraceAction(trace.action)}</span>
                      <span>{trace.createdAt.toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-200">
                      <p>Actor: {trace.actor}</p>
                      {trace.latencyMs ? <p>Latency: {trace.latencyMs} ms</p> : null}
                      {trace.model ? <p>Model: {trace.model}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
