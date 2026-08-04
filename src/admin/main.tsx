import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 게임과 같은 디자인 언어를 그대로 쓴다. 관리 화면 전용 규칙만 admin.css 에 얹는다.
// 진입점이 다르므로 index.css 의 @import 목록에는 넣지 않는다 — 넣으면 게임 번들에도 실린다
import '../index.css';
import '../styles/admin.css';
import AdminApp from './AdminApp.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
