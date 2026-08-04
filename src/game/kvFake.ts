/**
 * 테스트용 가짜 KV. 워커 테스트가 셋(기록·순위표·관리자)이라 한 군데서 만든다.
 * 앱도 워커도 이 파일을 import 하지 않는다 — 번들에는 안 들어간다.
 */

/** 진짜 KV 는 1000개씩 끊어준다. 여기서는 2개씩 끊어 커서 루프를 실제로 돌게 한다 */
const PAGE = 2;

export function fakeEnv(vars: { ORIGIN?: string; ADMIN_TOKEN?: string } = {}) {
  const store = new Map<string, string>();
  let writes = 0;
  return {
    ...vars,
    HISTORY: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => {
        writes++;
        store.set(k, v);
      },
      delete: async (k: string) => {
        store.delete(k);
      },
      list: async ({ cursor }: { cursor?: string } = {}) => {
        const names = [...store.keys()].sort();
        const from = cursor === undefined ? 0 : Number(cursor);
        const done = from + PAGE >= names.length;
        return {
          keys: names.slice(from, from + PAGE).map((name) => ({ name })),
          list_complete: done,
          ...(done ? {} : { cursor: String(from + PAGE) }),
        };
      },
    },
    writes: () => writes,
    keys: () => [...store.keys()].sort(),
  };
}
