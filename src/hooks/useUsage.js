// /src/hooks/useUsage.js
import { useCallback, useEffect, useRef, useState } from "react";

export function useUsage(getUsage, intervalMs = 30000) {
    const [usage, setUsage] = useState({ used: 0, limit: 100 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const timerRef = useRef(null);
    const inFlightRef = useRef(false);
    const getUsageRef = useRef(getUsage);
    useEffect(() => { getUsageRef.current = getUsage; }, [getUsage]);

    const refresh = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const u = await getUsageRef.current();
            setUsage({ used: u.used ?? 0, limit: u.limit ?? 100 });
        } catch (e) {
            setError(e);
        } finally {
            inFlightRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // initial load
        refresh();
        // start interval
        timerRef.current = setInterval(refresh, intervalMs);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [refresh, intervalMs]);

    return { usage, refresh, loading, error };
}
