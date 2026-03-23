import React, { useState, useEffect } from 'react';
import { getEpoSettings, saveEpoSettings, testEpoConnection, EpoSettings } from '../../services/patentApi';

interface EpoSettingsModalProps {
    onClose: () => void;
}

const EpoSettingsModal: React.FC<EpoSettingsModalProps> = ({ onClose }) => {
    const [settings, setSettings] = useState<EpoSettings>({ consumerKey: '', consumerSecret: '', enabled: false });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setSettings(getEpoSettings());
    }, []);

    const handleSave = () => {
        saveEpoSettings(settings);
        setSaved(true);
        setTestResult(null);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleTest = async () => {
        // 先保存再测试
        saveEpoSettings(settings);
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testEpoConnection();
            setTestResult(result);
        } catch (err: any) {
            setTestResult({ success: false, message: err.message || '连接测试失败' });
        }
        setTesting(false);
    };

    const isConfigured = settings.consumerKey && settings.consumerSecret;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                                <i className="fa-solid fa-shield-check text-white text-sm" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 leading-tight">EPO OPS 配置</h3>
                                <p className="text-[10px] text-slate-400 font-bold">European Patent Office · Open Patent Services</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="mx-8 mb-4">
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        settings.enabled && isConfigured
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                        <i className={`fa-solid ${settings.enabled && isConfigured ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-slate-400'}`} />
                        {settings.enabled && isConfigured ? '已启用 · 专利数据由 EPO 真实数据驱动' : '未启用 · 使用 AI 搜索回退方案'}
                    </div>
                </div>

                {/* Form */}
                <div className="px-8 space-y-4">
                    {/* Enable Toggle */}
                    <label className="flex items-center justify-between cursor-pointer group">
                        <div>
                            <span className="text-sm font-bold text-slate-700">启用 EPO 真实数据源</span>
                            <p className="text-[9px] text-slate-400 mt-0.5">启用后将优先从 EPO 获取真实专利数据</p>
                        </div>
                        <div
                            onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                            className={`w-11 h-6 rounded-full relative transition-all cursor-pointer ${settings.enabled ? 'bg-cyan-600' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                        </div>
                    </label>

                    {/* Key Inputs */}
                    <div className={`space-y-3 transition-opacity ${settings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 block">Consumer Key</label>
                            <input
                                type="text"
                                value={settings.consumerKey}
                                onChange={e => setSettings(s => ({ ...s, consumerKey: e.target.value }))}
                                placeholder="输入 EPO Developer Portal 的 Consumer Key"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all placeholder:text-slate-300"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 block">Consumer Secret</label>
                            <input
                                type="password"
                                value={settings.consumerSecret}
                                onChange={e => setSettings(s => ({ ...s, consumerSecret: e.target.value }))}
                                placeholder="输入 EPO Developer Portal 的 Consumer Secret"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold ${
                            testResult.success
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                            <i className={`fa-solid ${testResult.success ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
                            {testResult.message}
                        </div>
                    )}

                    {/* Saved toast */}
                    {saved && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-reveal">
                            <i className="fa-solid fa-check" /> 配置已保存
                        </div>
                    )}
                </div>

                {/* Registration Guide */}
                <div className="mx-8 mt-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1">
                        <i className="fa-solid fa-graduation-cap text-cyan-500" /> 如何获取 EPO Key
                    </p>
                    <ol className="text-[10px] text-slate-500 space-y-1 list-decimal list-inside">
                        <li>访问 <a href="https://developers.epo.org" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline font-bold hover:text-cyan-700">EPO Developer Portal</a> 免费注册账号</li>
                        <li>创建一个新应用 (Create App)</li>
                        <li>复制生成的 Consumer Key 和 Consumer Secret</li>
                        <li>粘贴到上方输入框，点击"保存并测试"</li>
                    </ol>
                    <p className="text-[9px] text-slate-400 mt-2 italic">
                        💡 EPO OPS 免费使用，覆盖全球 1.4 亿+ 专利，每周 4GB 数据配额
                    </p>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 flex items-center justify-between mt-2">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        关闭
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTest}
                            disabled={testing || !isConfigured || !settings.enabled}
                            className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                        >
                            {testing ? (
                                <><i className="fa-solid fa-spinner animate-spin text-[8px]" /> 测试中...</>
                            ) : (
                                <><i className="fa-solid fa-plug text-[8px]" /> 测试连接</>
                            )}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-floppy-disk text-[8px]" /> 保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EpoSettingsModal;
