// /src/pages/Logs.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import useAuthedFetch from "../auth/useAuthedFetch";

const kinds = [
  { key: "all", label: "All" },
  { key: "runs", label: "Runs" },
  { key: "events", label: "Events" },
];

export default function Logs({ graphs = [], selectedGraph }) {
  const authedFetch = useAuthedFetch();

  const graphId = selectedGraph?.id || null;
  const graphName = selectedGraph?.name || "(no graph selected)";

  const [type, setType] = useState("all");
  const [items, setItems] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);

  const [summary, setSummary] = useState({
    totalRuns: 0,
    failedRuns: 0,
    totalEvents: 0,
    unprocessedEvents: 0,
  });

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const canLoadMore = Boolean(nextBefore);
  const hasGraph = Boolean(graphId);

  const loadSummary = useCallback(async () => {
    if (!hasGraph) return;
    try {
      const res = await authedFetch(`/logs/summary?graphId=${graphId}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // non-fatal
    }
  }, [authedFetch, graphId, hasGraph]);

  const fetchPage = useCallback(
    async ({ cursor = null, replace = false } = {}) => {
      if (!hasGraph) return;
      const qs = new URLSearchParams({
        graphId,
        type,
        limit: "25",
        ...(cursor ? { before: cursor } : {}),
      }).toString();

      const res = await authedFetch(`/logs?${qs}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load logs");
      }
      const j = await res.json();
      setNextBefore(j.nextBefore || null);
      setItems((prev) => (replace ? j.items : [...prev, ...j.items]));
    },
    [authedFetch, graphId, type, hasGraph]
  );

  // First load + whenever graph/type changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasGraph) return;
      setLoading(true);
      setError("");
      try {
        await Promise.all([fetchPage({ replace: true }), loadSummary()]);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load logs");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchPage, loadSummary, hasGraph, type]);

  // Simple row expander state
  const [openId, setOpenId] = useState(null);
  const toggleOpen = (id) => setOpenId((cur) => (cur === id ? null : id));

  const headerNote = useMemo(() => {
    if (!hasGraph) return "Pick a graph from the header to view logs.";
    const parts = [];
    parts.push(`Runs: ${summary.totalRuns}`);
    parts.push(`Failed: ${summary.failedRuns}`);
    parts.push(`Events: ${summary.totalEvents}`);
    parts.push(`Unprocessed: ${summary.unprocessedEvents}`);
    return parts.join(" • ");
  }, [hasGraph, summary]);

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 1000,
        margin: "0 auto",
        display: "grid",
        gap: 12,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Logs</h1>

      {/* Top bar: graph name + filter toggle */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 700 }}>
          Graph:&nbsp;<span title={graphName}>{graphName}</span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {kinds.map((k) => (
            <button
              key={k.key}
              onClick={() => setType(k.key)}
              disabled={!hasGraph || loading}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border:
                  type === k.key ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                background: type === k.key ? "#eef2ff" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          color: "#334155",
          fontSize: 14,
        }}
      >
        {headerNote}
      </div>

      {/* Body */}
      {!hasGraph ? (
        <div style={{ color: "#64748b" }}>
          Select a graph from the “Graphs” menu in the header.
        </div>
      ) : loading ? (
        <div style={{ color: "#64748b" }}>Loading…</div>
      ) : error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "#64748b" }}>No logs yet.</div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => (
              <LogRow
                key={`${it.kind}:${it.id}`}
                item={it}
                graphName={graphName}
                expanded={openId === it.id}
                onToggle={() => toggleOpen(it.id)}
              />
            ))}
          </div>

          {/* Load more */}
          {canLoadMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 10,
              }}
            >
              <button
                onClick={async () => {
                  setLoadingMore(true);
                  try {
                    await fetchPage({ cursor: nextBefore, replace: false });
                  } finally {
                    setLoadingMore(false);
                  }
                }}
                disabled={loadingMore}
                style={primaryBtn}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Row renderer */

function LogRow({ item, graphName, expanded, onToggle }) {
  if (item.kind === "run")
    return (
      <RunRow
        item={item.data}
        at={item.at}
        graphName={graphName}
        expanded={expanded}
        onToggle={onToggle}
      />
    );
  return (
    <EventRow
      item={item.data}
      at={item.at}
      graphName={graphName}
      expanded={expanded}
      onToggle={onToggle}
    />
  );
}

function RunRow({ item, at, graphName, expanded, onToggle }) {
  const statusColor =
    item.status === "SUCCESS"
      ? "#16a34a"
      : item.status === "FAILED"
      ? "#dc2626"
      : "#475569";
  const mini = [
    item.httpStatus ? `HTTP ${item.httpStatus}` : null,
    item.durationMs ? `${item.durationMs}ms` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <section style={card}>
      <div style={rowHead}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 800 }}>Run</span>
          <span title={graphName} style={{ color: "#475569" }}>
            {graphName}
          </span>
        </div>
        <div style={{ color: "#475569" }}>{new Date(at).toLocaleString()}</div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <StatusPill color={statusColor} label={item.status} />
        <div style={{ color: "#334155", fontSize: 14 }}>{mini || "—"}</div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={onToggle} style={secondaryBtn}>
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {expanded && (
        <div style={detailsBox}>
          <JsonKV label="Request" value={item.request} />
          <JsonKV label="Response" value={item.response} />
          {item.error && <JsonKV label="Error" value={item.error} isError />}
        </div>
      )}
    </section>
  );
}

function EventRow({ item, at, graphName, expanded, onToggle }) {
  const statusLabel = item.processed ? "Processed" : "Pending";
  const statusColor = item.processed ? "#16a34a" : "#f59e0b";
  const hookMeta = [
    item.hook?.network,
    shorten(item.hook?.address),
    item.hook?.eventSelector,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <section style={card}>
      <div style={rowHead}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 800 }}>Event</span>
          <span title={graphName} style={{ color: "#475569" }}>
            {graphName}
          </span>
        </div>
        <div style={{ color: "#475569" }}>{new Date(at).toLocaleString()}</div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <StatusPill color={statusColor} label={statusLabel} />
        <div style={{ color: "#334155", fontSize: 14 }}>{hookMeta || "—"}</div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={onToggle} style={secondaryBtn}>
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {expanded && (
        <div style={detailsBox}>
          <JsonKV label="Payload" value={item.payload} />
          {item.errorText && (
            <JsonKV label="Error" value={item.errorText} isError />
          )}
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Hook ID: {item.hookId} • {item.hook?.network} •{" "}
            {item.hook?.eventSelector}
          </div>
        </div>
      )}
    </section>
  );
}

/** Small UI helpers */

function StatusPill({ color, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        fontWeight: 700,
        color: color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function JsonKV({ label, value, isError = false }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 12,
          color: isError ? "#dc2626" : "#475569",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          background: "#0b1220",
          color: "#e2e8f0",
          borderRadius: 10,
          fontSize: 12,
          overflowX: "auto",
        }}
      >
        {safeJSONStringify(value, 2)}
      </pre>
    </div>
  );
}

function safeJSONStringify(v, space = 0) {
  try {
    return JSON.stringify(v, null, space);
  } catch {
    return String(v);
  }
}

function shorten(addr) {
  if (!addr || typeof addr !== "string") return addr || "";
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Styles */

const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 8,
};

const rowHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#4f46e5",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
};

const detailsBox = {
  display: "grid",
  gap: 8,
  borderTop: "1px dashed #e5e7eb",
  paddingTop: 10,
};
