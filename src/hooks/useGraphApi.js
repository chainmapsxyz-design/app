// /src/hooks/useGraphApi.js
export function useGraphApi(authedFetch) {
    async function jsonOrThrow(res) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) {
            const msg = data?.error || data?.message || res.statusText || "Request failed";
            const err = new Error(msg);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    return {
        async listGraphs() {
            const res = await authedFetch("/graphs");
            return jsonOrThrow(res);
        },

        async createGraph(name) {
            const res = await authedFetch("/graphs", {
                method: "POST",
                body: JSON.stringify({ name, definition: { nodes: [], edges: [] }, status: "DRAFT" }),
            });
            return jsonOrThrow(res);
        },

        async deleteGraph(id) {
            const res = await authedFetch(`/graphs/${id}`, { method: "DELETE", body: "{}" });
            await jsonOrThrow(res);
        },

        async saveGraph(id, { name, definition, status }) {
            const res = await authedFetch(`/graphs/${id}`, {
                method: "PUT",
                body: JSON.stringify({ name, definition, status }),
            });
            return jsonOrThrow(res);
        },

        async fetchDeployState(graphId) {
            return authedFetch(`/graphs/${graphId}/deploy-state`, { method: 'GET' });
        },

        // No version bump, swallow non-OK silently by returning null (for autosave UX)
        async autosave(id, { name, definition, status }) {
            try {
                const res = await authedFetch(`/graphs/${id}`, {
                    method: "PUT",
                    body: JSON.stringify({ name, definition, status, bumpVersion: false }),
                });
                if (!res.ok) return null;
                return await res.json();
            } catch {
                return null;
            }
        },

        async compileGraph(id) {
            const res = await authedFetch(`/graphs/${id}/compile`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            return jsonOrThrow(res);
        },

        async pauseGraph(id) {
            const res = await authedFetch(`/graphs/${id}/pause`, { method: "POST", body: "{}" });
            if (res.status === 402) {
                const data = await res.json().catch(() => ({}));
                // surface the 402 reason; caller decides UI (alert/tooltip)
                const err = new Error(data?.message || "Over limit — cannot pause/resume.");
                err.status = 402;
                throw err;
            }
            return jsonOrThrow(res);
        },

        async resumeGraph(id) {
            const res = await authedFetch(`/graphs/${id}/resume`, { method: "POST", body: "{}" });
            if (res.status === 402) {
                const data = await res.json().catch(() => ({}));
                const err = new Error(data?.message || "Over limit — cannot resume.");
                err.status = 402;
                throw err;
            }
            return jsonOrThrow(res);
        },

        async getUsage() {
            const res = await authedFetch("/usage");
            return jsonOrThrow(res);
        },
    };
}
