import { useRef, useState, type FormEvent } from 'react';

const REPO = 'setosejin/murdoku';

type Props = { seed: string; n: number };

/**
 * 입력값으로 GitHub 이슈 작성 URL 을 만든다.
 * ponytail: 토큰 없이 이슈를 "자동 생성"할 방법은 없다. 정적 배포라 비밀을 둘 곳이
 * 없어서, 미리 채워진 작성 폼을 열어주고 등록 버튼만 사용자가 누르게 한다.
 * 무인 등록이 필요해지면 그때 토큰을 쥔 프록시(Actions/Worker)를 앞에 세운다.
 */
// eslint-disable-next-line react/only-export-components -- 테스트가 부르는 순수 함수. 파일 쪼갤 값어치 없음
export function issueUrl(kind: string, title: string, body: string, seed: string, n: number) {
  const url = new URL(`https://github.com/${REPO}/issues/new`);
  url.searchParams.set('title', `[${kind}] ${title.trim()}`);
  url.searchParams.set(
    'body',
    `${body.trim()}\n\n---\n시드: \`${seed}\` · 난이도: ${n}x${n} · 버전: v${import.meta.env.VITE_APP_VERSION}\n${navigator.userAgent}`,
  );
  return url.toString();
}

export default function FeedbackDialog({ seed, n }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState('버그');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    window.open(issueUrl(kind, title, body, seed, n), '_blank', 'noopener,noreferrer');
    ref.current?.close();
    setTitle('');
    setBody('');
  };

  return (
    <>
      <button type="button" className="chip" onClick={() => ref.current?.showModal()}>
        피드백
      </button>

      {/* 네이티브 dialog: 포커스 가둠·ESC 닫기·backdrop 을 브라우저가 준다 */}
      <dialog ref={ref} className="feedback" aria-labelledby="fb-title">
        <form onSubmit={submit}>
          <h2 id="fb-title">피드백 보내기</h2>
          <p className="fb-note">
            GitHub 이슈 작성 화면이 새 탭에서 열려. 마지막 <b>Create</b> 버튼은 거기서 눌러야 등록돼
            (GitHub 로그인 필요).
          </p>

          <label>
            유형
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option>버그</option>
              <option>제안</option>
            </select>
          </label>

          <label>
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="무슨 일이 있었어?"
              required
              maxLength={80}
            />
          </label>

          <label>
            내용
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="어떻게 하면 재현되는지, 뭘 기대했는지 적어줘."
              rows={5}
              maxLength={1500}
            />
          </label>

          <p className="fb-note">시드·난이도·버전은 자동으로 붙는다.</p>

          <div className="fb-actions">
            <button type="button" className="chip" onClick={() => ref.current?.close()}>
              취소
            </button>
            <button type="submit" className="chip primary">
              이슈로 열기
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
