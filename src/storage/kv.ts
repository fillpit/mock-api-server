/**
 * Cloudflare KV Storage Implementation
 */

import type { Project, Endpoint, GlobalSettings, Env } from '../types.js';
import { DEFAULT_SETTINGS } from '../types.js';
import { IStorage, generateId } from './interface.js';

const KEYS = {
    PROJECTS: 'projects',
    ENDPOINTS: 'endpoints',
    SETTINGS: 'settings',
};

export class KVStorage implements IStorage {
    private kv: KVNamespace;

    constructor(kv: KVNamespace) {
        this.kv = kv;
    }

    async initialize(): Promise<void> {
        // Initialize settings if not exists
        const settings = await this.kv.get(KEYS.SETTINGS);
        if (!settings) {
            await this.kv.put(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        }
    }

    // Projects
    async getProjects(): Promise<Project[]> {
        const data = await this.kv.get(KEYS.PROJECTS);
        return data ? JSON.parse(data) : [];
    }

    async getProject(id: string): Promise<Project | null> {
        const projects = await this.getProjects();
        return projects.find((p) => p.id === id) || null;
    }

    async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
        const projects = await this.getProjects();
        const now = Date.now();
        const project: Project = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        projects.push(project);
        await this.kv.put(KEYS.PROJECTS, JSON.stringify(projects));
        return project;
    }

    async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
        const projects = await this.getProjects();
        const index = projects.findIndex((p) => p.id === id);
        if (index === -1) return null;

        projects[index] = {
            ...projects[index],
            ...data,
            id, // Prevent ID change
            updatedAt: Date.now(),
        };
        await this.kv.put(KEYS.PROJECTS, JSON.stringify(projects));
        return projects[index];
    }

    async deleteProject(id: string): Promise<boolean> {
        const projects = await this.getProjects();
        const filtered = projects.filter((p) => p.id !== id);
        if (filtered.length === projects.length) return false;

        await this.kv.put(KEYS.PROJECTS, JSON.stringify(filtered));
        await this.deleteEndpointsByProject(id);
        return true;
    }

    // Endpoints
    async getEndpoints(projectId?: string): Promise<Endpoint[]> {
        const data = await this.kv.get(KEYS.ENDPOINTS);
        const endpoints: Endpoint[] = data ? JSON.parse(data) : [];
        if (projectId) {
            return endpoints.filter((e) => e.projectId === projectId);
        }
        return endpoints;
    }

    async getEndpoint(id: string): Promise<Endpoint | null> {
        const endpoints = await this.getEndpoints();
        return endpoints.find((e) => e.id === id) || null;
    }

    async getEndpointByPath(basePath: string, path: string, method: string): Promise<Endpoint | null> {
        const endpoints = await this.getEndpoints();
        const projects = await this.getProjects();

        // Find matching project by basePath
        const project = projects.find((p) => basePath.startsWith(p.basePath));
        if (!project) return null;

        // Find matching endpoint
        const relativePath = basePath.substring(project.basePath.length) + path;
        return endpoints.find(
            (e) =>
                e.projectId === project.id &&
                e.path === relativePath &&
                e.method === method &&
                e.enabled
        ) || null;
    }

    async createEndpoint(data: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint> {
        const endpoints = await this.getEndpoints();
        const now = Date.now();
        const endpoint: Endpoint = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        endpoints.push(endpoint);
        await this.kv.put(KEYS.ENDPOINTS, JSON.stringify(endpoints));
        return endpoint;
    }

    async updateEndpoint(id: string, data: Partial<Endpoint>): Promise<Endpoint | null> {
        const endpoints = await this.getEndpoints();
        const index = endpoints.findIndex((e) => e.id === id);
        if (index === -1) return null;

        endpoints[index] = {
            ...endpoints[index],
            ...data,
            id,
            updatedAt: Date.now(),
        };
        await this.kv.put(KEYS.ENDPOINTS, JSON.stringify(endpoints));
        return endpoints[index];
    }

    async deleteEndpoint(id: string): Promise<boolean> {
        const endpoints = await this.getEndpoints();
        const filtered = endpoints.filter((e) => e.id !== id);
        if (filtered.length === endpoints.length) return false;

        await this.kv.put(KEYS.ENDPOINTS, JSON.stringify(filtered));
        return true;
    }

    async deleteEndpointsByProject(projectId: string): Promise<number> {
        const endpoints = await this.getEndpoints();
        const filtered = endpoints.filter((e) => e.projectId !== projectId);
        const deleted = endpoints.length - filtered.length;
        await this.kv.put(KEYS.ENDPOINTS, JSON.stringify(filtered));
        return deleted;
    }

    // Settings
    async getSettings(): Promise<GlobalSettings> {
        const data = await this.kv.get(KEYS.SETTINGS);
        return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    }

    async updateSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings> {
        const current = await this.getSettings();
        const updated = { ...current, ...settings };
        await this.kv.put(KEYS.SETTINGS, JSON.stringify(updated));
        return updated;
    }
}

export function createKVStorage(env: Env): KVStorage | null {
    if (env.MOCK_KV) {
        return new KVStorage(env.MOCK_KV);
    }
    return null;
}
