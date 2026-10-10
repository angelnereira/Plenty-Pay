import { AppAction } from "@shared/lib/workflow-ids";

type FetchOptions = RequestInit & {
    action?: AppAction;
};

export const apiClient = {
    fetch: async (url: string, { action, ...options }: FetchOptions = {}) => {
        const headers = new Headers(options.headers);

        // Inject the App Action header if provided
        if (action) {
            headers.set("X-App-Action", action);
        }

        return fetch(url, {
            ...options,
            headers,
        });
    }
};
