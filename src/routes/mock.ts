/**
 * Mock API Routes - Serves configured mock responses
 */

import { Hono } from 'hono';
import type { Endpoint, GlobalSettings } from '../types.js';
import { IStorage } from '../storage/index.js';

type Variables = {
    storage: IStorage;
};

// Delay helper
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockRoutes(getStorage: () => IStorage, getSettings: () => Promise<GlobalSettings>) {
    const mock = new Hono<{ Variables: Variables }>();

    // Catch-all handler for mock requests
    mock.all('*', async (c) => {
        const storage = getStorage();
        const settings = await getSettings();
        const method = c.req.method;
        const path = c.req.path;

        // Find matching endpoint
        const endpoint = await storage.getEndpointByPath(path, '', method);

        if (!endpoint) {
            // Apply default headers even for 404
            for (const [key, value] of Object.entries(settings.defaultHeaders)) {
                c.header(key, value);
            }

            return c.json({
                error: 'Not Found',
                message: `No mock endpoint configured for ${method} ${path}`,
            }, 404);
        }

        // Apply delay if configured
        if (endpoint.response.delay && endpoint.response.delay > 0) {
            await delay(endpoint.response.delay);
        }

        // Apply default headers
        for (const [key, value] of Object.entries(settings.defaultHeaders)) {
            c.header(key, value);
        }

        // Apply endpoint-specific headers
        for (const [key, value] of Object.entries(endpoint.response.headers)) {
            c.header(key, value);
        }

        // Return configured response
        return c.json(endpoint.response.body, endpoint.response.status as any);
    });

    return mock;
}
