/**
 * Mock API Server - Main Application
 */

// API Client
const api = {
  token: localStorage.getItem('token'),
  baseUrl: '/api/admin',

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  },

  // Auth
  login: (username, password) => api.request('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),

  checkAuth: () => api.request('/auth/status'),

  // Projects
  getProjects: () => api.request('/projects'),
  getProject: (id) => api.request(`/projects/${id}`),
  createProject: (data) => api.request('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateProject: (id, data) => api.request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteProject: (id) => api.request(`/projects/${id}`, {
    method: 'DELETE',
  }),

  // Endpoints
  getEndpoints: (projectId) => api.request(`/endpoints${projectId ? `?projectId=${projectId}` : ''}`),
  getEndpoint: (id) => api.request(`/endpoints/${id}`),
  createEndpoint: (data) => api.request('/endpoints', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateEndpoint: (id, data) => api.request(`/endpoints/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteEndpoint: (id) => api.request(`/endpoints/${id}`, {
    method: 'DELETE',
  }),

  // Settings
  getSettings: () => api.request('/settings'),
  updateSettings: (data) => api.request('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// State
const state = {
  projects: [],
  endpoints: [],
  settings: null,
  currentPage: 'projects',
  currentProjectFilter: '',
};

// DOM Elements
const elements = {
  loginPage: null,
  dashboard: null,
  loginForm: null,
  loginError: null,
  logoutBtn: null,
  navItems: null,
  projectsList: null,
  endpointsList: null,
  projectFilter: null,
  settingsForm: null,
  modalOverlay: null,
  modal: null,
  modalTitle: null,
  modalContent: null,
  modalClose: null,
  toastContainer: null,
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEventListeners();
  checkAuthentication();
});

function initElements() {
  elements.loginPage = document.getElementById('login-page');
  elements.dashboard = document.getElementById('dashboard');
  elements.loginForm = document.getElementById('login-form');
  elements.loginError = document.getElementById('login-error');
  elements.logoutBtn = document.getElementById('logout-btn');
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.projectsList = document.getElementById('projects-list');
  elements.endpointsList = document.getElementById('endpoints-list');
  elements.projectFilter = document.getElementById('project-filter');
  elements.settingsForm = document.getElementById('settings-form');
  elements.modalOverlay = document.getElementById('modal-overlay');
  elements.modal = document.getElementById('modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalContent = document.getElementById('modal-content');
  elements.modalClose = document.getElementById('modal-close');
  elements.toastContainer = document.getElementById('toast-container');
}

function initEventListeners() {
  // Login form
  elements.loginForm.addEventListener('submit', handleLogin);

  // Logout
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  // Project filter
  elements.projectFilter.addEventListener('change', (e) => {
    state.currentProjectFilter = e.target.value;
    renderEndpoints();
  });

  // Add buttons
  document.getElementById('add-project-btn').addEventListener('click', () => showProjectModal());
  document.getElementById('add-endpoint-btn').addEventListener('click', () => showEndpointModal());
  document.getElementById('add-header-btn').addEventListener('click', addDefaultHeader);

  // Settings form
  elements.settingsForm.addEventListener('submit', handleSaveSettings);

  // Modal close
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      closeModal();
    }
  });

  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// Authentication
async function checkAuthentication() {
  if (!api.token) {
    showLoginPage();
    return;
  }

  try {
    await api.checkAuth();
    showDashboard();
  } catch (error) {
    api.clearToken();
    showLoginPage();
  }
}

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const submitBtn = elements.loginForm.querySelector('button[type="submit"]');
  const spinner = submitBtn.querySelector('.loading-spinner');

  submitBtn.disabled = true;
  spinner.classList.remove('hidden');
  elements.loginError.classList.add('hidden');

  try {
    const result = await api.login(username, password);
    api.setToken(result.data.token);
    showDashboard();
    showToast('登录成功', 'success');
  } catch (error) {
    elements.loginError.textContent = error.message || '登录失败';
    elements.loginError.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

function handleLogout() {
  api.clearToken();
  showLoginPage();
  showToast('已退出登录', 'info');
}

function showLoginPage() {
  elements.loginPage.classList.remove('hidden');
  elements.dashboard.classList.add('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  elements.loginError.classList.add('hidden');
}

async function showDashboard() {
  elements.loginPage.classList.add('hidden');
  elements.dashboard.classList.remove('hidden');

  // Load initial data
  await Promise.all([
    loadProjects(),
    loadSettings(),
  ]);

  navigateTo('projects');
}

// Navigation
function navigateTo(page) {
  state.currentPage = page;

  // Update nav
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update content
  document.querySelectorAll('.content-page').forEach(p => {
    p.classList.add('hidden');
  });
  document.getElementById(`${page}-page`).classList.remove('hidden');

  // Load page data
  if (page === 'endpoints') {
    loadEndpoints();
  }
}

// Projects
async function loadProjects() {
  try {
    const result = await api.getProjects();
    state.projects = result.data;
    renderProjects();
    updateProjectFilter();
  } catch (error) {
    showToast('加载项目失败: ' + error.message, 'error');
  }
}

function renderProjects() {
  if (state.projects.length === 0) {
    elements.projectsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
        </svg>
        <h3>暂无项目</h3>
        <p>点击"新建项目"按钮创建您的第一个项目</p>
      </div>
    `;
    return;
  }

  elements.projectsList.innerHTML = state.projects.map(project => `
    <div class="project-card glass-card" data-id="${project.id}">
      <div class="project-header">
        <h3 class="project-name">${escapeHtml(project.name)}</h3>
        <div class="project-actions">
          <button class="btn btn-icon btn-ghost edit-project" title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-icon btn-ghost delete-project" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <p class="project-description">${escapeHtml(project.description || '无描述')}</p>
      <div class="project-meta">
        <span class="project-path">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <code>${escapeHtml(project.basePath)}</code>
        </span>
        <span class="project-date">
          ${formatDate(project.updatedAt)}
        </span>
      </div>
    </div>
  `).join('');

  // Bind events
  elements.projectsList.querySelectorAll('.edit-project').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('.project-card').dataset.id;
      showProjectModal(state.projects.find(p => p.id === id));
    });
  });

  elements.projectsList.querySelectorAll('.delete-project').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('.project-card').dataset.id;
      confirmDeleteProject(id);
    });
  });
}

function showProjectModal(project = null) {
  const isEdit = !!project;
  elements.modalTitle.textContent = isEdit ? '编辑项目' : '新建项目';

  elements.modalContent.innerHTML = `
    <form id="project-form">
      <div class="form-group">
        <label for="project-name">项目名称 *</label>
        <input type="text" id="project-name" required value="${escapeHtml(project?.name || '')}">
      </div>
      <div class="form-group">
        <label for="project-description">项目描述</label>
        <textarea id="project-description" rows="3">${escapeHtml(project?.description || '')}</textarea>
      </div>
      <div class="form-group">
        <label for="project-basePath">基础路径 *</label>
        <input type="text" id="project-basePath" required placeholder="/api/v1" value="${escapeHtml(project?.basePath || '')}">
        <small>所有接口都会挂载在这个路径下</small>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
      </div>
    </form>
  `;

  const form = document.getElementById('project-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('project-name').value,
      description: document.getElementById('project-description').value,
      basePath: document.getElementById('project-basePath').value,
    };

    try {
      if (isEdit) {
        await api.updateProject(project.id, data);
        showToast('项目已更新', 'success');
      } else {
        await api.createProject(data);
        showToast('项目已创建', 'success');
      }
      closeModal();
      await loadProjects();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  openModal();
}

async function confirmDeleteProject(id) {
  const project = state.projects.find(p => p.id === id);

  elements.modalTitle.textContent = '确认删除';
  elements.modalContent.innerHTML = `
    <p>确定要删除项目 "<strong>${escapeHtml(project.name)}</strong>" 吗?</p>
    <p class="text-muted">此操作将同时删除该项目下的所有接口配置,且无法撤销。</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" id="confirm-delete">删除</button>
    </div>
  `;

  document.getElementById('confirm-delete').addEventListener('click', async () => {
    try {
      await api.deleteProject(id);
      closeModal();
      showToast('项目已删除', 'success');
      await loadProjects();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  openModal();
}

function updateProjectFilter() {
  elements.projectFilter.innerHTML = `
    <option value="">全部项目</option>
    ${state.projects.map(p => `
      <option value="${p.id}">${escapeHtml(p.name)}</option>
    `).join('')}
  `;
}

// Endpoints
async function loadEndpoints() {
  try {
    const result = await api.getEndpoints();
    state.endpoints = result.data;
    renderEndpoints();
  } catch (error) {
    showToast('加载接口失败: ' + error.message, 'error');
  }
}

function renderEndpoints() {
  let endpoints = state.endpoints;

  // Filter by project
  if (state.currentProjectFilter) {
    endpoints = endpoints.filter(e => e.projectId === state.currentProjectFilter);
  }

  if (endpoints.length === 0) {
    elements.endpointsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        <h3>暂无接口</h3>
        <p>点击"新建接口"按钮创建您的第一个 Mock 接口</p>
      </div>
    `;
    return;
  }

  elements.endpointsList.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>方法</th>
          <th>路径</th>
          <th>项目</th>
          <th>状态码</th>
          <th>启用</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${endpoints.map(endpoint => {
    const project = state.projects.find(p => p.id === endpoint.projectId);
    return `
            <tr data-id="${endpoint.id}">
              <td><span class="method-badge method-${endpoint.method.toLowerCase()}">${endpoint.method}</span></td>
              <td>
                <div class="path-container">
                  <code>${escapeHtml((project?.basePath || '') + endpoint.path)}</code>
                  <button class="copy-btn" title="复制完整链接" data-full-path="${escapeHtml((project?.basePath || '') + endpoint.path)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </td>
              <td>${escapeHtml(project?.name || 'Unknown')}</td>
              <td><span class="status-badge status-${Math.floor(endpoint.response.status / 100)}xx">${endpoint.response.status}</span></td>
              <td>
                <label class="toggle">
                  <input type="checkbox" ${endpoint.enabled ? 'checked' : ''} class="toggle-enabled">
                  <span class="toggle-slider"></span>
                </label>
              </td>
              <td class="actions">
                <button class="btn btn-icon btn-ghost edit-endpoint" title="编辑">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn btn-icon btn-ghost test-endpoint" title="测试">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </button>
                <button class="btn btn-icon btn-ghost delete-endpoint" title="删除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;

  // Bind events
  // Copy button
  elements.endpointsList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const path = e.currentTarget.dataset.fullPath;
      const fullUrl = window.location.origin + path;
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('已复制完整链接', 'success');
      }).catch(() => {
        showToast('复制失败', 'error');
      });
    });
  });

  elements.endpointsList.querySelectorAll('.toggle-enabled').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      try {
        await api.updateEndpoint(id, { enabled: e.target.checked });
        showToast(`接口已${e.target.checked ? '启用' : '禁用'}`, 'success');
      } catch (error) {
        e.target.checked = !e.target.checked;
        showToast(error.message, 'error');
      }
    });
  });

  elements.endpointsList.querySelectorAll('.edit-endpoint').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      showEndpointModal(state.endpoints.find(ep => ep.id === id));
    });
  });

  elements.endpointsList.querySelectorAll('.test-endpoint').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      testEndpoint(id);
    });
  });

  elements.endpointsList.querySelectorAll('.delete-endpoint').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      confirmDeleteEndpoint(id);
    });
  });
}

function showEndpointModal(endpoint = null) {
  const isEdit = !!endpoint;
  elements.modalTitle.textContent = isEdit ? '编辑接口' : '新建接口';

  elements.modalContent.innerHTML = `
    <form id="endpoint-form">
      <div class="form-row">
        <div class="form-group flex-1">
          <label for="endpoint-projectId">所属项目 *</label>
          <select id="endpoint-projectId" required>
            <option value="">选择项目</option>
            ${state.projects.map(p => `
              <option value="${p.id}" ${endpoint?.projectId === p.id ? 'selected' : ''}>
                ${escapeHtml(p.name)} (${escapeHtml(p.basePath)})
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="width: 120px;">
          <label for="endpoint-method">方法 *</label>
          <select id="endpoint-method" required>
            ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => `
              <option value="${m}" ${endpoint?.method === m ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group flex-1">
          <label for="endpoint-path">路径 *</label>
          <input type="text" id="endpoint-path" required placeholder="/users" value="${escapeHtml(endpoint?.path || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="width: 120px;">
          <label for="endpoint-status">状态码</label>
          <input type="number" id="endpoint-status" value="${endpoint?.response?.status || 200}" min="100" max="599">
        </div>
        <div class="form-group" style="width: 140px;">
          <label for="endpoint-delay">延迟 (ms)</label>
          <input type="number" id="endpoint-delay" value="${endpoint?.response?.delay || 0}" min="0">
        </div>
        <div class="form-group flex-1">
          <label class="checkbox-label">
            <input type="checkbox" id="endpoint-enabled" ${endpoint?.enabled !== false ? 'checked' : ''}>
            <span>启用接口</span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>响应体 (JSON) *</label>
        <div id="response-editor-container"></div>
      </div>
      <div class="form-group">
        <label>响应头</label>
        <div id="endpoint-headers-container">
          ${Object.entries(endpoint?.response?.headers || {}).map(([key, value]) => `
            <div class="header-row">
              <input type="text" class="header-key" placeholder="Header Name" value="${escapeHtml(key)}">
              <input type="text" class="header-value" placeholder="Header Value" value="${escapeHtml(value)}">
              <button type="button" class="btn btn-icon btn-ghost remove-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="add-endpoint-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>添加响应头</span>
        </button>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
      </div>
    </form>
  `;

  // Initialize JSON editor
  const responseBody = endpoint?.response?.body;
  const initialValue = responseBody !== undefined
    ? (typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2))
    : '{\n  \n}';

  const jsonEditor = new JsonEditor('#response-editor-container', {
    placeholder: '{\n  "message": "Hello World"\n}',
  });
  jsonEditor.setValue(initialValue);

  // Add header button
  document.getElementById('add-endpoint-header').addEventListener('click', () => {
    addEndpointHeader();
  });

  // Remove header buttons
  bindRemoveHeaderButtons();

  const form = document.getElementById('endpoint-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!jsonEditor.isValidJson() && jsonEditor.getValue().trim()) {
      showToast('请输入有效的 JSON', 'error');
      return;
    }

    // Collect headers
    const headers = {};
    document.querySelectorAll('#endpoint-headers-container .header-row').forEach(row => {
      const key = row.querySelector('.header-key').value.trim();
      const value = row.querySelector('.header-value').value.trim();
      if (key) {
        headers[key] = value;
      }
    });

    const data = {
      projectId: document.getElementById('endpoint-projectId').value,
      path: document.getElementById('endpoint-path').value,
      method: document.getElementById('endpoint-method').value,
      response: {
        status: parseInt(document.getElementById('endpoint-status').value, 10),
        headers,
        body: jsonEditor.getParsedValue() || {},
        delay: parseInt(document.getElementById('endpoint-delay').value, 10) || 0,
      },
      enabled: document.getElementById('endpoint-enabled').checked,
    };

    try {
      if (isEdit) {
        await api.updateEndpoint(endpoint.id, data);
        showToast('接口已更新', 'success');
      } else {
        await api.createEndpoint(data);
        showToast('接口已创建', 'success');
      }
      closeModal();
      await loadEndpoints();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  openModal();
}

function addEndpointHeader() {
  const container = document.getElementById('endpoint-headers-container');
  const row = document.createElement('div');
  row.className = 'header-row';
  row.innerHTML = `
    <input type="text" class="header-key" placeholder="Header Name">
    <input type="text" class="header-value" placeholder="Header Value">
    <button type="button" class="btn btn-icon btn-ghost remove-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  container.appendChild(row);
  bindRemoveHeaderButtons();
}

function bindRemoveHeaderButtons() {
  document.querySelectorAll('.remove-header').forEach(btn => {
    btn.onclick = (e) => {
      e.target.closest('.header-row').remove();
    };
  });
}

async function confirmDeleteEndpoint(id) {
  const endpoint = state.endpoints.find(e => e.id === id);
  const project = state.projects.find(p => p.id === endpoint.projectId);

  elements.modalTitle.textContent = '确认删除';
  elements.modalContent.innerHTML = `
    <p>确定要删除接口 "<strong>${endpoint.method} ${escapeHtml((project?.basePath || '') + endpoint.path)}</strong>" 吗?</p>
    <p class="text-muted">此操作无法撤销。</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" id="confirm-delete">删除</button>
    </div>
  `;

  document.getElementById('confirm-delete').addEventListener('click', async () => {
    try {
      await api.deleteEndpoint(id);
      closeModal();
      showToast('接口已删除', 'success');
      await loadEndpoints();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  openModal();
}

async function testEndpoint(id) {
  const endpoint = state.endpoints.find(e => e.id === id);
  const project = state.projects.find(p => p.id === endpoint.projectId);
  const url = (project?.basePath || '') + endpoint.path;

  elements.modalTitle.textContent = '测试接口';
  elements.modalContent.innerHTML = `
    <div class="test-endpoint">
      <div class="test-request">
        <span class="method-badge method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
        <code>${escapeHtml(url)}</code>
        <button class="btn btn-primary btn-sm" id="run-test">发送请求</button>
      </div>
      <div class="test-response">
        <h4>响应</h4>
        <div id="test-result" class="test-result">
          <p class="text-muted">点击"发送请求"测试接口</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('run-test').addEventListener('click', async () => {
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = '<p class="text-muted">请求中...</p>';

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const elapsed = Date.now() - startTime;
      const data = await response.json();

      resultDiv.innerHTML = `
        <div class="response-meta">
          <span class="status-badge status-${Math.floor(response.status / 100)}xx">${response.status}</span>
          <span class="response-time">${elapsed}ms</span>
        </div>
        <pre class="response-body">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      `;
    } catch (error) {
      resultDiv.innerHTML = `
        <div class="error-message">
          <p>请求失败: ${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  });

  openModal();
}

// Settings
async function loadSettings() {
  try {
    const result = await api.getSettings();
    state.settings = result.data;
    renderSettings();
  } catch (error) {
    showToast('加载设置失败: ' + error.message, 'error');
  }
}

function renderSettings() {
  if (!state.settings) return;

  document.getElementById('cors-origins').value = state.settings.corsOrigins.join('\n');
  document.getElementById('cors-headers').value = state.settings.corsHeaders.join('\n');
  document.getElementById('cors-methods').value = state.settings.corsMethods.join('\n');

  const container = document.getElementById('default-headers-container');
  container.innerHTML = Object.entries(state.settings.defaultHeaders).map(([key, value]) => `
    <div class="header-row">
      <input type="text" class="header-key" placeholder="Header Name" value="${escapeHtml(key)}">
      <input type="text" class="header-value" placeholder="Header Value" value="${escapeHtml(value)}">
      <button type="button" class="btn btn-icon btn-ghost remove-header" onclick="this.closest('.header-row').remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function addDefaultHeader() {
  const container = document.getElementById('default-headers-container');
  const row = document.createElement('div');
  row.className = 'header-row';
  row.innerHTML = `
    <input type="text" class="header-key" placeholder="Header Name">
    <input type="text" class="header-value" placeholder="Header Value">
    <button type="button" class="btn btn-icon btn-ghost remove-header" onclick="this.closest('.header-row').remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  container.appendChild(row);
}

async function handleSaveSettings(e) {
  e.preventDefault();

  const corsOrigins = document.getElementById('cors-origins').value.split('\n').map(s => s.trim()).filter(Boolean);
  const corsHeaders = document.getElementById('cors-headers').value.split('\n').map(s => s.trim()).filter(Boolean);
  const corsMethods = document.getElementById('cors-methods').value.split('\n').map(s => s.trim()).filter(Boolean);

  const defaultHeaders = {};
  document.querySelectorAll('#default-headers-container .header-row').forEach(row => {
    const key = row.querySelector('.header-key').value.trim();
    const value = row.querySelector('.header-value').value.trim();
    if (key) {
      defaultHeaders[key] = value;
    }
  });

  try {
    await api.updateSettings({
      corsOrigins,
      corsHeaders,
      corsMethods,
      defaultHeaders,
    });
    showToast('设置已保存', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Modal
function openModal() {
  elements.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => {
    const firstInput = elements.modal.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  elements.modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// Make closeModal globally available
window.closeModal = closeModal;

// Toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
      ${type === 'error' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>' : ''}
      ${type === 'info' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' : ''}
    </div>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Make showToast globally available for JSON editor
window.showToast = showToast;

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
