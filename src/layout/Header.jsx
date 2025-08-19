// /src/layout/Header.jsx
import { useMemo } from "react";
import { Link, NavLink } from "react-router-dom";
import githubLogo from "../assets/github_logo.svg";


function clampName(name = "", max = 90) {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
}

export default function Header({
  logo = "Chainmaps.xyz",
  graphs,
  selectedGraph,
  onSelectGraph,
  onCreateGraph,
  usage = { used: 0, limit: 100 },
}) {
  const currentLabel = useMemo(() => {
    if (!selectedGraph) return "Maps";
    return `Maps → ${clampName(selectedGraph.name, 90)}`;
  }, [selectedGraph]);

  const usedRaw = usage?.used ?? 0;
  const limit = usage?.limit ?? 100;
  const pct = limit > 0 ? Math.min(100, Math.round((usedRaw / limit) * 100)) : 0;
  const over = usedRaw >= limit;

  return (
    <header
      style={{
        height: 60,
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        background: "white",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Logo */}
      <Link to="/graphs" style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}>
          {logo}
        </div>
      </Link>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
        {/* Graphs dropdown */}
        <div style={{ position: "relative" }} className="graphs-dropdown">
          <details>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontWeight: 600,
              }}
            >
              {currentLabel}
            </summary>
            <div
              style={{
                position: "absolute",
                top: "110%",
                left: 0,
                minWidth: 320,
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                padding: 8,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              <button
                onClick={onCreateGraph}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px dashed #cbd5e1",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 6,
                }}
              >
                ➕ New map
              </button>

              {graphs?.length ? (
                graphs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onSelectGraph(g)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border:
                        g.id === selectedGraph?.id
                          ? "2px solid #4f46e5"
                          : "1px solid #e5e7eb",
                      background: "#fff",
                      cursor: "pointer",
                      marginBottom: 6,
                    }}
                    title={g.name}
                  >
                    {clampName(g.name, 90)}
                  </button>
                ))
              ) : (
                <div style={{ padding: 8, color: "#64748b", fontSize: 14 }}>
                  No maps yet.
                </div>
              )}
            </div>
          </details>
        </div>

        <NavLink
          to="/logs"
          style={({ isActive }) => ({
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: isActive ? "#111827" : "#334155",
            background: isActive ? "#eef2ff" : "transparent",
            fontWeight: 600,
          })}
        >
          Logs
        </NavLink>

        <NavLink
          to="/account"
          style={({ isActive }) => ({
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: isActive ? "#111827" : "#334155",
            background: isActive ? "#eef2ff" : "transparent",
            fontWeight: 600,
          })}
        >
          Account
        </NavLink>

        <NavLink
          to="/contact"
          style={({ isActive }) => ({
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: isActive ? "#111827" : "#334155",
            background: isActive ? "#eef2ff" : "transparent",
            fontWeight: 600,
          })}
        >
          Contact
        </NavLink>

        <a
          href="https://github.com/chainmapsxyz-design/app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: "#334155",
            fontWeight: 600,
          }}
          title="Contribute on GitHub"
        >
          <img
            src={githubLogo}
            alt="Contribute on GitHub"
            style={{ width: 18, height: 18 }}
          />
        </a>
      </nav>

      {/* Right: API Usage meter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 260,
        }}
      >
        <div style={{ fontSize: 12, color: "#475569", minWidth: 70 }}>
          API Usage
        </div>
        <div style={{ flex: 1 }}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={Math.min(usedRaw, limit)}
            style={{
              height: 10,
              background: "#e5e7eb",
              borderRadius: 999,
              overflow: "hidden",
            }}
            title={Math.min(usedRaw, limit) / limit}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: over
                  ? "#ef4444"
                  : pct < 70
                  ? "#4f46e5"
                  : pct < 90
                  ? "#f59e0b"
                  : "#ef4444",
              }}
            />
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#475569",
            minWidth: 80,
            textAlign: "right",
          }}
        >
          {Math.min(usedRaw, limit)} / {limit} used
        </div>
      </div>
    </header>
  );
}
