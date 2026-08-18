/**
 * 公式得点の計算。
 *
 * 配点・部分点・正答は `app/exam/2025-q2.ts` の試験セット・メタデータだけを参照する。
 * ここに問題固有の値（選択肢の文字や点数）を直接書かないこと。
 *
 * バトルスコア（コンボ倍率、速解き、ノーヒント）は公式得点とは別枠の
 * ゲーム内加点なので、この関数群には含めない。
 */
import type { QuestionMeta } from "./exam/2025-q2";

/** 順序を無視して、選んだ解答の集合が正答の集合と一致するか。 */
export function sameSet(left: string[], right: string[]) {
  return [...left].sort().join("") === [...right].sort().join("");
}

/**
 * 公式配点にもとづく得点。
 *
 * - 解答欄ごとに配点が分かれる問題（`partial` を持つ問題）は、欄ごとに加点する。
 * - それ以外は、正答と完全一致したときだけ満点。
 */
export function officialPoints(question: QuestionMeta, picks: string[]) {
  if (question.partial) {
    return question.partial.reduce(
      (total, part) => total + (picks[part.slot] === part.answer ? part.points : 0),
      0,
    );
  }
  return sameSet(picks, question.correct) ? question.points : 0;
}

/** その問題の満点かどうか。コンボ継続の判定に使う。 */
export function isFullMark(earned: number, question: QuestionMeta) {
  return earned === question.points;
}
