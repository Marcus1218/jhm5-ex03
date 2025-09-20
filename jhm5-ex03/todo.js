class ReminderManager {
    constructor() {
        this.reminders = this.loadReminders();
        this.currentFilter = 'all';
        this.currentSort = 'created-desc';
        this.searchQuery = '';
        this.editingId = null;
        this.selectedItems = new Set();
        this.currentTheme = localStorage.getItem('theme') || 'light';

        // 番茄鐘相關屬性
        this.pomodoroTimer = null;
        this.pomodoroTimeLeft = 25 * 60; // 25分鐘
        this.pomodoroMode = 'focus'; // focus, shortBreak, longBreak
        this.pomodoroRound = 1;
        this.pomodoroIsRunning = false;
        this.dailyPomodoros = this.loadDailyPomodoros();

        // 任務模板
        this.taskTemplates = this.loadTaskTemplates();

        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
        this.renderReminders();
        this.updateStats();
        this.requestNotificationPermission();
        this.setupDragAndDrop();
        this.updatePomodoroDisplay();
        this.updatePomodoroStats();
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

        // 番茄鐘事件綁定
        document.getElementById('pomodoroBtn').addEventListener('click', () => {
            this.showPomodoroModal();
        });

        document.getElementById('closePomodoroModal').addEventListener('click', () => {
            this.hidePomodoroModal();
        });

        document.getElementById('startTimer').addEventListener('click', () => {
            this.startPomodoro();
        });

        document.getElementById('pauseTimer').addEventListener('click', () => {
            this.pausePomodoro();
        });

        document.getElementById('resetTimer').addEventListener('click', () => {
            this.resetPomodoro();
        });

        // 任務模板事件綁定
        document.getElementById('templatesBtn').addEventListener('click', () => {
            this.toggleTemplatesPanel();
        });

        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const template = e.currentTarget.dataset.template;
                this.applyTemplate(template);
            });
        });

        // 模態框事件
        const modal = document.getElementById('statsModal');
        const closeBtn = modal.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // 鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        e.preventDefault();
                        this.toggleSelectAll(true);
                        break;
                    case 'd':
                        e.preventDefault();
                        this.toggleTheme();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportData();
                        break;
                    case 's':
                        e.preventDefault();
                        this.showStats();
                        break;
                }
            }
        });
    }

    // 新增提醒（增強版）
    addReminder() {
        const input = document.getElementById('reminderInput');
        const dueDateInput = document.getElementById('dueDateInput');
        const prioritySelect = document.getElementById('prioritySelect');
        const categorySelect = document.getElementById('categorySelect');

        const text = input.value.trim();
        const dueDate = dueDateInput.value;
        const priority = prioritySelect.value;
        const category = categorySelect.value;

        if (!text) {
            this.showNotification('請輸入提醒內容！', 'error');
            return;
        }

        if (text.length > 200) {
            this.showNotification('提醒內容不能超過200個字元！', 'error');
            return;
        }

        const reminder = {
            id: Date.now(),
            text: text,
            completed: false,
            priority: priority,
            category: category,
            dueDate: dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        };

        this.reminders.unshift(reminder);
        this.saveReminders();
        this.renderReminders();
        this.updateStats();
        
        // 清除輸入
        input.value = '';
        dueDateInput.value = '';
        prioritySelect.value = 'medium';
        categorySelect.value = 'personal';

        this.showNotification('提醒已新增！', 'success');

        // 設置通知
        if (dueDate) {
            this.scheduleNotification(reminder);
        }
    }

    // 切換提醒完成狀態
    toggleReminder(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.completed = !reminder.completed;
            reminder.updatedAt = new Date().toISOString();
            this.saveReminders();
            this.renderReminders();
            this.updateStats();
            
            const status = reminder.completed ? '已完成' : '待辦';
            this.showNotification(`提醒狀態已更新為：${status}`, 'info');
        }
    }

    // 刪除提醒
    deleteReminder(id) {
        if (confirm('確定要刪除這個提醒嗎？')) {
            this.reminders = this.reminders.filter(r => r.id !== id);
            this.saveReminders();
            this.renderReminders();
            this.updateStats();
            this.showNotification('提醒已刪除！', 'success');
        }
    }

    // 開始編輯提醒
    startEdit(id) {
        if (this.editingId) {
            this.cancelEdit();
        }
        
        this.editingId = id;
        const item = document.querySelector(`[data-id="${id}"]`);
        const textElement = item.querySelector('.reminder-text');
        const editInput = item.querySelector('.edit-input');
        const actions = item.querySelector('.reminder-actions');
        
        // 設置輸入框的值
        editInput.value = textElement.textContent;
        
        // 切換顯示狀態
        item.classList.add('editing');
        editInput.focus();
        
        // 更新操作按鈕
        actions.innerHTML = `
            <button class="action-btn save-btn" onclick="reminderManager.saveEdit(${id})">
                <i class="fas fa-save"></i> 儲存
            </button>
            <button class="action-btn cancel-btn" onclick="reminderManager.cancelEdit()">
                <i class="fas fa-times"></i> 取消
            </button>
        `;
    }

    // 儲存編輯
    saveEdit(id) {
        const item = document.querySelector(`[data-id="${id}"]`);
        const editInput = item.querySelector('.edit-input');
        const newText = editInput.value.trim();
        
        if (!newText) {
            this.showNotification('提醒內容不能為空！', 'error');
            return;
        }
        
        if (newText.length > 100) {
            this.showNotification('提醒內容不能超過100個字元！', 'error');
            return;
        }
        
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.text = newText;
            reminder.updatedAt = new Date().toISOString();
            this.saveReminders();
            this.editingId = null;
            this.renderReminders();
            this.showNotification('提醒已更新！', 'success');
        }
    }

    // 取消編輯
    cancelEdit() {
        this.editingId = null;
        this.renderReminders();
    }

    // 設置篩選
    setFilter(filter) {
        this.currentFilter = filter;
        
        // 更新按鈕狀態
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderReminders();
    }

    // 獲取篩選和搜索後的提醒
    getFilteredReminders() {
        let filtered = [...this.reminders];

        // 搜索篩選
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.text.toLowerCase().includes(query) ||
                r.category.toLowerCase().includes(query) ||
                r.priority.toLowerCase().includes(query)
            );
        }

        // 狀態篩選
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        switch (this.currentFilter) {
            case 'completed':
                filtered = filtered.filter(r => r.completed);
                break;
            case 'pending':
                filtered = filtered.filter(r => !r.completed);
                break;
            case 'overdue':
                filtered = filtered.filter(r =>
                    !r.completed && r.dueDate && new Date(r.dueDate) < now
                );
                break;
            case 'today':
                filtered = filtered.filter(r => {
                    if (!r.dueDate) return false;
                    const dueDate = new Date(r.dueDate);
                    return dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
                });
                break;
            case 'week':
                filtered = filtered.filter(r => {
                    if (!r.dueDate) return false;
                    const dueDate = new Date(r.dueDate);
                    return dueDate >= today && dueDate < weekEnd;
                });
                break;
            case 'high':
                filtered = filtered.filter(r => r.priority === 'high');
                break;
            case 'work':
            case 'personal':
            case 'study':
            case 'health':
            case 'other':
                filtered = filtered.filter(r => r.category === this.currentFilter);
                break;
        }
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'created-desc':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'created-asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'due-asc':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'due-desc':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(b.dueDate) - new Date(a.dueDate);
                case 'priority-desc':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                case 'priority-asc':
                    const priorityOrderAsc = { high: 3, medium: 2, low: 1 };
                    return priorityOrderAsc[a.priority] - priorityOrderAsc[b.priority];
                case 'alphabetical':
                    return a.text.localeCompare(b.text);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // ===== 番茄鐘功能 =====
    showPomodoroModal() {
        document.getElementById('pomodoroModal').style.display = 'block';
        this.updatePomodoroDisplay();
        this.updatePomodoroStats();
    }

    hidePomodoroModal() {
        document.getElementById('pomodoroModal').style.display = 'none';
    }

    startPomodoro() {
        if (this.pomodoroIsRunning) return;

        this.pomodoroIsRunning = true;
        document.getElementById('startTimer').disabled = true;
        document.getElementById('pauseTimer').disabled = false;

        this.pomodoroTimer = setInterval(() => {
            this.pomodoroTimeLeft--;
            this.updatePomodoroDisplay();

            if (this.pomodoroTimeLeft <= 0) {
                this.completePomodoro();
            }
        }, 1000);

        this.showNotification('番茄鐘已開始！', 'success');
    }

    pausePomodoro() {
        if (!this.pomodoroIsRunning) return;

        this.pomodoroIsRunning = false;
        clearInterval(this.pomodoroTimer);

        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;

        this.showNotification('番茄鐘已暫停', 'info');
    }

    resetPomodoro() {
        this.pausePomodoro();

        const focusTime = parseInt(document.getElementById('focusTime').value) || 25;
        this.pomodoroTimeLeft = focusTime * 60;
        this.pomodoroMode = 'focus';
        this.pomodoroRound = 1;

        this.updatePomodoroDisplay();
        this.showNotification('番茄鐘已重置', 'info');
    }

    completePomodoro() {
        this.pausePomodoro();

        if (this.pomodoroMode === 'focus') {
            // 完成一個專注時段
            this.dailyPomodoros++;
            this.saveDailyPomodoros();
            this.updatePomodoroStats();

            // 決定下一個時段
            if (this.pomodoroRound % 4 === 0) {
                // 長休息
                this.pomodoroMode = 'longBreak';
                const longBreak = parseInt(document.getElementById('longBreak').value) || 15;
                this.pomodoroTimeLeft = longBreak * 60;
                this.showNotification('專注時段完成！開始長休息 🎉', 'success');
            } else {
                // 短休息
                this.pomodoroMode = 'shortBreak';
                const shortBreak = parseInt(document.getElementById('shortBreak').value) || 5;
                this.pomodoroTimeLeft = shortBreak * 60;
                this.showNotification('專注時段完成！開始短休息 ☕', 'success');
            }
        } else {
            // 完成休息時段
            this.pomodoroMode = 'focus';
            const focusTime = parseInt(document.getElementById('focusTime').value) || 25;
            this.pomodoroTimeLeft = focusTime * 60;
            this.pomodoroRound++;
            this.showNotification('休息完畢！開始新的專注時段 💪', 'success');
        }

        this.updatePomodoroDisplay();
        this.playNotificationSound();
    }

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.pomodoroTimeLeft / 60);
        const seconds = this.pomodoroTimeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('timerDisplay').textContent = timeString;

        const modeText = {
            focus: '專注時間',
            shortBreak: '短休息',
            longBreak: '長休息'
        };

        document.getElementById('timerMode').textContent = modeText[this.pomodoroMode];
        document.getElementById('currentRound').textContent = this.pomodoroRound;
    }

    updatePomodoroStats() {
        document.getElementById('dailyPomodoros').textContent = this.dailyPomodoros;
    }

    loadDailyPomodoros() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem(`pomodoros_${today}`);
        return saved ? parseInt(saved) : 0;
    }

    saveDailyPomodoros() {
        const today = new Date().toDateString();
        localStorage.setItem(`pomodoros_${today}`, this.dailyPomodoros.toString());
    }

    // ===== 任務模板功能 =====
    toggleTemplatesPanel() {
        const panel = document.getElementById('templatesPanel');
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
    }

    applyTemplate(templateType) {
        const templates = {
            morning: [
                { text: '查看今日天氣', priority: 'low', category: 'personal' },
                { text: '檢查電子郵件', priority: 'medium', category: 'work' },
                { text: '規劃今日工作重點', priority: 'high', category: 'work' },
                { text: '喝一杯水', priority: 'low', category: 'health' }
            ],
            meeting: [
                { text: '準備會議議程', priority: 'high', category: 'work' },
                { text: '檢查會議連結和設備', priority: 'medium', category: 'work' },
                { text: '準備相關文件', priority: 'high', category: 'work' },
                { text: '設定會議提醒', priority: 'medium', category: 'work' }
            ],
            exercise: [
                { text: '準備運動服裝', priority: 'low', category: 'health' },
                { text: '30分鐘有氧運動', priority: 'high', category: 'health' },
                { text: '肌力訓練', priority: 'medium', category: 'health' },
                { text: '運動後補充水分', priority: 'low', category: 'health' }
            ],
            study: [
                { text: '複習上次學習內容', priority: 'medium', category: 'study' },
                { text: '學習新章節', priority: 'high', category: 'study' },
                { text: '做練習題', priority: 'medium', category: 'study' },
                { text: '整理學習筆記', priority: 'low', category: 'study' }
            ],
            shopping: [
                { text: '檢查冰箱庫存', priority: 'low', category: 'personal' },
                { text: '列出購物清單', priority: 'medium', category: 'personal' },
                { text: '比較商品價格', priority: 'low', category: 'personal' },
                { text: '安排購物時間', priority: 'medium', category: 'personal' }
            ]
        };

        if (templateType === 'custom') {
            this.showCustomTemplateDialog();
            return;
        }

        const templateTasks = templates[templateType];
        if (!templateTasks) return;

        // 批量添加任務
        templateTasks.forEach((task, index) => {
            setTimeout(() => {
                const reminder = {
                    id: Date.now() + index,
                    text: task.text,
                    completed: false,
                    priority: task.priority,
                    category: task.category,
                    dueDate: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    completedAt: null
                };

                this.reminders.unshift(reminder);
            }, index * 10); // 避免ID重複
        });

        this.saveReminders();
        this.renderReminders();
        this.updateStats();
        this.toggleTemplatesPanel();

        this.showNotification(`已添加 ${templateTasks.length} 個任務！`, 'success');
    }

    showCustomTemplateDialog() {
        const templateName = prompt('請輸入自定義模板名稱：');
        if (!templateName) return;

        const tasks = [];
        let taskText;

        do {
            taskText = prompt(`為模板 "${templateName}" 添加任務（點擊取消結束）：`);
            if (taskText && taskText.trim()) {
                tasks.push({
                    text: taskText.trim(),
                    priority: 'medium',
                    category: 'personal'
                });
            }
        } while (taskText !== null && tasks.length < 10);

        if (tasks.length > 0) {
            // 保存自定義模板
            this.taskTemplates[templateName] = tasks;
            this.saveTaskTemplates();

            // 應用模板
            tasks.forEach((task, index) => {
                setTimeout(() => {
                    const reminder = {
                        id: Date.now() + index,
                        text: task.text,
                        completed: false,
                        priority: task.priority,
                        category: task.category,
                        dueDate: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        completedAt: null
                    };

                    this.reminders.unshift(reminder);
                }, index * 10);
            });

            this.saveReminders();
            this.renderReminders();
            this.updateStats();
            this.toggleTemplatesPanel();

            this.showNotification(`自定義模板 "${templateName}" 已創建並應用！`, 'success');
        }
    }

    loadTaskTemplates() {
        const saved = localStorage.getItem('taskTemplates');
        return saved ? JSON.parse(saved) : {};
    }

    saveTaskTemplates() {
        localStorage.setItem('taskTemplates', JSON.stringify(this.taskTemplates));
    }

    // ===== 工具函數 =====
    playNotificationSound() {
        // 創建簡單的提示音
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    // 渲染提醒列表（更新版）
    renderReminders() {
        const container = document.getElementById('remindersList');
        const filteredReminders = this.getFilteredReminders();
        
        if (filteredReminders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <h3>${this.getEmptyStateMessage()}</h3>
                    <p>開始新增您的第一個提醒吧！</p>
                </div>
            `;
            this.updateBulkActions();
            return;
        }
        
        container.innerHTML = filteredReminders.map(reminder => `
            <div class="reminder-item ${reminder.completed ? 'completed' : ''}" 
                 data-id="${reminder.id}" 
                 data-priority="${reminder.priority}"
                 draggable="true">
                <input type="checkbox" class="item-select-checkbox" 
                       ${this.selectedItems.has(reminder.id) ? 'checked' : ''}
                       onchange="reminderManager.toggleItemSelection(${reminder.id}, this.checked)">
                       
                <input type="checkbox" class="reminder-checkbox" 
                       ${reminder.completed ? 'checked' : ''} 
                       onchange="reminderManager.toggleReminder(${reminder.id})">
                
                <div class="reminder-content">
                    <div class="reminder-text">${this.escapeHtml(reminder.text)}</div>
                    <div class="reminder-meta">
                        ${this.renderDueDate(reminder)}
                        ${this.renderPriorityBadge(reminder.priority)}
                        ${this.renderCategoryBadge(reminder.category)}
                    </div>
                </div>
                
                <input type="text" class="edit-input" value="${this.escapeHtml(reminder.text)}">
                
                <div class="reminder-actions">
                    <button class="action-btn pomodoro-btn" onclick="reminderManager.startTaskPomodoro(${reminder.id})" title="開始番茄鐘">
                        <i class="fas fa-clock"></i>
                    </button>
                    <button class="action-btn edit-btn" onclick="reminderManager.startEdit(${reminder.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="reminderManager.deleteReminder(${reminder.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.updateBulkActions();
    }

    startTaskPomodoro(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (!reminder) return;

        this.showPomodoroModal();
        this.resetPomodoro();
        this.showNotification(`為任務 "${reminder.text}" 開始番茄鐘`, 'info');
    }

    // 獲取空狀態訊息
    getEmptyStateMessage() {
        switch (this.currentFilter) {
            case 'completed':
                return '還沒有已完成的提醒';
            case 'pending':
                return '沒有待辦的提醒事項';
            case 'overdue':
                return '沒有過期的提醒';
            case 'today':
                return '今日沒有到期的提醒';
            case 'week':
                return '本週沒有到期的提醒';
            case 'high':
                return '沒有高優先級的提醒';
            case 'work':
                return '沒有工作相關的提醒';
            case 'personal':
                return '沒有個人提醒';
            case 'study':
                return '沒有學習相關的提醒';
            case 'health':
                return '沒有健康相關的提醒';
            default:
                return '還沒有提醒事項';
        }
    }

    // 儲存提醒到本地儲存
    saveReminders() {
        try {
            localStorage.setItem('reminders', JSON.stringify(this.reminders));
        } catch (error) {
            console.error('儲存提醒失敗:', error);
            this.showNotification('儲存失敗！請檢查瀏覽器儲存空間。', 'error');
        }
    }

    // 從本地儲存載入提醒
    loadReminders() {
        try {
            const saved = localStorage.getItem('reminders');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('載入提醒失敗:', error);
            this.showNotification('載入資料失敗！', 'error');
            return [];
        }
    }

    // 更新統計數據
    updateStats() {
        const total = this.reminders.length;
        const completed = this.reminders.filter(r => r.completed).length;
        const pending = total - completed;

        const now = new Date();
        const overdue = this.reminders.filter(r =>
            !r.completed && r.dueDate && new Date(r.dueDate) < now
        ).length;

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const todayCount = this.reminders.filter(r => {
            if (!r.dueDate) return false;
            const dueDate = new Date(r.dueDate);
            return dueDate >= today && dueDate < todayEnd;
        }).length;

        // 安全地更新DOM元素
        this.updateElementText('totalCount', total);
        this.updateElementText('completedCount', completed);
        this.updateElementText('pendingCount', pending);
        this.updateElementText('overdueCount', overdue);
        this.updateElementText('todayCount', todayCount);
    }

    // 安全地更新元素文本內容
    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    // 批量操作功能
    toggleSelectAll(selectAll) {
        this.selectedItems.clear();
        if (selectAll) {
            const filteredReminders = this.getFilteredReminders();
            filteredReminders.forEach(reminder => {
                this.selectedItems.add(reminder.id);
            });
        }
        this.renderReminders();
        this.updateBulkActions();
    }

    toggleItemSelection(id, selected) {
        if (selected) {
            this.selectedItems.add(id);
        } else {
            this.selectedItems.delete(id);
        }
        this.updateBulkActions();
    }

    updateBulkActions() {
        const hasSelected = this.selectedItems.size > 0;
        const bulkCompleteBtn = document.getElementById('bulkCompleteBtn');
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');

        if (bulkCompleteBtn) bulkCompleteBtn.disabled = !hasSelected;
        if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelected;

        if (selectAllCheckbox) {
            const filteredCount = this.getFilteredReminders().length;
            selectAllCheckbox.checked = filteredCount > 0 && this.selectedItems.size === filteredCount;
            selectAllCheckbox.indeterminate = this.selectedItems.size > 0 && this.selectedItems.size < filteredCount;
        }
    }

    bulkComplete() {
        if (this.selectedItems.size === 0) return;

        this.selectedItems.forEach(id => {
            const reminder = this.reminders.find(r => r.id === id);
            if (reminder && !reminder.completed) {
                reminder.completed = true;
                reminder.completedAt = new Date().toISOString();
                reminder.updatedAt = new Date().toISOString();
            }
        });

        this.selectedItems.clear();
        this.saveReminders();
        this.renderReminders();
        this.updateStats();
        this.showNotification('已批量完成選中的提醒！', 'success');
    }

    bulkDelete() {
        if (this.selectedItems.size === 0) return;

        if (confirm(`確定要刪除選中的 ${this.selectedItems.size} 個提醒嗎？`)) {
            this.reminders = this.reminders.filter(r => !this.selectedItems.has(r.id));
            this.selectedItems.clear();
            this.saveReminders();
            this.renderReminders();
            this.updateStats();
            this.showNotification('已批量刪除選中的提醒！', 'success');
        }
    }

    // 主題切換功能
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        localStorage.setItem('theme', this.currentTheme);
        this.showNotification(`已切換到${this.currentTheme === 'light' ? '淺色' : '深色'}主題`, 'info');
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    // 導出/導入功能
    exportData() {
        try {
            const data = {
                reminders: this.reminders,
                taskTemplates: this.taskTemplates,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `reminders_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showNotification('資料已成功導出！', 'success');
        } catch (error) {
            console.error('導出失敗:', error);
            this.showNotification('導出失敗！', 'error');
        }
    }

    importData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.reminders && Array.isArray(data.reminders)) {
                    if (confirm('這將覆蓋現有的提醒資料，確定要繼續嗎？')) {
                        this.reminders = data.reminders;
                        this.taskTemplates = data.taskTemplates || {};
                        this.saveReminders();
                        this.saveTaskTemplates();
                        this.renderReminders();
                        this.updateStats();
                        this.showNotification('資料已成功導入！', 'success');
                    }
                } else {
                    this.showNotification('無效的備份文件格式！', 'error');
                }
            } catch (error) {
                console.error('導入失敗:', error);
                this.showNotification('導入失敗！請檢查文件格式。', 'error');
            }
        };
        reader.readAsText(file);
    }

    // 統計功能
    showStats() {
        const modal = document.getElementById('statsModal');
        if (modal) {
            modal.style.display = 'block';
            this.generateStats();
        }
    }

    generateStats() {
        const total = this.reminders.length;
        const completed = this.reminders.filter(r => r.completed).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // 更新完成率圓圈
        const progressCircle = document.querySelector('.progress-circle');
        const percentage = document.querySelector('.percentage');
        if (progressCircle && percentage) {
            const degrees = (completionRate / 100) * 360;
            progressCircle.style.background = `conic-gradient(var(--primary-color) ${degrees}deg, var(--border-color) ${degrees}deg)`;
            percentage.textContent = `${completionRate}%`;
        }

        // 生成圖表數據
        this.generateCategoryChart();
        this.generatePriorityChart();
        this.generateDailyChart();
    }

    generateCategoryChart() {
        const categories = {};
        this.reminders.forEach(r => {
            categories[r.category] = (categories[r.category] || 0) + 1;
        });

        const chart = document.getElementById('categoryChart');
        if (chart) {
            const maxValue = Math.max(...Object.values(categories), 1);
            chart.innerHTML = Object.entries(categories)
                .map(([category, count]) => `
                    <div class="chart-bar" 
                         style="height: ${(count / maxValue) * 100}%" 
                         data-value="${count}" 
                         title="${category}: ${count}">
                    </div>
                `).join('');
        }
    }

    generatePriorityChart() {
        const priorities = { high: 0, medium: 0, low: 0 };
        this.reminders.forEach(r => {
            priorities[r.priority] = (priorities[r.priority] || 0) + 1;
        });

        const chart = document.getElementById('priorityChart');
        if (chart) {
            const maxValue = Math.max(...Object.values(priorities), 1);
            chart.innerHTML = Object.entries(priorities)
                .map(([priority, count]) => `
                    <div class="chart-bar" 
                         style="height: ${(count / maxValue) * 100}%" 
                         data-value="${count}" 
                         title="${priority}: ${count}">
                    </div>
                `).join('');
        }
    }

    generateDailyChart() {
        const dailyData = {};
        const last7Days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            last7Days.push(dateStr);
            dailyData[dateStr] = 0;
        }

        this.reminders.forEach(r => {
            if (r.completedAt) {
                const completedDate = new Date(r.completedAt).toDateString();
                if (dailyData.hasOwnProperty(completedDate)) {
                    dailyData[completedDate]++;
                }
            }
        });

        const chart = document.getElementById('dailyChart');
        if (chart) {
            const maxValue = Math.max(...Object.values(dailyData), 1);
            chart.innerHTML = last7Days
                .map(date => `
                    <div class="chart-bar" 
                         style="height: ${(dailyData[date] / maxValue) * 100}%" 
                         data-value="${dailyData[date]}" 
                         title="${new Date(date).toLocaleDateString()}: ${dailyData[date]}">
                    </div>
                `).join('');
        }
    }

    // 通知功能
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showNotification('通知權限已開啟！', 'success');
                }
            });
        }
    }

    scheduleNotification(reminder) {
        if (!reminder.dueDate) return;

        const dueTime = new Date(reminder.dueDate).getTime();
        const now = Date.now();
        const timeDiff = dueTime - now;

        if (timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000) { // 24小時內
            setTimeout(() => {
                this.sendNotification(reminder);
            }, timeDiff);
        }
    }

    sendNotification(reminder) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('提醒事項到期', {
                body: reminder.text,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 6.5L20.25 7.25L19 6L19.75 5.25L21 6.5ZM5 6L3.75 5.25L4.5 4.5L5.75 5.75L5 6ZM12 22C13.1 22 14 World Guessr.1 14 20H10C10 World Guessr.1 10.9 22 12 22ZM12 8.5C15.04 8.5 17.5 10.96 17.5 14V16.5L19 18V19H5V18L6.5 16.5V14C6.5 10.96 8.96 8.5 12 8.5Z"/></svg>',
                tag: `reminder-${reminder.id}`
            });
        }
        this.playNotificationSound();
    }

    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--surface-color);
            color: var(--text-color);
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 3秒後自動移除
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 拖拽功能
    setupDragAndDrop() {
        // 將在下一個版本中實現
    }

    // 渲染輔助方法
    renderDueDate(reminder) {
        if (!reminder.dueDate) return '';

        const dueDate = new Date(reminder.dueDate);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        let className = 'due-date';
        let displayText = dueDate.toLocaleDateString();

        if (dueDate < now) {
            className += ' overdue';
            displayText = '已過期';
        } else if (dueDate >= today && dueDate < tomorrow) {
            className += ' today';
            displayText = '今日到期';
        }

        return `<span class="${className}"><i class="fas fa-calendar"></i> ${displayText}</span>`;
    }

    renderPriorityBadge(priority) {
        const priorityText = {
            high: '高優先級',
            medium: '中優先級',
            low: '低優先級'
        };

        return `<span class="priority-badge ${priority}">
            <i class="fas fa-flag"></i> ${priorityText[priority]}
        </span>`;
    }

    renderCategoryBadge(category) {
        const categoryText = {
            personal: '個人',
            work: '工作',
            study: '學習',
            health: '健康',
            other: '其他'
        };

        return `<span class="category-badge ${category}">
            <i class="fas fa-tag"></i> ${categoryText[category]}
        </span>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 添加動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化應用
let reminderManager;

document.addEventListener('DOMContentLoaded', () => {
    try {
        reminderManager = new ReminderManager();
    } catch (error) {
        console.error('應用初始化失敗:', error);

        // 顯示錯誤訊息
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ef4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
        `;
        errorDiv.innerHTML = `
            <h3>應用載入失敗</h3>
            <p>請重新整理頁面或檢查瀏覽器支援</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; border: none; border-radius: 5px; background: white; color: #ef4444; cursor: pointer;">
                重新載入
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
});
