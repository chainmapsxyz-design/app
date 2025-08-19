// src/inspector/NodeInspector.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { inspectorRegistry } from "./registry";

export default function NodeInspector({
  node,
  width = 360,
  onResize,
  onResizeEnd,
  onChange, // (patch: object) => void  — pushes node.data updates to the canvas
}) {
  const Comp = useMemo(
    () => (node ? inspectorRegistry[node.type] : null),
    [node]
  );
  const [scratch, setScratch] = useState(node?.data ?? {});

  // drag state
  const dragging = useRef(null);
  const latestWidth = useRef(width);
  const rafId = useRef(0);

  // keep refs in sync
  useEffect(() => {
    latestWidth.current = Math.max(260, Math.min(720, width));
  }, [width]);

  // sync when switching nodes
  useEffect(() => {
    setScratch(node?.data ?? {});
  }, [node?.id]);

  // also sync when node.data changes (external updates)
  useEffect(() => {
    setScratch(node?.data ?? {});
  }, [node?.data]);

  function safeSetBodyDragStyles(active) {
    try {
      document.body.style.cursor = active ? "col-resize" : "";
      document.body.style.userSelect = active ? "none" : "";
    } catch {
      /* SES / locked DOM environments */
    }
  }

  function startPointerDrag(e) {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* empty */
    }
    dragging.current = {
      startClientX: e.clientX,
      startWidth: latestWidth.current,
    };
    safeSetBodyDragStyles(true);
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const { startClientX, startWidth } = dragging.current;
    const dx = startClientX - e.clientX;
    const next = Math.max(260, Math.min(720, Math.round(startWidth + dx)));

    // throttle with rAF
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      try {
        latestWidth.current = next;
        onResize?.(next);
      } catch {
        // swallow to avoid uncaughts under SES
      } finally {
        rafId.current = 0;
      }
    });
  }

  function onPointerUp(e) {
    if (!dragging.current) return;
    dragging.current = null;
    safeSetBodyDragStyles(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* empty */
    }
    // flush any pending frame
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    // persist once
    try {
      onResizeEnd?.(latestWidth.current);
    } catch {
      /* ignore */
    }
  }

  const clampedWidth = Math.max(260, Math.min(720, width));

  return (
    <aside
      role="complementary"
      aria-label="Node Inspector"
      style={{
        width: clampedWidth,
        minWidth: 260,
        maxWidth: 720,
        borderLeft: "1px solid #e2e8f0",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div
        onPointerDown={startPointerDrag}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Drag to resize"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 10,
          cursor: "col-resize",
          touchAction: "none", // disable gestures
        }}
      />

      <Header node={node} />

      <div style={{ padding: 12, overflow: "auto", flex: 1 }}>
        {node ? (
          Comp ? (
            <Comp
              node={node}
              value={scratch}
              onChange={(next) => {
                // Live-apply to both local state and canvas
                setScratch(next);
                node && onChange?.(next);
              }}
            />
          ) : (
            <DefaultJsonEditor
              value={scratch}
              onChange={(next) => {
                setScratch(next);
                node && onChange?.(next);
              }}
            />
          )
        ) : (
          <EmptyState />
        )}
      </div>

      <Footer hasNode={!!node} onReset={() => setScratch(node?.data ?? {})} />
    </aside>
  );
}

function Header({ node }) {
  return (
    <div
      style={{
        padding: 12,
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontWeight: 800 }}>
        {node ? (
          <>
            {node.type} <span style={{ color: "#64748b" }}>({node.id})</span>
          </>
        ) : (
          "Inspector"
        )}
      </div>
      {/* No Save here — edits apply live and the global Save bar handles persistence */}
    </div>
  );
}

function Footer({ hasNode, onReset }) {
  return (
    <div
      style={{
        padding: 12,
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
      }}
    >
      <button
        onClick={onReset}
        disabled={!hasNode}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          background: "#fff",
        }}
      >
        Reset
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "#64748b",
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>No node selected</div>
        <div style={{ fontSize: 12 }}>
          Click a node in the canvas to edit its properties here.
        </div>
      </div>
    </div>
  );
}

function DefaultJsonEditor({ value, onChange }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(JSON.stringify(value ?? {}, null, 2));
  }, [value]);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Data (raw JSON)</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: 240,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: 10,
        }}
      />
      <button
        onClick={() => {
          try {
            const parsed = JSON.parse(text);
            onChange?.(parsed); // live-apply upstream
          } catch {
            alert("Invalid JSON");
          }
        }}
        style={{
          justifySelf: "end",
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Apply JSON
      </button>
    </div>
  );
}
