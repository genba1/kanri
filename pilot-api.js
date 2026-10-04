/* 現場進捗管理 MySQL試験版: 画面側のAPI接続部品
 * 既存index.htmlの見た目を変えず、保存先だけを差し替えるために使う。
 */
(function (global) {
  'use strict';

  const TOKEN_KEY = 'kanri_pilot_access_token';

  class KanriPilotApi {
    constructor(baseUrl) {
      this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
      if (!this.baseUrl) throw new Error('APIのURLが設定されていません。');
    }

    get token() { return localStorage.getItem(TOKEN_KEY) || ''; }
    get isLoggedIn() { return this.token !== ''; }

    async request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        const error = new Error(body.error || `通信に失敗しました（${response.status}）`);
        error.status = response.status;
        throw error;
      }
      return body;
    }

    async requestBlob(path) {
      const headers = {};
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await fetch(`${this.baseUrl}${path}`, { headers });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `通信に失敗しました（${response.status}）`);
      }
      return response.blob();
    }

    async login(username, password) {
      const body = await this.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem(TOKEN_KEY, body.token);
      return body.user;
    }

    async logout() {
      try { await this.request('/auth/logout', { method: 'POST' }); }
      finally { localStorage.removeItem(TOKEN_KEY); }
    }

    me() { return this.request('/me'); }
    sites() { return this.request('/sites'); }
    site(id) { return this.request(`/sites/${encodeURIComponent(id)}`); }
    archives(query = '') { return this.request(`/archives${query ? `?q=${encodeURIComponent(query)}` : ''}`); }
    applyLegacyArchiveCodes() { return this.request('/admin/apply-legacy-archive-codes', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); }
    async previewInvoiceZip(file) { const form=new FormData();form.append('invoiceZip',file,file.name);return this.request('/admin/invoice-zip-preview',{method:'POST',body:form}); }
    confirmInvoiceZip(token, choices) { return this.request('/admin/invoice-zip-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,choices})}); }
    reports(siteId = '') { return this.request(`/reports${siteId ? `?site_id=${encodeURIComponent(siteId)}` : ''}`); }
    tasks() { return this.request('/tasks'); }
    createTask(task) { return this.request('/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(task) }); }
    updateTask(id, task) { return this.request(`/tasks/${encodeURIComponent(id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(task) }); }
    createSite(site) { return this.request('/sites', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(site) }); }
    updateSite(id, site) { return this.request(`/sites/${encodeURIComponent(id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(site) }); }
    deleteSite(id, version) { return this.request(`/sites/${encodeURIComponent(id)}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version}) }); }
    archiveSite(id, version, archiveSummary = '', estimateKnowledge = {}) {
      return this.request(`/sites/${encodeURIComponent(id)}/archive`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version, archiveSummary, estimateKnowledge}) });
    }
    updateArchiveLedger(id, ledger) { return this.request(`/sites/${encodeURIComponent(id)}/archive-ledger`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(ledger) }); }
    restoreSite(id, version) { return this.request(`/sites/${encodeURIComponent(id)}/restore`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version}) }); }
    documents(siteId) { return this.request(`/sites/${encodeURIComponent(siteId)}/documents`); }
    documentBlob(documentId) { return this.requestBlob(`/documents/${encodeURIComponent(documentId)}/file`); }
    async uploadDocument(siteId, file, metadata = {}) {
      const form = new FormData(); form.append('document', file, file.name);
      Object.entries(metadata).forEach(([key, value]) => { if (value !== undefined && value !== null) form.append(key, value); });
      return this.request(`/sites/${encodeURIComponent(siteId)}/documents`, { method:'POST', body:form });
    }
    documentItems(documentId) { return this.request(`/documents/${encodeURIComponent(documentId)}/items`); }
    replaceDocumentItems(documentId, items) { return this.request(`/documents/${encodeURIComponent(documentId)}/items`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({items}) }); }
    createCardDraft(siteId, sourceText) { return this.request(`/sites/${encodeURIComponent(siteId)}/ai/draft`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sourceText}) }); }
    routeReport(sourceText) { return this.request('/ai/route-report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sourceText}) }); }
    createDailyReportDraft(sourceText) { return this.request('/ai/daily-report-draft', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sourceText}) }); }
    createTaskDraft(sourceText) { return this.request('/ai/task-draft', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sourceText}) }); }
    card(id) { return this.request(`/sites/${encodeURIComponent(id)}/card`); }
    updateCard(id, card, version, sourceText = '') {
      return this.request(`/sites/${encodeURIComponent(id)}/card`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({card, version, sourceText}) });
    }
    createReport(report) { return this.request('/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(report) }); }
    updateReport(id, report) { return this.request(`/reports/${encodeURIComponent(id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(report) }); }
    deleteReport(id, version) { return this.request(`/reports/${encodeURIComponent(id)}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version}) }); }

    async uploadPhoto(reportId, file, caption = '') {
      const form = new FormData();
      form.append('photo', file, file.name);
      form.append('caption', caption);
      return this.request(`/reports/${encodeURIComponent(reportId)}/photos`, { method:'POST', body:form });
    }
    reportPhotos(reportId) { return this.request(`/reports/${encodeURIComponent(reportId)}/photos`); }
    photoBlob(photoId) { return this.requestBlob(`/photos/${encodeURIComponent(photoId)}/file`); }
  }

  global.KanriPilotApi = KanriPilotApi;
})(window);
