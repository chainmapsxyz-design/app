// src/components/InfoRow.jsx

export default function InfoRow({ label, value }) {
  return (
    <div
      style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}
    >
      <span style={{ width: 70, color: "#475569", fontSize: 12 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 12, color: "#0f172a" }}>
        {value}
      </span>
    </div>
  );
}

