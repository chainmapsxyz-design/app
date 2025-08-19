import { useEffect, useMemo, useState } from "react";
import useAuthedFetch from "../auth/useAuthedFetch";

function ProgressBar({ used = 0, limit = 100, height = 10 }) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  );
  const color = pct < 70 ? "#4f46e5" : pct < 90 ? "#f59e0b" : "#ef4444";
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={used}
      title={`${used} / ${limit}`}
      style={{
        width: "100%",
        height,
        background: "#e5e7eb",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: color }} />
    </div>
  );
}

export default function Account() {
  const authedFetch = useAuthedFetch();

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [usage, setUsage] = useState({
    used: 0,
    limit: 100,
    periodStart: "",
    periodEnd: "",
  });
  const [history, setHistory] = useState([]);

  const createdAt = useMemo(() => {
    if (!profile?.createdAt) return "";
    try {
      return new Date(profile.createdAt).toLocaleString();
    } catch {
      return profile.createdAt;
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [accRes, usageRes, histRes] = await Promise.all([
          authedFetch("/account"),
          authedFetch("/usage"),
          authedFetch("/account/usage/history?months=6"),
        ]);

        if (!accRes.ok)
          throw new Error(
            (await accRes.json()).error || "Failed to load account"
          );
        if (!usageRes.ok)
          throw new Error(
            (await usageRes.json()).error || "Failed to load usage"
          );
        if (!histRes.ok)
          throw new Error(
            (await histRes.json()).error || "Failed to load usage history"
          );

        const acc = await accRes.json();
        const u = await usageRes.json();
        const h = await histRes.json();

        if (!mounted) return;
        setProfile(acc);
        setName(acc.name || "");
        setUsage(u);
        setHistory(Array.isArray(h.items) ? h.items : []);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authedFetch]);

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    setError("");
    try {
      const res = await authedFetch("/account", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save name");
      setProfile((p) => (p ? { ...p, name: data.name } : p));
    } catch (e) {
      setError(e.message || "Failed to save name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const current = String(form.get("current") || "");
    const next = String(form.get("next") || "");
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setSavingPass(true);
    setError("");
    try {
      const res = await authedFetch("/account", {
        method: "PATCH",
        body: JSON.stringify({ passwordChange: { current, next } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Password change failed");
      e.currentTarget.reset();
      alert("Password updated.");
    } catch (e) {
      setError(e.message || "Password change failed");
    } finally {
      setSavingPass(false);
    }
  }

  // ---------- Billing actions ----------
  async function startCheckout(priceId) {
    try {
      setBillingBusy(true);
      const res = await authedFetch("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url)
        throw new Error(j.error || "Failed to start checkout");
      window.location.assign(j.url);
    } catch (e) {
      setError(e.message || "Checkout failed");
    } finally {
      setBillingBusy(false);
    }
  }

  async function openPortal() {
    try {
      setBillingBusy(true);
      const res = await authedFetch("/billing/portal", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url)
        throw new Error(j.error || "Failed to open billing portal");
      window.location.assign(j.url);
    } catch (e) {
      setError(e.message || "Open portal failed");
    } finally {
      setBillingBusy(false);
    }
  }

  const priceStarter = import.meta.env.VITE_STRIPE_PRICE_STARTER || "";
  const pricePro = import.meta.env.VITE_STRIPE_PRICE_PRO || "";

  const currentTier = (profile?.tier || "FREE").toUpperCase();
  const onStarter = currentTier === "STARTER";
  const onPro = currentTier === "PRO";
  const onFree = currentTier === "FREE";
  const isPaid = onStarter || onPro;

  // we’ll allow portal for any paid tier or if a customer exists (e.g., canceled -> FREE but still has a Stripe customer)
  const hasCustomer = Boolean(profile?.stripeCustomerId);
  const canUsePortal = isPaid || hasCustomer;

  // Build CTAs per card
  const freeCTA = onFree
    ? { label: null } // current plan: NO button
    : { label: "Downgrade to Free", onClick: openPortal };

  const starterCTA = onStarter
    ? { label: null } // current plan: NO button
    : isPaid
    ? { label: "Change to Starter", onClick: openPortal } // Pro -> Starter via portal
    : {
        label: "Upgrade to Starter",
        onClick: () => startCheckout(priceStarter),
        disabled: !priceStarter,
      };

  const proCTA = onPro
    ? { label: null } // current plan: NO button
    : isPaid
    ? {
        label: onStarter ? "Upgrade to Pro" : "Change to Pro",
        onClick: openPortal,
      } // Starter -> Pro via portal
    : {
        label: "Upgrade to Pro",
        onClick: () => startCheckout(pricePro),
        disabled: !pricePro,
      };

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 920,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Account</h1>

      {error && (
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
      )}

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading…</div>
      ) : (
        <>
          {/* Profile */}
          <section style={card}>
            <h2 style={h2}>Profile</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Row label="Email" value={profile?.email || "-"} />
              <Row label="Tier" value={profile?.tier || "-"} />
              <Row label="Created" value={createdAt || "-"} />
              <Row label="Graphs" value={String(profile?.graphsCount ?? 0)} />
              <Row
                label="Active Hooks"
                value={String(profile?.hooksCount ?? 0)}
              />
            </div>

            <form
              onSubmit={handleSaveName}
              style={{ display: "flex", gap: 8, marginTop: 8 }}
            >
              <label style={{ display: "grid", gap: 6, flex: 1 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  Display name
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </label>
              <button type="submit" disabled={savingName} style={primaryBtn}>
                {savingName ? "Saving…" : "Save"}
              </button>
            </form>
          </section>
          {/* Password */}
          <section style={card}>
            <h2 style={h2}>Change Password</h2>
            <form
              onSubmit={handleChangePassword}
              style={{ display: "grid", gap: 10 }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  Current password
                </div>
                <input
                  name="current"
                  type="password"
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#475569" }}>
                  New password
                </div>
                <input
                  name="next"
                  type="password"
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={savingPass} style={primaryBtn}>
                  {savingPass ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </section>
          {/* Usage */}
          <section style={card}>
            <h2 style={h2}>API Usage</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <ProgressBar used={usage.used} limit={usage.limit} height={12} />
              <div style={{ fontSize: 13, color: "#334155" }}>
                <strong>{usage.used}</strong> / {usage.limit} used
                {usage.periodStart && usage.periodEnd ? (
                  <span style={{ color: "#64748b" }}>
                    {" "}
                    (period {new Date(
                      usage.periodStart
                    ).toLocaleDateString()} –{" "}
                    {new Date(usage.periodEnd).toLocaleDateString()})
                  </span>
                ) : null}
              </div>
            </div>

            {history.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  Recent months
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thTd}>Period</th>
                        <th style={thTd}>Runs</th>
                        <th style={thTd}>Events</th>
                        <th style={thTd}>Webhook Calls</th>
                        <th style={thTd}>Bytes Stored</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((it) => (
                        <tr key={it.periodStart}>
                          <td style={thTd}>
                            {new Date(it.periodStart).toLocaleDateString()} –{" "}
                            {new Date(it.periodEnd).toLocaleDateString()}
                          </td>
                          <td style={thTd}>{it.runs}</td>
                          <td style={thTd}>{it.eventsReceived}</td>
                          <td style={thTd}>{it.webhookCalls}</td>
                          <td style={thTd}>{it.bytesStored}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
          {/* Subscription */}
          <section style={card}>
            <h2 style={h2}>Subscription</h2>
            <div style={{ fontSize: 14, color: "#334155" }}>
              Current plan: <strong>{currentTier}</strong>
              {profile?.currentPeriodEnd && (
                <span style={{ color: "#64748b" }}>
                  {" "}
                  • Renews{" "}
                  {new Date(profile.currentPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>

            {!canUsePortal && onFree && (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Choose a plan to get started. You can manage your card and
                change plans later in the Stripe portal.
              </div>
            )}

            {/* {canUsePortal && (
              <div>
                <button
                  onClick={openPortal}
                  disabled={billingBusy}
                  style={primaryBtn}
                >
                  {billingBusy ? "Opening…" : "Manage billing"}
                </button>
              </div>
            )} */}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 8,
              }}
            >
              <PlanCard
                name="Free"
                credits="100"
                highlight={onFree}
                badge={onFree ? "Current plan" : undefined}
                ctaLabel={freeCTA.label}
                onClick={freeCTA.onClick}
                disabled={freeCTA.disabled}
              />
              <PlanCard
                name="Starter"
                credits="10,000"
                highlight={onStarter}
                badge={onStarter ? "Current plan" : undefined}
                ctaLabel={starterCTA.label}
                onClick={starterCTA.onClick}
                disabled={starterCTA.disabled}
              />
              <PlanCard
                name="Pro"
                credits="100,000"
                highlight={onPro}
                badge={onPro ? "Current plan" : undefined}
                ctaLabel={proCTA.label}
                onClick={proCTA.onClick}
                disabled={proCTA.disabled}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** small subcomponents & styles */

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ width: 120, color: "#475569", fontSize: 13 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PlanCard({
  name,
  credits,
  badge,
  ctaLabel,
  onClick,
  disabled,
  highlight,
}) {
  return (
    <div
      style={{
        flex: "1 1 240px",
        border: highlight ? "2px solid #4f46e5" : "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 800 }}>{name}</div>
        {badge ? (
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              color: "#3730a3",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div style={{ color: "#475569", fontSize: 14 }}>
        {credits} API credits / month
      </div>
      {ctaLabel ? (
        <div>
          <button
            onClick={onClick}
            disabled={disabled || !onClick}
            style={primaryBtn}
          >
            {ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  background: "white",
  display: "grid",
  gap: 12,
};

const h2 = { margin: 0, fontSize: 18 };

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
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

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
  fontSize: 14,
};

const thTd = {
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left",
};
