/**
 * 端末内保存（localStorage）の読み書きテスト。
 *
 * 実行: npm run test:unit
 *
 * 追加依存なし。app/storage.ts は評価時に window / localStorage へ触らないので、
 * Node からそのまま import できる。保存先はテスト用の差し替え可能なオブジェクトを渡す。
 *
 * ここで最優先に守るのは「既存ユーザーの正常なデータが、これまでどおり読めること」。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_RAID_PROGRESS,
  GUIDED_PROGRESS_KEY,
  RAID_PROGRESS_KEY,
  STUCK_NOTES_KEY,
  parseGuidedProgress,
  parseRaidProgress,
  parseStuckNotes,
  readGuidedProgress,
  readRaidProgress,
  readStuckNotes,
  writeGuidedProgress,
  writeRaidProgress,
  writeStuckNotes,
} from "../app/storage.ts";

/** localStorage の代わり。中身をそのまま覗ける。 */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

/** console.warn を黙らせて、保存失敗のテスト出力を汚さない。 */
function withSilencedWarn(run) {
  const original = console.warn;
  console.warn = () => {};
  try {
    return run();
  } finally {
    console.warn = original;
  }
}

describe("保存キー", () => {
  it("既存のキー名から変わっていない", () => {
    // キー名が変わると既存ユーザーの学習データが消えたように見える。ここは固定。
    assert.equal(RAID_PROGRESS_KEY, "actuary-raid-progress-v2");
    assert.equal(STUCK_NOTES_KEY, "actuary-raid-stuck-notes-v1");
    assert.equal(GUIDED_PROGRESS_KEY, "actuary-guided-progress-v1");
  });
});

describe("既存データとの後方互換", () => {
  it("これまでの形式で保存された成績をそのまま読める", () => {
    const legacy = '{"bestScore":12345,"bestOfficial":49,"clears":3,"streak":5,"lastStudy":"2026-08-14"}';
    assert.deepEqual(parseRaidProgress(legacy), {
      bestScore: 12345,
      bestOfficial: 49,
      clears: 3,
      streak: 5,
      lastStudy: "2026-08-14",
    });
  });

  it("これまでの形式で保存されたメモをそのまま読める", () => {
    const legacy = '{"1":"#方針・立式 60歳以降の接続で詰まった","5":"返戻方式の比較"}';
    assert.deepEqual(parseStuckNotes(legacy), {
      1: "#方針・立式 60歳以降の接続で詰まった",
      5: "返戻方式の比較",
    });
  });

  it("これまでの形式で保存された誘導版進捗をそのまま読める", () => {
    assert.deepEqual(parseGuidedProgress("[1,2,7]"), [1, 2, 7]);
  });

  it("保存した値を読み戻すと同じ内容になる", () => {
    const storage = fakeStorage();
    const progress = { bestScore: 8800, bestOfficial: 56, clears: 12, streak: 9, lastStudy: "2026-08-18" };
    const notes = { 3: "計算でミス" };
    const guided = [2, 4, 8];

    assert.equal(writeRaidProgress(progress, storage), true);
    assert.equal(writeStuckNotes(notes, storage), true);
    assert.equal(writeGuidedProgress(guided, storage), true);

    assert.deepEqual(readRaidProgress(storage), progress);
    assert.deepEqual(readStuckNotes(storage), notes);
    assert.deepEqual(readGuidedProgress(storage), guided);
  });

  it("保存される文字列が従来と同じJSON形式である", () => {
    const storage = fakeStorage();
    writeRaidProgress({ bestScore: 1, bestOfficial: 2, clears: 3, streak: 4, lastStudy: "2026-01-01" }, storage);
    assert.equal(
      storage.getItem(RAID_PROGRESS_KEY),
      '{"bestScore":1,"bestOfficial":2,"clears":3,"streak":4,"lastStudy":"2026-01-01"}',
    );
  });
});

describe("成績の読み込み", () => {
  it("値が無ければ null を返す", () => {
    assert.equal(parseRaidProgress(null), null);
    assert.equal(parseRaidProgress(""), null);
    assert.equal(readRaidProgress(fakeStorage()), null);
  });

  it("壊れたJSONでも例外を投げず null を返す", () => {
    assert.equal(parseRaidProgress("{壊れている"), null);
    assert.equal(parseRaidProgress("[object Object]"), null);
  });

  it("オブジェクト以外は null を返す", () => {
    for (const raw of ["null", "0", '"文字列"', "true", "[1,2,3]"]) {
      assert.equal(parseRaidProgress(raw), null, `${raw} は成績として読めてはいけない`);
    }
  });

  it("欠けている項目と型違いの項目だけを既定値で補う", () => {
    assert.deepEqual(parseRaidProgress('{"bestScore":500}'), {
      ...EMPTY_RAID_PROGRESS,
      bestScore: 500,
    });
    // null や NaN が入っていても、画面が落ちる値をそのまま state へ入れない。
    assert.deepEqual(parseRaidProgress('{"bestScore":null,"streak":"5","lastStudy":42}'), EMPTY_RAID_PROGRESS);
  });

  it("知らない項目は取り込まない", () => {
    const restored = parseRaidProgress('{"bestScore":10,"unknownField":"x"}');
    assert.deepEqual(Object.keys(restored).sort(), Object.keys(EMPTY_RAID_PROGRESS).sort());
  });
});

describe("メモの読み込み", () => {
  it("文字列でない値は取り込まない", () => {
    assert.deepEqual(parseStuckNotes('{"1":"正常なメモ","2":42,"3":null,"4":["a"]}'), { 1: "正常なメモ" });
  });

  it("オブジェクト以外は null を返す", () => {
    for (const raw of ["null", "[]", '"x"', "壊れている"]) {
      assert.equal(parseStuckNotes(raw), null, `${raw} はメモとして読めてはいけない`);
    }
  });

  it("空の記録は空オブジェクトとして読める", () => {
    assert.deepEqual(parseStuckNotes("{}"), {});
  });
});

describe("誘導版進捗の読み込み", () => {
  it("配列でなければ null を返す", () => {
    for (const raw of ['{"0":1}', "null", '"1,2"', "壊れている"]) {
      assert.equal(parseGuidedProgress(raw), null, `${raw} は進捗として読めてはいけない`);
    }
  });

  it("数値でない要素は取り除く", () => {
    assert.deepEqual(parseGuidedProgress('[1,"2",null,3,{"id":4}]'), [1, 3]);
  });
});

describe("保存の失敗を検知する", () => {
  it("保存先が使えないときは false を返し、例外を投げない", () => {
    withSilencedWarn(() => {
      assert.equal(writeRaidProgress(EMPTY_RAID_PROGRESS, null), false);
      assert.equal(writeStuckNotes({}, null), false);
      assert.equal(writeGuidedProgress([], null), false);
    });
  });

  it("setItem が例外を投げても false を返すだけで止まらない", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    withSilencedWarn(() => {
      assert.equal(writeRaidProgress(EMPTY_RAID_PROGRESS, broken), false);
    });
  });

  it("書き込んだのに残らない保存先を検知して false を返す", () => {
    // 「書けたことになっているのに、次に読むと消えている」状況を捕まえる。
    const silentlyDropping = { getItem: () => null, setItem: () => {} };
    withSilencedWarn(() => {
      assert.equal(writeRaidProgress(EMPTY_RAID_PROGRESS, silentlyDropping), false);
    });
  });

  it("読み込み側も保存先が無ければ null を返す", () => {
    assert.equal(readRaidProgress(null), null);
    assert.equal(readStuckNotes(null), null);
    assert.equal(readGuidedProgress(null), null);
  });
});
