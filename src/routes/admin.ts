/**
 * Admin API Routes
 */

import { Hono } from 'hono';
import type { Env, ApiResponse, Project, Endpoint, GlobalSettings, HttpMethod } from '../types.js';
import { IStorage } from '../storage/index.js';
import { authMiddleware, createToken, validateCredentials } from '../middleware/index.js';

type Variables = {
    storage: IStorage;
    user: { sub: string };
};

export function createAdminRoutes(getStorage: () => IStorage, env: Env) {
    const admin = new Hono<{ Variables: Variables }>();

    // Inject storage into context
    admin.use('*', async (c, next) => {
        c.set('storage', getStorage());
        await next();
    });

    // ============ Auth Routes ============

    // Login
    admin.post('/login', async (c) => {
        try {
            const body = await c.req.json<{ username: string; password: string }>();
            const { username, password } = body;

            if (!validateCredentials(username, password, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'Invalid credentials',
                }, 401);
            }

            const token = await createToken(username, env.JWT_SECRET);

            return c.json<ApiResponse<{ token: string; expiresIn: number }>>({
                success: true,
                data: {
                    token,
                    expiresIn: 86400,
                },
            });
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    // Check auth status
    admin.get('/auth/status', authMiddleware(env.JWT_SECRET), async (c) => {
        const user = c.get('user');
        return c.json<ApiResponse<{ username: string }>>({
            success: true,
            data: { username: user.sub },
        });
    });

    // ============ Protected Routes ============
    admin.use('/*', authMiddleware(env.JWT_SECRET));

    // ============ Project Routes ============

    // List projects
    admin.get('/projects', async (c) => {
        const storage = c.get('storage');
        const projects = await storage.getProjects();
        return c.json<ApiResponse<Project[]>>({
            success: true,
            data: projects,
        });
    });

    // Get project
    admin.get('/projects/:id', async (c) => {
        const storage = c.get('storage');
        const project = await storage.getProject(c.req.param('id'));

        if (!project) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Project not found',
            }, 404);
        }

        return c.json<ApiResponse<Project>>({
            success: true,
            data: project,
        });
    });

    // Create project
    admin.post('/projects', async (c) => {
        try {
            const storage = c.get('storage');
            const body = await c.req.json<{ name: string; description?: string; basePath: string }>();

            // Validate basePath
            if (!body.basePath.startsWith('/')) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'basePath must start with /',
                }, 400);
            }

            const project = await storage.createProject({
                name: body.name,
                description: body.description,
                basePath: body.basePath,
            });

            return c.json<ApiResponse<Project>>({
                success: true,
                data: project,
            }, 201);
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    // Update project
    admin.put('/projects/:id', async (c) => {
        try {
            const storage = c.get('storage');
            const body = await c.req.json<Partial<Project>>();

            const project = await storage.updateProject(c.req.param('id'), body);

            if (!project) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'Project not found',
                }, 404);
            }

            return c.json<ApiResponse<Project>>({
                success: true,
                data: project,
            });
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    // Delete project
    admin.delete('/projects/:id', async (c) => {
        const storage = c.get('storage');
        const deleted = await storage.deleteProject(c.req.param('id'));

        if (!deleted) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Project not found',
            }, 404);
        }

        return c.json<ApiResponse>({
            success: true,
        });
    });

    // ============ Endpoint Routes ============

    // List endpoints
    admin.get('/endpoints', async (c) => {
        const storage = c.get('storage');
        const projectId = c.req.query('projectId');
        const endpoints = await storage.getEndpoints(projectId);
        return c.json<ApiResponse<Endpoint[]>>({
            success: true,
            data: endpoints,
        });
    });

    // Get endpoint
    admin.get('/endpoints/:id', async (c) => {
        const storage = c.get('storage');
        const endpoint = await storage.getEndpoint(c.req.param('id'));

        if (!endpoint) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Endpoint not found',
            }, 404);
        }

        return c.json<ApiResponse<Endpoint>>({
            success: true,
            data: endpoint,
        });
    });

    // Create endpoint
    admin.post('/endpoints', async (c) => {
        try {
            const storage = c.get('storage');
            const body = await c.req.json<{
                projectId: string;
                path: string;
                method: HttpMethod;
                response: {
                    status: number;
                    headers?: Record<string, string>;
                    body: unknown;
                    delay?: number;
                };
                enabled?: boolean;
            }>();

            // Validate path
            if (!body.path.startsWith('/')) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'path must start with /',
                }, 400);
            }

            // Verify project exists
            const project = await storage.getProject(body.projectId);
            if (!project) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'Project not found',
                }, 400);
            }

            const endpoint = await storage.createEndpoint({
                projectId: body.projectId,
                path: body.path,
                method: body.method,
                response: {
                    status: body.response.status || 200,
                    headers: body.response.headers || {},
                    body: body.response.body,
                    delay: body.response.delay,
                },
                enabled: body.enabled !== false,
            });

            return c.json<ApiResponse<Endpoint>>({
                success: true,
                data: endpoint,
            }, 201);
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    // Update endpoint
    admin.put('/endpoints/:id', async (c) => {
        try {
            const storage = c.get('storage');
            const body = await c.req.json<Partial<Endpoint>>();

            const endpoint = await storage.updateEndpoint(c.req.param('id'), body);

            if (!endpoint) {
                return c.json<ApiResponse>({
                    success: false,
                    error: 'Endpoint not found',
                }, 404);
            }

            return c.json<ApiResponse<Endpoint>>({
                success: true,
                data: endpoint,
            });
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    // Delete endpoint
    admin.delete('/endpoints/:id', async (c) => {
        const storage = c.get('storage');
        const deleted = await storage.deleteEndpoint(c.req.param('id'));

        if (!deleted) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Endpoint not found',
            }, 404);
        }

        return c.json<ApiResponse>({
            success: true,
        });
    });

    // ============ Settings Routes ============

    // Get settings
    admin.get('/settings', async (c) => {
        const storage = c.get('storage');
        const settings = await storage.getSettings();
        return c.json<ApiResponse<GlobalSettings>>({
            success: true,
            data: settings,
        });
    });

    // Update settings
    admin.put('/settings', async (c) => {
        try {
            const storage = c.get('storage');
            const body = await c.req.json<Partial<GlobalSettings>>();
            const settings = await storage.updateSettings(body);
            return c.json<ApiResponse<GlobalSettings>>({
                success: true,
                data: settings,
            });
        } catch (error) {
            return c.json<ApiResponse>({
                success: false,
                error: 'Invalid request body',
            }, 400);
        }
    });

    return admin;
}
