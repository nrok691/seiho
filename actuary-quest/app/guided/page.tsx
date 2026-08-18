/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./guided.module.css";
import { GUIDED_QUESTIONS } from "./data";
import { getQuestionMeta } from "../exam/2025-q2";
import { readGuidedProgress, writeGuidedProgress } from "../storage";

type Feedback = "idle" | "wrong" | "correct";

export default function GuidedRaid() {
  const [screen, setScreen] = useState<"map" | "lesson">("map");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [misses, setMisses] = useState(0);
  const [sessionMisses, setSessionMisses] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [justCleared, setJustCleared] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);

  const question = GUIDED_QUESTIONS[questionIndex];
  // 論点名・公式問題画像・公式解答画像は試験セット共通のメタデータから取る。
  const meta = getQuestionMeta(question.id);
  const step = question.steps[stepIndex];
  const progress = ((stepIndex + (feedback === "correct" ? 1 : 0)) / question.steps.length) * 100;
  const understanding = Math.max(40, 100 - sessionMisses * 10);

  const completedSet = useMemo(() => new Set(completed), [completed]);

  // 通常版と同じく、requestAnimationFrame を挟まずエフェクト内で直接復元する。
  useEffect(() => {
    const saved = readGuidedProgress();
    if (saved) {
      // localStorage はSSR時に読めないため、マウント後の一度だけ復元する。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompleted(saved);
    }
  }, []);

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

  function persistCompleted(next: number[]) {
    setCompleted(next);
    // 保存できなくても学習は続けられる。失敗は storage 側で警告を出す。
    writeGuidedProgress(next);
  }

  function startQuestion(index: number) {
    setQuestionIndex(index);
    setStepIndex(0);
    setSelected(null);
    setFeedback("idle");
    setMisses(0);
    setSessionMisses(0);
    setJustCleared(false);
    setScreen("lesson");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function choose(choiceIndex: number) {
    if (feedback === "correct") return;
    setSelected(choiceIndex);
    setFeedback("idle");
  }

  function checkAnswer() {
    if (selected === null || feedback === "correct") return;
    if (selected === step.correct) {
      setFeedback("correct");
      return;
    }
    setFeedback("wrong");
    setMisses((value) => value + 1);
    setSessionMisses((value) => value + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(55);
  }

  function nextStep() {
    if (stepIndex < question.steps.length - 1) {
      setStepIndex((value) => value + 1);
      setSelected(null);
      setFeedback("idle");
      setMisses(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!completedSet.has(question.id)) persistCompleted([...completed, question.id]);
    setJustCleared(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToNextQuestion() {
    const nextIndex = (questionIndex + 1) % GUIDED_QUESTIONS.length;
    startQuestion(nextIndex);
  }

  return (
    <main className={styles.app}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />

      {screen === "map" && (
        <section className={styles.mapScreen}>
          <header className={styles.header}>
            <Link href="/" className={styles.backLink} aria-label="通常版へ戻る">‹</Link>
            <div className={styles.brand}>
              <span>∴</span>
              <div><b>GUIDED RAID</b><small>LEARNING PROTOCOL</small></div>
            </div>
            <div className={styles.clearCount}>{completed.length}<span>/8</span></div>
          </header>

          <section className={styles.mapHero}>
            <p className={styles.kicker}>BEGINNER SCAFFOLD MODE</p>
            <h1>解けるまでの<br /><em>足場</em>をつくる。</h1>
            <p>過去問の難度は変えず、考える順番だけを小さなステップに分解します。</p>
          </section>

          <section className={styles.systemCard}>
            <div><span>01</span><p><b>原文を読む</b><small>問題は本番と同じ</small></p></div>
            <i />
            <div><span>02</span><p><b>一段ずつ選ぶ</b><small>方針→立式→計算</small></p></div>
            <i />
            <div><span>03</span><p><b>理由を回収</b><small>誤答もその場で修正</small></p></div>
          </section>

          <div className={styles.mapTitle}>
            <div><p>2025 · 生保数理 問題2</p><h2>演習マップ</h2></div>
            <span>{completed.length === 8 ? "ALL CLEAR" : "8 QUESTIONS"}</span>
          </div>

          <div className={styles.questionMap}>
            {GUIDED_QUESTIONS.map((item, index) => {
              const isComplete = completedSet.has(item.id);
              const itemMeta = getQuestionMeta(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={isComplete ? styles.mapCardComplete : styles.mapCard}
                  onClick={() => startQuestion(index)}
                >
                  <div className={styles.mapNumber}>
                    <span>Q</span>{String(item.id).padStart(2, "0")}
                  </div>
                  <div className={styles.mapCopy}>
                    <small>{itemMeta.topic}</small>
                    <strong>{item.title}</strong>
                    <p>{item.steps.length} STEPS</p>
                  </div>
                  <div className={styles.mapStatus}>{isComplete ? "✓" : "›"}</div>
                </button>
              );
            })}
          </div>

          <aside className={styles.modeNotice}>
            <span>本番演習も残っています</span>
            <p>誘導なしで力を試すときは、通常のACTUARY RAIDへ。</p>
            <Link href="/">通常版へ戻る <b>›</b></Link>
          </aside>
        </section>
      )}

      {screen === "lesson" && !justCleared && (
        <section className={styles.lessonScreen}>
          <header className={styles.lessonHeader}>
            <button type="button" onClick={() => setScreen("map")} aria-label="演習マップへ戻る">‹</button>
            <div><span>GUIDED RAID</span><strong>Q{String(question.id).padStart(2, "0")}</strong></div>
            <div className={styles.headerGauge}><span>UNDERSTANDING</span><b>{understanding}%</b></div>
          </header>

          <div className={styles.lessonProgress}>
            <div className={styles.progressCopy}>
              <span>STEP {stepIndex + 1} / {question.steps.length}</span>
              <strong>{meta.topic}</strong>
            </div>
            <div className={styles.progressTrack}><i style={{ width: progress + "%" }} /></div>
            <div className={styles.stepDots}>
              {question.steps.map((_, index) => (
                <span key={index} className={index < stepIndex || (index === stepIndex && feedback === "correct") ? styles.dotDone : index === stepIndex ? styles.dotCurrent : ""}>
                  {index + 1}
                </span>
              ))}
            </div>
          </div>

          <article className={styles.problemOverview}>
            <div className={styles.overviewHead}>
              <div><p>ORIGINAL QUESTION</p><h1>{question.title}</h1></div>
              <button type="button" onClick={() => setZoomOpen(true)}>拡大</button>
            </div>
            <p className={styles.goal}><span>GOAL</span>{question.goal}</p>
            <button className={styles.problemImage} type="button" onClick={() => setZoomOpen(true)} aria-label="公式問題を拡大する">
              <img src={meta.image} alt={"2025年度生保数理 問題2 (" + question.id + ")"} />
              <span>⌕ TAP TO ZOOM</span>
            </button>
          </article>

          <article className={styles.stepCard} key={question.id + "-" + stepIndex}>
            <div className={styles.stepHead}>
              <span>{step.phase}</span>
              <small>{misses ? "RETRY " + misses : "STEP " + String(stepIndex + 1).padStart(2, "0")}</small>
            </div>
            <h2>{step.title}</h2>
            <p className={styles.prompt}>{step.prompt}</p>
            {step.formula && <div className={styles.formula}>{step.formula}</div>}

            <div className={styles.choices}>
              {step.choices.map((choice, choiceIndex) => {
                const isSelected = selected === choiceIndex;
                const isCorrect = feedback === "correct" && choiceIndex === step.correct;
                const isWrong = feedback === "wrong" && isSelected;
                const className = isCorrect ? styles.choiceCorrect : isWrong ? styles.choiceWrong : isSelected ? styles.choiceSelected : styles.choice;
                return (
                  <button type="button" className={className} key={choice.label} onClick={() => choose(choiceIndex)}>
                    <span>{String.fromCharCode(65 + choiceIndex)}</span>
                    <div><strong>{choice.label}</strong>{choice.sub && <small>{choice.sub}</small>}</div>
                    <i>{isCorrect ? "✓" : isWrong ? "×" : ""}</i>
                  </button>
                );
              })}
            </div>

            {feedback === "wrong" && (
              <aside className={styles.wrongFeedback}>
                <div><span>NOT YET</span><strong>ここを確認</strong></div>
                <p>{step.wrongHint}</p>
              </aside>
            )}

            {feedback === "correct" && (
              <aside className={styles.correctFeedback}>
                <div><span>LOGIC ACQUIRED</span><strong>この一段の意味</strong></div>
                <p>{step.explanation}</p>
              </aside>
            )}

            {feedback !== "correct" ? (
              <button type="button" className={styles.checkButton} disabled={selected === null} onClick={checkAnswer}>
                <span>CHECK LOGIC</span><small>{selected === null ? "選択肢を選ぶ" : "この考え方で進む"}</small>
              </button>
            ) : (
              <button type="button" className={styles.nextButton} onClick={nextStep}>
                <span>{stepIndex === question.steps.length - 1 ? "ANSWERへ" : "NEXT STEP"}</span>
                <small>{stepIndex === question.steps.length - 1 ? "結論を確認する" : "次の一段へ進む"}</small>
                <b>›</b>
              </button>
            )}
          </article>
        </section>
      )}

      {screen === "lesson" && justCleared && (
        <section className={styles.clearScreen}>
          <header className={styles.header}>
            <button type="button" className={styles.backLink} onClick={() => setScreen("map")} aria-label="演習マップへ戻る">‹</button>
            <div className={styles.brand}><span>∴</span><div><b>GUIDED RAID</b><small>LOGIC COMPLETE</small></div></div>
            <div className={styles.clearCount}>{completedSet.has(question.id) ? "✓" : ""}</div>
          </header>

          <div className={styles.clearHero}>
            <p>QUESTION {String(question.id).padStart(2, "0")} · LOGIC COMPLETE</p>
            <div className={styles.clearOrb}><span>理解度</span><strong>{understanding}</strong><small>%</small></div>
            <h1>足場、完成。</h1>
            <p>{question.steps.length}段の論理をつないで、本番の答えまで到達しました。</p>
          </div>

          <section className={styles.answerCard}>
            <span>FINAL ANSWER</span>
            <strong>{question.finalAnswer}</strong>
            <p>{question.goal}</p>
          </section>

          <section className={styles.logicRoute}>
            <p>YOUR LOGIC ROUTE</p>
            {question.steps.map((item, index) => (
              <div key={item.title}><span>{index + 1}</span><div><small>{item.phase}</small><strong>{item.title}</strong></div><b>✓</b></div>
            ))}
          </section>

          <button type="button" className={styles.solutionButton} onClick={() => setSolutionOpen(true)}>
            <span>公式解答と照合する</span><small>OFFICIAL SOLUTION</small>
          </button>
          <button type="button" className={styles.nextQuestionButton} onClick={goToNextQuestion}>
            <span>{question.id === 8 ? "Q01へ戻る" : "次の問題へ"}</span><b>›</b>
          </button>
          <button type="button" className={styles.mapButton} onClick={() => setScreen("map")}>演習マップへ</button>
          <Link className={styles.examLink} href="/">誘導なしの本番版で試す</Link>
        </section>
      )}

      {zoomOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="公式問題の拡大" onClick={() => setZoomOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}><div><span>ORIGINAL QUESTION</span><strong>問題 {question.id}</strong></div><button type="button" onClick={() => setZoomOpen(false)}>×</button></div>
            <div className={styles.zoomScroll}><img src={meta.image} alt={"問題" + question.id + "の拡大"} /></div>
          </div>
        </div>
      )}

      {solutionOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="公式解答" onClick={() => setSolutionOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}><div><span>OFFICIAL SOLUTION</span><strong>問題 {question.id} · 解答例</strong></div><button type="button" onClick={() => setSolutionOpen(false)}>×</button></div>
            <div className={styles.solutionScroll}>
              {meta.solutions.map((image) => <img key={image} src={image} alt={"問題" + question.id + "の公式解答"} />)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
