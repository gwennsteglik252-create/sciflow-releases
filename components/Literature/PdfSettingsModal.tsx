import React, { useState, useEffect } from 'react';
import {
  getScihubMirror, setScihubMirror,
  getAutoDownloadEnabled, setAutoDownloadEnabled,
  getWytsgConfig, setWytsgConfig, testWytsgConnection,
  getCampusDoiEnabled, setCampusDoiEnabled,
  getPdfDownloadDir, setPdfDownloadDir, selectPdfDownloadDir,
  openWytsgLogin, getWytsgLoginStatus,
  autoWytsgLogin, saveWytsgCredentials, getWytsgCredentials,
  type WytsgConfig
} from '../../services/pdfDownloader';

interface PdfSettingsModalProps {
  onClose: () => void;
}

const PdfSettingsModal: React.FC<PdfSettingsModalProps> = ({ onClose }) => {
  const [mirror, setMirrorLocal] = useState(getScihubMirror());
  const [autoDownload, setAutoDownloadLocal] = useState(getAutoDownloadEnabled());
  const [campusDoi, setCampusDoiLocal] = useState(getCampusDoiEnabled());
  const [saved, setSaved] = useState(false);

  // wytsg 图书馆通道状态
  const wytsgInit = getWytsgConfig();
  const [wytsgEnabled, setWytsgEnabled] = useState(wytsgInit.enabled);
  const [wytsgTesting, setWytsgTesting] = useState(false);
  const [wytsgTestResult, setWytsgTestResult] = useState<{ ok: boolean; mirrorUrl?: string } | null>(null);
  // WebView 登录状态
  const [wytsgLoggedIn, setWytsgLoggedIn] = useState(false);
  const [wytsgLoginExpired, setWytsgLoginExpired] = useState(false);
  const [wytsgLoggingIn, setWytsgLoggingIn] = useState(false);
  const [wytsgChecking, setWytsgChecking] = useState(true);
  // 自动登录
  const [wytsgUsername, setWytsgUsername] = useState('');
  const [wytsgPassword, setWytsgPassword] = useState('');
  const [wytsgAutoStatus, setWytsgAutoStatus] = useState('');
  const [wytsgCredSaved, setWytsgCredSaved] = useState(false);

  // 下载目录
  const [downloadDir, setDownloadDir] = useState('');

  useEffect(() => {
    getPdfDownloadDir().then(setDownloadDir);
    // 检查 wytsg 登录状态
    setWytsgChecking(true);
    getWytsgLoginStatus().then(status => {
      setWytsgLoggedIn(status.loggedIn);
      setWytsgLoginExpired(status.expired || false);
    }).finally(() => setWytsgChecking(false));
    // 加载已保存的凭据
    getWytsgCredentials().then(cred => {
      if (cred.saved) {
        setWytsgUsername(cred.username || '');
        setWytsgPassword(cred.password || '');
        setWytsgCredSaved(true);
      }
    });
  }, []);

  const handleSave = () => {
    setScihubMirror(mirror.trim());
    setAutoDownloadEnabled(autoDownload);
    setCampusDoiEnabled(campusDoi);
    setWytsgConfig({
      enabled: wytsgEnabled,
    });
    if (downloadDir) {
      setPdfDownloadDir(downloadDir);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestWytsg = async () => {
    setWytsgTesting(true);
    setWytsgTestResult(null);
    try {
      const result = await testWytsgConnection();
      setWytsgTestResult({ ok: result.ok, mirrorUrl: result.mirrorUrl });
    } catch {
      setWytsgTestResult({ ok: false });
    } finally {
      setWytsgTesting(false);
    }
  };

  const handleSelectDir = async () => {
    const dir = await selectPdfDownloadDir();
    if (dir) setDownloadDir(dir);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[450px] max-h-[85vh] overflow-y-auto overflow-x-hidden animate-reveal"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <i className="fa-solid fa-file-pdf text-rose-500"></i>
            全文下载设置
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Download Directory */}
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <i className="fa-solid fa-folder-open text-slate-400"></i>
              下载保存目录
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={downloadDir}
                onChange={e => setDownloadDir(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all truncate"
                readOnly
              />
              <button
                onClick={handleSelectDir}
                className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all whitespace-nowrap"
              >
                <i className="fa-solid fa-folder-open mr-1"></i>
                选择
              </button>
            </div>
            <p className="text-[8px] text-slate-400 mt-1">
              PDF 全文将下载到此目录。默认：~/Documents/SciFlow-PDFs/
            </p>
          </div>

          {/* 校园网/VPN 直链 */}
          <div className={`rounded-xl p-3 border transition-all ${campusDoi ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className={`fa-solid fa-wifi text-xs ${campusDoi ? 'text-violet-500' : 'text-slate-400'}`}></i>
                <div>
                  <p className={`text-[10px] font-black uppercase ${campusDoi ? 'text-violet-700' : 'text-slate-500'}`}>校园网 / VPN 直链</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">连接高校 WiFi 或 VPN 后，直接从出版商下载 PDF。支持 Elsevier/Springer/Nature/Wiley/ACS/IEEE 等。</p>
                </div>
              </div>
              <button
                onClick={() => setCampusDoiLocal(!campusDoi)}
                className={`w-10 h-6 rounded-full transition-all flex items-center flex-shrink-0 ${campusDoi ? 'bg-violet-500 justify-end' : 'bg-slate-300 justify-start'}`}
              >
                <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5"></div>
              </button>
            </div>
          </div>

          {/* Unpaywall Info */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-unlock text-emerald-500 text-xs"></i>
              <p className="text-[10px] font-black text-emerald-700 uppercase">Unpaywall (默认启用)</p>
            </div>
            <p className="text-[9px] text-emerald-600 leading-relaxed">
              自动通过 Unpaywall API 查询 Open Access 全文链接。完全免费、合法，覆盖约 30% 的学术论文。
            </p>
          </div>

          {/* Sci-Hub Mirror */}
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <i className="fa-solid fa-globe text-slate-400"></i>
              Sci-Hub 镜像地址 (可选)
            </label>
            <input
              type="text"
              value={mirror}
              onChange={e => setMirrorLocal(e.target.value)}
              placeholder="如：https://sci-hub.se"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
            />
            <p className="text-[8px] text-slate-400 mt-1 leading-relaxed">
              当 Unpaywall 无结果时，将通过此镜像地址尝试获取全文。请自行确认所在地区的合规性。
            </p>
          </div>

          {/* ═══ wytsg 图书馆通道 ═══ */}
          <div className={`rounded-xl p-3 border transition-all ${wytsgEnabled ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <i className={`fa-solid fa-building-columns text-xs ${wytsgEnabled ? 'text-blue-500' : 'text-slate-400'}`}></i>
                <p className={`text-[10px] font-black uppercase ${wytsgEnabled ? 'text-blue-700' : 'text-slate-500'}`}>图书馆通道</p>
              </div>
              <button
                onClick={() => setWytsgEnabled(!wytsgEnabled)}
                className={`w-10 h-6 rounded-full transition-all flex items-center ${wytsgEnabled ? 'bg-blue-500 justify-end' : 'bg-slate-300 justify-start'}`}
              >
                <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5"></div>
              </button>
            </div>
            <p className="text-[8px] text-slate-500 leading-relaxed mb-3">
              通过 wytsg.com 图书馆的授权通道下载外文期刊全文。
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); (window as any).electron?.openExternal?.('http://www.wytsg.com') || window.open('http://www.wytsg.com', '_blank'); }}
                className="text-blue-500 hover:text-blue-700 underline ml-1 font-bold"
              >
                前往注册账号 →
              </a>
            </p>

            {/* 登录区域 */}
            <div className="space-y-2.5" style={{ opacity: wytsgEnabled ? 1 : 0.4, pointerEvents: wytsgEnabled ? 'auto' : 'none' }}>
              {/* 账号密码输入 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 block">账号</label>
                  <input
                    type="text"
                    value={wytsgUsername}
                    onChange={e => setWytsgUsername(e.target.value)}
                    placeholder="wytsg.com 用户名"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 block">密码</label>
                  <input
                    type="password"
                    value={wytsgPassword}
                    onChange={e => setWytsgPassword(e.target.value)}
                    placeholder="密码"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                  />
                </div>
              </div>

              {/* 登录状态 */}
              <div className="flex items-center gap-1.5">
                {wytsgChecking && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                    <i className="fa-solid fa-spinner fa-spin text-[7px]"></i>
                    检查登录状态...
                  </div>
                )}
                {!wytsgChecking && wytsgLoggedIn && !wytsgLoginExpired && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                    <i className="fa-solid fa-check-circle"></i>
                    已登录（持久有效）
                  </div>
                )}
                {!wytsgChecking && wytsgLoginExpired && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600">
                    <i className="fa-solid fa-clock"></i>
                    已过期，请重新登录
                  </div>
                )}
                {!wytsgChecking && !wytsgLoggedIn && !wytsgLoginExpired && (
                  <span className="text-[8px] text-slate-400">未登录</span>
                )}
                {wytsgCredSaved && (
                  <span className="text-[7px] text-blue-400 ml-auto">（账号已保存）</span>
                )}
              </div>

              {/* 按钮组 */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* 一键自动登录 */}
                <button
                  onClick={async () => {
                    if (!wytsgUsername || !wytsgPassword) return;
                    setWytsgLoggingIn(true);
                    setWytsgAutoStatus('');
                    try {
                      // 先保存凭据
                      await saveWytsgCredentials(wytsgUsername, wytsgPassword);
                      setWytsgCredSaved(true);
                      // 自动登录
                      const result = await autoWytsgLogin(
                        wytsgUsername, wytsgPassword, 3,
                        (msg) => setWytsgAutoStatus(msg),
                      );
                      if (result.success) {
                        setWytsgLoggedIn(true);
                        setWytsgLoginExpired(false);
                        setWytsgAutoStatus('✅ 登录成功！');
                      } else {
                        setWytsgAutoStatus(`❌ ${result.error}`);
                      }
                    } catch {
                      setWytsgAutoStatus('❌ 自动登录出错');
                    }
                    setWytsgLoggingIn(false);
                  }}
                  disabled={wytsgLoggingIn || !wytsgUsername || !wytsgPassword}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <i className={`fa-solid ${wytsgLoggingIn ? 'fa-spinner fa-spin' : 'fa-robot'} text-[8px]`}></i>
                  {wytsgLoggingIn ? '自动登录中...' : 'AI 一键登录'}
                </button>

                {/* 手动登录（备选） */}
                <button
                  onClick={async () => {
                    setWytsgLoggingIn(true);
                    try {
                      const result = await openWytsgLogin();
                      if (result.success) {
                        setWytsgLoggedIn(true);
                        setWytsgLoginExpired(false);
                      }
                    } catch { }
                    setWytsgLoggingIn(false);
                  }}
                  disabled={wytsgLoggingIn}
                  className="px-3 py-2 rounded-lg text-[8px] font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-[7px]"></i>
                  手动登录
                </button>

                {/* 测试连接 */}
                <button
                  onClick={handleTestWytsg}
                  disabled={wytsgTesting}
                  className="px-3 py-2 rounded-lg text-[8px] font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 transition-all flex items-center gap-1"
                >
                  <i className={`fa-solid ${wytsgTesting ? 'fa-spinner fa-spin' : 'fa-plug'} text-[7px]`}></i>
                  {wytsgTesting ? '测试中...' : '测试连接'}
                </button>
                {wytsgTestResult && (
                  <div className={`flex items-center gap-1 text-[8px] font-bold ${wytsgTestResult.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
                    <i className={`fa-solid ${wytsgTestResult.ok ? 'fa-check-circle' : 'fa-xmark-circle'}`}></i>
                    {wytsgTestResult.ok ? '可用' : '连接失败'}
                  </div>
                )}
              </div>

              {/* 自动登录状态消息 */}
              {wytsgAutoStatus && (
                <p className="text-[8px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1.5">
                  <i className="fa-solid fa-robot text-blue-400 mr-1"></i>
                  {wytsgAutoStatus}
                </p>
              )}
            </div>
          </div>

          {/* Auto Download Toggle */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div>
              <p className="text-[10px] font-black text-slate-700 uppercase">导入时自动下载</p>
              <p className="text-[8px] text-slate-400 mt-0.5">导入文献后自动尝试获取全文 PDF</p>
            </div>
            <button
              onClick={() => setAutoDownloadLocal(!autoDownload)}
              className={`w-10 h-6 rounded-full transition-all flex items-center ${autoDownload ? 'bg-indigo-500 justify-end' : 'bg-slate-300 justify-start'}`}
            >
              <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5"></div>
            </button>
          </div>

          {/* Download Priority Info */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2">下载优先级</p>
            <div className="flex items-center gap-1.5 text-[9px] flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-bold ${campusDoi ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                ① 校园网 {!campusDoi && '(未启用)'}
              </span>
              <i className="fa-solid fa-chevron-right text-[6px] text-slate-300"></i>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">② Unpaywall</span>
              <i className="fa-solid fa-chevron-right text-[6px] text-slate-300"></i>
              <span className={`px-2 py-0.5 rounded-full font-bold ${mirror ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                ③ Sci-Hub {!mirror && '(未配置)'}
              </span>
              <i className="fa-solid fa-chevron-right text-[6px] text-slate-300"></i>
              <span className={`px-2 py-0.5 rounded-full font-bold ${wytsgEnabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                ④ 图书馆 {!wytsgEnabled && '(未启用)'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-slate-100 transition-all">取消</button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            <i className={`fa-solid ${saved ? 'fa-check' : 'fa-floppy-disk'} text-[9px]`}></i>
            {saved ? '已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfSettingsModal;
