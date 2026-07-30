import { useRef, type ReactNode } from 'react';
import changelog from '../../CHANGELOG.md?raw';

/**
 * CHANGELOG.md 전용 마크다운 렌더러.
 * ponytail: 우리가 직접 쓰는 파일 하나만 그리면 되니 `##`/`###`/`-`/`**`/`` ` ``/링크만 안다.
 * 표·중첩 목록·이미지가 필요해지면 그때 파서를 넣는다.
 */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link)
      return (
        <a key={i} className="link" href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    return part;
  });
}

// eslint-disable-next-line react/only-export-components -- 테스트가 부르는 순수 함수. 파일 쪼갤 값어치 없음
export function renderMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let items: string[] = [];

  const flush = () => {
    if (!items.length) return;
    out.push(
      <ul key={out.length}>
        {items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    items = [];
  };

  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('- ')) {
      items.push(line.slice(2));
      continue;
    }
    flush();
    if (!line || line.startsWith('# ')) continue; // 파일 제목은 모달 제목이 대신한다
    if (line.startsWith('### ')) {
      out.push(<h4 key={out.length}>{inline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      // "v0.1.2 — 2026-07-30" 은 날짜를 흐리게 떼어 놓는다
      const [ver, date] = line.slice(3).split(' — ');
      out.push(
        <h3 key={out.length}>
          {ver}
          {date && ' '}
          {date && <span className="cl-date">{date}</span>}
        </h3>,
      );
    } else {
      out.push(<p key={out.length}>{inline(line)}</p>);
    }
  }
  flush();
  return out;
}

export default function ChangelogDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="ver"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
      >
        v{import.meta.env.VITE_APP_VERSION}
      </button>

      {/* 네이티브 dialog: 포커스 가둠·ESC 닫기·backdrop 을 브라우저가 준다 */}
      <dialog ref={ref} className="feedback changelog" aria-labelledby="cl-title">
        <div className="cl-body">
          <h2 id="cl-title">버전 기록</h2>
          {renderMarkdown(changelog)}
        </div>
        <div className="fb-actions cl-actions">
          <button type="button" className="chip" onClick={() => ref.current?.close()}>
            닫기
          </button>
        </div>
      </dialog>
    </>
  );
}
