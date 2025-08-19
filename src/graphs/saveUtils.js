// src/graphs/saveUtils.js
function stripFuncs(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripFuncs);
    const out = {};
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'function') continue;
        out[k] = stripFuncs(v);
    }
    return out;
}

export function sanitizeDefinition(nodes = [], edges = []) {
    // Keep only serializable fields; ReactFlow tolerates extra, but we avoid functions
    const safeNodes = nodes.map((n) => {
        const { data, ...rest } = n;
        return { ...rest, data: stripFuncs(data || {}) };
    });
    return { nodes: safeNodes, edges: stripFuncs(edges) };
}

export function rehydrateDefinition(def = {}, onNodeDataChange) {
    const nodes = (def.nodes || []).map((n) => ({
        ...n,
        data: { ...(n.data || {}), onChange: onNodeDataChange },
    }));
    const edges = def.edges || [];
    return { nodes, edges };
}

export function defsEqual(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}
