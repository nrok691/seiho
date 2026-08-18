/**
 * 公式得点の計算テスト。
 *
 * 実行: npm run test:unit
 *
 * 追加依存なし。app/scoring.ts は React に依存しないので Node からそのまま import できる。
 *
 * ここで守りたいのは次の2点。
 * 1. データ駆動化しても、これまでと採点結果が1点も変わらないこと。
 * 2. メタデータ（配点・部分点・正答）と採点処理が食い違ったら、テストが落ちること。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUESTION_META,
  TOTAL_OFFICIAL_POINTS,
  getQuestionMeta,
} from "../app/exam/2025-q2.ts";
import { isFullMark, officialPoints, sameSet } from "../app/scoring.ts";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * データ駆動化する前の実装。等価性の基準として置いてある。
 * app/page.tsx にあった当時のコードそのまま。
 */
function legacySameSet(left, right) {
  return [...left].sort().join("") === [...right].sort().join("");
}
function legacyOfficialPoints(question, picks) {
  if (question.mode === "dual") {
    return (picks[0] === "C" ? 3 : 0) + (picks[1] === "H" ? 4 : 0);
  }
  return legacySameSet(picks, question.correct) ? 7 : 0;
}

/** その問題で起こりうる解答パターンを網羅的に作る。 */
function candidatePicks(question) {
  if (question.mode === "dual") {
    const slots = ["", ...LETTERS];
    const picks = [];
    for (const first of slots) for (const second of slots) picks.push([first, second]);
    return picks;
  }
  if (question.mode === "multi") {
    const options = question.correct.length > 0 ? ["A", "B", "C", "D", "E", "F"] : [];
    const picks = [];
    for (let mask = 0; mask < 1 << options.length; mask += 1) {
      picks.push(options.filter((_, index) => mask & (1 << index)));
    }
    return picks;
  }
  return [[], ...LETTERS.map((letter) => [letter])];
}

describe("旧実装との等価性", () => {
  it("全8問について、あらゆる解答パターンで得点が一致する", () => {
    let checked = 0;
    for (const question of QUESTION_META) {
      for (const picks of candidatePicks(question)) {
        assert.equal(
          officialPoints(question, picks),
          legacyOfficialPoints(question, picks),
          `Q${question.id} picks=${JSON.stringify(picks)} で旧実装と得点が違う`,
        );
        checked += 1;
      }
    }
    // 網羅できていないと等価性の保証にならないので、件数自体も確認する。
    assert.ok(checked > 200, `検証した解答パターンが少なすぎる: ${checked}`);
  });
});

describe("メタデータと採点の結び付き", () => {
  it("正答を選ぶと、その問題の公式配点になる", () => {
    for (const question of QUESTION_META) {
      const picks = question.mode === "dual" ? [...question.correct] : [...question.correct];
      assert.equal(
        officialPoints(question, picks),
        question.points,
        `Q${question.id}: 正答なのに満点にならない`,
      );
    }
  });

  it("全問の満点を合計すると公式配点の合計になる", () => {
    const total = QUESTION_META.reduce(
      (sum, question) => sum + officialPoints(question, [...question.correct]),
      0,
    );
    assert.equal(total, TOTAL_OFFICIAL_POINTS);
  });

  it("無回答は0点", () => {
    for (const question of QUESTION_META) {
      const empty = question.mode === "dual" ? ["", ""] : [];
      assert.equal(officialPoints(question, empty), 0, `Q${question.id}: 無回答が0点でない`);
    }
  });

  it("満点判定がその問題の配点にもとづく", () => {
    for (const question of QUESTION_META) {
      assert.equal(isFullMark(question.points, question), true);
      assert.equal(isFullMark(question.points - 1, question), false);
      assert.equal(isFullMark(0, question), false);
    }
  });
});

describe("問2（解答欄が2つ・部分点あり）", () => {
  const question = getQuestionMeta(2);

  it("①のみ正解で3点、②のみ正解で4点、両方で7点", () => {
    assert.equal(officialPoints(question, ["C", "H"]), 7);
    assert.equal(officialPoints(question, ["C", ""]), 3);
    assert.equal(officialPoints(question, ["", "H"]), 4);
    assert.equal(officialPoints(question, ["C", "A"]), 3);
    assert.equal(officialPoints(question, ["A", "H"]), 4);
  });

  it("両方不正解と無回答は0点", () => {
    assert.equal(officialPoints(question, ["A", "B"]), 0);
    assert.equal(officialPoints(question, ["", ""]), 0);
  });

  it("解答欄を入れ替えると0点になる", () => {
    // ①と②は別々の設問なので、入れ替えても部分点は付かない。
    assert.equal(officialPoints(question, ["H", "C"]), 0);
  });

  it("部分点の内訳がメタデータと一致する", () => {
    for (const part of question.partial) {
      const picks = ["", ""];
      picks[part.slot] = part.answer;
      assert.equal(
        officialPoints(question, picks),
        part.points,
        `解答欄${part.slot + 1}の配点がメタデータと違う`,
      );
    }
  });
});

describe("問3（複数選択）", () => {
  const question = getQuestionMeta(3);

  it("正答の組を過不足なく選んだときだけ満点", () => {
    assert.equal(officialPoints(question, ["A", "C", "D"]), 7);
    assert.equal(officialPoints(question, ["D", "A", "C"]), 7, "選ぶ順番は得点に影響しない");
  });

  it("部分集合・超集合・別の組み合わせは0点", () => {
    assert.equal(officialPoints(question, ["A", "C"]), 0);
    assert.equal(officialPoints(question, ["A", "B", "C", "D"]), 0);
    assert.equal(officialPoints(question, ["F"]), 0);
    assert.equal(officialPoints(question, ["B", "E"]), 0);
  });
});

describe("単一選択の6問", () => {
  it("正答の1つだけが満点で、他の選択肢はすべて0点", () => {
    for (const question of QUESTION_META.filter((item) => item.mode === "single")) {
      const answer = question.correct[0];
      assert.equal(officialPoints(question, [answer]), question.points);
      for (const letter of LETTERS.filter((item) => item !== answer)) {
        assert.equal(officialPoints(question, [letter]), 0, `Q${question.id}: ${letter} が0点でない`);
      }
    }
  });
});

describe("sameSet", () => {
  it("順序を無視して一致を判定する", () => {
    assert.equal(sameSet(["A", "C", "D"], ["D", "C", "A"]), true);
    assert.equal(sameSet(["A"], ["A"]), true);
    assert.equal(sameSet([], []), true);
    assert.equal(sameSet(["A", "C"], ["A", "C", "D"]), false);
    assert.equal(sameSet(["B"], ["A"]), false);
  });
});
