import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ponytail: 상대 경로. 라우터가 없어서 /murdoku/ 든 루트든 그냥 붙는다.
  // 라우팅이 생기면 base: '/murdoku/' 로 고정할 것.
  base: './',
  // 배포된 빌드가 자기 버전을 말할 수 있게 package.json 버전을 심는다
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
