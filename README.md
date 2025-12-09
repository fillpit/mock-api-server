# Mock API Server

可配置的 Mock API 服务,支持 Web 界面管理接口、身份验证、CORS 配置,可部署到 Cloudflare Workers 和 Docker。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fillpit/mock-api)

## ✨ 功能特点

- 📝 **Web 管理界面** - 可视化配置 Mock 接口
- 📁 **项目管理** - 按项目组织和管理接口
- 🔐 **身份验证** - JWT Token 认证保护管理接口
- 🌐 **CORS 配置** - 可配置跨域访问策略
- ⚡ **JSON 编辑器** - 实时格式校验、一键格式化
- 🚀 **多平台部署** - 支持 Cloudflare Workers 和 Docker

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000,使用默认账号登录:
- 用户名: `admin`
- 密码: `admin123`

### Docker 部署

```bash
# 使用 Docker Compose
docker-compose up -d

# 或手动构建运行
docker build -t mock-api-server .
docker run -p 3000:3000 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=your-password \
  -e JWT_SECRET=your-secret \
  -v mock-api-data:/data \
  mock-api-server
```

### Cloudflare Workers 部署

1. 创建 KV 命名空间:
```bash
wrangler kv:namespace create MOCK_KV
```

2. 更新 `wrangler.toml` 中的 KV namespace ID

3. 设置密钥:
```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET
```

4. 部署:
```bash
npm run deploy
```

## 📖 使用指南

### 创建项目

1. 登录后点击"新建项目"
2. 填写项目名称和基础路径 (如 `/api/v1`)
3. 保存项目

### 配置接口

1. 进入"接口配置"页面
2. 点击"新建接口"
3. 选择所属项目、请求方法、路径
4. 在 JSON 编辑器中配置响应体
5. 可选配置响应头、状态码、延迟
6. 保存接口

### 测试接口

配置完成后,可直接访问:

```bash
curl http://localhost:3000/api/v1/users
```

## 🔧 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `ADMIN_USERNAME` | 管理员用户名 | admin |
| `ADMIN_PASSWORD` | 管理员密码 | admin123 |
| `JWT_SECRET` | JWT 签名密钥 | (必须设置) |
| `DATA_PATH` | 数据存储路径 | ./data |

## 📄 API 文档

### 认证

```
POST /api/admin/login
Content-Type: application/json

{"username": "admin", "password": "your-password"}
```

### 项目管理

```
GET    /api/admin/projects      # 列表
POST   /api/admin/projects      # 创建
GET    /api/admin/projects/:id  # 详情
PUT    /api/admin/projects/:id  # 更新
DELETE /api/admin/projects/:id  # 删除
```

### 接口管理

```
GET    /api/admin/endpoints           # 列表
POST   /api/admin/endpoints           # 创建
GET    /api/admin/endpoints/:id       # 详情
PUT    /api/admin/endpoints/:id       # 更新
DELETE /api/admin/endpoints/:id       # 删除
```

### 设置

```
GET /api/admin/settings  # 获取
PUT /api/admin/settings  # 更新
```

## 📜 License

MIT
