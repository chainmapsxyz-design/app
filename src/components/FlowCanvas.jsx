// src/components/FlowCanvas.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  ConnectionLineType,
} from "@xyflow/react";
import Sidebar from "./Sidebar";
import { nodeTypes, nodePalette, getNodeMeta } from "@nodes/frontend/index.js";
import { canAddNode } from "../graphs/nodeLimits";
import ContextNodeMenu from "./ContextNodeMenu";
import NodeInspector from "../inspector/NodeInspector";

/* =========================
   Helpers for Formatter vars
   ========================= */

function inferTypeFromValue(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "object") return "object";
  return t; // "string" | "number" | "boolean" | "undefined"
}

/**
 * Build the list of parameters for a target node based on incoming edges.
 * Uses source handle id as the parameter name (falls back to "value").
 * Uses source node.type as the src identifier.
 */
function buildAvailableParams({ nodes, edges, targetId }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = edges.filter((e) => e.target === targetId);

  const params = [];
  for (const e of incoming) {
    const srcNode = byId.get(e.source);
    if (!srcNode) continue;

    const name = e.sourceHandle || "value";
    const src = srcNode.type || "unknown";

    // Try to infer type/preview from node.data[handle]
    const preview = srcNode?.data?.[name];
    const type = inferTypeFromValue(preview) || "any";

    params.push({
      name, // e.g. "value", "amount"
      type, // "number" | "string" | ...
      src, // e.g. "core.constant" | "ethereum.listener"
      nodeId: srcNode.id,
      preview,
    });
  }

  return params;
}

/**
 * Patch formatter nodes' data.availableParams for the given target ids.
 */
function updateFormatterParamsForTargets(targetIds, nodes, edges, setNodes) {
  if (!targetIds || targetIds.length === 0) return;
  const targetSet = new Set(targetIds);

  setNodes((prev) =>
    prev.map((n) => {
      if (!targetSet.has(n.id)) return n;
      if (n.type !== "core.formatter") return n;

      const availableParams = buildAvailableParams({
        nodes: prev,
        edges,
        targetId: n.id,
      });

      // Only write if changed (cheap shallow check)
      const old = n.data?.availableParams || [];
      const sameLen = old.length === availableParams.length;
      const maybeSame =
        sameLen &&
        old.every((o, i) => {
          const p = availableParams[i];
          return (
            o.name === p.name &&
            o.type === p.type &&
            o.src === p.src &&
            o.nodeId === p.nodeId
          );
        });
      if (maybeSame) return n;

      return {
        ...n,
        data: { ...(n.data || {}), availableParams },
      };
    })
  );
}

/* =========================
   NEW: Per-handle connection caps from node meta
   ========================= */

/** Count existing edges targeting a specific node+handle. */
function countIncomingToHandle({ edges, targetId, targetHandle }) {
  const h = targetHandle ?? null;
  return edges.filter(
    (e) => e.target === targetId && (e.targetHandle ?? null) === h
  ).length;
}

/** Look up the input spec for the target handle from node meta. */
function getTargetInputSpec({ nodes, targetId, targetHandle }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const targetNode = byId.get(targetId);
  if (!targetNode) return null;

  const meta = getNodeMeta(targetNode.type);
  if (!meta || !Array.isArray(meta.inputs)) return null;

  const key = targetHandle ?? "in";
  return meta.inputs.find((inp) => inp.key === key) || null;
}

/** Validate whether a connection respects maxConnections on the target handle. */
function canConnectEdge({ nodes, edges, params }) {
  const spec = getTargetInputSpec({
    nodes,
    targetId: params.target,
    targetHandle: params.targetHandle,
  });
  if (!spec) return { ok: true }; // no declared spec → allow

  const max = Number(spec.maxConnections);
  if (!Number.isFinite(max) || max <= 0) return { ok: true }; // no cap

  const current = countIncomingToHandle({
    edges,
    targetId: params.target,
    targetHandle: params.targetHandle ?? null,
  });

  if (current >= max) {
    const label = spec.label || spec.key || "input";
    return {
      ok: false,
      reason: `Limit: “${label}” accepts only ${max} connection${
        max === 1 ? "" : "s"
      }.`,
    };
  }
  return { ok: true };
}

export default function FlowCanvas(props) {
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodeDataChange,
    selectedGraph,
    setSelectedGraph,
    usage,
    getCurrentDef,
    setLastSavedDef,
    autosave,
    pauseGraph,
    resumeGraph,
    onDeleteGraph,
    canAutosavePositions = true,
  } = props;

  const flowRef = useRef(null);
  const autoTimer = useRef(null);
  const AUTO_MS = 2000;
  const { screenToFlowPosition } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // inspector width (persisted)
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    try {
      const v = Number(localStorage.getItem("inspector.width"));
      return Number.isFinite(v) && v > 0 ? v : 360;
    } catch {
      return 360;
    }
  });
  const updateInspectorWidth = useCallback((w) => {
    const clamped = Math.max(260, Math.min(720, Math.round(w)));
    setInspectorWidth(clamped);
  }, []);
  const persistInspectorWidth = useCallback((w) => {
    try {
      localStorage.setItem("inspector.width", String(w));
    } catch {
      /* ignore in SES/private contexts */
    }
  }, []);

  const [menu, setMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    flowPos: null,
    query: "",
  });

  const openContextMenu = useCallback(
    (evt) => {
      evt.preventDefault();
      const x = evt.clientX;
      const y = evt.clientY;
      const flowPos = screenToFlowPosition({ x, y });
      setMenu({ open: true, x, y, flowPos, query: "" });
    },
    [screenToFlowPosition]
  );
  const closeContextMenu = useCallback(
    () => setMenu((m) => ({ ...m, open: false })),
    []
  );

  const overLimit = (usage?.used ?? 0) >= (usage?.limit ?? 100);

  const doAutoSave = useCallback(async () => {
    if (!selectedGraph) return;
    const safe = getCurrentDef();
    try {
      const updated = await autosave(String(selectedGraph.id), {
        name: selectedGraph.name,
        definition: safe,
        status: selectedGraph.status,
      });
      if (updated) {
        setSelectedGraph(updated);
        setLastSavedDef(safe);
      }
    } catch {
      /* ignore */
    }
  }, [
    autosave,
    getCurrentDef,
    selectedGraph,
    setLastSavedDef,
    setSelectedGraph,
  ]);

  const scheduleAutoSave = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(doAutoSave, AUTO_MS);
  }, [doAutoSave]);

  useEffect(() => {
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, []);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((ns) => applyNodeChanges(changes, ns));

      const removedIds = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      if (removedIds.includes(selectedNodeId)) {
        setSelectedNodeId(null);
      }

      const positionalOnly =
        changes.length > 0 &&
        changes.every(
          (ch) =>
            ch.type === "position" ||
            ch.type === "dimensions" ||
            ch.type === "select"
        );
      if (positionalOnly && selectedGraph && canAutosavePositions) {
        scheduleAutoSave();
      } else if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
    },
    [
      setNodes,
      selectedGraph,
      scheduleAutoSave,
      canAutosavePositions,
      selectedNodeId,
    ]
  );

  // UPDATED: onEdgesChange — recompute formatter params for affected targets
  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((es) => {
        const next = applyEdgeChanges(changes, es);

        const affectedTargets = new Set();
        for (const ch of changes) {
          // remove: find previous edge by id in `es`
          if (ch.type === "remove") {
            const removed = es.find((e) => e.id === ch.id);
            if (removed?.target) affectedTargets.add(removed.target);
          }
          // updates with item.target
          if (ch.item?.target) affectedTargets.add(ch.item.target);
        }

        if (affectedTargets.size > 0) {
          updateFormatterParamsForTargets(
            Array.from(affectedTargets),
            nodes,
            next,
            setNodes
          );
        }

        return next;
      });
    },
    [setEdges, setNodes, nodes]
  );

  // UPDATED: onConnect — enforce per-handle caps before adding an edge
  const onConnect = useCallback(
    (params) =>
      setEdges((es) => {
        const check = canConnectEdge({ nodes, edges: es, params });
        if (!check.ok) {
          window?.alert?.(check.reason);
          return es; // block
        }
        const next = addEdge(
          { ...params, type: ConnectionLineType.Bezier },
          es
        );
        updateFormatterParamsForTargets([params.target], nodes, next, setNodes);
        return next;
      }),
    [setEdges, setNodes, nodes]
  );

  const centerPos = () => {
    const el = flowRef.current;
    if (!el) return screenToFlowPosition({ x: 0, y: 0 });
    const bounds = el.getBoundingClientRect();
    return screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
  };

  const addNode = (type, data = {}, pos) => {
    const check = canAddNode(type, nodes);
    if (!check.ok) {
      window.alert(check.reason);
      return;
    }
    const p = pos ?? centerPos();
    setNodes((ns) => [
      ...ns,
      {
        id: `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        position: { x: p.x - 80, y: p.y - 30 },
        data: { onChange: onNodeDataChange, ...data },
      },
    ]);
  };

  async function setPause(checked) {
    if (!selectedGraph) return;
    if (checked) {
      const res = await pauseGraph(String(selectedGraph.id));
      setSelectedGraph((g) =>
        g ? { ...g, status: res?.status ?? "PAUSED" } : g
      );
    } else {
      const res = await resumeGraph(String(selectedGraph.id));
      setSelectedGraph((g) =>
        g ? { ...g, status: res?.status ?? "ACTIVE" } : g
      );
    }
  }

  // One-time sync after a graph loads (covers pre-existing edges)
  useEffect(() => {
    const formatterIds = nodes
      .filter((n) => n.type === "core.formatter")
      .map((n) => n.id);
    if (formatterIds.length) {
      updateFormatterParamsForTargets(formatterIds, nodes, edges, setNodes);
    }
    // Run when a new graph is selected/loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGraph]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <Sidebar
        selectedGraph={selectedGraph}
        overLimit={overLimit}
        onDeleteGraph={onDeleteGraph}
        onTogglePause={setPause}
        addNode={addNode}
        onNodeDataChange={onNodeDataChange}
        nodes={nodes}
      />

      {/* Center: canvas */}
      <div
        ref={flowRef}
        style={{ flex: 1, position: "relative", display: "flex", zIndex: 1 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          minZoom={0.2}
          connectionLineType={ConnectionLineType.Bezier}
          defaultEdgeOptions={{ type: ConnectionLineType.Bezier }}
          snapToGrid
          snapGrid={[25, 25]}
          onPaneContextMenu={openContextMenu}
          onPaneClick={() => {
            closeContextMenu();
            setSelectedNodeId(null);
          }}
          onSelectionChange={({ nodes: selNodes }) => {
            setSelectedNodeId(selNodes?.[0]?.id || null);
          }}
          onMove={closeContextMenu}
          // NEW: live validation while dragging connections
          isValidConnection={(params) => {
            const check = canConnectEdge({ nodes, edges, params });
            return check.ok;
          }}
        />
        {menu.open && (
          <ContextNodeMenu
            x={menu.x}
            y={menu.y}
            query={menu.query}
            setQuery={(q) => setMenu((m) => ({ ...m, query: q }))}
            nodePalette={nodePalette}
            nodes={nodes}
            ctx={{ env: import.meta.env, graph: selectedGraph }}
            onPick={(item) => {
              const initial =
                item.getData?.({
                  env: import.meta.env,
                  graph: selectedGraph,
                }) || {};
              addNode(
                item.type,
                { onChange: onNodeDataChange, ...initial },
                menu.flowPos
              );
              closeContextMenu();
            }}
            onClose={closeContextMenu}
          />
        )}
        <Background
          id="dots"
          gap={20}
          size={2}
          color="#e2e8f0"
          variant="dots"
        />
      </div>

      {/* Right inspector */}
      <NodeInspector
        node={selectedNode}
        width={inspectorWidth}
        onResize={updateInspectorWidth}
        onResizeEnd={persistInspectorWidth}
        onChange={(patch) => {
          if (!selectedNode) return;
          onNodeDataChange(selectedNode.id, patch);
        }}
      />
    </div>
  );
}
