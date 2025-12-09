/**
 * File-based Storage Implementation (for Node.js/Docker)
 */

import type { Project, Endpoint, GlobalSettings, StorageData } from '../types.js';
import { DEFAULT_SETTINGS } from '../types.js';
import { IStorage, generateId } from './interface.js';

export class MemoryStorage implements IStorage {
    private data: StorageData = {
        projects: [],
        endpoints: [],
        settings: { ...DEFAULT_SETTINGS },
    };

    private filePath: string | null = null;
    private fs: typeof import('fs/promises') | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath || null;
    }

    async initialize(): Promise<void> {
        // In Node.js environment, try to load fs module and read from file
        if (typeof process !== 'undefined' && this.filePath) {
            try {
                this.fs = await import('fs/promises');
                const { dirname } = await import('path');

                // Ensure directory exists
                try {
                    await this.fs.mkdir(dirname(this.filePath), { recursive: true });
                } catch {
                    // Directory might already exist
                }

                // Try to load existing data
                try {
                    const content = await this.fs.readFile(this.filePath, 'utf-8');
                    const parsed = JSON.parse(content);
                    this.data = {
                        projects: parsed.projects || [],
                        endpoints: parsed.endpoints || [],
                        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
                    };
                } catch {
                    // File doesn't exist, use default data
                    await this.save();
                }
            } catch {
                // fs module not available (might be in browser/worker env)
                this.filePath = null;
            }
        }
    }

    private async save(): Promise<void> {
        if (this.fs && this.filePath) {
            await this.fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
        }
    }

    // Projects
    async getProjects(): Promise<Project[]> {
        return [...this.data.projects];
    }

    async getProject(id: string): Promise<Project | null> {
        return this.data.projects.find((p) => p.id === id) || null;
    }

    async createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
        const now = Date.now();
        const project: Project = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        this.data.projects.push(project);
        await this.save();
        return project;
    }

    async updateProject(id: string, data: Partial<Project>): Promise<Project | null> {
        const index = this.data.projects.findIndex((p) => p.id === id);
        if (index === -1) return null;

        this.data.projects[index] = {
            ...this.data.projects[index],
            ...data,
            id,
            updatedAt: Date.now(),
        };
        await this.save();
        return this.data.projects[index];
    }

    async deleteProject(id: string): Promise<boolean> {
        const index = this.data.projects.findIndex((p) => p.id === id);
        if (index === -1) return false;

        this.data.projects.splice(index, 1);
        await this.deleteEndpointsByProject(id);
        await this.save();
        return true;
    }

    // Endpoints
    async getEndpoints(projectId?: string): Promise<Endpoint[]> {
        if (projectId) {
            return this.data.endpoints.filter((e) => e.projectId === projectId);
        }
        return [...this.data.endpoints];
    }

    async getEndpoint(id: string): Promise<Endpoint | null> {
        return this.data.endpoints.find((e) => e.id === id) || null;
    }

    async getEndpointByPath(fullPath: string, _subPath: string, method: string): Promise<Endpoint | null> {
        // Find matching project by basePath
        const project = this.data.projects.find((p) => fullPath.startsWith(p.basePath));
        if (!project) return null;

        // Calculate relative path
        const relativePath = fullPath.substring(project.basePath.length) || '/';

        // Find matching endpoint
        return this.data.endpoints.find(
            (e) =>
                e.projectId === project.id &&
                e.path === relativePath &&
                e.method === method &&
                e.enabled
        ) || null;
    }

    async createEndpoint(data: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint> {
        const now = Date.now();
        const endpoint: Endpoint = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        this.data.endpoints.push(endpoint);
        await this.save();
        return endpoint;
    }

    async updateEndpoint(id: string, data: Partial<Endpoint>): Promise<Endpoint | null> {
        const index = this.data.endpoints.findIndex((e) => e.id === id);
        if (index === -1) return null;

        this.data.endpoints[index] = {
            ...this.data.endpoints[index],
            ...data,
            id,
            updatedAt: Date.now(),
        };
        await this.save();
        return this.data.endpoints[index];
    }

    async deleteEndpoint(id: string): Promise<boolean> {
        const index = this.data.endpoints.findIndex((e) => e.id === id);
        if (index === -1) return false;

        this.data.endpoints.splice(index, 1);
        await this.save();
        return true;
    }

    async deleteEndpointsByProject(projectId: string): Promise<number> {
        const before = this.data.endpoints.length;
        this.data.endpoints = this.data.endpoints.filter((e) => e.projectId !== projectId);
        const deleted = before - this.data.endpoints.length;
        if (deleted > 0) {
            await this.save();
        }
        return deleted;
    }

    // Settings
    async getSettings(): Promise<GlobalSettings> {
        return { ...this.data.settings };
    }

    async updateSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings> {
        this.data.settings = { ...this.data.settings, ...settings };
        await this.save();
        return this.data.settings;
    }
}
