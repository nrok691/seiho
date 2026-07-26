"""
本書で使用する標準例示基礎率（Illustrative Basis）

本書の数値問題は、原則として問題文中に与えられた値のみから解けるように
作られている。ただし「与えられた値どうしが数理的に矛盾していない」ことを
保証するため、本ファイルの生命表・利率を母体として全ての例示数値を生成する。

死亡法則    : Makeham  mu_x = A + B c^x
利率        : i = 0.03 を標準、問題により i = 0.05 も使用

このモジュールは docs 配下の全数値の生成元であり、verify.py から検算に用いる。
"""

from __future__ import annotations

import math
from functools import lru_cache

# ---------------------------------------------------------------- 基礎率パラメータ

A_MAKEHAM = 0.0008
B_MAKEHAM = 0.00001
C_MAKEHAM = 1.11

OMEGA = 115  # 最終年齢（l_OMEGA = 0 とする）


def mu(x: float) -> float:
    """死力 mu_x = A + B c^x."""
    return A_MAKEHAM + B_MAKEHAM * (C_MAKEHAM ** x)


def _integrated_mu(x: float) -> float:
    """int_0^x mu_s ds  （Makeham の積分死力）"""
    return A_MAKEHAM * x + B_MAKEHAM * (C_MAKEHAM ** x - 1.0) / math.log(C_MAKEHAM)


def lx(x: float, radix: float = 100_000.0) -> float:
    """生存数 l_x = radix * exp(-int_0^x mu ds)."""
    if x >= OMEGA:
        return 0.0
    return radix * math.exp(-_integrated_mu(x))


@lru_cache(maxsize=None)
def tpx(t: float, x: float) -> float:
    """生存確率 _t p_x = l_{x+t} / l_x."""
    if x + t >= OMEGA:
        return 0.0
    return math.exp(-(_integrated_mu(x + t) - _integrated_mu(x)))


def tqx(t: float, x: float) -> float:
    """死亡確率 _t q_x = 1 - _t p_x."""
    return 1.0 - tpx(t, x)


def px(x: float) -> float:
    """p_x = _1 p_x."""
    return tpx(1.0, x)


def qx(x: float) -> float:
    """q_x = _1 q_x."""
    return 1.0 - px(x)


# ---------------------------------------------------------------- 利息の理論

def v_of(i: float) -> float:
    """現価率 v = 1/(1+i)."""
    return 1.0 / (1.0 + i)


def d_of(i: float) -> float:
    """割引率 d = 1 - v = i*v."""
    return i / (1.0 + i)


def delta_of(i: float) -> float:
    """利力 delta = ln(1+i)."""
    return math.log(1.0 + i)


def annuity_due_certain(n: int, i: float) -> float:
    """確定期始払年金現価 addot_n = (1 - v^n)/d."""
    return (1.0 - v_of(i) ** n) / d_of(i)


def annuity_imm_certain(n: int, i: float) -> float:
    """確定期末払年金現価 a_n = (1 - v^n)/i."""
    return (1.0 - v_of(i) ** n) / i


def annuity_cont_certain(n: float, i: float) -> float:
    """確定連続年金現価 abar_n = (1 - v^n)/delta."""
    return (1.0 - v_of(i) ** n) / delta_of(i)


# ---------------------------------------------------------------- 生命年金

def a_due(x: float, i: float, n: int | None = None) -> float:
    """期始払生命年金現価 addot_x  または  addot_{x:n} = sum_{t=0}^{n-1} v^t _tp_x."""
    v = v_of(i)
    upper = int(OMEGA - x) if n is None else n
    return sum((v ** t) * tpx(float(t), x) for t in range(upper))


def a_imm(x: float, i: float, n: int | None = None) -> float:
    """期末払生命年金現価 a_x = sum_{t=1}^{...} v^t _tp_x."""
    v = v_of(i)
    upper = int(OMEGA - x) if n is None else n
    return sum((v ** t) * tpx(float(t), x) for t in range(1, upper + 1))


def nEx(x: float, n: int, i: float) -> float:
    """生存保険（純粋据置）現価 _nE_x = v^n _np_x."""
    return (v_of(i) ** n) * tpx(float(n), x)


def a_due_deferred(x: float, m: int, i: float, n: int | None = None) -> float:
    """m年据置期始払生命年金 = _mE_x * addot_{x+m}(:n)."""
    return nEx(x, m, i) * a_due(x + m, i, n)


# ---------------------------------------------------------------- 生命保険（離散）

def A_term(x: float, n: int, i: float) -> float:
    """定期保険 A^1_{x:n} = sum_{t=0}^{n-1} v^{t+1} _tp_x q_{x+t}（死亡年度末払）."""
    v = v_of(i)
    return sum((v ** (t + 1)) * tpx(float(t), x) * qx(x + t) for t in range(n))


def A_whole(x: float, i: float) -> float:
    """終身保険 A_x（死亡年度末払）."""
    return A_term(x, int(OMEGA - x), i)


def A_endow(x: float, n: int, i: float) -> float:
    """養老保険 A_{x:n} = A^1_{x:n} + _nE_x."""
    return A_term(x, n, i) + nEx(x, n, i)


# ---------------------------------------------------------------- 生命保険（連続）

def A_bar_term(x: float, n: float, i: float, steps_per_year: int = 200) -> float:
    """連続型定期保険 Abar^1_{x:n} = int_0^n v^t _tp_x mu_{x+t} dt（Simpson 法）."""
    v, delta = v_of(i), delta_of(i)

    def f(t: float) -> float:
        return math.exp(-delta * t) * tpx(t, x) * mu(x + t)

    m = int(n * steps_per_year)
    if m % 2:
        m += 1
    h = n / m
    total = f(0.0) + f(n)
    for k in range(1, m):
        total += (4.0 if k % 2 else 2.0) * f(k * h)
    return total * h / 3.0


def A_bar_whole(x: float, i: float) -> float:
    """連続型終身保険 Abar_x."""
    return A_bar_term(x, OMEGA - x, i)


def a_bar(x: float, i: float, n: float | None = None, steps_per_year: int = 200) -> float:
    """連続生命年金 abar_x = int_0^n v^t _tp_x dt（Simpson 法）."""
    delta = delta_of(i)
    upper = (OMEGA - x) if n is None else n

    def f(t: float) -> float:
        return math.exp(-delta * t) * tpx(t, x)

    m = int(upper * steps_per_year)
    if m % 2:
        m += 1
    h = upper / m
    total = f(0.0) + f(upper)
    for k in range(1, m):
        total += (4.0 if k % 2 else 2.0) * f(k * h)
    return total * h / 3.0


# ---------------------------------------------------------------- 平均余命

def e_curtate(x: float) -> float:
    """平均余命（整数）e_x = sum_{t>=1} _tp_x."""
    return sum(tpx(float(t), x) for t in range(1, int(OMEGA - x) + 1))


def e_complete(x: float, steps_per_year: int = 200) -> float:
    """完全平均余命 ering_x = int_0^inf _tp_x dt（Simpson 法）."""
    upper = OMEGA - x
    m = int(upper * steps_per_year)
    if m % 2:
        m += 1
    h = upper / m
    f = lambda t: tpx(t, x)
    total = f(0.0) + f(upper)
    for k in range(1, m):
        total += (4.0 if k % 2 else 2.0) * f(k * h)
    return total * h / 3.0


# ---------------------------------------------------------------- 保険料・責任準備金

def P_whole(x: float, i: float, h: int | None = None) -> float:
    """終身保険の平準純保険料 P_x = A_x / addot_x（h 年払なら addot_{x:h}）."""
    return A_whole(x, i) / a_due(x, i, h)


def P_endow(x: float, n: int, i: float, h: int | None = None) -> float:
    """養老保険の平準純保険料 P_{x:n} = A_{x:n} / addot_{x:h}（既定 h=n）."""
    return A_endow(x, n, i) / a_due(x, i, n if h is None else h)


def V_endow_prospective(x: float, n: int, t: int, i: float) -> float:
    """養老保険の t 年度末純保険料式責任準備金（将来法）."""
    P = P_endow(x, n, i)
    return A_endow(x + t, n - t, i) - P * a_due(x + t, i, n - t)


def V_endow_retrospective(x: float, n: int, t: int, i: float) -> float:
    """養老保険の t 年度末純保険料式責任準備金（過去法）."""
    P = P_endow(x, n, i)
    return (P * a_due(x, i, t) - A_term(x, t, i)) / nEx(x, t, i)


def fackler(tV: float, P: float, i: float, x: float, S: float = 1.0) -> float:
    """Fackler の再帰式  (tV + P)(1+i) = q_x*S + p_x*(t+1)V  を (t+1)V について解く."""
    return ((tV + P) * (1.0 + i) - qx(x) * S) / px(x)


# ---------------------------------------------------------------- 連生（独立を仮定）

def tpxy(t: float, x: float, y: float) -> float:
    """同時生存確率 _tp_{xy} = _tp_x * _tp_y（独立）."""
    return tpx(t, x) * tpx(t, y)


def a_due_joint(x: float, y: float, i: float, n: int | None = None) -> float:
    """同時生存期始払年金 addot_{xy}."""
    v = v_of(i)
    upper = int(OMEGA - min(x, y)) if n is None else n
    return sum((v ** t) * tpxy(float(t), x, y) for t in range(upper))


def a_due_last(x: float, y: float, i: float, n: int | None = None) -> float:
    """最終生存者年金 addot_{xy-bar} = addot_x + addot_y - addot_{xy}."""
    return a_due(x, i, n) + a_due(y, i, n) - a_due_joint(x, y, i, n)


def A_joint(x: float, y: float, i: float) -> float:
    """同時生存状態の消滅に対する保険 A_{xy}（第一死亡年度末払）."""
    v = v_of(i)
    upper = int(OMEGA - min(x, y))
    return sum(
        (v ** (t + 1)) * (tpxy(float(t), x, y) - tpxy(float(t + 1), x, y))
        for t in range(upper)
    )


def A_last(x: float, y: float, i: float) -> float:
    """最終生存者保険 A_{xy-bar} = A_x + A_y - A_{xy}."""
    return A_whole(x, i) + A_whole(y, i) - A_joint(x, y, i)
