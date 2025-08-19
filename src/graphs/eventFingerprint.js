// /src/graphs/eventFingerprint.js
// Make a stable key for the configured ContractEvent node in a def
// Returns null if no fully-configured ContractEvent is present
export function eventFingerprintFromDef(def = {}) {
    const nodes = Array.isArray(def.nodes) ? def.nodes : [];
    const ev = nodes.find(
        (n) =>
            n?.type === "ContractEvent" &&
            n?.data?.address &&
            n?.data?.eventAbi &&
            (n?.data?.networkKey || n?.data?.network)
    );
    if (!ev) return null;

    const network =
        ev.data.networkKey || (ev.data.network || "").toLowerCase().replace(/\s+/g, "-");
    const addr = String(ev.data.address || "").toLowerCase();

    // Build a selector like name(type1,type2,tuple[],...)
    const abi = ev.data.eventAbi;
    const name = abi?.name || "event:?";
    const types = Array.isArray(abi?.inputs)
        ? abi.inputs.map((i) => (String(i.type || "") || "unknown"))
        : [];
    const selector = `${name}(${types.join(",")})`;

    return `${network}|${addr}|${selector}`;
}
