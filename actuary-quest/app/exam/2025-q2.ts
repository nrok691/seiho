/**
 * 2025年度 生保数理 問題2 の試験セット・メタデータ。
 *
 * 通常版 (`app/page.tsx`) と誘導版 (`app/guided/`) が共有する「試験そのものの事実」を、
 * ここだけに置く。モード固有の情報は各モード側に残す。
 *
 * - 通常版固有: レイド用タイトル、解法の軸 (`axis`)、解答欄に並べる文字 (`options`)
 * - 誘導版固有: `goal`、`steps`、`explanation`、`wrongHint`、`finalAnswer`
 *
 * ここの値を変更するときは、必ず `public/exam/2025-q2/` の公式問題画像・公式解答画像と
 * 照合すること。モデルの記憶だけで正答・配点・PARを決めない。
 */

export type QuestionMode = "single" | "dual" | "multi";

/**
 * 解答欄ごとに公式配点が分かれる問題 (問2) の部分点仕様。
 * `slot` は解答欄の位置で、0 が ①、1 が ②。
 */
export type PartialCredit = {
  slot: number;
  answer: string;
  points: number;
};

export type QuestionMeta = {
  /** 1始まりの連続した小問番号。配列順と一致させる。 */
  id: number;
  /** 結果・復習一覧に出す論点名 */
  topic: string;
  mode: QuestionMode;
  /** 公式正答 */
  correct: string[];
  /** 公式配点 */
  points: number;
  /** 解答欄ごとに配点が分かれる場合のみ持つ */
  partial?: PartialCredit[];
  /** 公式問題画像 */
  image: string;
  /** 公式解答画像。読む順に並べる。 */
  solutions: string[];
  /** 目標秒数 */
  par: number;
};

export const EXAM_SET = {
  id: "2025-q2",
  year: 2025,
  subject: "生保数理",
  /** 大問番号 */
  major: 2,
  source: "公益社団法人 日本アクチュアリー会「2025年度 生保数理 問題2・解答例」",
} as const;

export const QUESTION_META: QuestionMeta[] = [
  {
    id: 1,
    topic: "生命力・平均寿命",
    mode: "single",
    correct: ["C"],
    points: 7,
    image: "/exam/2025-q2/q1.webp",
    solutions: ["/exam/2025-q2/s1.webp"],
    par: 240,
  },
  {
    id: 2,
    topic: "多重脱退・定常人口",
    mode: "dual",
    correct: ["C", "H"],
    points: 7,
    partial: [
      { slot: 0, answer: "C", points: 3 },
      { slot: 1, answer: "H", points: 4 },
    ],
    image: "/exam/2025-q2/q2.webp",
    solutions: ["/exam/2025-q2/s2.webp", "/exam/2025-q2/s2b.webp"],
    par: 420,
  },
  {
    id: 3,
    topic: "年金・計算基数",
    mode: "multi",
    correct: ["A", "C", "D"],
    points: 7,
    image: "/exam/2025-q2/q3.webp",
    solutions: ["/exam/2025-q2/s3.webp"],
    par: 240,
  },
  {
    id: 4,
    topic: "保険現価・微分",
    mode: "single",
    correct: ["J"],
    points: 7,
    image: "/exam/2025-q2/q4.webp",
    solutions: ["/exam/2025-q2/s4.webp"],
    par: 300,
  },
  {
    id: 5,
    topic: "返戻金・責任準備金",
    mode: "single",
    correct: ["G"],
    points: 7,
    image: "/exam/2025-q2/q5.webp",
    solutions: ["/exam/2025-q2/s5.webp"],
    par: 360,
  },
  {
    id: 6,
    topic: "多生命年金",
    mode: "single",
    correct: ["B"],
    points: 7,
    image: "/exam/2025-q2/q6.webp",
    solutions: ["/exam/2025-q2/s6.webp"],
    par: 300,
  },
  {
    id: 7,
    topic: "就業不能保険",
    mode: "single",
    correct: ["H"],
    points: 7,
    image: "/exam/2025-q2/q7.webp",
    solutions: ["/exam/2025-q2/s7.webp"],
    par: 360,
  },
  {
    id: 8,
    topic: "入院給付・分布",
    mode: "single",
    correct: ["H"],
    points: 7,
    image: "/exam/2025-q2/q8.webp",
    solutions: ["/exam/2025-q2/s8.webp"],
    par: 240,
  },
];

/** 小問数 */
export const QUESTION_COUNT = QUESTION_META.length;

/** 公式配点の合計 */
export const TOTAL_OFFICIAL_POINTS = QUESTION_META.reduce(
  (total, question) => total + question.points,
  0,
);

/** 目標時間の合計秒数。問題別PARの合計から導く。 */
export const TOTAL_PAR_SECONDS = QUESTION_META.reduce(
  (total, question) => total + question.par,
  0,
);

export function getQuestionMeta(id: number): QuestionMeta {
  const meta = QUESTION_META.find((question) => question.id === id);
  if (!meta) {
    throw new Error("Unknown question id: " + id);
  }
  return meta;
}
