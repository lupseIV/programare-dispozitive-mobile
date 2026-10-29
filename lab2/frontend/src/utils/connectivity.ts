// navigator.onLine is unreliable (it stays true when only some adapters are down, e.g. virtual
// ones), so when the app server is unreachable we double-check with a tiny independent request.
const PROBE_URL = 'https://www.gstatic.com/generate_204';

export async function hasInternet(): Promise<boolean> {
    if (!navigator.onLine) return false;
    try {
        await fetch(PROBE_URL, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        return true;
    } catch {
        return false;
    }
}
