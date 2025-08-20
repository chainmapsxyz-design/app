// src/graphs/nodeLimits.js
// Graph-level node count caps, sourced directly from node meta.

import { getNodeMeta } from "@nodes/frontend/index.js";

export function countByType(nodes = []) {
    return nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
    }, {});
}

export function getMaxPerGraph(type) {
    const meta = getNodeMeta(type);
    if (meta && Number.isFinite(meta.maxPerGraph)) {
        return meta.maxPerGraph;
    }
    return null;
}

export function canAddNode(type, nodes = []) {
    const limit = getMaxPerGraph(type);
    if (!limit) return { ok: true };

    const counts = countByType(nodes);
    const current = counts[type] || 0;

    if (current >= limit) {
        const plural = limit > 1 ? "nodes" : "node";
        return {
            ok: false,
            reason: `Limit reached: only ${limit} ${type} ${plural} allowed in a graph.`,
        };
    }
    return { ok: true };
}
