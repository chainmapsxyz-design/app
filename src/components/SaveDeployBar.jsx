// /src/components/SaveDeployBar.jsx
export default function SaveDeployBar({
  compiling = false,
  onRevert,
  onSave,
  onSaveAndDeploy,
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        background: "#111827",
        color: "white",
        borderRadius: 12,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        zIndex: 20,
      }}
    >
      <div>Unsaved changes</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={secondaryBtn}
          onClick={onRevert}
          disabled={compiling}
          title="Discard in-editor changes and restore last saved version"
        >
          Revert
        </button>
        <button
          style={secondaryBtn}
          onClick={onSave}
          disabled={compiling}
          title="Save the graph definition"
        >
          {compiling ? "Saving…" : "Save"}
        </button>
        {typeof onSaveAndDeploy === "function" && (
          <button
            onClick={onSaveAndDeploy}
            disabled={compiling}
            title="Save then deploy webhooks"
            style={primaryBtn}>
            {compiling ? "Deploying…" : "Save & Deploy"}
          </button>
        )}
      </div>
    </div>
  );
}

const primaryBtn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: "#4f46e5",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryBtn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 600,
};
