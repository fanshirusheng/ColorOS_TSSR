/**
 * AMMF WebUI 状态页面模块
 * 显示模块运行状态和基本信息
 */

const StatusPage = {
    // 模块状态
    moduleStatus: 'UNKNOWN',
    
    // 自动刷新定时器
    refreshTimer: null,

    // 设备信息
    deviceInfo: {},
    
    // 初始化
    async init() {
        try {
            // 加载模块状态和信息
            await this.loadModuleStatus();
            await this.loadDeviceInfo();
            // 启动自动刷新
            this.startAutoRefresh();
            
            return true;
        } catch (error) {
            console.error('初始化状态页面失败:', error);
            return false;
        }
    },
    
    // 渲染页面
    render() {
        // 设置页面标题
        document.getElementById('page-title').textContent = I18n.translate('NAV_STATUS', '状态');
        
        const pageActions = document.getElementById('page-actions');
        pageActions.innerHTML = `
            <button id="refresh-status" class="icon-button" title="${I18n.translate('REFRESH', '刷新')}">
                <span class="material-symbols-rounded">refresh</span>
            </button>
            <button id="run-action" class="icon-button" title="${I18n.translate('RUN_ACTION', '运行Action')}">
                <span class="material-symbols-rounded">play_arrow</span>
            </button>
        `;
        
        // 渲染页面内容
        // 定义快捷按钮配置
        const quickActionsEnabled = false; // 设置为false可全部隐藏
        const quickActions = [
            {
                title: '清理缓存',
                icon: 'delete',
                command: 'rm -rf /data/local/tmp/*'
            },
            {
                title: '重启服务',
                icon: 'restart_alt',
                command: 'sh ${Core.MODULE_PATH}service.sh restart'
            },
            {
                title: '查看日志',
                icon: 'description',
                command: 'cat ${Core.MODULE_PATH}logs.txt'
            }
        ];
        
        return `
            <div class="status-page">
                <!-- 合并的状态卡片 -->
                <div class="card status-card">
                    <div class="status-card-header">
                        <span class="status-title" data-i18n="MODULE_STATUS">模块状态</span>
                    </div>
                    <div class="status-card-content">
                        <div class="status-icon-container">
                            <div class="status-indicator ${this.getStatusClass()}">
                                <span class="material-symbols-rounded">${this.getStatusIcon()}</span>
                            </div>
                        </div>
                        <div class="status-info-container">
                            <div class="status-title-row">
                                <span class="status-value ${this.getStatusClass()}-text" data-i18n="${this.getStatusI18nKey()}">${this.getStatusText()}</span>
                            </div>
                            <div class="status-update-row">
                                <span class="status-update-time">${new Date().toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${quickActionsEnabled ? `
                    <!-- 快捷操作按钮 -->
                    <div class="quick-actions-container">
                        ${quickActions.map(action => `
                            <div class="quick-action" data-command="${action.command}">
                                <span class="material-symbols-rounded">${action.icon}</span>
                                <span>${action.title}</span>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    
                    <!-- 设备信息部分 -->
                    <div class="device-info-grid">
                        ${this.renderDeviceInfo()}
                    </div>
                </div>
            </div>
        `;
    },

    // 渲染后的回调
    afterRender() {
        // 确保只绑定一次事件
        const refreshBtn = document.getElementById('refresh-status');
        const actionBtn = document.getElementById('run-action');
        
        if (refreshBtn && !refreshBtn.dataset.bound) {
            refreshBtn.addEventListener('click', () => {
                this.refreshStatus(true);
            });
            refreshBtn.dataset.bound = 'true';
        }
        
        if (actionBtn && !actionBtn.dataset.bound) {
            actionBtn.addEventListener('click', () => {
                this.runAction();
            });
            actionBtn.dataset.bound = 'true';
        }
        // 绑定快捷按钮事件
        document.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', async () => {
                const command = button.dataset.command;
                try {
                    await Core.execCommand(command);
                    Core.showToast(`${button.textContent.trim()}`);
                } catch (error) {
                    Core.showToast(`${button.textContent.trim()}`, 'error');
                }
            });
        });
    },
    
    // 运行Action脚本
    async runAction() {
        try {
            // 创建输出容器
            const outputContainer = document.createElement('div');
            outputContainer.className = 'card action-output-container';
            outputContainer.innerHTML = `
                <div class="action-output-header">
                    <h3>${I18n.translate('ACTION_OUTPUT', 'Action输出')}</h3>
                    <button class="icon-button close-output" title="${I18n.translate('CLOSE', '关闭')}">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="action-output-content"></div>
            `;
            
            document.body.appendChild(outputContainer);
            const outputContent = outputContainer.querySelector('.action-output-content');
            
            // 修复关闭按钮的事件监听
            const closeButton = outputContainer.querySelector('.close-output');
            closeButton.addEventListener('click', () => {
                outputContainer.remove();
            });
            
            Core.showToast(I18n.translate('RUNNING_ACTION', '正在运行Action...'));
            outputContent.textContent = I18n.translate('ACTION_STARTING', '正在启动Action...\n');
            
            outputContainer.querySelector('.close-output').addEventListener('click', () => {
                outputContainer.remove();
            });
    
            await Core.execCommand(`busybox sh ${Core.MODULE_PATH}action.sh`, {
                onStdout: (data) => {
                    outputContent.textContent += data + '\n';
                    outputContent.scrollTop = outputContent.scrollHeight;
                },
                onStderr: (data) => {
                    const errorText = document.createElement('span');
                    errorText.className = 'error';
                    errorText.textContent = '[ERROR] ' + data + '\n';
                    outputContent.appendChild(errorText);
                    outputContent.scrollTop = outputContent.scrollHeight;
                }
            });
    
            outputContent.textContent += '\n' + I18n.translate('ACTION_COMPLETED', 'Action运行完成');
            Core.showToast(I18n.translate('ACTION_COMPLETED', 'Action运行完成'));
        } catch (error) {
            console.error('运行Action失败:', error);
            Core.showToast(I18n.translate('ACTION_ERROR', '运行Action失败'), 'error');
        }
    },
    
    // 加载模块状态
    async loadModuleStatus() {
        try {
            // 检查状态文件是否存在
            const statusPath = `${Core.MODULE_PATH}status.txt`;
            const fileExistsResult = await Core.execCommand(`[ -f "${statusPath}" ] && echo "true" || echo "false"`);
            
            if (fileExistsResult.trim() !== "true") {
                console.error(`状态文件不存在: ${statusPath}`);
                this.moduleStatus = 'UNKNOWN';
                return;
            }
            
            // 读取状态文件
            const status = await Core.execCommand(`cat "${statusPath}"`);
            if (!status) {
                console.error(`无法读取状态文件: ${statusPath}`);
                this.moduleStatus = 'UNKNOWN';
                return;
            }
            
            // 检查服务进程是否运行
            const isRunning = await this.isServiceRunning();
            
            // 如果状态文件显示运行中，但进程检查显示没有运行，则返回STOPPED
            if (status.trim() === 'RUNNING' && !isRunning) {
                console.warn('状态文件显示运行中，但服务进程未检测到');
                this.moduleStatus = 'STOPPED';
                return;
            }
            
            this.moduleStatus = status.trim() || 'UNKNOWN';
        } catch (error) {
            console.error('获取模块状态失败:', error);
            this.moduleStatus = 'ERROR';
        }
    },

    async isServiceRunning() {
        try {
            // 使用ps命令检查service.sh进程
            const result = await Core.execCommand(`ps -ef | grep "${Core.MODULE_PATH}service.sh" | grep -v grep | wc -l`);
            return parseInt(result.trim()) > 0;
        } catch (error) {
            console.error('检查服务运行状态失败:', error);
            return false;
        }
    },

    async loadDeviceInfo() {
        try {
            // 获取设备信息
            this.deviceInfo = {
                model: await this.getDeviceModel(),
                android: await this.getAndroidVersion(),
                kernel: await this.getKernelVersion(),
                root: await this.getRootImplementation(),
                android_api: await this.getAndroidAPI(),
                device_abi: await this.getDeviceABI()
            };
            
            console.log('设备信息加载完成:', this.deviceInfo);
        } catch (error) {
            console.error('加载设备信息失败:', error);
        }
    },

    async getDeviceModel() {
        try {
            const result = await Core.execCommand('getprop ro.product.model');
            return result.trim() || 'Unknown';
        } catch (error) {
            console.error('获取设备型号失败:', error);
            return 'Unknown';
        }
    },

    async getAndroidVersion() {
        try {
            const result = await Core.execCommand('getprop ro.build.version.release');
            return result.trim() || 'Unknown';
        } catch (error) {
            console.error('获取Android版本失败:', error);
            return 'Unknown';
        }
    },

    async getAndroidAPI() {
        try {
            const result = await Core.execCommand('getprop ro.build.version.sdk');
            return result.trim() || 'Unknown';
        } catch (error) {
            console.error('获取Android API失败:', error);
            return 'Unknown';
        }
    },

    async getDeviceABI() {
        try {
            const result = await Core.execCommand('getprop ro.product.cpu.abi');
            return result.trim() || 'Unknown';
        } catch (error) {
            console.error('获取设备架构失败:', error);
            return 'Unknown';
        }
    },

    async getKernelVersion() {
        try {
            const result = await Core.execCommand('uname -r');
            return result.trim() || 'Unknown';
        } catch (error) {
            console.error('获取内核版本失败:', error);
            return 'Unknown';
        }
    },

    async getRootImplementation() {
        try {
            // 检查Magisk是否安装
            const magiskPath = '/data/adb/magisk';
            const magiskExists = await Core.execCommand(`[ -f "${magiskPath}" ] && echo "true" || echo "false"`);
            
            if (magiskExists.trim() === "true") {
                const version = await Core.execCommand(`cat "${magiskPath}"`);
                if (version && version.trim()) {
                    return `Magisk ${version.trim()}`;
                }
            }
            
            // 尝试通过magisk命令获取版本
            const magiskResult = await Core.execCommand('magisk -v');
            if (magiskResult && !magiskResult.includes('not found')) {
                const magiskVersion = magiskResult.trim().split(':')[0];
                if (magiskVersion) {
                    return `Magisk ${magiskVersion}`;
                }
            }
            
            // 检查KernelSU是否安装
            const ksuResult = await Core.execCommand('ksud -V');
            if (ksuResult && !ksuResult.includes('not found')) {
                return `KernelSU ${ksuResult.trim()}`;
            }
            
            // 检查APatch是否安装
            const apatchResult = await Core.execCommand('apd -V');
            if (apatchResult && !apatchResult.includes('not found')) {
                return `APatch ${apatchResult.trim()}`;
            }
            
            return 'No Root';
        } catch (error) {
            console.error('获取ROOT实现失败:', error);
            return 'Unknown';
        }
    },

    getStatusI18nKey() {
        switch (this.moduleStatus) {
            case 'RUNNING':
                return 'RUNNING';
            case 'STOPPED':
                return 'STOPPED';
            case 'ERROR':
                return 'ERROR';
            case 'PAUSED':
                return 'PAUSED';
            case 'NORMAL_EXIT':
                return 'NORMAL_EXIT';
            default:
                return 'UNKNOWN';
        }
    },

    // 渲染设备信息
    renderDeviceInfo() {
        if (!this.deviceInfo || Object.keys(this.deviceInfo).length === 0) {
            return `<div class="no-info" data-i18n="NO_DEVICE_INFO">无设备信息</div>`;
        }
        
        // 设备信息项映射
        const infoItems = [
            { key: 'model', label: 'DEVICE_MODEL', icon: 'smartphone' },
            { key: 'android', label: 'ANDROID_VERSION', icon: 'android' },
            { key: 'android_api', label: 'ANDROID_API', icon: 'api' },
            { key: 'device_abi', label: 'DEVICE_ABI', icon: 'memory' },
            { key: 'kernel', label: 'KERNEL_VERSION', icon: 'terminal' },
            { key: 'root', label: 'ROOT_IMPLEMENTATION', icon: 'security' }
        ];
        
        let html = '';
        
        infoItems.forEach(item => {
            if (this.deviceInfo[item.key]) {
                html += `
                    <div class="device-info-item">
                        <div class="device-info-icon">
                            <span class="material-symbols-rounded">${item.icon}</span>
                        </div>
                        <div class="device-info-content">
                            <div class="device-info-label" data-i18n="${item.label}">${I18n.translate(item.label, item.key)}</div>
                            <div class="device-info-value">${this.deviceInfo[item.key]}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        return html || `<div class="no-info" data-i18n="NO_DEVICE_INFO">无设备信息</div>`;
    },
    
    // 刷新状态
    async refreshStatus(showToast = false) {
        try {
            const oldStatus = this.moduleStatus;
            const oldDeviceInfo = JSON.stringify(this.deviceInfo);
            
            await this.loadModuleStatus();
            await this.loadDeviceInfo();
            
            // 只在状态发生变化时更新UI
            const newDeviceInfo = JSON.stringify(this.deviceInfo);
            if (oldStatus !== this.moduleStatus || oldDeviceInfo !== newDeviceInfo) {
                // 更新UI
                const statusPage = document.querySelector('.status-page');
                if (statusPage) {
                    statusPage.innerHTML = `
                        <!-- 合并的状态卡片 -->
                        <div class="card status-card">
                            <div class="status-card-header">
                                <span class="status-title" data-i18n="MODULE_STATUS">模块状态</span>
                            </div>
                            <div class="status-card-content">
                                <div class="status-icon-container">
                                    <div class="status-indicator ${this.getStatusClass()}">
                                        <span class="material-symbols-rounded">${this.getStatusIcon()}</span>
                                    </div>
                                </div>
                                <div class="status-info-container ${this.getStatusClass()}">
                                    <div class="status-title-row">
                                        <span class="status-value" data-i18n="${this.getStatusI18nKey()}">${this.getStatusText()}</span>
                                    </div>
                                    <div class="status-update-row">
                                        <span class="status-update-time">${new Date().toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 设备信息部分 -->
                            <div class="device-info-grid">
                                ${this.renderDeviceInfo()}
                            </div>
                        </div>
                    `;
                    
                    this.afterRender();
                }
            }
            
            if (showToast) {
                Core.showToast(I18n.translate('STATUS_REFRESHED', '状态已刷新'));
            }
        } catch (error) {
            console.error('刷新状态失败:', error);
            if (showToast) {
                Core.showToast(I18n.translate('STATUS_REFRESH_ERROR', '刷新状态失败'), 'error');
            }
        }
    },
    
    // 启动自动刷新
    startAutoRefresh() {
        // 每60秒刷新一次
        this.refreshTimer = setInterval(() => {
            this.refreshStatus();
        }, 60000);
    },
    
    // 停止自动刷新
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },
    
    // 获取状态类名
    getStatusClass() {
        switch (this.moduleStatus) {
            case 'RUNNING': return 'status-running';
            case 'STOPPED': return 'status-stopped';
            case 'ERROR': return 'status-error';
            case 'PAUSED': return 'status-paused';
            case 'NORMAL_EXIT': return 'status-normal-exit';
            default: return 'status-unknown';
        }
    },
    
    // 获取状态图标
    getStatusIcon() {
        switch (this.moduleStatus) {
            case 'RUNNING': return 'check_circle';
            case 'STOPPED': return 'cancel';
            case 'ERROR': return 'error';
            case 'PAUSED': return 'pause_circle';
            case 'NORMAL_EXIT': return 'task_alt';
            default: return 'help';
        }
    },
    
    // 获取状态文本
    getStatusText() {
        switch (this.moduleStatus) {
            case 'RUNNING': return I18n.translate('RUNNING', '运行中');
            case 'STOPPED': return I18n.translate('STOPPED', '已停止');
            case 'ERROR': return I18n.translate('ERROR', '错误');
            case 'PAUSED': return I18n.translate('PAUSED', '已暂停');
            case 'NORMAL_EXIT': return I18n.translate('NORMAL_EXIT', '正常退出');
            default: return I18n.translate('UNKNOWN', '未知');
        }
    },
    
    // 页面激活时的回调
    onActivate() {
        console.log('状态页面已激活');
        // 如果没有状态数据才进行刷新
        if (!this.moduleStatus || !this.deviceInfo) {
            this.refreshStatus();
        }
        // 启动自动刷新
        this.startAutoRefresh();
    },
    
    onDeactivate() {
        console.log('状态页面已停用');
        // 停止自动刷新但保留状态数据
        this.stopAutoRefresh();
    }
};

// 导出状态页面模块
window.StatusPage = StatusPage;
