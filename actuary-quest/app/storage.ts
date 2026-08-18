/**
 * 端末内保存（localStorage）の読み書きを1か所に集約する。
 *
 * 方針
 * - 既存のキー名と保存形式は変更しない。既存ユーザーのデータをそのまま読める。
 * - 読み込み時に型を検証し、壊れた値で画面が落ちないようにする。正常な既存データは必ずそのまま通す。
 * - 保存に失敗したとき、黙って握り潰さずに検知できるようにする。
 * - 既存データの削除や強制初期化は行わない。
 *
 * このモジュールは評価時に window / localStorage へ触らない。
 * 参照は関数の中だけで行うので、Node のテストからそのまま import できる。
 */

export const RAID_PROGRESS_KEY = "actuary-raid-progress-v2";
export const STUCK_NOTES_KEY = "actuary-raid-stuck-notes-v1";
export const GUIDED_PROGRESS_KEY = "actuary-guided-progress-v1";

export type RaidProgress = {
  bestScore: number;
  bestOfficial: number;
  clears: number;
  streak: number;
  lastStudy: string;
};

export type StuckNotes = Record<string, string>;

export const EMPTY_RAID_PROGRESS: RaidProgress = {
  bestScore: 0,
  bestOfficial: 0,
  clears: 0,
  streak: 0,
  lastStudy: "",
};

/** localStorage のうち、このモジュールが使う部分だけ。テストでは差し替えられる。 */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // プライベートモード等で localStorage 参照自体が例外になる場合がある。
    return null;
  }
}

function readRaw(key: string, storage?: StorageLike | null): string | null {
  const target = storage === undefined ? defaultStorage() : storage;
  if (!target) return null;
  try {
    return target.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 保存する。成功したら true。
 * 書き込み後に読み戻して一致を確認するので、黙って消える保存を検知できる。
 */
function writeRaw(key: string, value: string, storage?: StorageLike | null): boolean {
  const target = storage === undefined ? defaultStorage() : storage;
  if (!target) return false;
  try {
    target.setItem(key, value);
    if (target.getItem(key) !== value) {
      reportWriteFailure(key, "書き込み後に同じ値を読み戻せませんでした");
      return false;
    }
    return true;
  } catch (error) {
    reportWriteFailure(key, error);
    return false;
  }
}

function reportWriteFailure(key: string, reason: unknown) {
  // 学習は保存なしでも続けられるので、UIは止めない。ただし黙って失敗はさせない。
  try {
    console.warn("[actuary-quest] localStorage への保存に失敗しました: " + key, reason);
  } catch {
    // 出力先が無い環境でも保存処理自体は続行する。
  }
}

function parseJson(raw: string | null): unknown {
  if (raw === null || raw === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 通常版の成績を復元する。読めなければ null。
 * 既存形式（数値4つと YYYY-MM-DD 文字列）はそのまま通る。
 */
export function parseRaidProgress(raw: string | null): RaidProgress | null {
  const parsed = parseJson(raw);
  if (!isPlainObject(parsed)) return null;
  return {
    bestScore: toFiniteNumber(parsed.bestScore, EMPTY_RAID_PROGRESS.bestScore),
    bestOfficial: toFiniteNumber(parsed.bestOfficial, EMPTY_RAID_PROGRESS.bestOfficial),
    clears: toFiniteNumber(parsed.clears, EMPTY_RAID_PROGRESS.clears),
    streak: toFiniteNumber(parsed.streak, EMPTY_RAID_PROGRESS.streak),
    lastStudy: typeof parsed.lastStudy === "string" ? parsed.lastStudy : EMPTY_RAID_PROGRESS.lastStudy,
  };
}

/** 詰まりメモを復元する。値が文字列でないものは捨てる。 */
export function parseStuckNotes(raw: string | null): StuckNotes | null {
  const parsed = parseJson(raw);
  if (!isPlainObject(parsed)) return null;
  const notes: StuckNotes = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") notes[key] = value;
  }
  return notes;
}

/** 誘導版のクリア済み問題IDを復元する。数値でない要素は捨てる。 */
export function parseGuidedProgress(raw: string | null): number[] | null {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

export function readRaidProgress(storage?: StorageLike | null): RaidProgress | null {
  return parseRaidProgress(readRaw(RAID_PROGRESS_KEY, storage));
}

export function writeRaidProgress(value: RaidProgress, storage?: StorageLike | null): boolean {
  return writeRaw(RAID_PROGRESS_KEY, JSON.stringify(value), storage);
}

export function readStuckNotes(storage?: StorageLike | null): StuckNotes | null {
  return parseStuckNotes(readRaw(STUCK_NOTES_KEY, storage));
}

export function writeStuckNotes(value: StuckNotes, storage?: StorageLike | null): boolean {
  return writeRaw(STUCK_NOTES_KEY, JSON.stringify(value), storage);
}

export function readGuidedProgress(storage?: StorageLike | null): number[] | null {
  return parseGuidedProgress(readRaw(GUIDED_PROGRESS_KEY, storage));
}

export function writeGuidedProgress(value: number[], storage?: StorageLike | null): boolean {
  return writeRaw(GUIDED_PROGRESS_KEY, JSON.stringify(value), storage);
}
