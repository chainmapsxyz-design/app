// ./src/lib/ABIUtils.js
// Utilities for flattening event inputs and decoding tuple[] payload strings.

export function isTupleArray(type = "") {
    // "tuple[]" or "tuple[] indexed" (from your UI labeling)
    const t = type.split(/\s+/)[0];
    return t === "tuple[]";
}

export function flattenEventInputs(inputs = []) {
    // Return both: "display args" for the node, and a spec map for decoding later
    const flattened = [];
    const decodeSpec = {}; // { [parentName]: { kind: 'tuple[]', groupSize: N, components: [{name,type}, ...] } }

    for (const inp of inputs) {
        const { name, type, components = [], indexed } = inp;
        const baseType = indexed ? type.replace(/\s*indexed\s*$/i, "").trim() : type;

        if (baseType === "tuple") {
            // Not common in logs, but if present, flatten as name:sub
            for (const c of components) {
                flattened.push({
                    name: `${name}:${c.name}`,
                    type: c.type,
                    parent: name,
                    isFromTuple: true,
                });
            }
            decodeSpec[name] = {
                kind: "tuple",
                groupSize: components.length,
                components: components.map(({ name, type }) => ({ name, type })),
            };
        } else if (baseType === "tuple[]") {
            for (const c of components) {
                flattened.push({
                    name: `${name}:${c.name}`,
                    type: c.type,
                    parent: name,
                    isFromTupleArray: true,
                });
            }
            decodeSpec[name] = {
                kind: "tuple[]",
                groupSize: components.length,
                components: components.map(({ name, type }) => ({ name, type })),
            };
        } else {
            flattened.push({ name, type: inp.type, parent: null });
        }
    }

    return { flattened, decodeSpec };
}

/**
 * API gives tuple[] as a single comma-separated string.
 * Example offer: '1,0xToken,0,770000...' for SpentItem { itemType, token, identifier, amount }
 * Example consideration: repeats groups of 5 values.
 */
export function decodeTupleArrayString(valueStr, spec) {
    if (!valueStr || typeof valueStr !== "string") return [];
    if (!spec || spec.kind !== "tuple[]") return [];

    const pieces = valueStr.split(",");
    const { groupSize, components } = spec;

    const result = [];
    for (let i = 0; i < pieces.length; i += groupSize) {
        const group = pieces.slice(i, i + groupSize);
        if (group.length < groupSize) break;
        const obj = {};
        components.forEach((c, idx) => {
            obj[c.name] = group[idx];
        });
        result.push(obj);
    }
    return result;
}

/**
 * Decode tuple (non-array) comma string into an object.
 */
export function decodeTupleString(valueStr, spec) {
    if (!valueStr || typeof valueStr !== "string") return null;
    if (!spec || spec.kind !== "tuple") return null;

    const parts = valueStr.split(",");
    if (parts.length < spec.groupSize) return null;

    const obj = {};
    spec.components.forEach((c, i) => {
        obj[c.name] = parts[i];
    });
    return obj;
}

/**
 * Build a normalized "event payload" using the decodeSpec and raw event data.
 * The goal is to let Formatter use {{offer[0].token}} and {{consideration[2].recipient}} safely.
 */
export function normalizeEventPayload(rawEvent = {}, decodeSpec = {}) {
    const out = { ...rawEvent };

    Object.entries(decodeSpec).forEach(([parentName, spec]) => {
        const raw = rawEvent[parentName];
        if (spec.kind === "tuple[]") {
            out[parentName] = decodeTupleArrayString(raw, spec);
        } else if (spec.kind === "tuple") {
            out[parentName] = decodeTupleString(raw, spec);
        }
    });

    return out;
}
