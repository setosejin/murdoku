/** 콘텐츠 풀. image 를 채우면 UI가 이모지 대신 그림을 쓴다. */

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

export type FurnitureSpec = {
  kind: string;
  label: string;
  emoji: string;
  /** 차지하는 칸 수 (2면 방 안에서 세로/가로로 두 칸) */
  size: 1 | 2;
  standable: boolean;
  image?: string;
};

export const FURNITURE: readonly FurnitureSpec[] = [
  { kind: 'bed', label: '침대', emoji: '🛏️', size: 2, standable: true },
  { kind: 'sofa', label: '소파', emoji: '🛋️', size: 2, standable: true },
  { kind: 'rug', label: '러그', emoji: '🟫', size: 1, standable: true },
  { kind: 'table', label: '탁자', emoji: '🪑', size: 1, standable: false },
  { kind: 'piano', label: '피아노', emoji: '🎹', size: 1, standable: false },
  { kind: 'plant', label: '화분', emoji: '🪴', size: 1, standable: false },
  { kind: 'tv', label: 'TV', emoji: '📺', size: 1, standable: false },
  { kind: 'bookshelf', label: '책장', emoji: '📚', size: 1, standable: false },
  { kind: 'fridge', label: '냉장고', emoji: '🧊', size: 1, standable: false },
  { kind: 'lamp', label: '스탠드', emoji: '💡', size: 1, standable: false },
  { kind: 'bathtub', label: '욕조', emoji: '🛁', size: 1, standable: false },
  { kind: 'desk', label: '책상', emoji: '🗄️', size: 1, standable: false },
];

export const WALL_ITEMS = [
  { kind: 'window' as const, label: '창문', emoji: '🪟' },
  { kind: 'door' as const, label: '문', emoji: '🚪' },
];

export const ROOM_NAMES = [
  '거실', '침실', '주방', '서재', '욕실', '손님방', '다이닝룸', '작업실', '복도',
] as const;

export const CASE_TITLES = [
  '서늘한 밤의 사건', '창문이 4개', '아침에는 잉글리시 브렉퍼스트',
  '동네 책방 사건', '지워진 발자국', '멈춘 괘종시계', '식은 홍차 한 잔',
  '열쇠는 안쪽에', '비 오는 날의 초대', '마지막 축음기',
] as const;

export const CASE_BRIEFS = [
  '어젯밤 이 집에서 일어난 일을 아는 사람은 이 안에 있다.',
  '아무도 밖으로 나가지 않았다. 범인은 아직 이 집에 있다.',
  '문은 잠겨 있었고 창문은 열려 있었다.',
  '모두가 알리바이를 말했지만, 한 사람만은 거짓이 아니었다.',
  '피해자와 마지막까지 같은 방에 있던 사람을 찾아라.',
] as const;
