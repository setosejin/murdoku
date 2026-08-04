/** 콘텐츠 풀. image 를 채우면 UI가 이모지 대신 그림을 쓴다. */
import type { FloorKind } from '../game/types';

export const SUSPECT_NAMES = [
  '오스틴', '브라이슨', '샬린', '다이애나', '엘라', '프랭크',
  '그레이스', '해리스', '이자벨', '제이든', '카밀라', '루카스',
  '마야', '노아', '올리비아', '패트릭',
] as const;

export const VICTIM_NAMES = ['바니', '빈센트', '베라', '벤', '비올라'] as const;

/** 용의자 카드 색 (id 순서대로) */
export const PERSON_COLORS = [
  '#f2c94c', '#bb9af7', '#f2994a', '#6fcf97', '#56ccf2', '#eb6f92',
  '#9ccfd8', '#c4a7e7', '#f6c177', '#a3be8c', '#d08770', '#88c0d0',
  '#b48ead', '#ebcb8b', '#81a1c1', '#bf616a',
] as const;

export const VICTIM_COLOR = '#8a8f98';

export type RoomSpec = { name: string; floor: FloorKind };

/** 하늘이 뚫린 바닥. 여기엔 창문·문 대신 울타리·대문이 선다 */
export const OUTDOOR_FLOORS = new Set<FloorKind>(['grass', 'soil']);

export type FurnitureSpec = {
  kind: string;
  label: string;
  emoji: string;
  /**
   * 차지하는 칸 수. 2·3 은 가로 또는 세로 일자, 4 는 2×2.
   * 큰 가구는 방이 넉넉할 때만 놓인다 — 자리가 없으면 조용히 건너뛴다.
   */
  size: 1 | 2 | 3 | 4;
  standable: boolean;
  /** 놓일 수 있는 방 이름. 없으면 아무 방이나 (러그·화분·물통) */
  rooms?: readonly string[];
  image?: string;
};

export type WallItemSpec = {
  kind: 'window' | 'door' | 'fence' | 'gate';
  label: string;
  emoji: string;
  image?: string;
};

/**
 * 안뜰에 사는 짐승. 못 누르는 칸을 몸으로 막아서 이유를 그림으로 먼저 말한다.
 * 테마마다 안뜰이 달라서(잔디 안뜰 · 물 연못) 주인도 같이 갈린다.
 */
export type PetSpec = {
  /** 스프라이트 아이콘 이름. `i-<kind>` 와 `i-<kind>-sit` 이 둘 다 있어야 한다 */
  kind: string;
  label: string;
  emoji: string;
  /** 안뜰을 눌렀을 때 띄우는 한 줄. 조사가 이름마다 달라 조립하지 않고 통째로 둔다 */
  deny: string;
  image?: string;
};

/**
 * 사건 테마. 방·가구·벽부착물·제목·직업이 한 묶음이라
 * `욕실`과 `돼지우리`가 같은 사건에 섞이지 않는다.
 */
export type Theme = {
  id: string;
  label: string;
  /** 방 이름은 테마마다 9개 이상 — 6×6 평면도가 최대 9개 방까지 나온다 */
  rooms: readonly RoomSpec[];
  furniture: readonly FurnitureSpec[];
  /** 실내 벽에 붙는 것. 0번은 창문 자리, 1번은 문 자리 */
  wallItems: readonly WallItemSpec[];
  /**
   * 야외(잔디·흙) 칸에 걸렸을 때 대신 쓰는 것. 자리 순서는 wallItems 와 같다.
   * 없으면 실내 것을 그대로 쓴다 — 저택은 야외 방이 없어서 필요가 없다.
   */
  outdoorItems?: readonly WallItemSpec[];
  /**
   * 건물 안쪽에 갇힌 빈 칸(안뜰·연못)을 그리는 법. 실루엣이 `donut` 일 때만 쓴다.
   * 건물 바깥으로 트인 빈 칸은 그냥 빈 땅이라 그리지 않는다.
   */
  courtyard: { label: string; emoji: string; floor: FloorKind; pet: PetSpec };
  titles: readonly string[];
  briefs: readonly string[];
  roles: readonly string[];
};

const MANSION: Theme = {
  id: 'mansion',
  label: '저택',
  rooms: [
    { name: '거실', floor: 'wood' },
    { name: '침실', floor: 'carpet' },
    { name: '주방', floor: 'tile' },
    { name: '서재', floor: 'wood' },
    { name: '욕실', floor: 'tile' },
    { name: '손님방', floor: 'carpet' },
    { name: '다이닝룸', floor: 'wood' },
    { name: '작업실', floor: 'wood' },
    { name: '복도', floor: 'tile' },
  ],
  courtyard: {
    label: '안뜰',
    emoji: '⛲',
    floor: 'grass',
    pet: { kind: 'cat', label: '고양이', emoji: '🐈', deny: '고양이가 막아섰다 — 안뜰은 건물 밖이야' },
  },
  furniture: [
    { kind: 'bed', label: '침대', emoji: '🛏️', size: 2, standable: true, rooms: ['침실', '손님방'] },
    { kind: 'sofa', label: '소파', emoji: '🛋️', size: 3, standable: true, rooms: ['거실', '서재', '손님방'] },
    { kind: 'rug', label: '러그', emoji: '🟫', size: 4, standable: true },
    { kind: 'table', label: '탁자', emoji: '🪑', size: 1, standable: false, rooms: ['거실', '주방', '다이닝룸', '손님방', '서재', '복도'] },
    { kind: 'piano', label: '피아노', emoji: '🎹', size: 2, standable: false, rooms: ['거실', '서재', '작업실'] },
    { kind: 'plant', label: '화분', emoji: '🪴', size: 1, standable: false },
    { kind: 'tv', label: 'TV', emoji: '📺', size: 1, standable: false, rooms: ['거실', '침실', '손님방'] },
    { kind: 'bookshelf', label: '책장', emoji: '📚', size: 2, standable: false, rooms: ['서재', '침실', '거실', '작업실', '손님방'] },
    { kind: 'fridge', label: '냉장고', emoji: '🧊', size: 1, standable: false, rooms: ['주방', '다이닝룸'] },
    { kind: 'lamp', label: '스탠드', emoji: '💡', size: 1, standable: false },
    { kind: 'bathtub', label: '욕조', emoji: '🛁', size: 2, standable: false, rooms: ['욕실'] },
    { kind: 'desk', label: '책상', emoji: '🗄️', size: 2, standable: false, rooms: ['서재', '침실', '작업실', '손님방'] },
  ],
  wallItems: [
    { kind: 'window', label: '창문', emoji: '🪟' },
    { kind: 'door', label: '문', emoji: '🚪' },
  ],
  titles: [
    '서늘한 밤의 사건', '창문이 4개', '아침에는 잉글리시 브렉퍼스트',
    '동네 책방 사건', '지워진 발자국', '멈춘 괘종시계', '식은 홍차 한 잔',
    '열쇠는 안쪽에', '비 오는 날의 초대', '마지막 축음기',
  ],
  briefs: [
    '어젯밤 이 집에서 일어난 일을 아는 사람은 이 안에 있다.',
    '아무도 밖으로 나가지 않았다. 범인은 아직 이 집에 있다.',
    '문은 잠겨 있었고 창문은 열려 있었다.',
    '모두가 알리바이를 말했지만, 한 사람만은 거짓이 아니었다.',
    '피해자와 마지막까지 같은 방에 있던 사람을 찾아라.',
  ],
  roles: [
    '집사', '요리사', '정원사', '운전기사', '가정교사',
    '하녀', '비서', '조카', '이웃', '초대손님',
  ],
};

const FARM: Theme = {
  id: 'farm',
  label: '농장',
  rooms: [
    { name: '마당', floor: 'soil' },
    { name: '목초지', floor: 'grass' },
    { name: '돼지우리', floor: 'straw' },
    { name: '외양간', floor: 'straw' },
    { name: '헛간', floor: 'wood' },
    { name: '창고', floor: 'wood' },
    { name: '정원', floor: 'grass' },
    { name: '작업실', floor: 'wood' },
    { name: '우물가', floor: 'soil' },
  ],
  courtyard: {
    label: '연못',
    emoji: '💧',
    floor: 'water',
    pet: { kind: 'duck', label: '오리', emoji: '🦆', deny: '오리가 막아섰다 — 연못은 건물 밖이야' },
  },
  furniture: [
    { kind: 'haystack', label: '건초더미', emoji: '🌾', size: 4, standable: true, rooms: ['외양간', '헛간', '돼지우리', '창고'] },
    { kind: 'trough', label: '여물통', emoji: '🥣', size: 3, standable: false, rooms: ['외양간', '돼지우리', '목초지'] },
    { kind: 'mud', label: '진흙탕', emoji: '🟤', size: 2, standable: true, rooms: ['돼지우리', '마당', '우물가'] },
    { kind: 'well', label: '우물', emoji: '🕳️', size: 1, standable: false, rooms: ['우물가', '마당', '정원'] },
    { kind: 'tree', label: '나무', emoji: '🌳', size: 1, standable: false, rooms: ['목초지', '정원', '마당'] },
    { kind: 'cart', label: '수레', emoji: '🛒', size: 2, standable: false, rooms: ['마당', '헛간', '창고', '작업실'] },
    { kind: 'tractor', label: '트랙터', emoji: '🚜', size: 3, standable: false, rooms: ['헛간', '창고', '마당', '작업실'] },
    { kind: 'scarecrow', label: '허수아비', emoji: '🎃', size: 1, standable: false, rooms: ['정원', '목초지', '마당'] },
    { kind: 'bench', label: '작업대', emoji: '🔨', size: 2, standable: false, rooms: ['작업실', '헛간', '창고'] },
    { kind: 'bucket', label: '물통', emoji: '🪣', size: 1, standable: false },
    { kind: 'sack', label: '사료포대', emoji: '📦', size: 1, standable: false },
    { kind: 'stump', label: '그루터기', emoji: '🪵', size: 1, standable: true },
  ],
  wallItems: [
    { kind: 'window', label: '창문', emoji: '🪟' },
    { kind: 'door', label: '문', emoji: '🚪' },
  ],
  outdoorItems: [
    { kind: 'fence', label: '울타리', emoji: '🚧' },
    { kind: 'gate', label: '대문', emoji: '⛩️' },
  ],
  titles: [
    '새벽의 농장', '사라진 우유통', '진흙 위의 발자국', '건초 속의 열쇠',
    '멈춘 풍차', '닭장이 열려 있었다', '시동이 걸린 트랙터',
    '비 오는 날의 수확', '우물에 빠진 반지', '개는 짖지 않았다',
  ],
  briefs: [
    '어젯밤 이 농장에서 일어난 일을 아는 사람은 이 안에 있다.',
    '대문은 잠겨 있었다. 범인은 아직 농장 안에 있다.',
    '개는 짖지 않았다. 낯선 사람이 아니었다는 뜻이다.',
    '진흙에 남은 발자국은 한 사람의 것뿐이었다.',
    '피해자와 마지막까지 같은 곳에 있던 사람을 찾아라.',
  ],
  roles: [
    '농부', '수의사', '목동', '마부', '일꾼',
    '우유배달부', '사료상인', '이웃 농부', '조카', '계절 일꾼',
  ],
};

export const THEMES: readonly Theme[] = [MANSION, FARM];
