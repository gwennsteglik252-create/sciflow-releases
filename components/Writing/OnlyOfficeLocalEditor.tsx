// ═══ OnlyOfficeLocalEditor.tsx — 嵌入本地 OnlyOffice WebAssembly 编辑器 ═══

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface OnlyOfficeLocalEditorProps {
  isRightSidebarVisible?: boolean;
  onToggleRightSidebar?: () => void;
}

const DEFAULT_SERVER_URL = 'https://sweetwisdom.github.io/onlyoffice-web-local/';
const STORAGE_KEY = 'sciflow_onlyoffice_url';
const WEBVIEW_ID = 'sciflow-onlyoffice-webview';

function getWebview(): any | null {
  return document.getElementById(WEBVIEW_ID) as any;
}

const OnlyOfficeLocalEditor: React.FC<OnlyOfficeLocalEditorProps> = ({
  isRightSidebarVisible,
  onToggleRightSidebar,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // 如果缓存是旧的 localhost 地址，自动迁移到线上 demo
    if (stored && stored.includes('localhost:8080')) {
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_SERVER_URL;
    }
    return stored || DEFAULT_SERVER_URL;
  });
  const [urlInput, setUrlInput] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const hasLoadedOnce = useRef(false);

  // webview 事件绑定
  useEffect(() => {
    let webview: any = null;
    let attempts = 0;

    const attach = () => {
      webview = getWebview();
      if (!webview) {
        if (attempts++ < 20) setTimeout(attach, 200);
        return;
      }
      webview.addEventListener('did-start-loading', onStartLoad);
      webview.addEventListener('did-stop-loading', onStopLoad);
      webview.addEventListener('did-navigate', onNavigate);
      webview.addEventListener('did-navigate-in-page', onNavigate);
      webview.addEventListener('did-fail-load', onFailLoad);
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
    const onNavigate = () => updateNav();
    const onFailLoad = (e: any) => {
      if (e.errorCode !== -3) {
        setLoadError(`连接失败 — 请确认 OnlyOffice 本地服务已启动`);
        setIsLoading(false);
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true;
          setShowOverlay(false);
        }
      }
    };
    const onNewWindow = (e: any) => {
      e.preventDefault();
      const url = e.url;
      if (url) {
        const wv = getWebview();
        if (wv) { try { wv.loadURL(url); } catch {} }
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

  const nav = useCallback((action: string, url?: string) => {
    const wv = getWebview();
    if (!wv) return;
    try {
      switch (action) {
        case 'back': wv.goBack(); break;
        case 'forward': wv.goForward(); break;
        case 'reload': setLoadError(null); wv.reload(); break;
        case 'load': if (url) wv.loadURL(url); break;
      }
    } catch {}
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      let url = urlInput.trim();
      if (!url.startsWith('http')) url = 'http://' + url;
      setServerUrl(url);
      localStorage.setItem(STORAGE_KEY, url);
      nav('load', url);
    }
  }, [urlInput, nav]);

  const handleChangeServer = useCallback((url: string) => {
    setServerUrl(url);
    localStorage.setItem(STORAGE_KEY, url);
    setLoadError(null);
    nav('load', url);
  }, [nav]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', borderRadius: '1.25rem', overflow: 'hidden' }}>
      {/* ─── 控制栏 ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        {/* 左侧控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onToggleRightSidebar && (
            <button onClick={onToggleRightSidebar}
              style={{ ...btnStyle, color: !isRightSidebarVisible ? '#f97316' : 'rgba(255,255,255,0.6)' }}
              title={isRightSidebarVisible ? '收起侧边栏' : '展开侧边栏'}>
              <i className={`fa-solid ${!isRightSidebarVisible ? 'fa-indent' : 'fa-outdent'}`} />
            </button>
          )}
          <div style={dividerStyle} />
          <button onClick={() => nav('back')} disabled={!canGoBack} style={btnStyle} title="后退">
            <i className="fa-solid fa-arrow-left" />
          </button>
          <button onClick={() => nav('forward')} disabled={!canGoForward} style={btnStyle} title="前进">
            <i className="fa-solid fa-arrow-right" />
          </button>
          <button onClick={() => nav('reload')} style={btnStyle} title="刷新">
            <i className={`fa-solid ${isLoading ? 'fa-spinner animate-spin' : 'fa-rotate-right'}`} />
          </button>
          <button onClick={() => handleChangeServer(DEFAULT_SERVER_URL)} style={btnStyle} title="重置为默认地址">
            <i className="fa-solid fa-house" />
          </button>
        </div>

        {/* 地址栏 */}
        <form onSubmit={handleUrlSubmit} style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '4px 10px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <i className="fa-solid fa-server" style={{ color: '#f97316', fontSize: 10, flexShrink: 0 }} />
          <input
            value={urlInput || currentUrl || serverUrl}
            onChange={e => setUrlInput(e.target.value)}
            onFocus={() => setUrlInput(currentUrl || serverUrl)}
            onBlur={() => setUrlInput('')}
            placeholder="OnlyOffice 服务地址..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
            }}
          />
          {isLoading && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', animation: 'pulse 1s infinite' }} />}
        </form>

        {/* 右侧 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => window.open(currentUrl || serverUrl, '_blank')} style={btnStyle} title="在浏览器中打开">
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </button>
        </div>
      </div>

      {/* ─── webview ─── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <webview
          id={WEBVIEW_ID}
          src={serverUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          /* @ts-ignore */
          allowpopups="true"
          partition="persist:onlyoffice-local"
        />

        {/* 加载错误 → 配置引导 */}
        {loadError && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)',
          }}>
            <div style={{ textAlign: 'center', maxWidth: 420, padding: 32 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                boxShadow: '0 8px 32px rgba(249,115,22,0.3)',
              }}>
                <i className="fa-solid fa-server" style={{ fontSize: 24, color: 'white' }} />
              </div>
              <h3 style={{ color: 'white', fontSize: 16, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
                OnlyOffice 本地服务未启动
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.6, marginBottom: 20 }}>
                请先通过以下方式之一启动 OnlyOffice 本地服务：
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16,
                textAlign: 'left', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ color: '#f97316', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>方式一：Docker（推荐）</span>
                  <pre style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`docker run -d -p 8080:80 \\
  sweetwisdom/onlyoffice-web-local`}
                  </pre>
                </div>
                <div>
                  <span style={{ color: '#f97316', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>方式二：npm</span>
                  <pre style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{`npx onlyoffice-web-local`}
                  </pre>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleChangeServer(DEFAULT_SERVER_URL)}
                  style={{
                    padding: '10px 24px', background: '#f97316', color: 'white', border: 'none',
                    borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    textTransform: 'uppercase' as const, letterSpacing: 0.5,
                  }}>
                  使用在线版
                </button>
                <button
                  onClick={() => { setLoadError(null); nav('reload'); }}
                  style={{
                    padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    textTransform: 'uppercase' as const, letterSpacing: 0.5,
                  }}>
                  重试连接
                </button>
                <button
                  onClick={() => {
                    const url = window.prompt('输入 OnlyOffice 服务地址：', serverUrl);
                    if (url) handleChangeServer(url);
                  }}
                  style={{
                    padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    textTransform: 'uppercase' as const, letterSpacing: 0.5,
                  }}>
                  更改地址
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 加载遮罩 */}
        {showOverlay && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                animation: 'pulse 2s ease-in-out infinite',
                boxShadow: '0 8px 32px rgba(249,115,22,0.3)',
              }}>
                <i className="fa-solid fa-file-word" style={{ fontSize: 22, color: 'white' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700 }}>
                正在连接 OnlyOffice...
              </p>
              <div style={{
                width: 120, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2,
                margin: '12px auto', overflow: 'hidden',
              }}>
                <div style={{
                  width: '40%', height: '100%', background: '#f97316', borderRadius: 2,
                  animation: 'loading-bar 1.5s ease-in-out infinite',
                }} />
              </div>
              <button
                onClick={() => { setShowOverlay(false); hasLoadedOnce.current = true; }}
                style={{
                  marginTop: 12, padding: '6px 16px', background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>
                跳过
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};

// 共用按钮样式
const btnStyle: React.CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', borderRadius: 8,
  color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer',
  transition: 'all 0.15s',
};

const dividerStyle: React.CSSProperties = {
  width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px',
};

export default OnlyOfficeLocalEditor;
