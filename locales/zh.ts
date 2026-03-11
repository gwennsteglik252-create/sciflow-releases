// ═══ SciFlow Pro — 中文翻译包 ═══

const zh = {

    // ── 侧边栏导航 ──
    sidebar: {
        inception: '战略立项',
        industryTrends: '行业动态',
        dashboard: '研究看板',
        projects: '课题中心',
        team: '团队矩阵',
        researchBrain: '中心大脑',
        literature: '情报档案',
        mechanism: '机理推演',
        characterizationHub: '实验表征',
        inventory: '库存管理',
        doe: 'DOE 迭代',
        flowchart: '实验路线',
        data: '数据分析',
        figureCenter: '科研绘图',
        videoLab: '视频工坊',
        writing: '写作工坊',
        voiceCompanion: '湿实验语音伴侣',
        dragPopoutHint: '松手弹出独立窗口',
    },

    // ── 通用操作 ──
    common: {
        save: '保存',
        cancel: '取消',
        confirm: '确认',
        delete: '删除',
        edit: '编辑',
        add: '添加',
        close: '关闭',
        back: '返回',
        search: '搜索',
        export: '导出',
        import: '导入',
        reset: '重置',
        copy: '复制',
        loading: '加载中...',
        noData: '暂无数据',
        success: '操作成功',
        error: '操作失败',
        warning: '警告',
        info: '提示',
        yes: '是',
        no: '否',
        all: '全部',
        none: '无',
        refresh: '刷新',
        download: '下载',
        upload: '上传',
        browse: '浏览...',
        viewAll: '查看全部',
        more: '更多',
        less: '收起',
        done: '完成',
        pending: '待处理',
        active: '活跃',
        create: '创建',
        update: '更新',
        remove: '移除',
    },

    // ── 仪表盘 ──
    dashboard: {
        title: '研究看板',
        activeProjects: '活跃课题',
        totalLiterature: '文献总量',
        teamMembers: '团队成员',
        tasksCompleted: '已完成任务',
        recentActivity: '最近活动',
        quickActions: '快速操作',
        researchProgress: '研究进度',
        weeklyOverview: '本周概览',
    },

    // ── 课题中心 ──
    projects: {
        title: '研究课题中心',
        newProject: '新建课题库',
        activeNode: '当前活跃节点',
        noActive: '无活跃节点',
        totalProgress: '总研究进度',
        literature: '文献',
        reports: '报告',
        weeklyProgress: '本周任务进度',
        confirmDelete: '确认删除该课题库？',
        irreversible: '操作不可逆，再次确认？',
        category: {
            newEnergy: '新能源',
            biomedicine: '生物医药',
            ai: '人工智能',
            materialScience: '材料科学',
        },
    },

    // ── 设置相关 ──
    settings: {
        title: '系统偏好设置',
        saveButton: '完成设置并保存',

        // 标签页
        tabs: {
            ai: 'AI 引擎',
            appearance: '外观语言',
            research: '科研写作',
            data: '数据图表',
            system: '系统管理',
        },

        // AI 引擎
        ai: {
            hybridEngine: '多模型混合引擎',
            preferredEngine: '当前首选推理引擎',
            smartRouting: '智能自动',
            routingActive: '智能路由已激活',
            orchestration: '智能调度逻辑说明',
            orchestrationDesc: '系统将根据已保存的有效 Key，自动分析任务内容。视觉任务优先分配给 Gemini，简单润色分配给 DeepSeek/豆包以降低成本，复杂推演则分配给顶级旗舰模型。',
            routingPreference: '调度优先级偏好',
            costFirst: '成本优先',
            qualityFirst: '质量优先',
            automationStrategy: 'AI 自动化策略',
            autoDiagnose: '自动诊断异常',
            autoDiagnoseDesc: '自动检测实验中的异常数据',
            realtimePolish: '实时学术润色',
            realtimePolishDesc: '写作时提供实时修改建议',
            customModel: '自定义模型',
            refreshList: '刷新列表',
            updating: '更新中...',
            modelsFound: '成功获取 {count} 个模型！',
            noModels: '未发现可用模型。',
            refreshFailed: '模型列表更新失败，请检查网络或 API Key。',
            enterApiKey: '请先输入有效的 API 地址和 API Key。',
            proxyBaseUrl: '代理 Base URL',
            proxyBaseUrlHint: '可选，留空则直连',
            configHint: '手动填入即可覆盖系统默认的 API Key 及模型设置。此设定会保存在本地单独的缓存中。',
        },

        // 外观
        appearance: {
            title: '外观与主题',
            themeMode: '界面主题模式',
            light: '☀️ 浅色',
            dark: '🌙 深色',
            system: '💻 跟随系统',
            uiScale: '界面缩放',
            editorFontSize: '编辑器字体大小',
            languageLocale: '语言与区域',
            uiLanguage: '界面语言',
            dateFormat: '日期格式',
            aiOutputLanguage: 'AI 输出语言',
            autoLanguage: '🔄 自动',
        },

        // 科研写作
        research: {
            scientificStandards: '科研标准与排版',
            defaultCitation: '默认文献引用格式',
            latexStyle: '全局 LaTeX 渲染风格',
            writingPreferences: '写作偏好',
            polishIntensity: 'AI 润色强度',
            polishLight: '轻度 (语法)',
            polishModerate: '中度 (风格)',
            polishDeep: '深度 (改写)',
            defaultWritingLang: '默认写作语言',
            paragraphIndent: '段落缩进',
            indentFirst: '首行缩进',
            noIndent: '无缩进',
            experimentDefaults: '实验参数默认值',
            xrdRadiation: 'XRD 默认辐射源',
            xpsReference: 'XPS 能量参考',
            semVoltage: 'SEM 默认加速电压',
            temVoltage: 'TEM 默认加速电压',
            experimentDefaultsHint: '这些默认值将在新建实验表征时自动填充，可在具体模块中覆盖',
        },

        // 数据图表
        data: {
            title: '数据与可视化',
            defaultExportFormat: '默认导出格式',
            defaultExportDPI: '默认导出 DPI',
            dpiStandard: '标准',
            dpiHD: '高清',
            dpiPublication: '出版级',
            chartFont: '图表默认字体',
            colorPalette: '默认配色方案',
        },

        // 系统管理
        system: {
            license: '软件授权',
            activated: '已激活',
            trial: '试用中',
            expired: '已过期',
            permanentLicense: '永久授权',
            activatedAt: '激活于',
            trialDaysRemaining: '剩余 {days} 天 · 14天免费试用',
            enterActivationCode: '输入激活码',
            activate: '激活',
            getActivationCode: '获取激活码 →',
            activationSuccess: '激活成功！',
            activationFailed: '激活失败',

            interaction: '交互与通知',
            enableNotifications: '启用桌面通知',
            notificationsDesc: '任务完成提醒',
            autoSave: '自动保存策略',
            autoSaveRealtime: '实时 (1m)',
            autoSaveStandard: '标准 (5m)',
            autoSaveLow: '低频 (15m)',
            autoSaveOff: '关闭',

            networkProxy: '网络与代理',
            enableProxy: '启用 HTTP 代理',
            proxyDesc: '通过代理路由 AI 请求',
            proxyAddress: '代理地址',
            aiTimeout: 'AI 请求超时',

            privacySecurity: '隐私与安全',
            confirmBeforeAI: 'AI 数据发送确认',
            confirmBeforeAIDesc: '开启后，每次向 AI 发送实验数据前将弹窗二次确认',

            backupRestore: '备份与恢复',
            exportSettings: '导出设置',
            importSettings: '导入设置',
            exportHint: '导出文件包含所有配置项（含 API Key），请妥善保管',

            shortcuts: '快捷键一览',
            shortcutSearch: '全局搜索',
            shortcutAiCli: 'AI 命令行',
            shortcutSave: '保存文档',
            shortcutUndo: '撤销',
            shortcutRedo: '重做',
            shortcutScreenshot: '全屏截图',
            shortcutSearchInChat: '对话内搜索',
            shortcutCloseModal: '关闭弹窗',
            shortcutsHint: '快捷键暂不支持自定义，后续版本计划开放',

            storage: '文献存储管理',
            localLibraryPath: '默认本地文献库路径',
            storageHint: 'AI 检索本地档案时将以此目录为根路径',

            chatManagement: 'AI 对话管理',
            chatRetention: '对话历史保留',
            chatRetention7: '7 天',
            chatRetention30: '30 天 (默认)',
            chatRetention90: '90 天',
            chatRetentionForever: '永久保留',
            autoClearChat: '自动清理过期对话',

            windowBehavior: '窗口行为',
            restorePosition: '恢复上次窗口位置',
            rememberLastPage: '记住最后打开的页面',

            performance: '性能调优',
            gpuAcceleration: 'GPU 硬件加速',
            cacheMaxSize: '缓存大小上限',

            aboutUpdate: '关于与更新',
            checkUpdate: '检查更新',
            checking: '检查中...',
            latestVersion: '当前已是最新版本 ✨',
            newVersionFound: '发现新版本 v{version}！',
            downloadUpdate: '下载更新',
            downloading: '正在下载更新...',
            downloaded: '已下载完成，点击下方按钮重启安装！',
            installRestart: '立即重启并安装',
            updateError: '更新检查失败',
            updateNotAvailableHint: '点击下方按钮检查是否有新版本可用',
            devModeHint: '当前环境不支持自动更新（仅打包版本可用）',

            dangerZone: '危险区域',
            dangerZoneDesc: '移除所有本地存档数据，该操作不可撤销。',
            clearAllCache: '清除本地所有缓存',
            clearCacheTitle: '清空所有本地数据？',
            clearCacheDesc: '此操作将抹除所有本地存储的课题、文献、对话历史和配置项。该操作不可逆，请确保已备份重要数据。',
        },
    },

    // ── 文献 / 情报档案 ──
    literature: {
        title: '情报档案',
        addLiterature: '添加文献',
        search: '搜索文献...',
        totalItems: '总计 {count} 条',
    },

    // ── 团队 ──
    team: {
        title: '团队矩阵',
        members: '成员',
    },

    // ── AI 助手 ──
    aiAssistant: {
        title: 'AI 研究助手',
        sendMessage: '发送消息...',
        thinking: 'AI 思考中...',
        taskCancelled: '任务已取消',
        taskFailed: '任务失败',
    },

    // ── 数据分析 ──
    dataAnalysis: {
        title: '数据分析',
        importData: '导入数据',
        exportChart: '导出图表',
    },

    // ── 写作工坊 ──
    writing: {
        title: '写作工坊',
        newDocument: '新建文档',
    },

    // ── 科研绘图 ──
    figureCenter: {
        title: '科研绘图',
    },

    // ── 表征中心 ──
    characterization: {
        title: '实验表征中心',
    },

    // ── 库存管理 ──
    inventory: {
        title: '库存管理',
    },

    // ── 机理推演 ──
    mechanism: {
        title: '机理推演',
    },

    // ── Toast 消息 ──
    toast: {
        settingsImportSuccess: '设置导入成功！页面将刷新以应用变更。',
        settingsImportFailed: '导入失败：文件格式无效。',
        taskCancelled: '任务已取消',
        taskFailed: '任务失败: {message}',
    },

    // ── 登录/注册 ──
    auth: {
        welcomeBack: '欢迎回来',
        createAccount: '创建账号',
        resetPassword: '重置密码',
        loginSubtitle: '登录以继续使用 SciFlow Pro',
        registerSubtitle: '注册账号开始你的科研之旅',
        resetSubtitle: '输入邮箱地址，我们将发送重置链接',
        email: '邮箱地址',
        password: '密码',
        passwordHint: '至少 6 位字符',
        enterPassword: '输入密码',
        forgotPassword: '忘记密码？',
        login: '登 录',
        register: '创建账号',
        sendResetEmail: '发送重置邮件',
        processing: '处理中…',
        or: '或',
        wechat: '微信',
        wechatComingSoon: '(即将上线)',
        noAccount: '还没有账号？',
        signUpNow: '立即注册',
        hasAccount: '已有账号？',
        backToLogin: '返回登录',
        backArrow: '← 返回登录',
        registerSuccess: '注册成功！请查收验证邮件，验证后即可登录。',
        resetEmailSent: '密码重置邮件已发送，请查收邮箱。',
        operationFailed: '操作失败，请稍后重试',
        brandSubtitle: '新一代科研全流程管理平台',
        brandSlogan: 'AI 驱动 · 数据安全 · 协作无间',
        featureExperiment: '实验管理',
        featureExperimentDesc: '全流程实验记录与分析',
        featureData: '数据分析',
        featureDataDesc: 'AI 驱动的智能数据处理',
        featureWriting: '学术写作',
        featureWritingDesc: '论文撰写与排版一体化',
        featureTeam: '团队协作',
        featureTeamDesc: '多人实时协作与知识共享',
    },
};

export type TranslationKeys = typeof zh;
export default zh;
