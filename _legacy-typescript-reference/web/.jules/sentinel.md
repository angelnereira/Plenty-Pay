## 2024-05-23 - Middleware Public Route Bypass
**Vulnerability:** Middleware logic `publicRoutes.some(route => pathname.startsWith(route))` combined with a `'/'` entry in `publicRoutes` caused ALL routes to be treated as public.
**Learning:** `startsWith` is dangerous for path matching when the root path `'/'` is involved. It effectively disables the check.
**Prevention:** Use exact matching for the root path (`if (route === '/') return pathname === '/'`) or ensure route definitions are robust (e.g., using regex or path-to-regexp).
