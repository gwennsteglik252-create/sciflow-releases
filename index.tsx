
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Tailwind CSS 构建入口
import './services/apiBridge'; // 注册 window.__sciflowAPI__（供本地 HTTP API Server 使用）
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
