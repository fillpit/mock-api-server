/**
 * Mock API Server - Main Entry Point (Cloudflare Workers)
 */

import { Hono } from 'hono';
import type { Env, GlobalSettings } from './types.js';
import { DEFAULT_SETTINGS } from './types.js';
import { createKVStorage, MemoryStorage, IStorage } from './storage/index.js';
import { corsMiddleware, staticCorsMiddleware } from './middleware/index.js';
import { createAdminRoutes, createMockRoutes } from './routes/index.js';

type Variables = {
    storage: IStorage;
};

// Get storage instance
function getStorage(env: Env): IStorage {
    // Try KV first (Cloudflare Workers)
    const kvStorage = createKVStorage(env);
    if (kvStorage) {
        return kvStorage;
    }

    // Fall back to memory storage (no persistence in workers without KV)
    return new MemoryStorage();
}

// Get settings from storage
async function getSettings(storage: IStorage): Promise<GlobalSettings> {
    try {
        return await storage.getSettings();
    } catch {
        return DEFAULT_SETTINGS;
    }
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Create storage
        const storage = getStorage(env);
        await storage.initialize();

        const storageGetter = () => storage;
        const settingsGetter = () => getSettings(storage);

        // Create app instance
        const workerApp = new Hono<{ Bindings: Env; Variables: Variables }>();

        // Initialize storage middleware
        workerApp.use('*', async (c, next) => {
            c.set('storage', storage);
            await next();
        });

        // Redirect root to index.html
        workerApp.get('/', (c) => c.redirect('/index.html'));

        // CORS for admin routes
        workerApp.use('/api/admin/*', staticCorsMiddleware());

        // Mount admin routes with proper env
        workerApp.route('/api/admin', createAdminRoutes(storageGetter, env));

        // Dynamic CORS for mock routes
        workerApp.use('/mock/*', corsMiddleware(settingsGetter));

        // Mount mock routes under /mock prefix
        workerApp.route('/mock', createMockRoutes(storageGetter, settingsGetter));

        // Handle any other paths as potential mock routes
        workerApp.all('*', async (c) => {
            const path = c.req.path;

            // Skip admin routes
            if (path.startsWith('/api/admin')) {
                return c.notFound();
            }

            // Apply dynamic CORS
            const settings = await settingsGetter();
            const origin = c.req.header('Origin') || '*';
            const isAllowed = settings.corsOrigins.includes('*') ||
                settings.corsOrigins.includes(origin);

            if (isAllowed) {
                const allowedOrigin = settings.corsOrigins.includes('*') ? '*' : origin;
                c.header('Access-Control-Allow-Origin', allowedOrigin);
                c.header('Access-Control-Allow-Methods', settings.corsMethods.join(', '));
                c.header('Access-Control-Allow-Headers', settings.corsHeaders.join(', '));
            }

            if (c.req.method === 'OPTIONS') {
                return new Response(null, { status: 204 });
            }

            // Try to find matching endpoint
            const endpoint = await storage.getEndpointByPath(path, '', c.req.method);

            if (!endpoint) {
                for (const [key, value] of Object.entries(settings.defaultHeaders)) {
                    c.header(key, value);
                }
                return c.json({
                    error: 'Not Found',
                    message: `No mock endpoint configured for ${c.req.method} ${path}`,
                }, 404);
            }

            // Apply delay
            if (endpoint.response.delay && endpoint.response.delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, endpoint.response.delay));
            }

            // Apply headers
            for (const [key, value] of Object.entries(settings.defaultHeaders)) {
                c.header(key, value);
            }
            for (const [key, value] of Object.entries(endpoint.response.headers)) {
                c.header(key, value);
            }

            return c.json(endpoint.response.body, endpoint.response.status as 200);
        });

        return workerApp.fetch(request, env, ctx);
    },
};
