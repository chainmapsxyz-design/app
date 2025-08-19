// /src/components/Sidebar.jsx
import InfoRow from "./InfoRow";
import { nodePalette } from "../nodes";
import { canAddNode } from "../graphs/nodeLimits";

export default function Sidebar({
  selectedGraph,
  overLimit,
  onDeleteGraph,
  onTogglePause, // (checked: boolean) => void
  addNode, // (type: string, data?: object) => void
  onNodeDataChange,
  nodes,
}) {
  const status = selectedGraph?.status;
  const statusColor =
    status === "ACTIVE"
      ? "#16a34a"
      : status === "PAUSED"
      ? "#f59e0b"
      : "#475569";

  const compiledAt = selectedGraph?.compiledAt
    ? new Date(selectedGraph.compiledAt).toLocaleString()
    : "—";
  const version = selectedGraph?.version ?? "—";
  const name = selectedGraph?.name ?? "—";

  const btnStyle = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
    textAlign: "left",
  };

  const ctx = {
    env: import.meta.env,
    graph: selectedGraph,
  };

  return (
    <aside
      style={{
        width: 240,
        borderRight: "1px solid #e2e8f0",
        padding: 12,
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Graph Info */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "white",
          padding: 10,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Map Info</div>
        <InfoRow label="Name" value={name} />
        <div>
          <button
            onClick={onDeleteGraph}
            title="Delete map"
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            🗑️ Delete
          </button>
        </div>
        <InfoRow label="Deployed" value={compiledAt} />
        <InfoRow label="Version" value={String(version)} />

        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <span style={{ width: 70, color: "#475569", fontSize: 12 }}>
            Status
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: statusColor,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: statusColor,
              }}
            />
            {status || "—"}
          </span>
        </div>

        {(status === "ACTIVE" || status === "PAUSED") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "#475569" }}>Pause triggers</div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={status === "PAUSED"}
                onChange={(e) => onTogglePause(e.target.checked)}
                disabled={status === "PAUSED" && overLimit}
                title={
                  status === "PAUSED" && overLimit
                    ? "Over limit — upgrade or wait for next cycle to resume"
                    : undefined
                }
              />
              <span style={{ fontSize: 12, color: "#334155" }}>
                {status === "PAUSED" ? "Paused" : "Active"}
              </span>
            </label>
          </div>
        )}

        {status === "PAUSED" && overLimit && (
          <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>
            Over limit — resume disabled until you upgrade or usage resets.
          </div>
        )}
      </div>

      {/* Node palette */}
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Nodes</div>

      {nodePalette
        .filter((item) => (item.enabled ? item.enabled(ctx) : true))
        .map((item) => {
          const check = canAddNode(item.type, nodes || []);
          const title = !check.ok ? check.reason : `Add ${item.label}`;
          return (
            <button
              key={item.type}
              onClick={() => {
                const initial = item.getData?.(ctx) || {};
                addNode(item.type, { onChange: onNodeDataChange, ...initial });
              }}
              style={btnStyle}
              disabled={!check.ok}
              title={title}
            >
              {item.icon} {item.label}
            </button>
          );
        })}
    </aside>
  );
}
