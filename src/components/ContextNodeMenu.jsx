// /src/components/ContextNodeMenu.jsx
import { useEffect, useRef } from "react";
import { canAddNode } from "../graphs/nodeLimits";

export default function ContextNodeMenu({
  x,
  y,
  query,
  setQuery,
  nodePalette,
  nodes,
  ctx,
  onPick,
  onClose,
}) {
  const ref = useRef(null);
  useEffect(() => {
    // Close on Escape or click outside
    const onKey = (e) => e.key === "Escape" && onClose();
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const items = nodePalette
    .filter((it) => (it.enabled ? it.enabled(ctx) : true))
    .filter((it) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        it.label.toLowerCase().includes(q) || it.type.toLowerCase().includes(q)
      );
    });

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        width: 280,
        maxHeight: 360,
        overflow: "auto",
        background: "white",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        borderRadius: 10,
        padding: 8,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <input
        autoFocus
        placeholder="Search nodes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "auto",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          marginBottom: 8,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => {
          const check = canAddNode(item.type, nodes || []);
          const title = !check.ok ? check.reason : `Add ${item.label}`;
          return (
            <button
              key={item.type}
              onClick={() => check.ok && onPick(item)}
              disabled={!check.ok}
              title={title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: check.ok ? "white" : "#f8fafc",
                cursor: check.ok ? "pointer" : "not-allowed",
                textAlign: "left",
              }}
            >
              <span style={{ width: 20, textAlign: "center" }}>
                {item.icon}
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {item.type}
                </span>
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <div style={{ padding: 8, color: "#64748b", fontSize: 12 }}>
            No matches.
          </div>
        )}
      </div>
    </div>
  );
}
