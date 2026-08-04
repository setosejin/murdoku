import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ponytail: 상대 경로. 라우터가 없어서 /murdoku/ 든 루트든 그냥 붙는다.
  // 라우팅이 생기면 base: '/murdoku/' 로 고정할 것.
  base: './',
  // 진입점이 둘이다 — 게임(index.html)과 관리 화면(admin.html).
  // 라우터를 얹는 대신 Vite 의 MPA 를 쓴다: 관리 화면 코드가 게임 번들에 안 실린다
  build: { rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
  // Vitest 는 기본으로 CSS 를 빈 스텁으로 갈아치우는데, 그게 `?raw` 까지 먹어서
  // 스타일을 읽는 테스트가 조용히 빈 문자열을 보고 통과해버린다. 켜야 원문이 온다
  test: { css: true },
  // 배포된 빌드가 자기 버전을 말할 수 있게 package.json 버전을 심는다
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
