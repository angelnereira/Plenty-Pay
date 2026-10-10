import { handlers } from "@core/auth"
import { NextRequest } from "next/server"

export const { GET } = handlers

export const POST = async (request: NextRequest) => {
    // We want real session persistence for PWA by default.
    // The wrapper ensures the cookie has a Max-Age unless explicitly not wanted.
    if (request.method === "POST") {
        const clone = request.clone()
        // Default to true for PWA persistence as per user feedback
        let rememberMe = true 

        try {
            const contentType = request.headers.get("content-type") || ""
            if (contentType.includes("application/json")) {
                const body = await clone.json()
                // If the parameter is provided, we respect its value
                if (body.rememberMe !== undefined) {
                    rememberMe = body.rememberMe === "true" || body.rememberMe === true
                }
            } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
                const formData = await clone.formData()
                const value = formData.get("rememberMe")
                if (value !== null) {
                    rememberMe = value === "true"
                }
            }
        } catch (e) {
            console.error("[Auth Middleware] Failed to parse body", e)
        }

        // Call original handler
        const response = await handlers.POST(request)

        // If remember me is NOT checked (and wasn't default), we want a session cookie
        if (!rememberMe) {
            console.log("[Auth] User explicitly requested session-only. Stripping expiration.")
            // Helper to strip expiration from a single cookie string
            const stripExpiration = (cookie: string) => {
                return cookie
                    .replace(/Max-Age=[^;]+;?/g, "")
                    .replace(/Expires=[^;]+;?/g, "")
            }

            // Modify Set-Cookie headers
            const setCookieHeader = response.headers.get("Set-Cookie")
            if (setCookieHeader) {
                let newCookies: string[] = []

                // getSetCookie is the modern way to get all Set-Cookie headers individually
                if (typeof response.headers.getSetCookie === 'function') {
                    const cookies = response.headers.getSetCookie()
                    newCookies = cookies.map(cookie => {
                        if (cookie.includes("session-token")) {
                            return stripExpiration(cookie)
                        }
                        return cookie
                    })
                } else {
                    // Fallback for older environments
                    const cookies = setCookieHeader.split(/,(?=\s*[^=]+=[^;]+)/)
                    newCookies = cookies.map(cookie => {
                        if (cookie.includes("session-token")) {
                            return stripExpiration(cookie)
                        }
                        return cookie
                    })
                }

                // Clear and set new cookies
                response.headers.delete("Set-Cookie")
                newCookies.forEach(cookie => response.headers.append("Set-Cookie", cookie))
            }
        } else {
            // Log for verification in Dev / Staging
            const setCookieHeader = response.headers.get("Set-Cookie")
            if (setCookieHeader && (setCookieHeader.includes("Max-Age") || setCookieHeader.includes("Expires"))) {
                console.log("[Auth] Persistent session confirmed in headers")
            } else if (setCookieHeader) {
                console.warn("[Auth] Warning: Persistent session requested but no Max-Age found in headers. Check core/auth config.")
            }
        }

        return response
    }

    return handlers.POST(request)
}
