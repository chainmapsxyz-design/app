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
import { nodeTypes, nodePalette } from "@nodes/frontend/index.js";
import { canAddNode } from "../graphs/nodeLimits";
import ContextNodeMenu from "./ContextNodeMenu";
import NodeInspector from "../inspector/NodeInspector";

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

  const onEdgesChange = useCallback(
    (changes) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges]
  );
  const onConnect = useCallback(
    (params) =>
      setEdges((es) =>
        addEdge({ ...params, type: ConnectionLineType.Bezier }, es)
      ),
    [setEdges]
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
          fitView
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
