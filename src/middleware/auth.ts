/**
 * JWT Authentication Middleware
 */

import { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, JWTPayload, ApiResponse } from '../types.js';

// Simple base64 encoding/decoding for JWT
function base64UrlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

// Simple HMAC-SHA256 signing using Web Crypto API
async function sign(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// Create JWT token
export async function createToken(username: string, secret: string, expiresIn: number = 86400): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
        sub: username,
        iat: now,
        exp: now + expiresIn,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signature = await sign(`${headerB64}.${payloadB64}`, secret);

    return `${headerB64}.${payloadB64}.${signature}`;
}

// Verify JWT token
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;

        // Verify signature
        const expectedSignature = await sign(`${headerB64}.${payloadB64}`, secret);
        if (signatureB64 !== expectedSignature) return null;

        // Parse payload
        const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) return null;

        return payload;
    } catch {
        return null;
    }
}

// Auth middleware factory
export function authMiddleware(secret: string): MiddlewareHandler {
    return async (c: Context, next: Next) => {
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Missing or invalid authorization header',
            }, 401);
        }

        const token = authHeader.substring(7);
        const payload = await verifyToken(token, secret);

        if (!payload) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid or expired token',
            }, 401);
        }

        // Store user info in context
        c.set('user', payload);

        await next();
    };
}

// Validate login credentials
export function validateCredentials(
    username: string,
    password: string,
    expectedUsername: string,
    expectedPassword: string
): boolean {
    return username === expectedUsername && password === expectedPassword;
}
