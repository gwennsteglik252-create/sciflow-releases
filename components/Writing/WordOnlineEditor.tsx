// ═══ WordOnlineEditor.tsx — 嵌入在线文档编辑器（多服务支持） ═══

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './word-online-editor.css';

interface WordOnlineEditorProps {
  isRightSidebarVisible?: boolean;
  onToggleRightSidebar?: () => void;
}

interface DocService {
  id: string;
  name: string;
  icon: string;
  color: string;
  homeUrl: string;
  newDocUrl: string;
  description: string;
}

const DOC_SERVICES: DocService[] = [
  {
    id: 'wps',
    name: 'WPS 在线文档',
    icon: 'fa-solid fa-file-lines',
    color: '#00a4ff',
    homeUrl: 'https://www.kdocs.cn/latest',
    newDocUrl: 'https://www.kdocs.cn/l/new/word',
    description: '金山文档，国内秒开',
  },
  {
    id: 'tencent',
    name: '腾讯文档',
    icon: 'fa-solid fa-file-word',
    color: '#1677ff',
    homeUrl: 'https://docs.qq.com/desktop',
    newDocUrl: 'https://docs.qq.com/doc/create',
    description: '微信登录，协作便捷',
  },
  {
    id: 'office',
    name: 'Office Online',
    icon: 'fa-solid fa-file-word',
    color: '#2b579a',
    homeUrl: 'https://www.office.com/launch/word',
    newDocUrl: 'https://word.new',
    description: '完整 Word，需海外网络',
  },
  {
    id: 'google',
    name: 'Google Docs',
    icon: 'fa-solid fa-file-word',
    color: '#4285f4',
    homeUrl: 'https://docs.google.com/document/u/0/',
    newDocUrl: 'https://docs.new',
    description: '功能强大，需 VPN',
  },
];

const STORAGE_KEY = 'sciflow_doc_service';
const WEBVIEW_ID = 'sciflow-word-webview';

// ─── 通过 DOM ID 获取 webview（React ref 对自定义元素不可靠） ───
function getWebview(): any | null {
  return document.getElementById(WEBVIEW_ID) as any;
}

const WordOnlineEditor: React.FC<WordOnlineEditorProps> = ({
  isRightSidebarVisible,
  onToggleRightSidebar,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeServiceId, setActiveServiceId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'wps';
  });
  const activeService = DOC_SERVICES.find(s => s.id === activeServiceId) || DOC_SERVICES[0];

  // webview 事件绑定（通过 DOM ID）
  useEffect(() => {
    let webview: any = null;
    let attempts = 0;

    const attach = () => {
      webview = getWebview();
      if (!webview) {
        if (attempts++ < 20) setTimeout(attach, 200);
        return;
      }
      console.log('[WordOnline] ✅ webview element found');

      webview.addEventListener('did-start-loading', onStartLoad);
      webview.addEventListener('did-stop-loading', onStopLoad);
      webview.addEventListener('did-navigate', onNavigate);
      webview.addEventListener('did-navigate-in-page', onNavigate);
      webview.addEventListener('did-fail-load', onFailLoad);
      webview.addEventListener('dom-ready', onDomReady);
      webview.addEventListener('new-window', onNewWindow);
    };

    const onStartLoad = () => {
      setIsLoading(true);
      setLoadError(null);
    };
    const onStopLoad = () => {
      setIsLoading(false);
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        setShowOverlay(false);
      }
      updateNav();
    };
    const onNavigate = () => {
      updateNav();
    };
    const onFailLoad = (e: any) => {
      if (e.errorCode !== -3) {
        console.error('[WordOnline] ❌ Load failed:', e.errorCode, e.errorDescription);
        setLoadError(`加载失败 (${e.errorCode}): ${e.errorDescription || '网络错误'}`);
        setIsLoading(false);
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true;
          setShowOverlay(false);
        }
      }
    };
    const onDomReady = () => {
      console.log('[WordOnline] 🟢 dom-ready');
    };
    // ─── 拦截 target="_blank" 链接，强制在同一 webview 内打开 ───
    const onNewWindow = (e: any) => {
      e.preventDefault();
      const url = e.url;
      if (url) {
        console.log('[WordOnline] 🔗 new-window intercepted →', url);
        const wv = getWebview();
        if (wv) {
          try { wv.loadURL(url); } catch {}
        }
      }
    };

    const updateNav = () => {
      const wv = getWebview();
      if (!wv) return;
      try {
        setCurrentUrl(wv.getURL());
        setPageTitle(wv.getTitle() || '');
        setCanGoBack(wv.canGoBack());
        setCanGoForward(wv.canGoForward());
      } catch {}
    };

    attach();

    return () => {
      if (webview) {
        try {
          webview.removeEventListener('did-start-loading', onStartLoad);
          webview.removeEventListener('did-stop-loading', onStopLoad);
          webview.removeEventListener('did-navigate', onNavigate);
          webview.removeEventListener('did-navigate-in-page', onNavigate);
          webview.removeEventListener('did-fail-load', onFailLoad);
          webview.removeEventListener('dom-ready', onDomReady);
          webview.removeEventListener('new-window', onNewWindow);
        } catch {}
      }
    };
  }, []);

  // 3 秒超时自动隐藏遮罩
  useEffect(() => {
    if (!showOverlay) return;
    const timer = setTimeout(() => {
      setShowOverlay(false);
      hasLoadedOnce.current = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [showOverlay]);

  // ─── 操作 ───
  const nav = useCallback((action: string, url?: string) => {
    const wv = getWebview();
    if (!wv) { console.warn('[WordOnline] webview not found'); return; }
    console.log(`[WordOnline] ${action}`, url || '');
    try {
      switch (action) {
        case 'back': wv.goBack(); break;
        case 'forward': wv.goForward(); break;
        case 'reload': setLoadError(null); wv.reload(); break;
        case 'load': if (url) wv.loadURL(url); break;
      }
    } catch (e) {
      console.error('[WordOnline] action failed:', e);
    }
  }, []);

  const switchService = useCallback((serviceId: string) => {
    setActiveServiceId(serviceId);
    localStorage.setItem(STORAGE_KEY, serviceId);
    setShowServicePicker(false);
    setLoadError(null);
    const service = DOC_SERVICES.find(s => s.id === serviceId);
    if (service) nav('load', service.homeUrl);
  }, [nav]);

  // 地址栏
  const [urlInput, setUrlInput] = useState('');
  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      let url = urlInput.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      nav('load', url);
    }
  }, [urlInput, nav]);

  const displayUrl = currentUrl || activeService.homeUrl;

  return (
    <div className="word-online-container">
      {/* ─── 控制栏 ─── */}
      <div className="word-online-toolbar">
        <div className="word-online-toolbar-left">
          {onToggleRightSidebar && (
            <button onClick={onToggleRightSidebar}
              className={`word-online-btn ${!isRightSidebarVisible ? 'active' : ''}`}
              title={isRightSidebarVisible ? '收起侧边栏' : '展开侧边栏'}>
              <i className={`fa-solid ${!isRightSidebarVisible ? 'fa-indent' : 'fa-outdent'}`} />
            </button>
          )}
          <div className="word-online-divider" />

          <button onClick={() => nav('back')} disabled={!canGoBack} className="word-online-btn" title="后退">
            <i className="fa-solid fa-arrow-left" />
          </button>
          <button onClick={() => nav('forward')} disabled={!canGoForward} className="word-online-btn" title="前进">
            <i className="fa-solid fa-arrow-right" />
          </button>
          <button onClick={() => nav('reload')} className="word-online-btn" title="刷新">
            <i className={`fa-solid ${isLoading ? 'fa-spinner animate-spin' : 'fa-rotate-right'}`} />
          </button>
          <button onClick={() => nav('load', activeService.homeUrl)} className="word-online-btn" title="主页">
            <i className="fa-solid fa-house" />
          </button>
          <div className="word-online-divider" />

          {/* ─── 本地 Word 按钮 ─── */}
          <button onClick={async () => {
            try {
              const result = await (window as any).electron?.openInWord?.();
              if (result?.success) console.log('[WordOnline] ✅ 已用 Word 打开:', result.name);
            } catch (e) { console.error(e); }
          }} className="word-online-btn word-online-btn-local" title="选择文件 → 用本地 Word 打开">
            <i className="fa-solid fa-folder-open" />
            <span>用 Word 打开</span>
          </button>

          <button onClick={async () => {
            try {
              const result = await (window as any).electron?.createNewDocx?.();
              if (result?.success) console.log('[WordOnline] ✅ 已创建并打开:', result.name);
            } catch (e) { console.error(e); }
          }} className="word-online-btn word-online-btn-local" title="新建空白 .docx → 用本地 Word 打开">
            <i className="fa-solid fa-file-circle-plus" />
            <span>新建 Word</span>
          </button>

          <div className="word-online-divider" />

          {/* ─── 在线新建 ─── */}
          <button onClick={() => nav('load', activeService.newDocUrl)}
            className="word-online-btn word-online-btn-primary" title="在线新建文档"
            style={{ background: activeService.color }}>
            <i className="fa-solid fa-plus" />
            <span>在线新建</span>
          </button>
          <div className="word-online-divider" />

          {/* 服务切换器 */}
          <div className="word-online-service-picker-wrapper">
            <button className="word-online-btn word-online-service-btn"
              onClick={() => setShowServicePicker(!showServicePicker)}
              style={{ color: activeService.color }}>
              <i className={activeService.icon} />
              <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4 }}>{activeService.name}</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: 8, marginLeft: 4, opacity: 0.6 }} />
            </button>
            {showServicePicker && (
              <div className="word-online-service-dropdown">
                {DOC_SERVICES.map(s => (
                  <button key={s.id}
                    className={`word-online-service-item ${s.id === activeServiceId ? 'active' : ''}`}
                    onClick={() => switchService(s.id)}>
                    <i className={s.icon} style={{ color: s.color, width: 16, textAlign: 'center' }} />
                    <div className="word-online-service-info">
                      <div className="word-online-service-name">{s.name}</div>
                      <div className="word-online-service-desc">{s.description}</div>
                    </div>
                    {s.id === activeServiceId && <i className="fa-solid fa-check" style={{ color: s.color, fontSize: 11 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 地址栏 */}
        <div className="word-online-toolbar-center">
          <form className="word-online-url-bar" onSubmit={handleUrlSubmit}>
            <i className="fa-solid fa-lock" style={{ color: '#16a34a', fontSize: 10, marginRight: 4, flexShrink: 0 }} />
            <input className="word-online-url-input"
              value={urlInput || displayUrl}
              onChange={e => setUrlInput(e.target.value)}
              onFocus={() => setUrlInput(displayUrl)}
              onBlur={() => setUrlInput('')}
              placeholder="输入网址..." />
            {isLoading && <span className="word-online-loading-dot" />}
          </form>
        </div>

        <div className="word-online-toolbar-right">
          <button onClick={() => window.open(displayUrl, '_blank')} className="word-online-btn" title="在浏览器中打开">
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </button>
        </div>
      </div>

      {/* ─── webview ─── */}
      <div className="word-online-webview-wrapper">
        <webview
          id={WEBVIEW_ID}
          src={activeService.homeUrl}
          className="word-online-webview"
          /* @ts-ignore */
          allowpopups="true"
          partition="persist:word-online"
        />

        {loadError && (
          <div className="word-online-error-overlay">
            <div className="word-online-loading-content">
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 36, color: '#ef4444', marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{loadError}</p>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>试试切换到其他文档服务</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="word-online-skip-btn" onClick={() => { setLoadError(null); nav('reload'); }}>重试</button>
                <button className="word-online-skip-btn" onClick={() => setShowServicePicker(true)}>切换服务</button>
              </div>
            </div>
          </div>
        )}

        {showOverlay && (
          <div className="word-online-loading-overlay">
            <div className="word-online-loading-content">
              <i className={`${activeService.icon} word-online-loading-icon`} style={{ color: activeService.color }} />
              <p>正在加载 {activeService.name}...</p>
              <div className="word-online-loading-bar">
                <div className="word-online-loading-bar-inner" style={{ background: activeService.color }} />
              </div>
              <button className="word-online-skip-btn" onClick={() => { setShowOverlay(false); hasLoadedOnce.current = true; }}>跳过</button>
            </div>
          </div>
        )}
      </div>

      {showServicePicker && <div className="word-online-backdrop" onClick={() => setShowServicePicker(false)} />}
    </div>
  );
};

export default WordOnlineEditor;
