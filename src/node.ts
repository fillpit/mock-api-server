/**
 * Node.js Entry Point (for Docker/local development)
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { MemoryStorage, IStorage } from './storage/index.js';
import { corsMiddleware, staticCorsMiddleware } from './middleware/index.js';
import { createAdminRoutes, createMockRoutes } from './routes/index.js';
import type { Env, GlobalSettings } from './types.js';
import { DEFAULT_SETTINGS } from './types.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const env: Env = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    DATA_PATH: process.env.DATA_PATH || './data',
    PORT: process.env.PORT || '3000',
};

// Initialize storage
const dataPath = env.DATA_PATH || './data';
const storage = new MemoryStorage(`${dataPath}/data.json`);

// Storage and settings getters
const getStorage = (): IStorage => storage;
const getSettings = async (): Promise<GlobalSettings> => {
    try {
        return await storage.getSettings();
    } catch {
        return DEFAULT_SETTINGS;
    }
};

// Create Hono app
const app = new Hono();

// Initialize storage on startup
await storage.initialize();

console.log('📦 Storage initialized');

// Serve static files
const publicPath = join(__dirname, '..', 'public');
app.use('/*', serveStatic({ root: publicPath }));

// Redirect root to index.html
app.get('/', (c) => c.redirect('/index.html'));

// CORS for admin routes
app.use('/api/admin/*', staticCorsMiddleware());

// Mount admin routes
app.route('/api/admin', createAdminRoutes(getStorage, env));

// Dynamic CORS for all other routes
app.use('*', corsMiddleware(getSettings));

// Catch-all for mock endpoints
app.all('*', async (c) => {
    const path = c.req.path;
    const method = c.req.method;

    // Skip static files and admin routes
    if (path.startsWith('/api/admin') ||
        path === '/index.html' ||
        path === '/app.js' ||
        path === '/json-editor.js' ||
        path === '/style.css' ||
        path === '/favicon.ico' ||
        path === '/') {
        return c.notFound();
    }

    const settings = await getSettings();

    // Try to find matching endpoint
    const endpoint = await storage.getEndpointByPath(path, '', method);

    if (!endpoint) {
        for (const [key, value] of Object.entries(settings.defaultHeaders)) {
            c.header(key, value);
        }
        return c.json({
            error: 'Not Found',
            message: `No mock endpoint configured for ${method} ${path}`,
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

    return c.json(endpoint.response.body, endpoint.response.status as any);
});

// Start server
const port = parseInt(env.PORT || '3000', 10);

console.log(`🚀 Mock API Server starting on http://localhost:${port}`);
console.log(`📝 Admin UI: http://localhost:${port}/`);
console.log(`🔐 Default credentials: ${env.ADMIN_USERNAME} / ${env.ADMIN_PASSWORD === 'admin123' ? 'admin123 (change in production!)' : '****'}`);

serve({
    fetch: app.fetch,
    port,
});
