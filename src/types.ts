/**
 * Mock API Server - Type Definitions
 */

// 项目
export interface Project {
    id: string;
    name: string;
    description?: string;
    basePath: string;
    createdAt: number;
    updatedAt: number;
}

// HTTP 方法
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

// 接口响应配置
export interface EndpointResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    delay?: number;
}

// 接口配置
export interface Endpoint {
    id: string;
    projectId: string;
    path: string;
    method: HttpMethod;
    response: EndpointResponse;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

// 全局设置
export interface GlobalSettings {
    corsOrigins: string[];
    corsHeaders: string[];
    corsMethods: string[];
    defaultHeaders: Record<string, string>;
    authEnabled: boolean;
}

// 存储数据结构
export interface StorageData {
    projects: Project[];
    endpoints: Endpoint[];
    settings: GlobalSettings;
}

// 默认设置
export const DEFAULT_SETTINGS: GlobalSettings = {
    corsOrigins: ['*'],
    corsHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    corsMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
    authEnabled: true,
};

// 环境变量类型
export interface Env {
    MOCK_KV?: KVNamespace;
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    JWT_SECRET: string;
    DATA_PATH?: string;
    PORT?: string;
}

// JWT Payload
export interface JWTPayload {
    sub: string;
    exp: number;
    iat: number;
}

// API 响应
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

// 分页参数
export interface PaginationParams {
    page?: number;
    limit?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
