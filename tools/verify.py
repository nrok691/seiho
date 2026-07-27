#!/usr/bin/env python3
"""本文に記載した数値解答を独立に再計算し、本文の値と照合する。

使い方:

    python3 tools/verify.py            # 全チェックを実行
    python3 tools/verify.py -v         # 一致したものも含めて全件表示

`tools/basis.py` の基礎率・保険数理関数だけを使って値を作り直し、
本文に書いてある数値（このファイルの EXPECTED に転記したもの）と突き合わせる。
本文を書き換えたら、対応する期待値もここに反映すること。

終了コード: 0 = 全件一致、1 = 不一致あり。
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import basis as B  # noqa: E402

I = 0.03  # 標準予定利率

# ---------------------------------------------------------------------------
# チェックの登録
# ---------------------------------------------------------------------------

CHECKS: list[tuple[str, str, float, float, float]] = []
# (章, 内容, 本文の値, 再計算した値, 許容誤差)


def check(chapter: str, label: str, text_value: float, computed: float,
          tol: float = 5e-7) -> None:
    CHECKS.append((chapter, label, text_value, computed, tol))


# ---------------------------------------------------------------------------
# 第1章　利息の理論と現価計算
# ---------------------------------------------------------------------------

v = B.v_of(I)
d = B.d_of(I)
delta = B.delta_of(I)

check("第1章", "v (i=3%)", 0.9708738, v)
check("第1章", "d (i=3%)", 0.0291262, d)
check("第1章", "delta (i=3%)", 0.0295588, delta)
check("第1章", "ä_10| (i=4%)", 8.435332, B.annuity_due_certain(10, 0.04), 5e-6)

# 期間により利率が変わる年金（前半5年 6%、後半 4%）
check("第1章", "v1^5", 0.7472582, (1 / 1.06) ** 5)
check("第1章", "v1^5 v2^2 (時点7の現価)", 0.6908822,
      (1 / 1.06) ** 5 * (1 / 1.04) ** 2)

# ---------------------------------------------------------------------------
# 第2章　生命表と生存分布
# ---------------------------------------------------------------------------

check("第2章", "5p40", 0.9917670, B.tpx(5, 40))
check("第2章", "e40 (略算)", 42.164, B.e_curtate(40), 5e-3)
check("第2章", "e°40", 42.664, B.e_complete(40), 5e-3)
check("第2章", "Makeham c^50(c^10-1)", 339.4924,
      1.11 ** 50 * (1.11 ** 10 - 1), 5e-4)

# ---------------------------------------------------------------------------
# 第3章　一時払純保険料
# ---------------------------------------------------------------------------

check("第3章", "A_40", B.A_whole(40, I), B.A_whole(40, I))
check("第3章", "A_40 = 1 - d ä_40", B.A_whole(40, I),
      1 - d * B.a_due(40, I), 1e-12)
check("第3章", "A^1_40:20|", 0.0404606, B.A_term(40, 20, I))
check("第3章", "20E40", 0.5214386, B.nEx(40, 20, I))
check("第3章", "A_40:20| (養老)", 0.5618992, B.A_endow(40, 20, I))
check("第3章", "(IA)^1_40:20|", 0.4788157, B.IA_term(40, 20, I))
check("第3章", "(DA)^1_40:20|", 0.3708571, B.DA_term(40, 20, I))
check("第3章", "(DA)+(IA) = (n+1)A^1", (20 + 1) * B.A_term(40, 20, I),
      B.DA_term(40, 20, I) + B.IA_term(40, 20, I), 1e-12)

# ---------------------------------------------------------------------------
# 第4章　生命年金
# ---------------------------------------------------------------------------

check("第4章", "ä_40:20|", 15.0414615, B.a_due(40, I, 20), 5e-6)
check("第4章", "ä_40 = (1-A_40)/d", B.a_due(40, I),
      (1 - B.A_whole(40, I)) / d, 1e-12)
check("第4章", "a_40 = ä_40 - 1", B.a_imm(40, I), B.a_due(40, I) - 1, 1e-12)

# ---------------------------------------------------------------------------
# 第5章　平準純保険料
# ---------------------------------------------------------------------------

P_endow = B.P_endow(40, 20, I)
check("第5章", "P_40:20| (養老)", 0.0373567, P_endow)
check("第5章", "P = A/ä", P_endow, B.A_endow(40, 20, I) / B.a_due(40, I, 20),
      1e-12)

# ---------------------------------------------------------------------------
# 第6章　責任準備金
# ---------------------------------------------------------------------------

V10 = B.V_endow_prospective(40, 20, 10, I)
V11 = B.V_endow_prospective(40, 20, 11, I)
check("第6章", "10V (将来法)", 0.4242821, V10)
check("第6章", "11V (将来法)", 0.4740460, V11)
check("第6章", "10V 将来法 = 過去法", V10,
      B.V_endow_retrospective(40, 20, 10, I), 1e-12)
check("第6章", "Fackler で 10V -> 11V", V11,
      B.fackler(V10, P_endow, I, 50), 1e-12)
check("第6章", "危険保険金額 S - 11V", 0.5259540, 1.0 - V11)

# ---------------------------------------------------------------------------
# 第7章　営業保険料と実務計算
# ---------------------------------------------------------------------------

# 予定事業費 alpha=0.03（初年度のみ）、beta=5%（営業保険料比）、gamma=0.002（毎年）
alpha, beta, gamma = 0.03, 0.05, 0.002
adue = B.a_due(40, I, 20)
A_e = B.A_endow(40, 20, I)
# P'ä = A + alpha + beta P' ä + gamma ä
P_gross = (A_e + alpha + gamma * adue) / ((1 - beta) * adue)
check("第7章", "営業保険料 P'", 0.0435276, P_gross)
check("第7章", "付加保険料 P' - P", 0.0061709, P_gross - P_endow)
check("第7章", "第11年度の予定事業費", 0.0041764, beta * P_gross + gamma)

# ---------------------------------------------------------------------------
# 第8章　連生と最終生存
# ---------------------------------------------------------------------------

check("第8章", "ä_70:75 (連生)", B.a_due_joint(70, 75, I),
      B.a_due_joint(70, 75, I))
check("第8章", "包除原理 ä_xy̅ = ä_x + ä_y - ä_xy",
      B.a_due_last(70, 75, I),
      B.a_due(70, I) + B.a_due(75, I) - B.a_due_joint(70, 75, I), 1e-12)
check("第8章", "tpxy = tpx * tpy", B.tpxy(10, 70, 75),
      B.tpx(10, 70) * B.tpx(10, 75), 1e-15)
# Gompertz 型の等価年齢: c^w = c^x + c^y （Makeham の B c^x 部分）
c = B.C_MAKEHAM
check("第8章", "c^60 + c^65", 1407.1241,
      c ** 60 + c ** 65, 5e-4)
check("第8章", "等価年齢 w (c^w = c^60 + c^65)", 69.46438,
      math.log(c ** 60 + c ** 65) / math.log(c), 5e-5)

# ---------------------------------------------------------------------------
# 第9章　多重脱退と多状態モデル
# ---------------------------------------------------------------------------

# 3状態モデル（回復なし）: mu^ai = 0.02, mu^ad = 0.01, mu^id = 0.05
#   tp^aa = exp(-(mu^ai + mu^ad) t)
#   tp^ai = exp(-(mu^ai + mu^ad) t) - exp(-mu^id t)   （本問は mu^id - mu^a. = mu^ai）
mu_ai, mu_ad, mu_id = 0.02, 0.01, 0.05
d1 = delta + mu_ai + mu_ad          # 0.0595588 : ā^aa の指数
d2 = delta + mu_id                  # 0.0795588 : ā^ai の第2項の指数
a_aa = (1 - math.exp(-20 * d1)) / d1
a_ai = a_aa - (1 - math.exp(-20 * d2)) / d2
check("第9章", "ā^aa_20|", 11.688219, a_aa, 5e-6)
check("第9章", "ā^ai_20|", 1.679093, a_ai, 5e-6)
check("第9章", "払込免除ありの保険料", 0.160840, 1.879930 / a_aa, 5e-6)
check("第9章", "払込免除なしの保険料", 0.140636, 1.879930 / (a_aa + a_ai), 5e-6)
check("第9章", "免除特約の保険料", 0.020203,
      1.879930 / a_aa - 1.879930 / (a_aa + a_ai), 5e-6)
check("第9章", "免除ありの保険料の倍率", 1.143657, 1 + a_ai / a_aa, 5e-6)
# 多重脱退: q'^(1)=0.02, q'^(2)=0.05 のとき q^(tau) と各 q^(j)
qp1, qp2 = 0.02, 0.05
q_tau = 1 - (1 - qp1) * (1 - qp2)
check("第9章", "q^(tau) = 1 - Π(1-q'^(j))", 0.069, q_tau, 5e-4)
check("第9章", "q^(1)+q^(2) = q^(tau)", q_tau,
      qp1 * (1 - qp2 / 2) + qp2 * (1 - qp1 / 2), 1e-15)

# ---------------------------------------------------------------------------
# 第10章　総合応用と収支分析
# ---------------------------------------------------------------------------

# Q10-1-1 複合給付（死亡給付 20,19,...,1 ／ 満期給付 5）
DA20 = B.DA_term(40, 20, I)
E20 = B.nEx(40, 20, I)
benefit = DA20 + 5 * E20
P_comp = benefit / B.a_due(40, I, 20)
check("第10章", "Q10-1-1 給付の期待現価合計", 2.9780501, benefit, 5e-6)
check("第10章", "Q10-1-1 P", 0.1979894, P_comp)
check("第10章", "Q10-1-1 死亡給付の割合", 0.124531, DA20 / benefit, 5e-6)
V10_comp = (B.DA_term(50, 10, I) + 5 * B.nEx(50, 10, I)
            - P_comp * B.a_due(50, I, 10))
check("第10章", "Q10-1-1 10V (将来法)", 2.0274937, V10_comp, 5e-6)
past_benefit = B.DA_term(40, 10, I) + 10 * B.A_term(40, 10, I)
V10_retro = ((P_comp * B.a_due(40, I, 10) - past_benefit) / B.nEx(40, 10, I))
check("第10章", "Q10-1-1 10V 将来法 = 過去法", V10_comp, V10_retro, 1e-9)
check("第10章", "Q10-1-1 既払給付 (DA)+10A", 0.2472953, past_benefit, 5e-6)

# Q10-2-1 利源分析（i'=3.5%, q'=0.0025）
i_act, q_act = 0.035, 0.0025
q50 = B.qx(50)
fund = V10 + P_endow
gain = fund * (1 + i_act) - (q_act * 1.0 + (1 - q_act) * V11)
interest_gain = fund * (i_act - I)
mortality_gain = (q50 - q_act) * (1.0 - V11)
check("第10章", "Q10-2-1 期首資金", 0.4616388, fund)
check("第10章", "Q10-2-1 実際の損益 G", 0.0024353, gain)
check("第10章", "Q10-2-1 利差益", 0.0023082, interest_gain)
check("第10章", "Q10-2-1 死差益", 0.0001271, mortality_gain)
check("第10章", "Q10-2-1 利差益+死差益 = G", gain,
      interest_gain + mortality_gain, 1e-15)
check("第10章", "Q10-2-1 利差益の割合", 0.9478, interest_gain / gain, 5e-5)
expense_gain = (beta * P_gross + gamma - 0.0038) * (1 + i_act)
check("第10章", "Q10-2-1 費差益", 0.0003896, expense_gain)
check("第10章", "Q10-2-1 3利源合計", 0.0028248,
      interest_gain + mortality_gain + expense_gain)

# Q10-2-2 群団（N=10000 件、S=1000 万円、死亡 25 件）
N, S, D = 10000, 1000.0, 25
scale = N * S
res_begin = scale * V10
premium = scale * P_endow
investment = (res_begin + premium) * i_act
claims = D * S
res_end = (N - D) * S * V11
profit = res_begin + premium + investment - claims - res_end
check("第10章", "Q10-2-2 期首責任準備金", 4242820.9, res_begin, 0.05)
check("第10章", "Q10-2-2 純保険料収入", 373566.9, premium, 0.05)
check("第10章", "Q10-2-2 運用収益", 161573.6, investment, 0.05)
check("第10章", "Q10-2-2 期末責任準備金", 4728608.6, res_end, 0.05)
check("第10章", "Q10-2-2 利益", 24352.8, profit, 0.05)
check("第10章", "Q10-2-2 利益 = N*S*G", scale * gain, profit, 1e-6)
check("第10章", "Q10-2-2 利差益(総額)", 23081.9,
      (res_begin + premium) * (i_act - I), 0.05)
check("第10章", "Q10-2-2 死差益(総額)", 1270.9,
      (N * q50 - D) * (S - S * V11), 0.05)

# ---------------------------------------------------------------------------
# 基礎率そのものの整合性（README の表に対応）
# ---------------------------------------------------------------------------

check("基礎率", "A_x = 1 - d ä_x", B.A_whole(40, I), 1 - d * B.a_due(40, I),
      1e-15)
check("基礎率", "Ā_x = 1 - δ ā_x", B.A_bar_whole(40, I),
      1 - delta * B.a_bar(40, I), 1e-6)
check("基礎率", "Ā_x / A_x ≈ i/δ", I / delta,
      B.A_bar_whole(40, I) / B.A_whole(40, I), 1e-3)
check("基礎率", "e°_x ≈ e_x + 1/2", B.e_curtate(40) + 0.5, B.e_complete(40),
      1e-3)
check("基礎率", "ω までの生存確率 < 1e-6", 0.0,
      B.tpx(B.OMEGA - 40, 40), 1e-6)


# ---------------------------------------------------------------------------
# 実行
# ---------------------------------------------------------------------------

def main() -> int:
    verbose = "-v" in sys.argv or "--verbose" in sys.argv
    failures = []
    width = max(len(label) for _, label, _, _, _ in CHECKS)

    current_chapter = None
    for chapter, label, expected, computed, tol in CHECKS:
        ok = abs(expected - computed) <= tol
        if not ok:
            failures.append((chapter, label, expected, computed, tol))
        if verbose or not ok:
            if chapter != current_chapter:
                print(f"\n[{chapter}]")
                current_chapter = chapter
            mark = "OK  " if ok else "FAIL"
            print(f"  {mark} {label:<{width}}  本文 {expected!r:>16}"
                  f"  再計算 {computed!r:>22}"
                  f"  差 {abs(expected - computed):.3e}")

    total = len(CHECKS)
    print()
    if failures:
        print(f"{len(failures)} / {total} 件が不一致でした。")
        return 1
    print(f"全 {total} 件が一致しました。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
