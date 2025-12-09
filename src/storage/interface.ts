/**
 * Storage Interface - Abstract storage operations
 */

import type { Project, Endpoint, GlobalSettings, StorageData } from '../types.js';

export interface IStorage {
    // Projects
    getProjects(): Promise<Project[]>;
    getProject(id: string): Promise<Project | null>;
    createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
    updateProject(id: string, data: Partial<Project>): Promise<Project | null>;
    deleteProject(id: string): Promise<boolean>;

    // Endpoints
    getEndpoints(projectId?: string): Promise<Endpoint[]>;
    getEndpoint(id: string): Promise<Endpoint | null>;
    getEndpointByPath(basePath: string, path: string, method: string): Promise<Endpoint | null>;
    createEndpoint(endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<Endpoint>;
    updateEndpoint(id: string, data: Partial<Endpoint>): Promise<Endpoint | null>;
    deleteEndpoint(id: string): Promise<boolean>;
    deleteEndpointsByProject(projectId: string): Promise<number>;

    // Settings
    getSettings(): Promise<GlobalSettings>;
    updateSettings(settings: Partial<GlobalSettings>): Promise<GlobalSettings>;

    // Initialize
    initialize(): Promise<void>;
}

// Generate unique ID
export function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
