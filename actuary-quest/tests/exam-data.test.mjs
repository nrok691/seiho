/**
 * 試験データの整合性テスト。
 *
 * 実行:
 *   npm run test:data
 *   (= node --test --experimental-strip-types tests/exam-data.test.mjs)
 *
 * 追加依存は使わない。Node標準のテストランナーと型ストリッピングだけで、
 * TypeScriptのデータモジュールをそのまま読み込んで検証する。
 *
 * ここで守りたいのは「公式問題・公式解答と照合済みの事実が、
 * 後の変更で静かに壊れないこと」。ソースコードの文字列を正規表現で
 * 解析するのではなく、実際にエクスポートされた値を検証する。
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EXAM_SET,
  QUESTION_COUNT,
  QUESTION_META,
  TOTAL_OFFICIAL_POINTS,
  TOTAL_PAR_SECONDS,
  getQuestionMeta,
} from "../app/exam/2025-q2.ts";
import { GUIDED_QUESTIONS } from "../app/guided/data.ts";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

/** 収録している試験セットの前提値。ここを変えるときは公式問題と照合すること。 */
const EXPECTED = {
  questionCount: 8,
  totalOfficialPoints: 56,
  totalParMinutes: 41,
  totalGuidedSteps: 37,
  modes: ["single", "dual", "multi"],
  phases: ["READ", "MODEL", "DERIVE", "CALC", "JUDGE"],
};

/**
 * 誘導版の `finalAnswer` に書かれた選択肢記号を取り出す。
 * 表記は全角括弧の「（C）」形式。例:
 *   "（C）480"                        -> ["C"]
 *   "①（C）0.0711　②（H）0.00885"     -> ["C", "H"]
 *   "（A）（C）（D）"                  -> ["A", "C", "D"]
 * この表記を変えたときは、この抽出規則も併せて更新すること。
 */
function extractOptionLetters(finalAnswer) {
  return [...finalAnswer.matchAll(/（([A-J])）/g)].map((match) => match[1]);
}

describe("試験セットのメタデータ", () => {
  it("2025年度 生保数理 問題2 を収録している", () => {
    assert.equal(EXAM_SET.id, "2025-q2");
    assert.equal(EXAM_SET.year, 2025);
    assert.equal(EXAM_SET.subject, "生保数理");
    assert.equal(EXAM_SET.major, 2);
  });

  it("問題数が8問である", () => {
    assert.equal(QUESTION_META.length, EXPECTED.questionCount);
    assert.equal(QUESTION_COUNT, EXPECTED.questionCount);
  });

  it("問題IDが1〜8で連続し、重複せず、配列順と一致する", () => {
    const ids = QUESTION_META.map((question) => question.id);
    assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(new Set(ids).size, ids.length);
    // 通常版に QUESTIONS[attempt.id - 1] という参照があるため、この一致は必須。
    QUESTION_META.forEach((question, index) => {
      assert.equal(question.id, index + 1);
      assert.equal(getQuestionMeta(question.id), question);
    });
  });

  it("合計公式配点が56点である", () => {
    assert.equal(TOTAL_OFFICIAL_POINTS, EXPECTED.totalOfficialPoints);
    const sum = QUESTION_META.reduce((total, question) => total + question.points, 0);
    assert.equal(sum, EXPECTED.totalOfficialPoints);
  });

  it("問題別PARの合計が41分である", () => {
    assert.equal(TOTAL_PAR_SECONDS, EXPECTED.totalParMinutes * 60);
    const sum = QUESTION_META.reduce((total, question) => total + question.par, 0);
    assert.equal(sum, EXPECTED.totalParMinutes * 60);
  });

  it("各問題が既知の出題形式と空でない正答を持つ", () => {
    for (const question of QUESTION_META) {
      assert.ok(
        EXPECTED.modes.includes(question.mode),
        `Q${question.id}: 未知の出題形式 ${question.mode}`,
      );
      assert.ok(question.correct.length > 0, `Q${question.id}: 正答が空`);
      assert.equal(
        new Set(question.correct).size,
        question.correct.length,
        `Q${question.id}: 正答に重複がある`,
      );
      assert.ok(question.points > 0, `Q${question.id}: 配点が0以下`);
      assert.ok(question.par > 0, `Q${question.id}: PARが0以下`);
    }
  });

  it("問2の3点＋4点の部分点仕様が維持されている", () => {
    const question = getQuestionMeta(2);
    assert.equal(question.mode, "dual");
    assert.deepEqual(question.correct, ["C", "H"]);
    assert.deepEqual(question.partial, [
      { slot: 0, answer: "C", points: 3 },
      { slot: 1, answer: "H", points: 4 },
    ]);
    // 部分点の合計が、その問題の公式配点と一致すること。
    const partialTotal = question.partial.reduce((total, part) => total + part.points, 0);
    assert.equal(partialTotal, question.points);
    // 部分点の解答欄順と正答の並びが一致すること。
    assert.deepEqual(
      question.partial.map((part) => part.answer),
      question.correct,
    );
    question.partial.forEach((part, index) => {
      assert.equal(part.slot, index, "部分点の slot は解答欄の位置と一致させる");
    });
  });

  it("部分点を持つのは解答欄が分かれる問題だけである", () => {
    for (const question of QUESTION_META) {
      if (question.mode === "dual") {
        assert.ok(question.partial, `Q${question.id}: dual なのに部分点仕様がない`);
      } else {
        assert.equal(
          question.partial,
          undefined,
          `Q${question.id}: dual 以外に部分点仕様がある`,
        );
      }
    }
  });
});

describe("公式問題・公式解答の画像", () => {
  it("問題画像が命名規則どおりに存在する", () => {
    for (const question of QUESTION_META) {
      assert.equal(
        question.image,
        `/exam/${EXAM_SET.id}/q${question.id}.webp`,
        `Q${question.id}: 問題画像のパスが命名規則と違う`,
      );
      assert.ok(
        existsSync(join(publicDirectory, question.image)),
        `Q${question.id}: 問題画像が見つからない (${question.image})`,
      );
    }
  });

  it("公式解答画像が1枚以上存在する", () => {
    for (const question of QUESTION_META) {
      assert.ok(question.solutions.length > 0, `Q${question.id}: 公式解答画像がない`);
      assert.equal(
        new Set(question.solutions).size,
        question.solutions.length,
        `Q${question.id}: 公式解答画像が重複している`,
      );
      for (const solution of question.solutions) {
        assert.ok(
          solution.startsWith(`/exam/${EXAM_SET.id}/s${question.id}`),
          `Q${question.id}: 解答画像の番号が問題番号と一致しない (${solution})`,
        );
        assert.ok(
          existsSync(join(publicDirectory, solution)),
          `Q${question.id}: 公式解答画像が見つからない (${solution})`,
        );
      }
    }
  });
});

describe("誘導版と通常版の整合", () => {
  it("誘導版が8問すべてを過不足なく持つ", () => {
    assert.equal(GUIDED_QUESTIONS.length, EXPECTED.questionCount);
    assert.deepEqual(
      GUIDED_QUESTIONS.map((question) => question.id),
      QUESTION_META.map((question) => question.id),
    );
  });

  it("問題画像・公式解答画像・論点名を誘導版が二重に持っていない", () => {
    // 二重定義を許すと、片方だけ更新されたときに静かにずれる。
    // これらは app/exam/2025-q2.ts を唯一の出所とする。
    for (const question of GUIDED_QUESTIONS) {
      for (const field of ["image", "solutions", "topic", "correct", "points", "par"]) {
        assert.ok(
          !Object.hasOwn(question, field),
          `Q${question.id}: 誘導版が ${field} を再定義している`,
        );
      }
      // 共通メタデータ側から必ず解決できること。
      const meta = getQuestionMeta(question.id);
      assert.ok(meta.image);
      assert.ok(meta.solutions.length > 0);
      assert.ok(meta.topic);
    }
  });

  it("誘導版の最終解答が通常版の正答と矛盾しない", () => {
    for (const question of GUIDED_QUESTIONS) {
      const meta = getQuestionMeta(question.id);
      const letters = extractOptionLetters(question.finalAnswer);
      assert.ok(
        letters.length > 0,
        `Q${question.id}: finalAnswer から選択肢記号を取り出せない (${question.finalAnswer})`,
      );
      assert.deepEqual(
        letters,
        meta.correct,
        `Q${question.id}: 誘導版の最終解答と通常版の正答が食い違う`,
      );
    }
  });
});

describe("誘導ステップ", () => {
  it("ステップ総数が37である", () => {
    const total = GUIDED_QUESTIONS.reduce(
      (count, question) => count + question.steps.length,
      0,
    );
    assert.equal(total, EXPECTED.totalGuidedSteps);
  });

  it("各問題が1つ以上のステップを持つ", () => {
    for (const question of GUIDED_QUESTIONS) {
      assert.ok(question.steps.length > 0, `Q${question.id}: 誘導ステップがない`);
    }
  });

  it("各ステップの correct が選択肢の範囲内にある", () => {
    for (const question of GUIDED_QUESTIONS) {
      question.steps.forEach((step, index) => {
        const label = `Q${question.id} step${index + 1}`;
        assert.ok(step.choices.length > 0, `${label}: 選択肢がない`);
        assert.ok(Number.isInteger(step.correct), `${label}: correct が整数でない`);
        assert.ok(
          step.correct >= 0 && step.correct < step.choices.length,
          `${label}: correct=${step.correct} が選択肢数 ${step.choices.length} の範囲外`,
        );
      });
    }
  });

  it("同一ステップ内で選択肢ラベルが重複しない", () => {
    // 誘導版は choice.label を React の key に使っているため、重複すると表示が壊れる。
    for (const question of GUIDED_QUESTIONS) {
      question.steps.forEach((step, index) => {
        const labels = step.choices.map((choice) => choice.label);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `Q${question.id} step${index + 1}: 選択肢ラベルが重複している`,
        );
      });
    }
  });

  it("各ステップが既知の段階と、説明・ヒントを持つ", () => {
    for (const question of GUIDED_QUESTIONS) {
      question.steps.forEach((step, index) => {
        const label = `Q${question.id} step${index + 1}`;
        assert.ok(EXPECTED.phases.includes(step.phase), `${label}: 未知の phase ${step.phase}`);
        assert.ok(step.title.length > 0, `${label}: タイトルが空`);
        assert.ok(step.prompt.length > 0, `${label}: 問いかけが空`);
        assert.ok(step.explanation.length > 0, `${label}: 正答時の説明が空`);
        assert.ok(step.wrongHint.length > 0, `${label}: 誤答時のヒントが空`);
      });
    }
  });
});
