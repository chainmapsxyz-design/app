// /src/hooks/useEthereumApi.js
export function useEthereumApi(authedFetch) {
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
        /**
         * Fetch ABI/events for a contract address.
         * Server is expected to respond with either:
         *   { events: Array<Event> }  // normalized events
         * or
         *   { abi: Array<ABIItem> }   // full ABI (filter events client-side)
         */
        async getAbi(address) {
            const res = await authedFetch(`/ethereum/abi?address=${encodeURIComponent(address)}`, {
                method: "GET",
            });
            return jsonOrThrow(res);
        },
    };
}
