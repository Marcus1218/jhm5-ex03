class KVReminderManager {
    constructor() {
        this.reminders = [];
        this.currentFilter = 'all';
        this.currentSort = 'created-desc';
        this.searchQuery = '';
        this.editingId = null;
        this.selectedItems = new Set();
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.isLoading = false;
        this.syncStatus = 'synced';

        // 番茄鐘相關屬性
        this.pomodoroTimer = null;
        this.pomodoroTimeLeft = 25 * 60; // 25分鐘
        this.pomodoroMode = 'focus'; // focus, shortBreak, longBreak
        this.pomodoroRound = 1;
        this.pomodoroIsRunning = false;
        this.dailyPomodoros = this.loadDailyPomodoros();

        // 任務模板
        this.taskTemplates = this.loadTaskTemplates();

        // API 基礎 URL
        this.apiBase = '/api/todos';

        this.init();
    }

    async init() {
        this.applyTheme();
        this.bindEvents();
        await this.loadRemindersFromKV();
        this.renderReminders();
        this.updateStats();
        this.requestNotificationPermission();
        this.setupDragAndDrop();
        this.updatePomodoroDisplay();
        this.updatePomodoroStats();
    }

    // API 方法
    async apiCall(url, options = {}) {
        this.setLoading(true);
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.text();
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('API 調用錯誤:', error);
            this.setSyncStatus('error');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async loadRemindersFromKV() {
        try {
            this.reminders = await this.apiCall(this.apiBase);
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('載入提醒失敗:', error);
            this.setSyncStatus('error');
            this.reminders = [];
        }
    }

    async saveReminderToKV(reminder) {
        try {
            const savedReminder = await this.apiCall(this.apiBase, {
                method: 'POST',
                body: JSON.stringify(reminder)
            });
            this.setSyncStatus('synced');
            return savedReminder;
        } catch (error) {
            console.error('儲存提醒失敗:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async updateReminderInKV(id, updates) {
        try {
            const updatedReminder = await this.apiCall(`${this.apiBase}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            this.setSyncStatus('synced');
            return updatedReminder;
        } catch (error) {
            console.error('更新提醒失敗:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async deleteReminderFromKV(id) {
        try {
            await this.apiCall(`${this.apiBase}/${id}`, {
                method: 'DELETE'
            });
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('刪除提醒失敗:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async bulkUpdateRemindersInKV(ids, updates) {
        try {
            await this.apiCall(`${this.apiBase}/bulk`, {
                method: 'PUT',
                body: JSON.stringify({ ids, updates })
            });
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('批量更新失敗:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async bulkDeleteRemindersFromKV(ids) {
        try {
            await this.apiCall(`${this.apiBase}/bulk`, {
                method: 'DELETE',
                body: JSON.stringify({ ids })
            });
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('批量刪除失敗:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    // UI 狀態管理
    setLoading(loading) {
        this.isLoading = loading;
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.display = loading ? 'flex' : 'none';
        }
    }

    setSyncStatus(status) {
        this.syncStatus = status;
        const statusElement = document.getElementById('syncStatus');
        if (statusElement) {
            switch (status) {
                case 'synced':
                    statusElement.innerHTML = '<i class="fas fa-check-circle"></i> 已同步';
                    statusElement.className = 'sync-success';
                    break;
                case 'syncing':
                    statusElement.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> 同步中';
                    statusElement.className = 'sync-loading';
                    break;
                case 'error':
                    statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 同步失敗';
                    statusElement.className = 'sync-error';
                    break;
            }
        }
    }

    bindEvents() {
        // 原有的事件綁定
        document.getElementById('addBtn').addEventListener('click', () => {
            this.addReminder();
        });

        document.getElementById('reminderInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addReminder();
            }
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // 新增功能事件綁定
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderReminders();
        });

        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderReminders();
        });

        document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        document.getElementById('bulkCompleteBtn').addEventListener('click', () => {
            this.bulkComplete();
        });

        document.getElementById('bulkDeleteBtn').addEventListener('click', () => {
            this.bulkDelete();
        });

        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importInput').click();
        });

        document.getElementById('importInput').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('statsBtn').addEventListener('click', () => {
            this.showStats();
        });

        // 同步按鈕
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.syncData();
        });

        // 番茄鐘事件綁定
        document.getElementById('pomodoroBtn').addEventListener('click', () => {
            this.showPomodoroModal();
        });

        // 模板事件綁定
        document.getElementById('templatesBtn').addEventListener('click', () => {
            this.toggleTemplatesPanel();
        });

        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const template = e.currentTarget.dataset.template;
                this.applyTemplate(template);
            });
        });

        // 模態框關閉事件
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // 點擊模態框外部關閉
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // 番茄鐘控制事件
        document.getElementById('startTimer').addEventListener('click', () => {
            this.startPomodoro();
        });

        document.getElementById('pauseTimer').addEventListener('click', () => {
            this.pausePomodoro();
        });

        document.getElementById('resetTimer').addEventListener('click', () => {
            this.resetPomodoro();
        });

        // 番茄鐘設定事件
        ['focusTime', 'shortBreak', 'longBreak'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.updatePomodoroSettings();
            });
        });
    }

    async addReminder() {
        const input = document.getElementById('reminderInput');
        const dueDateInput = document.getElementById('dueDateInput');
        const prioritySelect = document.getElementById('prioritySelect');
        const categorySelect = document.getElementById('categorySelect');

        const text = input.value.trim();
        if (!text) {
            input.focus();
            return;
        }

        const reminder = {
            text: text,
            completed: false,
            priority: prioritySelect.value,
            category: categorySelect.value,
            dueDate: dueDateInput.value || null,
            createdAt: new Date().toISOString(),
            tags: this.extractTags(text)
        };

        try {
            const savedReminder = await this.saveReminderToKV(reminder);
            this.reminders.push(savedReminder);

            // 清空輸入
            input.value = '';
            dueDateInput.value = '';
            prioritySelect.value = 'medium';
            categorySelect.value = 'personal';

            this.renderReminders();
            this.updateStats();

            // 顯示成功訊息
            this.showNotification('提醒已成功新增！', 'success');
        } catch (error) {
            this.showNotification('新增提醒失敗，請稍後再試', 'error');
        }
    }

    async toggleReminder(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (!reminder) return;

        const updates = {
            completed: !reminder.completed,
            completedAt: !reminder.completed ? new Date().toISOString() : null
        };

        try {
            const updatedReminder = await this.updateReminderInKV(id, updates);
            Object.assign(reminder, updatedReminder);

            this.renderReminders();
            this.updateStats();

            const message = reminder.completed ? '任務已完成！' : '任務已標記為未完成';
            this.showNotification(message, 'success');
        } catch (error) {
            this.showNotification('更新失敗，請稍後再試', 'error');
        }
    }

    async deleteReminder(id) {
        if (!confirm('確定要刪除這個提醒嗎？')) return;

        try {
            await this.deleteReminderFromKV(id);
            this.reminders = this.reminders.filter(r => r.id !== id);

            this.renderReminders();
            this.updateStats();
            this.showNotification('提醒已刪除', 'success');
        } catch (error) {
            this.showNotification('刪除失敗，請稍後再試', 'error');
        }
    }

    async bulkComplete() {
        if (this.selectedItems.size === 0) return;

        const ids = Array.from(this.selectedItems);
        const updates = {
            completed: true,
            completedAt: new Date().toISOString()
        };

        try {
            await this.bulkUpdateRemindersInKV(ids, updates);

            // 更新本地資料
            this.reminders.forEach(reminder => {
                if (ids.includes(reminder.id)) {
                    Object.assign(reminder, updates);
                }
            });

            this.selectedItems.clear();
            this.updateBulkActionButtons();
            this.renderReminders();
            this.updateStats();

            this.showNotification(`已完成 ${ids.length} 個任務`, 'success');
        } catch (error) {
            this.showNotification('批量操作失敗，請稍後再試', 'error');
        }
    }

    async bulkDelete() {
        if (this.selectedItems.size === 0) return;
        if (!confirm(`確定要刪除選中的 ${this.selectedItems.size} 個提醒嗎？`)) return;

        const ids = Array.from(this.selectedItems);

        try {
            await this.bulkDeleteRemindersFromKV(ids);

            // 更新本地資料
            this.reminders = this.reminders.filter(r => !ids.includes(r.id));

            this.selectedItems.clear();
            this.updateBulkActionButtons();
            this.renderReminders();
            this.updateStats();

            this.showNotification(`已刪除 ${ids.length} 個提醒`, 'success');
        } catch (error) {
            this.showNotification('批量刪除失敗，請稍後再試', 'error');
        }
    }

    async syncData() {
        this.setSyncStatus('syncing');
        try {
            await this.loadRemindersFromKV();
            this.renderReminders();
            this.updateStats();
            this.showNotification('資料同步成功！', 'success');
        } catch (error) {
            this.showNotification('同步失敗，請檢查網路連線', 'error');
        }
    }

    // 以下為原有方法的簡化版本或保持不變的方法

    extractTags(text) {
        const tagRegex = /#(\w+)/g;
        const tags = [];
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.renderReminders();
    }

    getFilteredReminders() {
        let filtered = this.reminders.filter(reminder => {
            // 搜索過濾
            if (this.searchQuery && !reminder.text.toLowerCase().includes(this.searchQuery.toLowerCase())) {
                return false;
            }

            // 狀態過濾
            switch (this.currentFilter) {
                case 'completed':
                    return reminder.completed;
                case 'pending':
                    return !reminder.completed;
                case 'overdue':
                    return !reminder.completed && reminder.dueDate && new Date(reminder.dueDate) < new Date();
                case 'today':
                    if (!reminder.dueDate) return false;
                    const today = new Date().toDateString();
                    return new Date(reminder.dueDate).toDateString() === today;
                case 'week':
                    if (!reminder.dueDate) return false;
                    const weekFromNow = new Date();
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    return new Date(reminder.dueDate) <= weekFromNow;
                case 'high':
                    return reminder.priority === 'high';
                case 'work':
                case 'personal':
                case 'study':
                case 'health':
                case 'other':
                    return reminder.category === this.currentFilter;
                default:
                    return true;
            }
        });

        // 排序
        switch (this.currentSort) {
            case 'created-asc':
                filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'created-desc':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'due-asc':
                filtered.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                });
                break;
            case 'due-desc':
                filtered.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return -1;
                    if (!b.dueDate) return 1;
                    return new Date(b.dueDate) - new Date(a.dueDate);
                });
                break;
            case 'priority-desc':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                filtered.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
                break;
            case 'priority-asc':
                const priorityOrderAsc = { high: 3, medium: 2, low: 1 };
                filtered.sort((a, b) => priorityOrderAsc[a.priority] - priorityOrderAsc[b.priority]);
                break;
            case 'alphabetical':
                filtered.sort((a, b) => a.text.localeCompare(b.text));
                break;
        }

        return filtered;
    }

    renderReminders() {
        const container = document.getElementById('remindersList');
        const filtered = this.getFilteredReminders();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>${this.searchQuery ? '沒有找到匹配的提醒' : '雲端待辦事項'}</h3>
                    <p>${this.searchQuery ? '試試其他關鍵字' : '您的待辦事項將儲存在 Cloudflare KV 中，可在任何裝置存取'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(reminder => this.renderReminderItem(reminder)).join('');
        this.setupReminderEvents();
    }

    renderReminderItem(reminder) {
        const dueDate = reminder.dueDate ? new Date(reminder.dueDate) : null;
        const isOverdue = dueDate && dueDate < new Date() && !reminder.completed;
        const isToday = dueDate && dueDate.toDateString() === new Date().toDateString();

        return `
            <div class="reminder-item ${reminder.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isToday ? 'today' : ''}" data-id="${reminder.id}">
                <div class="reminder-content">
                    <input type="checkbox" class="reminder-checkbox bulk-select" data-id="${reminder.id}" ${this.selectedItems.has(reminder.id) ? 'checked' : ''}>
                    <input type="checkbox" class="reminder-toggle" ${reminder.completed ? 'checked' : ''}>

                    <div class="reminder-text">
                        <span class="text">${this.highlightTags(reminder.text)}</span>
                        <div class="reminder-meta">
                            <span class="priority priority-${reminder.priority}">${this.getPriorityText(reminder.priority)}</span>
                            <span class="category category-${reminder.category}">${this.getCategoryText(reminder.category)}</span>
                            ${dueDate ? `<span class="due-date ${isOverdue ? 'overdue' : ''}">${this.formatDueDate(dueDate)}</span>` : ''}
                            ${reminder.tags && reminder.tags.length > 0 ? `<span class="tags">${reminder.tags.map(tag => `#${tag}`).join(' ')}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="reminder-actions">
                    <button class="action-btn edit-btn" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    setupReminderEvents() {
        // 切換完成狀態
        document.querySelectorAll('.reminder-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.closest('.reminder-item').dataset.id;
                this.toggleReminder(id);
            });
        });

        // 刪除提醒
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.reminder-item').dataset.id;
                this.deleteReminder(id);
            });
        });

        // 批量選擇
        document.querySelectorAll('.bulk-select').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedItems.add(id);
                } else {
                    this.selectedItems.delete(id);
                }
                this.updateBulkActionButtons();
            });
        });
    }

    updateBulkActionButtons() {
        const hasSelected = this.selectedItems.size > 0;
        document.getElementById('bulkCompleteBtn').disabled = !hasSelected;
        document.getElementById('bulkDeleteBtn').disabled = !hasSelected;

        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        selectAllCheckbox.checked = hasSelected && this.selectedItems.size === this.getFilteredReminders().length;
        selectAllCheckbox.indeterminate = hasSelected && this.selectedItems.size < this.getFilteredReminders().length;
    }

    toggleSelectAll(selectAll) {
        const filtered = this.getFilteredReminders();
        if (selectAll) {
            filtered.forEach(reminder => this.selectedItems.add(reminder.id));
        } else {
            this.selectedItems.clear();
        }

        document.querySelectorAll('.bulk-select').forEach(checkbox => {
            checkbox.checked = selectAll;
        });

        this.updateBulkActionButtons();
    }

    updateStats() {
        const total = this.reminders.length;
        const completed = this.reminders.filter(r => r.completed).length;
        const pending = total - completed;
        const overdue = this.reminders.filter(r => !r.completed && r.dueDate && new Date(r.dueDate) < new Date()).length;
        const today = this.reminders.filter(r => {
            if (!r.dueDate) return false;
            return new Date(r.dueDate).toDateString() === new Date().toDateString();
        }).length;

        document.getElementById('totalCount').textContent = total;
        document.getElementById('completedCount').textContent = completed;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('overdueCount').textContent = overdue;
        document.getElementById('todayCount').textContent = today;
    }

    // 工具方法
    highlightTags(text) {
        return text.replace(/#(\w+)/g, '<span class="tag-highlight">#$1</span>');
    }

    getPriorityText(priority) {
        const priorities = { high: '高', medium: '中', low: '低' };
        return priorities[priority] || priority;
    }

    getCategoryText(category) {
        const categories = {
            personal: '個人',
            work: '工作',
            study: '學習',
            health: '健康',
            other: '其他'
        };
        return categories[category] || category;
    }

    formatDueDate(date) {
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === -1) return '昨天';
        if (diffDays > 1 && diffDays <= 7) return `${diffDays}天後`;
        if (diffDays < -1) return `${Math.abs(diffDays)}天前`;

        return date.toLocaleDateString('zh-TW');
    }

    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // 顯示動畫
        setTimeout(() => notification.classList.add('show'), 100);

        // 自動移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // 主題切換
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme();
    }

    applyTheme() {
        document.body.className = this.currentTheme + '-theme';
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // 資料匯出/匯入
    exportData() {
        const data = {
            reminders: this.reminders,
            exportDate: new Date().toISOString(),
            version: '2.0-kv'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reminders-kv-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('資料匯出成功！', 'success');
    }

    async importData(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.reminders || !Array.isArray(data.reminders)) {
                throw new Error('無效的資料格式');
            }

            if (confirm(`確定要匯入 ${data.reminders.length} 個提醒嗎？這將會與雲端資料合併。`)) {
                // 將匯入的資料同步到 KV
                for (const reminder of data.reminders) {
                    try {
                        const savedReminder = await this.saveReminderToKV(reminder);
                        this.reminders.push(savedReminder);
                    } catch (error) {
                        console.error('匯入提醒失敗:', reminder, error);
                    }
                }

                this.renderReminders();
                this.updateStats();
                this.showNotification('資料匯入成功！', 'success');
            }
        } catch (error) {
            console.error('匯入錯誤:', error);
            this.showNotification('匯入失敗，請檢查檔案格式', 'error');
        }
    }

    // 統計和其他功能的簡化實現
    showStats() {
        document.getElementById('statsModal').style.display = 'block';
        // 這裡可以添加統計圖表的實現
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    setupDragAndDrop() {
        // 拖拽功能的簡化實現
    }

    // 番茄鐘功能保持不變（使用 localStorage）
    loadDailyPomodoros() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('dailyPomodoros');
        if (stored) {
            const data = JSON.parse(stored);
            if (data.date === today) {
                return data.count;
            }
        }
        return 0;
    }

    loadTaskTemplates() {
        const stored = localStorage.getItem('taskTemplates');
        return stored ? JSON.parse(stored) : {
            morning: ['檢查郵件', '規劃今日任務', '晨間運動'],
            meeting: ['準備會議資料', '確認參與者', '預約會議室'],
            exercise: ['熱身運動', '主要訓練', '拉伸放鬆'],
            study: ['複習上次內容', '學習新章節', '練習題目'],
            shopping: ['牛奶', '麵包', '蔬菜', '水果']
        };
    }

    toggleTemplatesPanel() {
        const panel = document.getElementById('templatesPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    applyTemplate(templateName) {
        const templates = this.taskTemplates[templateName];
        if (templates) {
            templates.forEach(task => {
                const reminder = {
                    text: task,
                    completed: false,
                    priority: 'medium',
                    category: templateName === 'work' ? 'work' : 'personal',
                    dueDate: null,
                    createdAt: new Date().toISOString(),
                    tags: []
                };
                this.saveReminderToKV(reminder).then(savedReminder => {
                    this.reminders.push(savedReminder);
                    this.renderReminders();
                    this.updateStats();
                });
            });
        }
        this.toggleTemplatesPanel();
    }

    showPomodoroModal() {
        document.getElementById('pomodoroModal').style.display = 'block';
    }

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.pomodoroTimeLeft / 60);
        const seconds = this.pomodoroTimeLeft % 60;
        document.getElementById('timerDisplay').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePomodoroStats() {
        document.getElementById('dailyPomodoros').textContent = this.dailyPomodoros;
        document.getElementById('currentRound').textContent = this.pomodoroRound;
    }

    startPomodoro() {
        this.pomodoroIsRunning = true;
        document.getElementById('startTimer').disabled = true;
        document.getElementById('pauseTimer').disabled = false;

        this.pomodoroTimer = setInterval(() => {
            this.pomodoroTimeLeft--;
            this.updatePomodoroDisplay();

            if (this.pomodoroTimeLeft <= 0) {
                this.pomodoroComplete();
            }
        }, 1000);
    }

    pausePomodoro() {
        this.pomodoroIsRunning = false;
        clearInterval(this.pomodoroTimer);
        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;
    }

    resetPomodoro() {
        this.pausePomodoro();
        this.pomodoroTimeLeft = parseInt(document.getElementById('focusTime').value) * 60;
        this.updatePomodoroDisplay();
    }

    pomodoroComplete() {
        this.pausePomodoro();

        if (this.pomodoroMode === 'focus') {
            this.dailyPomodoros++;
            this.saveDailyPomodoros();
            this.updatePomodoroStats();

            // 播放通知
            if (Notification.permission === 'granted') {
                new Notification('番茄鐘完成！', {
                    body: '是時候休息一下了',
                    icon: '/favicon.ico'
                });
            }
        }

        // 切換模式
        this.switchPomodoroMode();
    }

    switchPomodoroMode() {
        if (this.pomodoroMode === 'focus') {
            this.pomodoroMode = this.pomodoroRound % 4 === 0 ? 'longBreak' : 'shortBreak';
        } else {
            this.pomodoroMode = 'focus';
            if (this.pomodoroMode === 'focus') {
                this.pomodoroRound++;
                if (this.pomodoroRound > 4) this.pomodoroRound = 1;
            }
        }

        this.updatePomodoroSettings();
    }

    updatePomodoroSettings() {
        const focusTime = parseInt(document.getElementById('focusTime').value);
        const shortBreak = parseInt(document.getElementById('shortBreak').value);
        const longBreak = parseInt(document.getElementById('longBreak').value);

        switch (this.pomodoroMode) {
            case 'focus':
                this.pomodoroTimeLeft = focusTime * 60;
                document.getElementById('timerMode').textContent = '專注時間';
                break;
            case 'shortBreak':
                this.pomodoroTimeLeft = shortBreak * 60;
                document.getElementById('timerMode').textContent = '短休息';
                break;
            case 'longBreak':
                this.pomodoroTimeLeft = longBreak * 60;
                document.getElementById('timerMode').textContent = '長休息';
                break;
        }

        this.updatePomodoroDisplay();
        this.updatePomodoroStats();
    }

    saveDailyPomodoros() {
        const today = new Date().toDateString();
        localStorage.setItem('dailyPomodoros', JSON.stringify({
            date: today,
            count: this.dailyPomodoros
        }));
    }
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    window.reminderManager = new KVReminderManager();
});
