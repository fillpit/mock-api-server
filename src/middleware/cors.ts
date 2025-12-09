/**
 * CORS Middleware
 */

import { Context, Next, MiddlewareHandler } from 'hono';
import type { GlobalSettings } from '../types.js';

export interface CORSOptions {
    origins?: string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
}

// Dynamic CORS middleware
export function corsMiddleware(getSettings: () => Promise<GlobalSettings>): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const settings = await getSettings();
        const origin = c.req.header('Origin') || '*';

        // Check if origin is allowed
        const isAllowed = settings.corsOrigins.includes('*') ||
            settings.corsOrigins.includes(origin);

        if (!isAllowed) {
            return c.text('Origin not allowed', 403);
        }

        // Set CORS headers
        const allowedOrigin = settings.corsOrigins.includes('*') ? '*' : origin;
        c.header('Access-Control-Allow-Origin', allowedOrigin);
        c.header('Access-Control-Allow-Methods', settings.corsMethods.join(', '));
        c.header('Access-Control-Allow-Headers', settings.corsHeaders.join(', '));
        c.header('Access-Control-Max-Age', '86400');

        if (allowedOrigin !== '*') {
            c.header('Access-Control-Allow-Credentials', 'true');
        }

        // Handle preflight
        if (c.req.method === 'OPTIONS') {
            return new Response(null, { status: 204 });
        }

        await next();
    };
}

// Simple static CORS middleware (for admin routes)
export function staticCorsMiddleware(options: CORSOptions = {}): MiddlewareHandler {
    const {
        origins = ['*'],
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers = ['Content-Type', 'Authorization'],
        maxAge = 86400,
    } = options;

    return async (c: Context, next: Next) => {
        const origin = c.req.header('Origin') || '*';
        const allowedOrigin = origins.includes('*') ? '*' :
            origins.includes(origin) ? origin : null;

        if (allowedOrigin) {
            c.header('Access-Control-Allow-Origin', allowedOrigin);
            c.header('Access-Control-Allow-Methods', methods.join(', '));
            c.header('Access-Control-Allow-Headers', headers.join(', '));
            c.header('Access-Control-Max-Age', String(maxAge));

            if (allowedOrigin !== '*') {
                c.header('Access-Control-Allow-Credentials', 'true');
            }
        }

        if (c.req.method === 'OPTIONS') {
            return new Response(null, { status: 204 });
        }

        await next();
    };
}
