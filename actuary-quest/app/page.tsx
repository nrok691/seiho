/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getQuestionMeta,
  TOTAL_OFFICIAL_POINTS,
  TOTAL_PAR_SECONDS,
  type QuestionMeta,
} from "./exam/2025-q2";
import { isFullMark, officialPoints } from "./scoring";
import {
  EMPTY_RAID_PROGRESS,
  readRaidProgress,
  readStuckNotes,
  writeRaidProgress,
  writeStuckNotes,
  type RaidProgress,
  type StuckNotes,
} from "./storage";

type Screen = "lobby" | "battle" | "result";
type Hit = "critical" | "partial" | "miss";

/** 試験セット共通のメタデータに、通常版だけで使う表示情報を足したもの。 */
type Question = QuestionMeta & {
  title: string;
  axis: string;
  options: string[];
};

type Attempt = {
  id: number;
  official: number;
  answer: string;
  correct: string;
  status: Hit;
  seconds: number;
  usedHint: boolean;
};

const NOTE_TAGS = ["問題文の読み取り", "方針・立式", "公式の想起", "計算", "時間配分"];
// 結果ランクの下限。公式配点ではなくゲーム内評価なので、この値は現行のまま維持する。
const RANK_A_MIN = 49;
const RANK_B_MIN = 35;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

// 論点名・正答・画像・PAR・配点は app/exam/2025-q2.ts が唯一の出所。
// ここではレイド表示用のタイトル・解法の軸・解答欄の文字だけを足す。
const QUESTIONS: Question[] = [
  {
    ...getQuestionMeta(1),
    title: "区分的死力を突破せよ",
    axis: "μから生存関数へ戻し、平均寿命を生存確率の積分として置く。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(2),
    title: "二つの集団を連立せよ",
    axis: "率のまま扱わず、年間死亡数・退職数と平均在籍人数に変換して連立する。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(3),
    title: "正しい公式を選び抜け",
    axis: "公式を定義の和へ戻し、開始添字・支払回数・端点を検算する。",
    options: ["A", "B", "C", "D", "E", "F"],
  },
  {
    ...getQuestionMeta(4),
    title: "利率微分の鎖を切れ",
    axis: "dv/di = -v²。現価を級数表示して微分し、支払時点を係数として出す。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(5),
    title: "二つの返戻方式を比較せよ",
    axis: "第6年度以降の共通給付を先に消し、第5年度までの給付差だけを比較する。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(6),
    title: "四生命の給付を分解せよ",
    axis: "給付を生存人数mの関数として、生存指標の積の線形結合へ展開する。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(7),
    title: "状態遷移を現価化せよ",
    axis: "就業不能への移行給付用Mと、状態別死亡給付用Mを分けて現価化する。",
    options: LETTERS,
  },
  {
    ...getQuestionMeta(8),
    title: "三十日単位の壁を越えろ",
    axis: "共通因子を比率で消し、期待給付日数の比だけを計算する。",
    options: LETTERS,
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextStreak(previous: RaidProgress) {
  const today = getTodayKey();
  if (previous.lastStudy === today) return Math.max(previous.streak, 1);
  if (!previous.lastStudy) return 1;
  const current = new Date(today + "T00:00:00");
  const last = new Date(previous.lastStudy + "T00:00:00");
  const days = Math.round((current.getTime() - last.getTime()) / 86_400_000);
  return days === 1 ? previous.streak + 1 : 1;
}

function displayAnswer(question: Question, picks: string[]) {
  if (question.mode === "dual") {
    return "① " + (picks[0] || "−") + " / ② " + (picks[1] || "−");
  }
  return picks.length ? [...picks].sort().join("・") : "未回答";
}

function playFx(kind: "start" | Hit | "finish", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const SafariWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtor = window.AudioContext || SafariWindow.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    const context = new AudioCtor();
    const notes =
      kind === "critical" ? [392, 523.25, 659.25]
        : kind === "partial" ? [330, 440]
          : kind === "miss" ? [170, 125]
            : kind === "finish" ? [392, 493.88, 587.33, 783.99]
              : [261.63, 392, 523.25];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.065;
      oscillator.type = kind === "miss" ? "sawtooth" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "miss" ? 0.055 : 0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.26);
    });
    window.setTimeout(() => void context.close(), 900);
  } catch {
    // Audio is an optional reward layer.
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [progress, setProgress] = useState<RaidProgress>(EMPTY_RAID_PROGRESS);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [officialScore, setOfficialScore] = useState(0);
  const [battleScore, setBattleScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lastGain, setLastGain] = useState(0);
  const [lastMultiplier, setLastMultiplier] = useState(1);
  const [lastBonuses, setLastBonuses] = useState({ speed: 0, noHint: 0 });
  const [lastOfficial, setLastOfficial] = useState(0);
  const [hit, setHit] = useState<{ key: number; status: Hit } | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [stuckNotes, setStuckNotes] = useState<StuckNotes>({});

  const question = QUESTIONS[index];
  const bossHp = Math.max(TOTAL_OFFICIAL_POINTS - officialScore, 0);
  const ready = question.mode === "dual" ? Boolean(picks[0] && picks[1]) : picks.length > 0;
  const resultRank =
    officialScore === TOTAL_OFFICIAL_POINTS ? "S" : officialScore >= RANK_A_MIN ? "A" : officialScore >= RANK_B_MIN ? "B" : "C";
  const reviewTargets = useMemo(
    () =>
      attempts
        .filter((attempt) => attempt.official < QUESTIONS[attempt.id - 1].points)
        .map((attempt) => QUESTIONS[attempt.id - 1].topic),
    [attempts],
  );
  const notedQuestions = useMemo(
    () => QUESTIONS.filter((item) => stuckNotes[String(item.id)]?.trim()),
    [stuckNotes],
  );

  // エフェクトはハイドレーション後に走るので、ここで直接 state へ入れて問題ない。
  // 以前は requestAnimationFrame を挟んでいたが、クリーンアップで取り消されうる隙があり、
  // また成績とメモが同じ try に入っていたため、片方の失敗で両方復元されない構造だった。
  useEffect(() => {
    const savedProgress = readRaidProgress();
    if (savedProgress) setProgress(savedProgress);
    const savedNotes = readStuckNotes();
    if (savedNotes) setStuckNotes(savedNotes);
  }, []);

  useEffect(() => {
    if (screen !== "battle" || answered || zoomOpen || solutionOpen) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setQuestionElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, answered, zoomOpen, solutionOpen]);

  useEffect(() => {
    if (!zoomOpen && !solutionOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setZoomOpen(false);
        setSolutionOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [zoomOpen, solutionOpen]);

  function persist(next: RaidProgress) {
    setProgress(next);
    // 保存できなくても学習は続けられる。失敗は storage 側で警告を出す。
    writeRaidProgress(next);
  }

  function initialPicks(target: Question) {
    return target.mode === "dual" ? ["", ""] : [];
  }

  function updateStuckNote(questionId: number, value: string) {
    const next = { ...stuckNotes };
    if (value.trim()) {
      next[String(questionId)] = value;
    } else {
      delete next[String(questionId)];
    }
    setStuckNotes(next);
    writeStuckNotes(next);
  }

  function addNoteTag(tag: string) {
    const current = stuckNotes[String(question.id)] || "";
    const marker = "#" + tag;
    if (current.includes(marker)) return;
    updateStuckNote(question.id, current ? current.trimEnd() + " " + marker + " " : marker + " ");
  }

  function startRaid() {
    setIndex(0);
    setPicks(initialPicks(QUESTIONS[0]));
    setActiveSlot(0);
    setAnswered(false);
    setUsedHint(false);
    setOfficialScore(0);
    setBattleScore(0);
    setCombo(0);
    setBestCombo(0);
    setElapsed(0);
    setQuestionElapsed(0);
    setAttempts([]);
    setLastGain(0);
    setLastOfficial(0);
    setHit(null);
    setScreen("battle");
    playFx("start", sound);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function choose(letter: string) {
    if (answered) return;
    if (question.mode === "single") {
      setPicks([letter]);
      return;
    }
    if (question.mode === "dual") {
      const next = picks.length === 2 ? [...picks] : ["", ""];
      next[activeSlot] = letter;
      setPicks(next);
      if (activeSlot === 0 && !next[1]) setActiveSlot(1);
      return;
    }
    if (letter === "F") {
      setPicks(picks.length === 1 && picks[0] === "F" ? [] : ["F"]);
      return;
    }
    const withoutNone = picks.filter((pick) => pick !== "F");
    setPicks(withoutNone.includes(letter) ? withoutNone.filter((pick) => pick !== letter) : [...withoutNone, letter]);
  }

  function submitAnswer() {
    if (!ready || answered) return;
    const earned = officialPoints(question, picks);
    const full = isFullMark(earned, question);
    const status: Hit = full ? "critical" : earned > 0 ? "partial" : "miss";
    const nextCombo = full ? combo + 1 : 0;
    const multiplier = full ? 1 + Math.min(nextCombo - 1, 4) * 0.25 : 1;
    const speed = earned > 0 && questionElapsed <= Math.round(question.par * 0.55) ? 180 : 0;
    const noHint = earned > 0 && !usedHint ? 220 : 0;
    const gain = Math.round(earned * 100 * multiplier + speed + noHint);
    const attempt: Attempt = {
      id: question.id,
      official: earned,
      answer: displayAnswer(question, picks),
      correct: displayAnswer(question, question.correct),
      status,
      seconds: questionElapsed,
      usedHint,
    };
    setLastOfficial(earned);
    setLastGain(gain);
    setLastMultiplier(multiplier);
    setLastBonuses({ speed, noHint });
    setOfficialScore((value) => value + earned);
    setBattleScore((value) => value + gain);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setAttempts((value) => [...value, attempt]);
    setAnswered(true);
    setHit({ key: Date.now(), status });
    playFx(status, sound);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(status === "critical" ? [35, 35, 85] : status === "partial" ? [45, 35, 45] : [110]);
    }
    window.setTimeout(
      () => document.querySelector(".answer-feedback")?.scrollIntoView({ behavior: "smooth", block: "center" }),
      420,
    );
  }

  function finishRaid() {
    const next: RaidProgress = {
      bestScore: Math.max(progress.bestScore, battleScore),
      bestOfficial: Math.max(progress.bestOfficial, officialScore),
      clears: progress.clears + 1,
      streak: nextStreak(progress),
      lastStudy: getTodayKey(),
    };
    persist(next);
    setScreen("result");
    playFx("finish", sound);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function advance() {
    if (index === QUESTIONS.length - 1) {
      finishRaid();
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setPicks(initialPicks(QUESTIONS[nextIndex]));
    setActiveSlot(0);
    setAnswered(false);
    setUsedHint(false);
    setQuestionElapsed(0);
    setHit(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="raid-app">
      <div className="noise" aria-hidden="true" />
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      {screen === "lobby" && (
        <section className="lobby-screen">
          <header className="brandbar">
            <div className="brand-lockup">
              <span className="brand-sigil">μ</span>
              <div><p className="brand-name">ACTUARY RAID</p><p className="brand-tagline">EXAM COMBAT PROTOCOL</p></div>
            </div>
            <button className="sound-button" type="button" onClick={() => setSound((value) => !value)} aria-label="効果音を切り替える">
              <span aria-hidden="true">{sound ? "♪" : "×"}</span>{sound ? "SOUND" : "MUTE"}
            </button>
          </header>

          <div className="lobby-hero">
            <div className="season-chip"><span />2025 OFFICIAL PAST EXAM</div>
            <div className="raid-emblem" aria-hidden="true">
              <span className="emblem-ring ring-one" /><span className="emblem-ring ring-two" /><b>Σ</b>
            </div>
            <p className="hero-overline">LIFE CONTINGENCIES / STAGE 02</p>
            <h1>生保数理<br /><span>問題2</span></h1>
            <p className="hero-copy">過去問を、そのまま倒せ。</p>
          </div>

          <div className="boss-card">
            <div className="boss-card-head">
              <div><p className="micro-label">RAID BOSS</p><h2>2025年度 問題2</h2></div>
              <div className="threat-level"><span>THREAT</span> S</div>
            </div>
            <div className="hp-label"><span>BOSS HP</span><strong>{TOTAL_OFFICIAL_POINTS} / {TOTAL_OFFICIAL_POINTS}</strong></div>
            <div className="hp-track"><span style={{ width: "100%" }} /></div>
            <div className="question-pips" aria-label="全8問">
              {QUESTIONS.map((item) => <span key={item.id}>{String(item.id).padStart(2, "0")}</span>)}
            </div>
          </div>

          <button className="raid-start" type="button" onClick={startRaid}>
            <span>RAID START</span><small>本番8問に挑戦する</small><i aria-hidden="true">›</i>
          </button>
          <Link className="guided-start" href="/guided">
            <span><b>GUIDED RAID</b><small>初学者向け · 一段ずつ解く</small></span>
            <em>NEW</em>
            <i aria-hidden="true">›</i>
          </Link>

          <div className="mission-grid">
            <div><strong>8</strong><span>QUESTIONS</span></div>
            <div><strong>{formatTime(TOTAL_PAR_SECONDS)}</strong><span>TARGET</span></div>
            <div><strong>{TOTAL_OFFICIAL_POINTS}</strong><span>OFFICIAL PTS</span></div>
          </div>

          <div className="rules-card">
            <p className="section-label">COMBAT SYSTEM</p>
            <div className="rule-row"><span className="rule-icon">⚡</span><div><strong>正答でHPを削る</strong><small>公式配点そのまま。問2は3点＋4点の部分点対応。</small></div></div>
            <div className="rule-row"><span className="rule-icon">×5</span><div><strong>連続正解で最大2倍</strong><small>5連続CRITICALでバトルスコア倍率MAX。</small></div></div>
            <div className="rule-row"><span className="rule-icon">＋</span><div><strong>速解き・ノーヒント加点</strong><small>実力を落とさず、気持ちよさだけ上乗せ。</small></div></div>
          </div>

          <div className="save-strip">
            <div><span>BEST</span><strong>{progress.bestOfficial}<small>/{TOTAL_OFFICIAL_POINTS}</small></strong></div>
            <div><span>HIGH SCORE</span><strong>{progress.bestScore.toLocaleString()}</strong></div>
            <div><span>STREAK</span><strong>{progress.streak}<small>日</small></strong></div>
          </div>
          <p className="source-note">出典：公益社団法人 日本アクチュアリー会「2025年度 生保数理 問題2・解答例」</p>
        </section>
      )}

      {screen === "battle" && (
        <section className="battle-screen">
          <header className="battle-header">
            <div className="battle-brand"><span>μ</span><b>ACTUARY RAID</b></div>
            <p>Q {index + 1}<span>/ {QUESTIONS.length}</span></p>
            <button className="icon-button" type="button" onClick={() => setSound((value) => !value)} aria-label="効果音を切り替える">{sound ? "♪" : "×"}</button>
          </header>

          <section key={"boss-" + (hit?.key || index)} className={"boss-hud " + (hit ? "boss-" + hit.status : "")}>
            <div className="boss-line"><div><span className="live-dot" />RAID BOSS</div><strong>{bossHp} <small>/ {TOTAL_OFFICIAL_POINTS} HP</small></strong></div>
            <div className="boss-name">生保数理・問題2</div>
            <div className="hp-track hp-battle"><span style={{ width: String((bossHp / TOTAL_OFFICIAL_POINTS) * 100) + "%" }} /></div>
            <div className="battle-pips">
              {QUESTIONS.map((item, itemIndex) => (
                <span key={item.id} className={itemIndex < index ? "done" : itemIndex === index ? "current" : ""} />
              ))}
            </div>
          </section>

          <div className="combat-stats">
            <div><span>TIME</span><strong>{formatTime(elapsed)}</strong></div>
            <div className={combo > 1 ? "combo-live" : ""}><span>COMBO</span><strong>×{combo}</strong></div>
            <div><span>SCORE</span><strong>{battleScore.toLocaleString()}</strong></div>
          </div>

          <article className="question-card">
            <div className="question-meta"><span>QUESTION {String(question.id).padStart(2, "0")}</span><span>{question.topic}</span></div>
            <h1>{question.title}</h1>
            <div className="pace-row"><span>公式問題</span><span className={questionElapsed > question.par ? "pace-over" : ""}>PAR {formatTime(question.par)} · {formatTime(questionElapsed)}</span></div>

            <button className="question-sheet" type="button" onClick={() => setZoomOpen(true)} aria-label="問題画像を拡大する">
              <img src={question.image} alt={"2025年度 生保数理 問題2 (" + question.id + ")"} />
              <span className="zoom-chip">⌕ タップして拡大</span>
            </button>

            {!answered && (
              <div className="hint-zone">
                <button className="hint-trigger" type="button" onClick={() => setUsedHint(true)} aria-expanded={usedHint}>
                  <span>解法の軸</span><strong>{usedHint ? "表示中" : "HINT -220"}</strong>
                </button>
                {usedHint && <p className="hint-copy"><span>AXIS</span>{question.axis}</p>}
              </div>
            )}

            {!answered && (
              <section className="answer-zone">
                <div className="answer-heading">
                  <div><p>SELECT ANSWER</p><h2>{question.mode === "dual" ? "2つの解答を入力" : question.mode === "multi" ? "該当するものをすべて選択" : "最も近いものを1つ選択"}</h2></div>
                  {question.mode === "multi" && <span className="multi-badge">MULTI</span>}
                </div>

                {question.mode === "dual" && (
                  <div className="answer-slots">
                    {[0, 1].map((slot) => (
                      <button key={slot} type="button" className={activeSlot === slot ? "active" : ""} onClick={() => setActiveSlot(slot)}>
                        <span>{slot === 0 ? "①" : "②"}</span><strong>{picks[slot] || "—"}</strong>
                      </button>
                    ))}
                  </div>
                )}

                <div className={"choice-grid " + (question.options.length === 6 ? "six-grid" : "")}>
                  {question.options.map((letter) => {
                    const selected = question.mode === "dual" ? picks[activeSlot] === letter : picks.includes(letter);
                    const slotMarks = question.mode === "dual" ? picks.map((pick, slot) => pick === letter ? slot + 1 : 0).filter(Boolean) : [];
                    return (
                      <button key={letter} type="button" className={selected || slotMarks.length ? "selected" : ""} onClick={() => choose(letter)} aria-pressed={selected}>
                        {letter}
                        {slotMarks.length > 0 && <small>{slotMarks.map((slot) => slot === 1 ? "①" : "②").join("")}</small>}
                      </button>
                    );
                  })}
                </div>
                {question.mode === "multi" && <p className="none-note">F は「いずれも該当しない」</p>}
                <button className="lock-button" type="button" disabled={!ready} onClick={submitAnswer}>
                  <span>ANSWER LOCK</span><small>{ready ? displayAnswer(question, picks) : "解答を選択"}</small>
                </button>
              </section>
            )}

            {answered && hit && (
              <section className={"answer-feedback feedback-" + hit.status}>
                <div className="feedback-top">
                  <div>
                    <p>{hit.status === "critical" ? "CRITICAL HIT" : hit.status === "partial" ? "PARTIAL BREAK" : "ATTACK BLOCKED"}</p>
                    <h2>{hit.status === "critical" ? "正解。完全撃破！" : hit.status === "partial" ? "部分点を確保" : "惜しい。解法を回収しよう"}</h2>
                  </div>
                  <strong className="damage-number">-{lastOfficial}<small> HP</small></strong>
                </div>
                <div className="answer-compare">
                  <div><span>YOUR ANSWER</span><strong>{attempts.at(-1)?.answer}</strong></div>
                  <div><span>CORRECT</span><strong>{attempts.at(-1)?.correct}</strong></div>
                </div>
                <div className="reward-ledger">
                  <div><span>公式得点</span><strong>{lastOfficial} / {question.points}</strong></div>
                  <div><span>コンボ倍率</span><strong>×{lastMultiplier.toFixed(2)}</strong></div>
                  <div className={lastBonuses.speed ? "bonus-on" : ""}><span>速解き</span><strong>+{lastBonuses.speed}</strong></div>
                  <div className={lastBonuses.noHint ? "bonus-on" : ""}><span>ノーヒント</span><strong>+{lastBonuses.noHint}</strong></div>
                </div>
                <div className="score-burst"><span>BATTLE SCORE</span><strong>+{lastGain.toLocaleString()}</strong></div>
                <button className="solution-button" type="button" onClick={() => setSolutionOpen(true)}><span>公式解答で検証する</span><small>OFFICIAL SOLUTION</small></button>
                <section className="stuck-note">
                  <div className="stuck-note-head">
                    <div>
                      <p>STUMBLE NOTE</p>
                      <h3>今回、どこで詰まった？</h3>
                    </div>
                    <span><i />AUTO SAVED</span>
                  </div>
                  <p className="stuck-note-guide">短く残しておくと、次に同じ問題を解くとき最初から表示されます。</p>
                  <div className="note-tags" aria-label="詰まった箇所のタグ">
                    {NOTE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={(stuckNotes[String(question.id)] || "").includes("#" + tag) ? "selected" : ""}
                        onClick={() => addNoteTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    aria-label={"問題" + question.id + "で詰まった箇所のメモ"}
                    value={stuckNotes[String(question.id)] || ""}
                    maxLength={500}
                    rows={4}
                    placeholder="例：60歳で生存関数を分けた後、後半の積分の立て方が出てこなかった"
                    onChange={(event) => updateStuckNote(question.id, event.target.value)}
                  />
                  <div className="stuck-note-foot">
                    <span>{(stuckNotes[String(question.id)] || "").length} / 500</span>
                    {stuckNotes[String(question.id)] && (
                      <button type="button" onClick={() => updateStuckNote(question.id, "")}>メモを消す</button>
                    )}
                  </div>
                </section>
                <button className="next-button" type="button" onClick={advance}>{index === QUESTIONS.length - 1 ? "RESULTへ" : "QUESTION " + String(index + 2).padStart(2, "0") + " へ"}<span>›</span></button>
              </section>
            )}
          </article>
          <p className="battle-source">2025年度 生保数理 問題2 · 公式問題</p>
        </section>
      )}

      {screen === "result" && (
        <section className="result-screen">
          <header className="result-header"><div className="battle-brand"><span>μ</span><b>ACTUARY RAID</b></div><span>MISSION COMPLETE</span></header>
          <div className="result-hero">
            <p>2025 OFFICIAL RAID</p>
            <div className={"rank-orb rank-" + resultRank.toLowerCase()}><small>RANK</small><strong>{resultRank}</strong></div>
            <h1>{resultRank === "S" ? "PERFECT CLEAR" : resultRank === "A" ? "BOSS DEFEATED" : resultRank === "B" ? "CORE DAMAGED" : "RETRY READY"}</h1>
            <p className="result-message">{resultRank === "S" ? TOTAL_OFFICIAL_POINTS + "点。過去問を完全制圧した。" : "残ったHPが、次に伸びる場所だ。"}</p>
          </div>
          <div className="result-score-card">
            <div className="official-total"><span>OFFICIAL SCORE</span><strong>{officialScore}<small>/{TOTAL_OFFICIAL_POINTS}</small></strong></div>
            <div className="result-hp"><span>残りBOSS HP</span><strong>{bossHp}</strong></div>
            <div className="result-score-line"><span>BATTLE SCORE</span><strong>{battleScore.toLocaleString()}</strong></div>
            <div className="result-triple">
              <div><span>TIME</span><strong>{formatTime(elapsed)}</strong></div>
              <div><span>FULL SCORE</span><strong>{attempts.filter((attempt) => attempt.official === QUESTIONS[attempt.id - 1].points).length}<small>/8</small></strong></div>
              <div><span>BEST COMBO</span><strong>×{bestCombo}</strong></div>
            </div>
          </div>
          <section className="breakdown-card">
            <div className="breakdown-title"><p>COMBAT LOG</p><span>公式配点</span></div>
            {attempts.map((attempt) => (
              <div className="attempt-row" key={attempt.id}>
                <span className={"attempt-mark " + attempt.status}>{attempt.status === "critical" ? "✓" : attempt.status === "partial" ? "△" : "×"}</span>
                <div><strong>Q{String(attempt.id).padStart(2, "0")} · {QUESTIONS[attempt.id - 1].topic}</strong><small>{formatTime(attempt.seconds)} · {attempt.usedHint ? "HINT USED" : "NO HINT"}</small></div>
                <b>{attempt.official}<small>/{QUESTIONS[attempt.id - 1].points}</small></b>
              </div>
            ))}
          </section>
          <section className="review-card">
            <p className="section-label">NEXT TARGET</p>
            <h2>{reviewTargets.length ? "次に叩く論点" : "弱点なし。次は速度戦へ。"}</h2>
            {reviewTargets.length > 0 && <div className="target-tags">{reviewTargets.map((target, targetIndex) => <span key={target + "-" + targetIndex}>{target}</span>)}</div>}
          </section>
          <section className="memo-summary-card">
            <div className="memo-summary-title">
              <div><p>STUMBLE NOTES</p><h2>詰まった箇所</h2></div>
              <span>{notedQuestions.length} / 8</span>
            </div>
            {notedQuestions.length ? (
              <div className="memo-summary-list">
                {notedQuestions.map((item) => (
                  <article key={item.id}>
                    <div><span>Q{String(item.id).padStart(2, "0")}</span><strong>{item.topic}</strong></div>
                    <p>{stuckNotes[String(item.id)]}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="memo-empty">今回はメモなし。解答後に詰まった箇所を残すと、ここに一覧表示されます。</p>
            )}
          </section>
          <button className="raid-start retry-button" type="button" onClick={startRaid}><span>RETRY RAID</span><small>同じ8問でもう一度</small><i aria-hidden="true">↻</i></button>
          <button className="lobby-button" type="button" onClick={() => setScreen("lobby")}>ロビーへ戻る</button>
          <p className="source-note">出典：公益社団法人 日本アクチュアリー会「2025年度 生保数理 問題2・解答例」</p>
        </section>
      )}

      {hit && screen === "battle" && (
        <div key={hit.key} className={"impact-layer impact-" + hit.status} aria-hidden="true">
          <span className="slash slash-one" /><span className="slash slash-two" />
          <div className="sparks">{Array.from({ length: 10 }, (_, spark) => <i key={spark} />)}</div>
          <strong>{hit.status === "critical" ? "CRITICAL" : hit.status === "partial" ? "PARTIAL" : "MISS"}</strong>
        </div>
      )}

      {zoomOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="問題の拡大表示" onClick={() => setZoomOpen(false)}>
          <div className="image-modal zoom-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span>QUESTION {String(question.id).padStart(2, "0")}</span><strong>ピンチ操作で拡大できます</strong></div><button type="button" onClick={() => setZoomOpen(false)} aria-label="閉じる">×</button></div>
            <div className="zoom-scroll"><img src={question.image} alt={"問題" + question.id + "の拡大"} /></div>
          </div>
        </div>
      )}

      {solutionOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="公式解答" onClick={() => setSolutionOpen(false)}>
          <div className="image-modal solution-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span>OFFICIAL SOLUTION</span><strong>問題 {question.id} · 解答例</strong></div><button type="button" onClick={() => setSolutionOpen(false)} aria-label="閉じる">×</button></div>
            <div className="solution-scroll">{question.solutions.map((solution) => <img key={solution} src={solution} alt={"問題" + question.id + "の公式解答"} />)}</div>
            <button className="modal-close-button" type="button" onClick={() => setSolutionOpen(false)}>戦闘画面へ戻る</button>
          </div>
        </div>
      )}
    </main>
  );
}
