const { invoke } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;

// 视频处理类
class VideoProcessor {
    constructor(config) {
        this.files = [];
        this.config = config;
        // 定义支持的格式
        this.supportedFormats = {
            audio: ['mp3', 'aac', 'wav', 'flac'],
            video: ['mp4', 'mkv', 'avi', 'mov']  // 添加 mov 格式
        };
    }

    addFile(filePath) {
        // 修改文件名获取逻辑
        const fileName = filePath.split('/').pop().split('\\').pop();
        const defaultTitle = fileName.replace(/\.[^/.]+$/, "");
        
        this.files.push({
            path: filePath,
            fileName: fileName,
            startTime: "00:00",  // 修改为 MM:SS 格式
            endTime: "03:00",    // 修改为 MM:SS 格式
            title: defaultTitle,
            artist: "",
            outputFormat: "mp3", // 默认格式
            status: "待处理"
        });
    }

    // 添加时间格式验证方法
    validateTimeFormat(time) {
        if (!time || time.trim() === '') {
            return null;
        }

        // 检查并规范化时间格式 (MM:SS)
        const timePattern = /^(\d{1,2}):(\d{1,2})$/;
        const match = time.match(timePattern);
        
        if (match) {
            const minutes = match[1].padStart(2, '0');
            const seconds = match[2].padStart(2, '0');
            return `${minutes}:${seconds}`;
        }
        
        return null;
    }

    updateFile(index, field, value) {
        if (this.files[index]) {
            this.files[index][field] = value;
            // 如果修改了时间或标签相关字段，重置状态为待处理
            if (['startTime', 'endTime', 'title', 'artist', 'outputFormat'].includes(field)) {
                if (this.files[index].status === "完成" || this.files[index].status === "失败") {
                    this.files[index].status = "待处理";
                    // 立即更新表格显示
                    UIManager.renderTable(this.files);
                }
            }
        }
    }

    deleteFiles(indices) {
        indices.sort((a, b) => b - a); // 从后往前删除
        indices.forEach(index => {
            this.files.splice(index, 1);
        });
    }

    getSelectedFiles() {
        const checkboxes = document.querySelectorAll('#video-list input[type="checkbox"]');
        return this.files.filter((_, index) => {
            const checkbox = checkboxes[index];
            return checkbox && checkbox.checked;
        });
    }

    async convertSelected() {
        const selectedFiles = this.getSelectedFiles();
        
        if (selectedFiles.length === 0) {
            await UIManager.showMessage("请先选择要转换的文件", "操作提示", "warning");
            return;
        }

        // 检查必填字段
        for (const file of selectedFiles) {
            if (!file.title?.trim() || !file.artist?.trim()) {
                await UIManager.showMessage(
                    `文件 "${file.fileName}" 的标题和艺术家不能为空`,
                    "操作提示",
                    "warning"
                );
                return;
            }
        }

        // 继续转换过程
        for (const file of selectedFiles) {
            if (file.status === "待处理") {
                await this.convertFile(file);
            }
        }
    }

    async convertFile(file) {
        // 只允许转换"待处理"状态的文件
        if (file.status !== "待处理") {
            return;
        }

        try {
            const fileName = `${file.title}.${file.outputFormat}`; // 使用文件自己的格式
            const outputPath = this.config.outputDir 
                ? `${this.config.outputDir}/${fileName}`
                : file.path.replace(/\.[^/.]+$/, `.${file.outputFormat}`);

            const songInfo = {
                video_file: file.path,
                output_filename: file.path.replace(/\.[^/.]+$/, ".mp3"),
                output_path: outputPath,
                title: file.title,
                artist: file.artist,
                start_time: file.startTime !== "" ? file.startTime : "00:00:00",
                end_time: file.endTime !== "" ? file.endTime : "00:03:00",
                audio_config: {
                    format: file.outputFormat, // 使用文件自己的格式
                    bitrate: this.config.audioBitrate,
                    sample_rate: this.config.sampleRate,
                    channels: this.config.channels
                }
            };
            
            file.status = "处理中";
            UIManager.renderTable(this.files);
            
            const result = await invoke('convert_audio', { song: songInfo });
            file.status = result ? "完成" : "失败";
        } catch (err) {
            console.error('转换失败:', err);
            file.status = "失败";
            await UIManager.showMessage(
                `转换失败: ${err.message || '未知错误'}`,
                "错误提示",
                "warning"
            );
        }
        UIManager.renderTable(this.files);
    }
}

// UI管理类
class UIManager {
    static async showMessage(message, title, kind) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'message-overlay';
            
            const messageBox = document.createElement('div');
            messageBox.className = 'message-box';
            
            const header = document.createElement('div');
            header.className = 'message-header';
            header.textContent = title;
            
            const content = document.createElement('div');
            content.className = 'message-content';
            content.textContent = message;
            
            const buttons = document.createElement('div');
            buttons.className = 'message-buttons';
            
            const okButton = document.createElement('button');
            okButton.className = `message-btn ${kind}`;
            okButton.textContent = '确定';
            okButton.onclick = () => {
                overlay.classList.remove('show');
                messageBox.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(true);
                }, 200);
            };
            
            buttons.appendChild(okButton);
            messageBox.append(header, content, buttons);
            overlay.appendChild(messageBox);
            document.body.appendChild(overlay);
            
            // 触发重排后添加显示类
            requestAnimationFrame(() => {
                overlay.classList.add('show');
                messageBox.classList.add('show');
            });
        });
    }

    static clearTable() {
        const tbody = document.getElementById('video-list');
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
    }

    static renderTable(files) {
        this.clearTable(); // 清理旧的 DOM 节点
        const tbody = document.getElementById('video-list');
        const fragment = document.createDocumentFragment(); // 使用文档片段优化性能
        
        files.forEach((file, index) => {
            const row = this.createTableRow(file, index);
            fragment.appendChild(row);
        });
        
        tbody.appendChild(fragment);
    }

    static createTableRow(file, index) {
        const row = document.createElement('tr');
        
        const cells = [
            this.createCheckboxCell(index),
            this.createTextCell(file.fileName),
            this.createInputCell('time', 'startTime', file.startTime, index),
            this.createInputCell('time', 'endTime', file.endTime, index),
            this.createInputCell('text', 'title', file.title, index),
            this.createInputCell('text', 'artist', file.artist, index),
            this.createFormatSelectCell(index, file.outputFormat), // 新增格式选择单元格
            this.createStatusCell(file.status)
        ];

        row.append(...cells);
        return row;
    }

    static createCheckboxCell(index) {
        const cell = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.index = index;
        container.appendChild(checkbox);
        cell.appendChild(container);
        return cell;
    }

    static createTextCell(text) {
        const cell = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'input-container';
        container.title = text; // 添加悬停提示
        container.textContent = text;
        cell.appendChild(container);
        return cell;
    }

    static createInputCell(type, field, value, index) {
        const cell = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'input-container';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = `${type}-input`;
        input.value = value;
        input.dataset.index = index;
        input.dataset.field = field;
        
        // 为所有输入框添加change事件
        input.addEventListener('change', (e) => {
            const app = window.app; // 获取全局app实例
            if (app) {
                app.handleTableChange(e);
            }
        });

        // 为时间输入框添加特殊处理
        if (type === 'time') {
            input.placeholder = '00:00';
            // 添加输入验证
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                // 只允许输入数字和冒号
                if (!/^[\d:]*$/.test(value)) {
                    e.target.value = value.replace(/[^\d:]/g, '');
                }
                // 限制最大长度
                if (value.length > 5) {
                    e.target.value = value.slice(0, 5);
                }
            });
        }
        
        container.appendChild(input);
        cell.appendChild(container);
        return cell;
    }

    static createFormatSelectCell(index, currentFormat) {
        const cell = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'input-container';
        
        const select = document.createElement('select');
        select.className = 'format-select';
        select.dataset.index = index;
        select.dataset.field = 'outputFormat';

        const formats = ['mp3', 'aac', 'wav', 'flac'];
        formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            option.selected = format === currentFormat;
            select.appendChild(option);
        });

        container.appendChild(select);
        cell.appendChild(container);
        return cell;
    }

    static createStatusCell(status) {
        const cell = document.createElement('td');
        const statusIcon = document.createElement('div');
        statusIcon.className = `status-icon ${this.getStatusClass(status)}`;
        const container = document.createElement('div');
        container.className = 'status-cell';
        container.appendChild(statusIcon);
        cell.appendChild(container);
        return cell;
    }

    static getStatusClass(status) {
        const statusClasses = {
            '待处理': 'pending',
            '处理中': 'converting',
            '完成': 'completed',
            '失败': 'failed'
        };
        return statusClasses[status] || 'pending';
    }
}

// 应用程序类
class App {
    constructor() {
        this.config = {
            outputDir: null,
            audioBitrate: '320k',
            sampleRate: '44100',
            channels: 2
        };
        
        this.processor = new VideoProcessor(this.config);
        
        // 绑定方法到实例
        this.handleTableChange = this.handleTableChange.bind(this);
        this.handleSelectAll = this.handleSelectAll.bind(this);
        this.handleAddVideos = this.handleAddVideos.bind(this);
        this.handleDeleteSelected = this.handleDeleteSelected.bind(this);
        this.handleStartConversion = this.handleStartConversion.bind(this);
        this.handleSelectOutputDir = this.handleSelectOutputDir.bind(this);

        // 等待 DOM 加载完成后初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initApp());
        } else {
            this.initApp();
        }
    }

    // 新增：统一的应用初始化方法
    initApp() {
        try {
            // 先检查所有必需的DOM元素是否存在
            const elements = {
                'add-video': '添加视频按钮',
                'delete-selected': '删除选中按钮',
                'start-conversion': '开始转换按钮',
                'output-dir': '输出目录按钮',
                'select-all': '全选复选框',
                'video-list': '视频列表'
            };

            for (const [id, name] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (!element) {
                    throw new Error(`${name}(#${id})未找到`);
                }
            }

            // 绑定事件监听器
            this.bindEventListeners();
            
            // 添加按钮状态样式
            this.addButtonStyles();
            
            // 初始化完成后添加标记
            document.body.classList.add('app-initialized');
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            // 显示错误提示
            UIManager.showMessage(
                `初始化失败: ${error.message}`,
                "错误提示",
                "warning"
            );
        }
    }

    // 修改事件绑定方法
    bindEventListeners() {
        const handlers = {
            'add-video': { event: 'click', handler: this.handleAddVideos },
            'delete-selected': { event: 'click', handler: this.handleDeleteSelected },
            'start-conversion': { event: 'click', handler: this.handleStartConversion },
            'output-dir': { event: 'click', handler: this.handleSelectOutputDir },
            'select-all': { event: 'change', handler: this.handleSelectAll },
            'video-list': { event: 'change', handler: this.handleTableChange }
        };

        for (const [id, { event, handler }] of Object.entries(handlers)) {
            const element = document.getElementById(id);
            if (element) {
                // 先移除可能存在的旧事件监听器
                element.removeEventListener(event, handler);
                // 添加新的事件监听器
                element.addEventListener(event, handler);
            }
        }
    }

    // 新增：添加按钮样式方法
    addButtonStyles() {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            // 确保按钮可点击
            button.style.pointerEvents = 'auto';
            // 添加悬停效果
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-1px)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
            });
        });
    }

    // 表格变化处理
    handleTableChange(e) {
        if (e.target.dataset.index && e.target.dataset.field) {
            this.processor.updateFile(
                parseInt(e.target.dataset.index),
                e.target.dataset.field,
                e.target.value
            );
        }
    }

    // 全选处理
    handleSelectAll(e) {
        const checkboxes = document.querySelectorAll('#video-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    }

    // 添加视频处理
    async handleAddVideos() {
        try {
            const selected = await open({
                multiple: true,
                filters: [{
                    name: 'Video Files',
                    extensions: ['mp4', 'mkv', 'avi', 'mov']  // 添加 mov 格式
                }]
            });
            
            if (Array.isArray(selected)) {
                selected.forEach(filePath => this.processor.addFile(filePath));
            } else if (selected) {
                this.processor.addFile(selected);
            }
            UIManager.renderTable(this.processor.files);
        } catch (err) {
            console.error('选择文件时出错:', err);
        }
    }

    // 删除选中文件处理
    handleDeleteSelected() {
        const selected = [];
        document.querySelectorAll('#video-list input[type="checkbox"]').forEach((checkbox, index) => {
            if (checkbox.checked) selected.unshift(index);
        });
        this.processor.deleteFiles(selected);
        UIManager.renderTable(this.processor.files);
    }

    // 开始转换处理
    handleStartConversion() {
        this.processor.convertSelected();
    }

    // 选择输出目录处理
    async handleSelectOutputDir() {
        try {
            const dir = await invoke('pick_output_dir');
            if (dir) {
                this.config.outputDir = dir;
                // 只更改按钮文本，不显示提示框
                document.getElementById('output-dir').textContent = `已设置输出目录`;
            }
        } catch (err) {
            console.error('选择输出目录时出错:', err);
            await UIManager.showMessage("设置输出目录失败", "错误提示", "warning");
        }
    }

    // 清理资源
    destroy() {
        try {
            // 移除所有事件监听器
            const elements = [
                { id: 'add-video', event: 'click' },
                { id: 'delete-selected', event: 'click' },
                { id: 'start-conversion', event: 'click' },
                { id: 'output-dir', event: 'click' },
                { id: 'select-all', event: 'change' },
                { id: 'video-list', event: 'change' }
            ];

            elements.forEach(({ id, event }) => {
                const element = document.getElementById(id);
                if (element) {
                    const listeners = element.getEventListeners?.(event) || [];
                    listeners.forEach(listener => {
                        element.removeEventListener(event, listener);
                    });
                }
            });

            // 移除初始化标记
            document.body.classList.remove('app-initialized');

        } catch (error) {
            console.error('清理资源时出错:', error);
        }
    }
}

// 修改初始化方式
let app;
document.addEventListener('DOMContentLoaded', () => {
    if (!app) {
        app = new App();
    }
});

// 确保在页面关闭时清理资源
window.addEventListener('unload', () => {
    if (app) {
        app.destroy();
        app = null;
    }
});
