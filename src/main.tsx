import React from 'react';
import ReactDOM from 'react-dom/client';
import { LoginGate } from './presentation/auth/login-gate';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LoginGate />
  </React.StrictMode>
);
