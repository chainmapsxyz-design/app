// Simple, reusable caps per node type.
export const NODE_LIMITS = {
    ContractEvent: 1,
    // Formatter: 1,  // example for later
};

export function countByType(nodes = []) {
    return nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
    }, {});
}

export function canAddNode(type, nodes = []) {
    const limit = NODE_LIMITS[type];
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
