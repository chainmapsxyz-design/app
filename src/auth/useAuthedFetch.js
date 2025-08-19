// /src/auth/useAuthedFetch.js
import { useCallback, useMemo } from 'react';
import { useAuth } from './AuthProvider';

export default function useAuthedFetch() {
    const { token, logout } = useAuth();

    // normalize base (strip trailing slash)
    const rawBase = import.meta.env.VITE_API_URL || '';
    const apiBase = useMemo(
        () => rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase,
        [rawBase]
    );

    const authedFetch = useCallback(
        async (path, options = {}) => {
            // allow absolute URLs; otherwise prefix with base
            const url = /^https?:\/\//i.test(path) ? path : `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`;

            const headers = new Headers(options.headers || {});
            if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
            if (token) headers.set('Authorization', `Bearer ${token}`);

            const res = await fetch(url, { ...options, headers });

            if (res.status === 401) {
                logout();           // expire session
                throw new Error('Unauthorized');
            }
            return res;
        },
        [apiBase, token, logout] // ✅ stable unless auth/base actually changes
    );

    return authedFetch;
}
