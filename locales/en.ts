// ═══ SciFlow Pro — English Translation Pack ═══

import type { TranslationKeys } from './zh';

const en: TranslationKeys = {

    // ── Sidebar Navigation ──
    sidebar: {
        inception: 'Strategy Lab',
        industryTrends: 'Industry Trends',
        dashboard: 'Dashboard',
        projects: 'Projects',
        team: 'Team Matrix',
        researchBrain: 'Research Brain',
        literature: 'Intel Archive',
        mechanism: 'Mechanism Engine',
        characterizationHub: 'Characterization',
        inventory: 'Inventory',
        doe: 'DOE Iteration',
        flowchart: 'Experiment Route',
        data: 'Data Analysis',
        figureCenter: 'Figure Studio',
        videoLab: 'Video Lab',
        writing: 'Writing Studio',
        voiceCompanion: 'Wet Lab Voice Companion',
        dragPopoutHint: 'Release to pop out window',
    },

    // ── Common Actions ──
    common: {
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        close: 'Close',
        back: 'Back',
        search: 'Search',
        export: 'Export',
        import: 'Import',
        reset: 'Reset',
        copy: 'Copy',
        loading: 'Loading...',
        noData: 'No data',
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info',
        yes: 'Yes',
        no: 'No',
        all: 'All',
        none: 'None',
        refresh: 'Refresh',
        download: 'Download',
        upload: 'Upload',
        browse: 'Browse...',
        viewAll: 'View All',
        more: 'More',
        less: 'Less',
        done: 'Done',
        pending: 'Pending',
        active: 'Active',
        create: 'Create',
        update: 'Update',
        remove: 'Remove',
    },

    // ── Dashboard ──
    dashboard: {
        title: 'Dashboard',
        activeProjects: 'Active Projects',
        totalLiterature: 'Total Literature',
        teamMembers: 'Team Members',
        tasksCompleted: 'Tasks Completed',
        recentActivity: 'Recent Activity',
        quickActions: 'Quick Actions',
        researchProgress: 'Research Progress',
        weeklyOverview: 'Weekly Overview',
    },

    // ── Projects ──
    projects: {
        title: 'Research Project Center',
        newProject: 'New Project',
        activeNode: 'Active Milestone',
        noActive: 'No active milestone',
        totalProgress: 'Overall Progress',
        literature: 'Literature',
        reports: 'Reports',
        weeklyProgress: 'Weekly Task Progress',
        confirmDelete: 'Confirm delete this project?',
        irreversible: 'This action is irreversible. Confirm again?',
        category: {
            newEnergy: 'New Energy',
            biomedicine: 'Biomedicine',
            ai: 'Artificial Intelligence',
            materialScience: 'Material Science',
        },
    },

    // ── Settings ──
    settings: {
        title: 'System Preferences',
        saveButton: 'Save All Settings',

        tabs: {
            ai: 'AI Engine',
            appearance: 'Appearance',
            research: 'Research',
            data: 'Data & Charts',
            system: 'System',
        },

        ai: {
            hybridEngine: 'Hybrid AI Engine',
            preferredEngine: 'Preferred Inference Engine',
            smartRouting: 'Smart Auto',
            routingActive: 'SMART ROUTING ACTIVE',
            orchestration: 'Orchestration Logic',
            orchestrationDesc: 'The system automatically dispatches tasks based on saved API keys. Visual tasks go to Gemini, light polishing to DeepSeek/Doubao for cost savings, and complex reasoning to flagship models.',
            routingPreference: 'Routing Priority',
            costFirst: 'Cost Priority (Economy)',
            qualityFirst: 'Quality Priority (Intelligence)',
            automationStrategy: 'AI Automation Strategy',
            autoDiagnose: 'Auto-Diagnose Anomalies',
            autoDiagnoseDesc: 'Auto-detect anomalous experimental data',
            realtimePolish: 'Real-time Academic Polish',
            realtimePolishDesc: 'Provide real-time writing suggestions',
            customModel: 'Custom Model',
            refreshList: 'Refresh List',
            updating: 'Updating...',
            modelsFound: 'Successfully fetched {count} models!',
            noModels: 'No available models found.',
            refreshFailed: 'Model list refresh failed. Check your network or API Key.',
            enterApiKey: 'Please enter a valid API URL and API Key first.',
            proxyBaseUrl: 'Proxy Base URL',
            proxyBaseUrlHint: 'Optional, leave empty for direct connection',
            configHint: 'Manual entries override default API Key and model settings. Saved in separate local cache.',
        },

        appearance: {
            title: 'Appearance & Theme',
            themeMode: 'Color Theme Mode',
            light: '☀️ Light',
            dark: '🌙 Dark',
            system: '💻 System',
            uiScale: 'UI Scale',
            editorFontSize: 'Editor Font Size',
            languageLocale: 'Language & Locale',
            uiLanguage: 'Interface Language',
            dateFormat: 'Date Format',
            aiOutputLanguage: 'AI Response Language',
            autoLanguage: '🔄 Auto',
        },

        research: {
            scientificStandards: 'Scientific Standards & Typesetting',
            defaultCitation: 'Default Citation Style',
            latexStyle: 'Global LaTeX Rendering Style',
            writingPreferences: 'Writing Preferences',
            polishIntensity: 'AI Polish Intensity',
            polishLight: 'Light (Grammar)',
            polishModerate: 'Moderate (Style)',
            polishDeep: 'Deep (Rewrite)',
            defaultWritingLang: 'Default Writing Language',
            paragraphIndent: 'Paragraph Indent',
            indentFirst: 'First-line Indent',
            noIndent: 'No Indent',
            experimentDefaults: 'Experiment Parameter Defaults',
            xrdRadiation: 'XRD Default Radiation',
            xpsReference: 'XPS Energy Reference',
            semVoltage: 'SEM Default Voltage',
            temVoltage: 'TEM Default Voltage',
            experimentDefaultsHint: 'These defaults auto-populate when creating new characterizations and can be overridden per-module',
        },

        data: {
            title: 'Data & Visualization',
            defaultExportFormat: 'Default Export Format',
            defaultExportDPI: 'Default Export DPI',
            dpiStandard: 'Standard',
            dpiHD: 'High Definition',
            dpiPublication: 'Publication Grade',
            chartFont: 'Default Chart Font',
            colorPalette: 'Default Color Palette',
        },

        system: {
            license: 'Software License',
            activated: 'Activated',
            trial: 'Trial',
            expired: 'Expired',
            permanentLicense: 'Permanent License',
            activatedAt: 'Activated on',
            trialDaysRemaining: '{days} days remaining · 14-day free trial',
            enterActivationCode: 'Enter Activation Code',
            activate: 'Activate',
            getActivationCode: 'Get Activation Code →',
            activationSuccess: 'Activation Successful!',
            activationFailed: 'Activation Failed',

            interaction: 'Interaction & Notifications',
            enableNotifications: 'Enable Desktop Notifications',
            notificationsDesc: 'Task Completion Alerts',
            autoSave: 'Auto-Save Strategy',
            autoSaveRealtime: 'Real-time (1m)',
            autoSaveStandard: 'Standard (5m)',
            autoSaveLow: 'Low Frequency (15m)',
            autoSaveOff: 'Off',

            networkProxy: 'Network & Proxy',
            enableProxy: 'Enable HTTP Proxy',
            proxyDesc: 'Route AI Requests via Proxy',
            proxyAddress: 'Proxy Address',
            aiTimeout: 'AI Request Timeout',

            privacySecurity: 'Privacy & Security',
            confirmBeforeAI: 'AI Data Send Confirmation',
            confirmBeforeAIDesc: 'When enabled, a confirmation dialog appears before sending experimental data to AI',

            backupRestore: 'Backup & Restore',
            exportSettings: 'Export Settings',
            importSettings: 'Import Settings',
            exportHint: 'Export file contains all settings (including API Keys), please keep it safe',

            shortcuts: 'Keyboard Shortcuts',
            shortcutSearch: 'Global Search',
            shortcutAiCli: 'AI Command Line',
            shortcutSave: 'Save Document',
            shortcutUndo: 'Undo',
            shortcutRedo: 'Redo',
            shortcutScreenshot: 'Full Screenshot',
            shortcutSearchInChat: 'Search in Chat',
            shortcutCloseModal: 'Close Modal',
            shortcutsHint: 'Custom shortcuts not yet supported, planned for future versions',

            storage: 'Literature Storage',
            localLibraryPath: 'Default Local Library Path',
            storageHint: 'Root path for AI local archive retrieval',

            chatManagement: 'AI Chat Management',
            chatRetention: 'Chat History Retention',
            chatRetention7: '7 days',
            chatRetention30: '30 days (Default)',
            chatRetention90: '90 days',
            chatRetentionForever: 'Keep Forever',
            autoClearChat: 'Auto-Clear Expired Chats',

            windowBehavior: 'Window Behavior',
            restorePosition: 'Restore Window Position on Launch',
            rememberLastPage: 'Remember Last Visited Page',

            performance: 'Performance Tuning',
            gpuAcceleration: 'GPU Hardware Acceleration',
            cacheMaxSize: 'Max Cache Size',

            aboutUpdate: 'About & Updates',
            checkUpdate: 'Check for Updates',
            checking: 'Checking...',
            latestVersion: 'Already on the latest version ✨',
            newVersionFound: 'New version v{version} found!',
            downloadUpdate: 'Download Update',
            downloading: 'Downloading update...',
            downloaded: 'Download complete. Click below to restart and install!',
            installRestart: 'Restart & Install Now',
            updateError: 'Update check failed',
            updateNotAvailableHint: 'Click below to check for new versions',
            devModeHint: 'Auto-update not available in dev mode (packaged builds only)',

            dangerZone: 'Danger Zone',
            dangerZoneDesc: 'Remove all local data. This action is irreversible.',
            clearAllCache: 'Clear All Local Cache',
            clearCacheTitle: 'Clear all local data?',
            clearCacheDesc: 'This will erase all locally stored projects, literature, chat history, and configuration. This action cannot be undone. Please ensure you have backed up important data.',
        },
    },

    // ── Literature / Intel Archive ──
    literature: {
        title: 'Intel Archive',
        addLiterature: 'Add Literature',
        search: 'Search literature...',
        totalItems: '{count} items total',
    },

    // ── Team ──
    team: {
        title: 'Team Matrix',
        members: 'Members',
    },

    // ── AI Assistant ──
    aiAssistant: {
        title: 'AI Research Assistant',
        sendMessage: 'Send a message...',
        thinking: 'AI is thinking...',
        taskCancelled: 'Task cancelled',
        taskFailed: 'Task failed',
    },

    // ── Data Analysis ──
    dataAnalysis: {
        title: 'Data Analysis',
        importData: 'Import Data',
        exportChart: 'Export Chart',
    },

    // ── Writing Studio ──
    writing: {
        title: 'Writing Studio',
        newDocument: 'New Document',
    },

    // ── Figure Center ──
    figureCenter: {
        title: 'Figure Studio',
    },

    // ── Characterization ──
    characterization: {
        title: 'Characterization Hub',
    },

    // ── Inventory ──
    inventory: {
        title: 'Inventory Management',
    },

    // ── Mechanism ──
    mechanism: {
        title: 'Mechanism Engine',
    },

    // ── Toast Messages ──
    toast: {
        settingsImportSuccess: 'Settings imported successfully! The page will refresh to apply changes.',
        settingsImportFailed: 'Import failed: Invalid file format.',
        taskCancelled: 'Task cancelled',
        taskFailed: 'Task failed: {message}',
    },

    // ── Auth ──
    auth: {
        welcomeBack: 'Welcome Back',
        createAccount: 'Create Account',
        resetPassword: 'Reset Password',
        loginSubtitle: 'Sign in to continue using SciFlow Pro',
        registerSubtitle: 'Begin your research journey',
        resetSubtitle: 'Enter your email to receive a reset link',
        email: 'Email Address',
        password: 'Password',
        passwordHint: 'At least 6 characters',
        enterPassword: 'Enter password',
        forgotPassword: 'Forgot password?',
        login: 'Sign In',
        register: 'Create Account',
        sendResetEmail: 'Send Reset Email',
        processing: 'Processing…',
        or: 'or',
        wechat: 'WeChat',
        wechatComingSoon: '(Coming Soon)',
        noAccount: "Don't have an account?",
        signUpNow: 'Sign Up',
        hasAccount: 'Already have an account?',
        backToLogin: 'Back to Login',
        backArrow: '← Back to Login',
        registerSuccess: 'Registration successful! Please check your email to verify your account.',
        resetEmailSent: 'Password reset email sent. Please check your inbox.',
        operationFailed: 'Operation failed. Please try again later.',
        brandSubtitle: 'Next-Gen Research Workflow Platform',
        brandSlogan: 'AI-Powered · Data-Secure · Seamless Collaboration',
        featureExperiment: 'Experiment Mgmt',
        featureExperimentDesc: 'Full-cycle experiment tracking & analysis',
        featureData: 'Data Analysis',
        featureDataDesc: 'AI-driven intelligent data processing',
        featureWriting: 'Academic Writing',
        featureWritingDesc: 'Paper writing & typesetting in one',
        featureTeam: 'Team Collab',
        featureTeamDesc: 'Real-time collaboration & knowledge sharing',
    },
};

export default en;
