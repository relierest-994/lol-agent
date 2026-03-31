import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="web-disabled-shell">
      <section className="web-disabled-card">
        <h1>Web 已停用</h1>
        <p>当前项目仅保留移动端（Expo）功能。</p>
      </section>
    </main>
  </React.StrictMode>
);
