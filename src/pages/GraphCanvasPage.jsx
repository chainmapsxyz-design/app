// /src/pages/GraphCanvasPage.jsx
import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  sanitizeDefinition,
  rehydrateDefinition,
  defsEqual,
} from "../graphs/saveUtils";

import { eventFingerprintFromDef } from "../graphs/eventFingerprint";

import FlowCanvas from "../components/FlowCanvas";
import SaveDeployBar from "../components/SaveDeployBar";

// --- local helpers (we can move to utils later) ---
function normalizeForContent(def = {}) {
  const nodes = (def.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data ?? {},
  }));
  const edges = (def.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type ?? null,
    data: e.data ?? {},
    sourceHandle:
      typeof e.sourceHandle === "object" && e.sourceHandle?.id
        ? e.sourceHandle.id
        : e.sourceHandle ?? null,
    targetHandle:
      typeof e.targetHandle === "object" && e.targetHandle?.id
        ? e.targetHandle.id
        : e.targetHandle ?? null,
  }));
  return { nodes, edges };
}

function contentEqual(a, b) {
  return (
    JSON.stringify(normalizeForContent(a)) ===
    JSON.stringify(normalizeForContent(b))
  );
}
// ---------------------------------------------------

export default function GraphCanvasPage({
  graphs,
  setGraphs,
  selectedGraph,
  setSelectedGraph,
  setLastSavedDef,
  onNodeDataChange,
  nodes,
  setNodes,
  edges,
  setEdges,
  getCurrentDef,
  lastSavedDef,
  compiling,
  setCompiling,
  usage,
  api, // graph API object
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleDeleteGraph = useCallback(async () => {
    if (!selectedGraph) return;
    const name = selectedGraph.name || "this graph";
    const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await api.deleteGraph(selectedGraph.id);
    } catch (e) {
      alert(`Delete failed: ${e.message || "Unknown error"}`);
      return;
    }

    const filtered = graphs.filter((g) => g.id !== selectedGraph.id);
    setGraphs(filtered);
    setSelectedGraph(null);
    setNodes([]);
    setEdges([]);
    setLastSavedDef({ nodes: [], edges: [] });

    if (filtered[0]) {
      navigate(`/graphs/${filtered[0].id}`, { replace: true });
    } else {
      navigate(`/graphs`, { replace: true });
    }
  }, [
    api,
    graphs,
    navigate,
    selectedGraph,
    setEdges,
    setGraphs,
    setLastSavedDef,
    setNodes,
    setSelectedGraph,
  ]);

  // When URL changes, pick graph by id
  useEffect(() => {
    if (!graphs?.length || !id) return;
    const g = graphs.find((x) => String(x.id) === String(id));
    if (g) {
      setSelectedGraph(g);
      const def = g.definition || { nodes: [], edges: [] };
      setLastSavedDef(def);
      const { nodes: n, edges: e } = rehydrateDefinition(def, onNodeDataChange);
      setNodes(n);
      setEdges(e);

      (async () => {
        try {
          const state = await api.fetchDeployState(g.id); // implement in useGraphApi
          setSelectedGraph((prev) =>
            prev && String(prev.id) === String(g.id)
              ? {
                  ...prev,
                  deployFingerprint: state?.deployFingerprint || null,
                }
              : prev
          );
        } catch {
          // ignore; UI will allow Deploy if needed later
        }
      })();
    }
  }, [
    graphs,
    id,
    setSelectedGraph,
    setLastSavedDef,
    onNodeDataChange,
    setNodes,
    setEdges,
  ]);

  async function saveGraph(silent = false) {
    if (!selectedGraph) {
      if (!silent) alert("Select or create a graph first.");
      return null;
    }
    const safe = getCurrentDef();
    try {
      const updated = await api.saveGraph(selectedGraph.id, {
        name: selectedGraph.name,
        definition: safe,
        status: selectedGraph.status || "DRAFT",
      });
      setSelectedGraph(updated);
      setLastSavedDef(safe);
      return updated;
    } catch (e) {
      if (!silent) alert(`Save failed: ${e.message || "Unknown error"}`);
      throw e;
    }
  }

  async function deployGraph() {
    if (!selectedGraph) {
      alert("Select or create a graph first.");
      return;
    }
    const def = getCurrentDef();
    const eventNodes = (def.nodes || []).filter(
      (n) => n.type === "ContractEvent"
    );
    if (eventNodes.length === 0) {
      alert("Add at least one Contract Event node before deploying.");
      return;
    }
    const missing = eventNodes.filter(
      (n) => !n.data?.address || !n.data?.eventAbi || !n.data?.networkKey
    );
    if (missing.length) {
      alert(
        "Some Contract Event nodes are missing address, event ABI, or network. Double-click them to finish configuration."
      );
      return;
    }

    setCompiling(true);
    try {
      if (!defsEqual(def, lastSavedDef)) {
        await saveGraph(true);
      }
      const data = await api.compileGraph(selectedGraph.id);
      const fp = eventFingerprintFromDef(getCurrentDef()) || null;
      setSelectedGraph((g) =>
        g
          ? {
              ...g,
              status: "ACTIVE",
              compiledAt: new Date().toISOString(),
              deployFingerprint: fp, // stash it locally for UI logic
            }
          : g
      );
      window.alert(`Deployed successfully.`);
    } catch (e) {
      window.alert(`Compile failed: ${e.message || "Unknown error"}`);
    } finally {
      setCompiling(false);
    }
  }

  const dirty = !contentEqual(sanitizeDefinition(nodes, edges), lastSavedDef);

  // Button visibility logic
  const savedDef = lastSavedDef; // what’s on server (or last autosave)
  const currentFingerprint = eventFingerprintFromDef(savedDef);
  const isDeployedToThis = selectedGraph?.deployFingerprint
    ? selectedGraph.deployFingerprint === currentFingerprint
    : false;
  const showDeploy = Boolean(
    selectedGraph && !dirty && currentFingerprint && !isDeployedToThis
  );

  return (
    <div>
      <div
        style={{ width: "100%", height: "calc(100vh - 60px)", display: "flex" }}
      >
        <FlowCanvas
          nodes={nodes}
          setNodes={setNodes}
          edges={edges}
          setEdges={setEdges}
          onNodeDataChange={onNodeDataChange}
          selectedGraph={selectedGraph}
          setSelectedGraph={setSelectedGraph}
          usage={usage}
          getCurrentDef={getCurrentDef}
          setLastSavedDef={setLastSavedDef}
          autosave={api.autosave}
          pauseGraph={api.pauseGraph}
          resumeGraph={api.resumeGraph}
          onDeleteGraph={handleDeleteGraph}
          canAutosavePositions={!dirty}
        />
      </div>

      {/* Floating Compile when CLEAN */}
      {showDeploy && (
        <button
          onClick={deployGraph}
          disabled={compiling}
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            padding: "10px 14px",
            borderRadius: 12,
            border: "none",
            background: "#4f46e5",
            color: "white",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            cursor: "pointer",
            zIndex: 20,
          }}
          title="Deploy (create/update webhook)"
        >
          {compiling ? "Deploying…" : "Deploy"}
        </button>
      )}

      {/* Bottom Save bar when DIRTY */}
      {dirty && (
        <SaveDeployBar
          compiling={compiling}
          onRevert={() => {
            const { nodes: n, edges: e } = rehydrateDefinition(
              lastSavedDef,
              onNodeDataChange
            );
            setNodes(n);
            setEdges(e);
          }}
          onSave={async () => {
            // Save-only path. We may need to CLEAN UP provider webhooks if the event was removed.
            const before = selectedGraph?.deployFingerprint || null;
            const updated = await saveGraph();
            const afterFp = eventFingerprintFromDef(getCurrentDef()) || null;
            // If graph had a deployment but now has NO event → reconcile (delete provider webhook if orphan)
            if (before && !afterFp) {
              try {
                await api.compileGraph(updated.id); // our compile route already removes links when no nodes exist
                setSelectedGraph((g) =>
                  g ? { ...g, deployFingerprint: null } : g
                );
              } catch {
                /* soft-fail; provider cleanup can be retried later */
              }
            }
          }}
          onSaveAndCompile={
            showDeploy
              ? async () => {
                  await deployGraph();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
