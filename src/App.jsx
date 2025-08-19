// /src/App.jsx
import { useState, useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useLocation, matchPath } from "react-router-dom";
import "@xyflow/react/dist/style.css";

import useAuthedFetch from "./auth/useAuthedFetch";

import { sanitizeDefinition } from "./graphs/saveUtils";

import Header from "./layout/Header";
import Logs from "./pages/Logs";
import Account from "./pages/Account";
import Contact from "./pages/Contact";
import GraphCanvasPage from "./pages/GraphCanvasPage";

// NEW: extracted pieces
import { useGraphApi } from "./hooks/useGraphApi";
import { useUsage } from "./hooks/useUsage";

const initialNodes = [];
const initialEdges = [];

export default function App() {
  const authedFetch = useAuthedFetch();
  const navigate = useNavigate();
  const location = useLocation();

  // Usage hook
  const api = useGraphApi(authedFetch);
  // Pass a stable callback into the polling hook
  const getUsage = useCallback(() => api.getUsage(), [api]);
  const { usage } = useUsage(getUsage, 30000);

  // Graph list + selected + defs
  const [graphs, setGraphs] = useState([]);
  const [selectedGraph, setSelectedGraph] = useState(null);
  const [lastSavedDef, setLastSavedDef] = useState({ nodes: [], edges: [] });

  // Flow state
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  // Compile state
  const [compiling, setCompiling] = useState(false);

  // Node data updater
  const onNodeDataChange = useCallback((id, patch) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }, []);

  // Helpers
  const getCurrentDef = useCallback(
    () => sanitizeDefinition(nodes, edges),
    [nodes, edges]
  );

  // Load graphs (and select default)
  useEffect(() => {
    (async () => {
      try {
        const list = await api.listGraphs();
        setGraphs(list || []);
        if (!list?.length) return;

        // Is the URL /graphs/:id? If so, try to select that one.
        const matchWithId = matchPath("/graphs/:id", location.pathname);
        if (matchWithId?.params?.id) {
          const targetId = String(matchWithId.params.id);
          const found = list.find((g) => String(g.id) === targetId);
          if (found) {
            setSelectedGraph(found);
            return; // respect the URL; no redirect
          }
          // If the id doesn't exist (deleted/invalid), fall back to first
          setSelectedGraph(list[0]);
          navigate(`/graphs/${list[0].id}`, { replace: true });
          return;
        }

        // Is the URL exactly /graphs (index)? Then choose a default and redirect.
        const atGraphsIndex = matchPath(
          { path: "/graphs", end: true },
          location.pathname
        );
        if (atGraphsIndex) {
          const dest = list[0];
          setSelectedGraph(dest);
          navigate(`/graphs/${dest.id}`, { replace: true });
        }
      } catch {
        // ignore for now; could show toast
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectGraph = useCallback(
    (g) => {
      setSelectedGraph(g);
      navigate(`/graphs/${g.id}`);
    },
    [navigate]
  );

  const handleCreateGraph = useCallback(async () => {
    const name = prompt("Name your new graph:");
    if (!name) return;
    try {
      const created = await api.createGraph(name);
      setGraphs((gs) => [created, ...gs]);
      setSelectedGraph(created);
      navigate(`/graphs/${created.id}`);
    } catch (e) {
      alert(`Create failed: ${e.message || "Unknown error"}`);
    }
  }, [api, navigate]);

  return (
    <ReactFlowProvider>
      <Header
        graphs={graphs}
        selectedGraph={selectedGraph}
        onSelectGraph={handleSelectGraph}
        onCreateGraph={handleCreateGraph}
        usage={usage}
      />

      <Routes>
        <Route path="/" element={<Navigate to="/graphs" replace />} />
        <Route
          path="/graphs"
          element={
            graphs?.length ? (
              <Navigate
                to={`/graphs/${selectedGraph?.id || graphs[0]?.id}`}
                replace
              />
            ) : (
              <div style={{ padding: 16 }}>
                No maps yet — use the “Maps: New Map” button in the header.
              </div>
            )
          }
        />
        <Route
          path="/graphs/:id"
          element={
            <GraphCanvasPage
              graphs={graphs}
              setGraphs={setGraphs}
              selectedGraph={selectedGraph}
              setSelectedGraph={setSelectedGraph}
              setLastSavedDef={setLastSavedDef}
              onNodeDataChange={onNodeDataChange}
              nodes={nodes}
              setNodes={setNodes}
              edges={edges}
              setEdges={setEdges}
              getCurrentDef={getCurrentDef}
              lastSavedDef={lastSavedDef}
              compiling={compiling}
              setCompiling={setCompiling}
              usage={usage}
              api={api} // pass API down
            />
          }
        />
        <Route
          path="/logs"
          element={<Logs graphs={graphs} selectedGraph={selectedGraph} />}
        />
        <Route path="/account" element={<Account />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="*"
          element={<div style={{ padding: 16 }}>Not found</div>}
        />
      </Routes>
    </ReactFlowProvider>
  );
}
