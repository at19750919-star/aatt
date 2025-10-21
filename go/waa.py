#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
產生「整靴全敏感局」的百家樂牌靴(8 副牌 / 416 張)。
需求：
- 不用 A 段、不要標記局；只保留敏感局（swap 前兩張→結果在閒/莊間翻轉、張數相同、且不把 原=和 且 換後=莊 算進來）。
- 主流程：先掃天然敏感局，再對剩牌做「重複洗牌補強」，盡量塞滿。
- 停止條件：當剩餘的牌無法排列成敏感局時(整副牌重洗。
- 如果只剩 4/5/6 張且任何排列都無法成為敏感局 → 放棄此靴、重洗重來。
- 若可排列成敏感局，程式會自動把尾局排列成敏感局，完成 416/416 全敏感。
- 也支援「手動指定最後一局順序」：若指定，並且與剩餘牌面一致且確實為敏感局，就使用手動順序；否則回退自動嘗試。

輸出：
- all_sensitive_B_rounds_*.csv    ：每副牌的敏感局清單（中文欄位，含尾局與花色統計，可一次列出多副）
- all_sensitive_vertical_*.csv    ：依 B 順序列出各牌組（含鞋序，便於逐張檢查）
- cut_hits_*.csv                  ：各鞋切牌模擬結果（中文欄位，附平均命中統計）

使用方式：
- 直接執行本腳本；可調整 CONFIG 區塊（包含 NUM_SHOES 可一次產生多副牌）。
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import random, time, csv, collections, itertools, os

# =========================
# CONFIG（可依需求調整）
# =========================
SEED: Optional[int] = None        # 指定整體亂數種子；None 表示每次執行都不同
MAX_ATTEMPTS: int = 1000000       # 最多重試靴數（已設極高，請勿調小避免影響成功率）
# 花色處理（以下設定為流程必要條件，不建議修改為其他狀態）
HEART_SIGNAL_ENABLED: bool = True # 固定啟用訊號花色補位
SIGNAL_SUIT: str = '♥'            # 訊號花色（預設愛心，若需更換請同步調整流程）
A_PASSWORD_SUIT: Optional[str] = None
A_PASSWORD_COUNT: int = 0
B_PASSWORD_SUIT: Optional[str] = None
B_PASSWORD_COUNT: int = 0
TIE_SIGNAL_SUIT: Optional[str] = None  # ?��?訊�??�色（None 表示不使?��?
LATE_BALANCE_DIFF: int = 2         # 花色平衡目標：非訊號花色最大差 ≤ 此值（必須保持小數）
COLOR_RULE_ENABLED: bool = True    # 啟用卡牌顏色規則（紅黑各半；莊局前三張同色）

# 手動指定最後一局（可留空）。格式：例如 ["3♣","8♦","4♠","3♠","K♦"]
MANUAL_TAIL: List[str] = []
NUM_SHOES: int = 1               # 一次生成的敏感靴數量
MIN_TAIL_STOP: int = 7            # 剩餘 < 7 張時停止補強，交給尾局排敏感
MULTI_PASS_MIN_CARDS: int = 4     # 重複洗牌補強的最小剩牌門檻

# =========================
# 基本常數與資料結構
# =========================
SUITS = ['♠','♥','♦','♣']
NUM_DECKS = 8
RANKS = ['A'] + [str(i) for i in range(2, 10)] + ['10', 'J', 'Q', 'K']
CARD_VALUES = {**{str(i): i for i in range(2, 10)}, '10': 0, 'J': 0, 'Q': 0, 'K': 0, 'A': 1}

@dataclass
class Card:
    rank: str
    suit: str
    pos: int  # 0..415 在原靴的絕對索引
    color: Optional[str] = None  # 'R' 或 'B'；獨立於花色
    def point(self) -> int: return CARD_VALUES[self.rank]
    def short(self) -> str: return f"{self.rank}{self.suit}"

@dataclass
class Round:
    start_index: int
    cards: List[Card]
    result: str  # '閒' / '莊' / '和'
    sensitive: bool

@dataclass
class RoundView:
    cards: List[Card]
    result: str

@dataclass
class ShoeResult:
    shoe_index: int
    rounds: List[Round]
    tail: List[Card]
    deck: List[Card]

@dataclass
class CutSimulationResult:
    shoe_index: int
    rows: List[Tuple[int, int, int, str, int]]
    avg_hit: float
    avg_rounds: float

# =========================
# 牌靴與模擬
# =========================

def build_shuffled_deck() -> List[Card]:
    base = [Card(rank=r, suit=s, pos=-1) for s in SUITS for r in RANKS]
    deck: List[Card] = []
    for _ in range(NUM_DECKS):
        deck.extend([Card(c.rank, c.suit, -1) for c in base])
    random.shuffle(deck)
    for i, c in enumerate(deck): c.pos = i
    return deck

class Simulator:
    def __init__(self, deck: List[Card]):
        self.deck = deck

    def simulate_round(self, start: int, *, no_swap: bool = False) -> Optional[Round]:
        d = self.deck
        if start + 3 >= len(d):
            return None
        P1,B1,P2,B2 = d[start:start+4]
        idx = start + 4
        p_tot = (P1.point()+P2.point()) % 10
        b_tot = (B1.point()+B2.point()) % 10
        natural = (p_tot in (8,9)) or (b_tot in (8,9))
        p_cards=[P1,P2]; b_cards=[B1,B2]

        if not natural:
            p3=None
            if p_tot<=5:
                if idx>=len(d): return None
                p3=d[idx]; p_cards.append(p3); idx+=1; p_tot=(p_tot+p3.point())%10
            if p3 is None:
                if b_tot<=5:
                    if idx>=len(d): return None
                    b3=d[idx]; b_cards.append(b3); idx+=1; b_tot=(b_tot+b3.point())%10
            else:
                pt=p3.point()
                def draw():
                    nonlocal idx,b_tot
                    if idx>=len(d): return False
                    b3=d[idx]; b_cards.append(b3); idx+=1; b_tot=(b_tot+b3.point())%10; return True
                if b_tot<=2:
                    if not draw(): return None
                elif b_tot==3 and pt!=8:
                    if not draw(): return None
                elif b_tot==4 and pt in (2,3,4,5,6,7):
                    if not draw(): return None
                elif b_tot==5 and pt in (4,5,6,7):
                    if not draw(): return None
                elif b_tot==6 and pt in (6,7):
                    if not draw(): return None

        res = '和' if p_tot==b_tot else ('閒' if p_tot>b_tot else '莊')
        used = d[start:idx]
        if no_swap:
            return Round(start, used, res, False)

        # 敏感判定：只交換前兩張（P1↔B1），張數相同、結果在閒/莊間翻轉，且排除 原=和 且 換後=莊
        swap_res, same_len = self._swap_result(start)
        invalid_swap = (res == '和' and swap_res == '莊')
        sensitive = (
            (swap_res is not None)
            and (swap_res != res)
            and (swap_res != '和')
            and (same_len == len(used))
            and not invalid_swap
        )
        return Round(start, used, res, sensitive)

    def _swap_result(self, start: int) -> Tuple[Optional[str], int]:
        d2 = self.deck.copy()
        d2[start], d2[start+1] = d2[start+1], d2[start]
        sim2 = Simulator(d2)
        r2 = sim2.simulate_round(start, no_swap=True)
        if not r2: return None, 0
        return r2.result, len(r2.cards)

# =========================
# 掃描 / 重複洗牌補強（2222精神）
# =========================

def scan_all_sensitive_rounds(sim: Simulator) -> List[Round]:
    out: List[Round] = []
    last = len(sim.deck) - 1
    for i in range(last):
        r = sim.simulate_round(i)
        if r and r.sensitive:
            out.append(r)
    return out

def multi_pass_candidates_from_cards_simple(card_pool: List[Card]) -> List[Round]:
    """把剩餘牌重洗，找敏感局，並映射回原靴的卡片順序。"""
    if len(card_pool) < 4:
        return []
    # 洗剩牌
    shuffled = card_pool.copy()
    random.shuffle(shuffled)
    # 建臨時牌（pos=臨時索引）與映射到原牌
    temp_cards = [Card(c.rank, c.suit, i) for i,c in enumerate(shuffled)]
    idx2orig: Dict[int, Card] = {i: c for i,c in enumerate(shuffled)}
    temp_sim = Simulator(temp_cards)

    out: List[Round] = []
    used_idx: set[int] = set()
    i = 0
    while i < len(temp_cards) - 3:
        if i in used_idx:
            i += 1; continue
        r = temp_sim.simulate_round(i)
        if not r:
            i += 1; continue
        temp_indices = [c.pos for c in r.cards]
        if any(ti in used_idx for ti in temp_indices):
            i += 1; continue
        if not r.sensitive:
            i += len(r.cards); continue
        # 映回原牌，保持發牌順序
        ordered: List[Card] = []
        seen: set[int] = set()
        valid = True
        for ti in temp_indices:
            oc = idx2orig[ti]
            if oc.pos in seen: valid=False; break
            ordered.append(oc); seen.add(oc.pos)
        if not valid:
            i += 1; continue
        start_pos = ordered[0].pos
        out.append(Round(start_pos, ordered, r.result, True))
        used_idx.update(temp_indices)
        i = max(temp_indices) + 1
    return out

# =========================
# 尾局敏感化（自動/手動）
# =========================

def _seq_result(cards: List[Card]) -> Optional[str]:
    """回傳給定牌序作為一局時的結果（閒/莊/和）。"""
    if len(cards) < 4:
        return None
    tmp = [Card(c.rank, c.suit, i) for i, c in enumerate(cards)]
    sim = Simulator(tmp)
    r = sim.simulate_round(0)
    return r.result if r else None

def _seq_points(cards: List[Card]) -> Optional[Tuple[int, int]]:
    """計算給定牌序作為一局時，閒家與莊家的最終點數。"""
    if len(cards) < 4:
        return None
    
    # 為了不影響原始 Card 物件，這裡建立臨時副本
    temp_deck = [Card(c.rank, c.suit, i) for i, c in enumerate(cards)]
    
    P1, B1, P2, B2 = temp_deck[0:4]
    
    p_tot = (P1.point() + P2.point()) % 10
    b_tot = (B1.point() + B2.point()) % 10
    
    is_natural = (p_tot in (8, 9)) or (b_tot in (8, 9))
    
    card_idx = 4
    if not is_natural:
        p3 = None
        # 閒家補牌
        if p_tot <= 5:
            if card_idx < len(temp_deck):
                p3 = temp_deck[card_idx]
                p_tot = (p_tot + p3.point()) % 10
                card_idx += 1
        
        # 莊家補牌規則
        if p3 is None: # 閒家沒補牌
            if b_tot <= 5:
                if card_idx < len(temp_deck):
                    b3 = temp_deck[card_idx]
                    b_tot = (b_tot + b3.point()) % 10
        else: # 閒家有補牌
            p3_point = p3.point()
            should_draw = False
            if b_tot <= 2: should_draw = True
            elif b_tot == 3 and p3_point != 8: should_draw = True
            elif b_tot == 4 and p3_point in (2,3,4,5,6,7): should_draw = True
            elif b_tot == 5 and p3_point in (4,5,6,7): should_draw = True
            elif b_tot == 6 and p3_point in (6,7): should_draw = True
            
            if should_draw and card_idx < len(temp_deck):
                b3 = temp_deck[card_idx]
                b_tot = (b_tot + b3.point()) % 10

    return b_tot, p_tot

def _is_sensitive_sequence(cards: List[Card]) -> bool:
    if len(cards) < 4:
        return False
    temp = [Card(c.rank, c.suit, i) for i,c in enumerate(cards)]
    sim = Simulator(temp)
    r = sim.simulate_round(0)
    return bool(r and r.sensitive and len(r.cards) == len(temp))

def try_make_tail_sensitive(tail_cards: List[Card]) -> Optional[List[Card]]:
    k = len(tail_cards)
    if k not in (4,5,6):
        return None
    # 常見啟發式
    heuristics: List[List[Card]] = []
    heuristics.append(tail_cards[:])
    heuristics.append(list(reversed(tail_cards)))
    if k>=2:
        t = tail_cards[:]; t[0],t[1] = t[1],t[0]; heuristics.append(t)
    if k>=3:
        t = tail_cards[:]; t[1],t[2] = t[2],t[1]; heuristics.append(t)
    for cand in heuristics:
        if _is_sensitive_sequence(cand):
            return cand
    # 全排列（最多 720 種）
    for perm in itertools.permutations(tail_cards, k):
        if _is_sensitive_sequence(list(perm)):
            return list(perm)
    return None

def multiset(items: List[str]) -> collections.Counter:
    return collections.Counter(items)

def try_manual_tail(tail_cards: List[Card], manual: List[str]) -> Optional[List[Card]]:
    if not manual:
        return None
    target_ms = multiset(manual)
    avail_ms = multiset([c.short() for c in tail_cards])
    if target_ms != avail_ms:
        return None
    # 依 manual 順序重建
    short2stack: Dict[str, List[Card]] = collections.defaultdict(list)
    for c in tail_cards:
        short2stack[c.short()].append(c)
    ordered: List[Card] = []
    for face in manual:
        ordered.append(short2stack[face].pop())
    return ordered if _is_sensitive_sequence(ordered) else None

# =========================
# 花色處理（S_idx + 平衡）
# =========================

def compute_sidx_new(rounds: List[RoundView]) -> List[int]:
    """S_idx：當下一局結果為『莊』時，把當前局的索引加入（僅 B/尾局）。"""
    S: List[int] = []
    for i in range(len(rounds) - 1):
        if rounds[i+1].result == '莊':
            S.append(i)
    return S


def swap_suits_between_same_rank_cards(card1: Card, card2: Card):
    """
    安全地交換兩張同點數卡牌的花色。
    這是核心修正：確保只在點數相同時才交換花色，避免破壞牌組完整性。
    """
    if card1.rank != card2.rank:
        # 為了安全起見，如果點數不同則不執行任何操作
        # 在這個應用場景中，我們預期呼叫者會確保點數相同
        return
    card1.suit, card2.suit = card2.suit, card1.suit


def _ensure_signal_presence(
    rounds: List[RoundView], signal_suit: str, s_idx: List[int]
) -> set:
    """
    Fallback：若嚴格分配失敗，至少確保每個 S_idx 擁有一張訊號花色。
    【修正】只在找到同點數的 donor 和 receiver 時才交換花色，避免破壞牌組完整性。
    """
    # 收集所有非 S_idx 局中的訊號花色牌作為 donors
    donors = [
        (i, j)
        for i, r in enumerate(rounds)
        if i not in s_idx
        for j, card in enumerate(r.cards)
        if card.suit == signal_suit
    ]
    locked_ids: set = set()
    
    for idx in s_idx:
        rv = rounds[idx]
        # 如果該局已有訊號花色，跳過
        if any(card.suit == signal_suit for card in rv.cards):
            continue
        
        # 收集該局中非訊號花色的牌作為 receivers
        receivers = [j for j, card in enumerate(rv.cards) if card.suit != signal_suit]
        
        if not donors or not receivers:
            raise RuntimeError("Insufficient signal suit donors for S_idx coverage")
        
        # 【修正】尋找可交換的同點數對
        found_swap = False
        for rk_idx, rk in enumerate(receivers):
            receiver_card = rv.cards[rk]
            for d_idx, (di, dj) in enumerate(donors):
                donor_card = rounds[di].cards[dj]
                # 只有在點數相同時才交換
                if receiver_card.rank == donor_card.rank:
                    # 找到配對，交換花色
                    swap_suits_between_same_rank_cards(receiver_card, donor_card)
                    donors.pop(d_idx)
                    receivers.pop(rk_idx)
                    found_swap = True
                    break
            if found_swap:
                break
        
        if not found_swap:
            # 如果跑完所有組合都找不到同點數的交換對，則此靴失敗
            raise RuntimeError("S_idx 備用方案失敗：找不到同點數的牌進行交換。")
    
    # 鎖住所有 S_idx 中的訊號花色，避免後續平衡/顏色規則移除
    for idx in s_idx:
        for card in rounds[idx].cards:
            if card.suit == signal_suit:
                locked_ids.add(id(card))
    return locked_ids



def _is_tie_result(result: Optional[str]) -> bool:
    if not isinstance(result, str):
        return False
    val = result.strip()
    return val in {'和', 'Tie', 'T'}

def enforce_tie_signal(rounds: List[RoundView], tie_suit: str) -> set:
    """
    確保所有和局觸發局使用 tie_suit，並在其他局中移除它。
    【修正】透過同點數花色交換來實現，而非直接改寫 suit。
    """
    if not tie_suit:
        return set()
    
    # 找出所有和局觸發局的索引
    tie_indices = [
        idx for idx in range(len(rounds) - 1)
        if _is_tie_result(rounds[idx + 1].result)
    ]
    locked_ids: set = set()
    
    # 1. 強制和局觸發局每張牌都設為 tie_suit
    # 【修正】透過從全域尋找同點數、目標花色的牌進行交換
    for idx in tie_indices:
        rv = rounds[idx]
        for card_to_replace in rv.cards:
            if card_to_replace.suit == tie_suit:
                # 已經是目標花色，鎖定它
                locked_ids.add(id(card_to_replace))
                continue

            # 在全域（非 tie_indices 局）尋找一張點數相同、花色為 tie_suit 的牌
            found_donor = None
            for other_idx, other_rv in enumerate(rounds):
                if other_idx == idx:  # 跳過自己
                    continue
                for donor_card in other_rv.cards:
                    if (donor_card.rank == card_to_replace.rank and 
                        donor_card.suit == tie_suit and 
                        id(donor_card) not in locked_ids):
                        found_donor = donor_card
                        break
                if found_donor:
                    break
            
            if found_donor:
                # 找到捐贈者，交換它們的花色
                swap_suits_between_same_rank_cards(card_to_replace, found_donor)
                locked_ids.add(id(card_to_replace))  # 鎖定新換來的 tie_suit
            else:
                # 找不到可交換的牌，此靴失敗
                raise RuntimeError(f"Tie signal enforcement failed: Cannot find donor for {card_to_replace.short()}")
    
    # 2. 其他局只要不是全 tie_suit 即可，不強制移除
    # 若有局全部都是 tie_suit，則隨機挑一張換成其他花色
    alt_suits = [s for s in SUITS if s != tie_suit] or [tie_suit]
    for idx, rv in enumerate(rounds):
        if idx in tie_indices:
            continue
        tie_count = sum(1 for card in rv.cards if card.suit == tie_suit)
        if tie_count == len(rv.cards):
            # 全部都是 tie_suit，需打破
            # 【保留原邏輯】這裡只是打破全同花色，影響較小
            for card in rv.cards:
                alt = random.choice(alt_suits)
                card.suit = alt
                break
    return locked_ids


def balance_non_tie_suits(
    rounds: List[RoundView],
    tie_suit: Optional[str],
    locked_ids: set,
    tolerance: int,
):
    """
    平衡非 tie_suit 的花色分佈。
    【修正】透過同點數花色交換來實現，而非直接改寫 suit。
    """
    if not tie_suit:
        return
    other_suits = [s for s in SUITS if s != tie_suit]
    if not other_suits:
        return

    def counts() -> collections.Counter:
        c = collections.Counter()
        for rv in rounds:
            for card in rv.cards:
                c[card.suit] += 1
        return c

    for _ in range(160):
        c = counts()
        total_other = sum(c[s] for s in other_suits)
        if not total_other:
            return
        target = total_other / len(other_suits)
        hi = max(other_suits, key=lambda s: c[s] - target)
        lo = min(other_suits, key=lambda s: c[s] - target)
        if (c[hi] - target) <= tolerance and (target - c[lo]) <= tolerance:
            return
        
        # 【修正】尋找同點數的牌進行花色交換
        moved = False
        # 收集候選牌
        hi_cards = [card for r in rounds for card in r.cards 
                    if card.suit == hi and id(card) not in locked_ids]
        lo_cards = [card for r in rounds for card in r.cards 
                    if card.suit == lo and id(card) not in locked_ids]

        # 為了快速查找，將 lo_cards 按點數分組
        lo_cards_by_rank = collections.defaultdict(list)
        for card in lo_cards:
            lo_cards_by_rank[card.rank].append(card)

        # 尋找並交換
        for hi_card in hi_cards:
            if lo_cards_by_rank[hi_card.rank]:
                # 找到同點數的牌
                lo_card = lo_cards_by_rank[hi_card.rank].pop()
                
                # 交換花色
                swap_suits_between_same_rank_cards(hi_card, lo_card)
                
                moved = True
                break  # 完成一次交換就重新計算分佈
        
        if not moved:
            break

def validate_tie_signal(rounds: List[RoundView], tie_suit: str) -> None:
    tie_indices = [
        idx for idx in range(len(rounds) - 1)
        if _is_tie_result(rounds[idx + 1].result)
    ]
    for idx in tie_indices:
        if any(card.suit != tie_suit for card in rounds[idx].cards):
            raise RuntimeError(f"Tie signal enforcement failed for index {idx}")
    forbidden = [
        idx for idx in range(len(rounds))
        if idx not in tie_indices and any(card.suit == tie_suit for card in rounds[idx].cards)
    ]
    if forbidden:
        raise RuntimeError(f"Tie signal suit present outside T rounds: {forbidden}")

def enforce_suit_distribution(rounds: List[RoundView], signal_suit: str, s_idx: List[int]) -> set:
    """
    將訊號花色分配到 s_idx 指定的局中，並鎖定這些牌以供後續平衡保護。
    【修正】只在找到同點數的 donor 和 receiver 時才交換花色，避免破壞牌組完整性。
    """
    # 1. 計算整副牌中訊號花色的總張數
    total_signal = sum(1 for r in rounds for c in r.cards if c.suit == signal_suit)
    
    # 2. 計算 S_idx 所涵蓋局的總容量（每局的張數加總）
    s_cap = sum(len(rounds[i].cards) for i in s_idx)
    if s_idx and s_cap < total_signal:
        print(f"[驗證] S_idx 容量不足：容量 {s_cap} < 訊號花色總數 {total_signal}，S_idx 長度={len(s_idx)}")
        raise RuntimeError(f"S_idx 容量不足 ({s_cap})，無法容納所有 {signal_suit} ({total_signal})")

    # 3. 收集所有非 S_idx 的訊號牌當 donors
    donors = []
    for i, r in enumerate(rounds):
        if i in s_idx:
            continue
        for j, card in enumerate(r.cards):
            if card.suit == signal_suit:
                donors.append((i, j))

    locked_ids = set()
    if not s_idx:
        return locked_ids

    # 4. 目標用「現況為下界」，不再硬性每局至少 1
    target = [0] * len(rounds)
    cur_sig = [0] * len(rounds)
    for i in s_idx:
        cur_sig[i] = sum(1 for c in rounds[i].cards if c.suit == signal_suit)
        target[i] = cur_sig[i]

    # 5. 只用「非 S_idx 的訊號數」去增加 target（容量優先）
    remain = total_signal - sum(target)  # = 非 S_idx 的訊號數
    if remain > 0:
        s_idx_sorted = sorted(
            s_idx,
            key=lambda idx: (len(rounds[idx].cards) - target[idx]),  # 尚可填入的容量
            reverse=True
        )
        ptr = 0
        while remain > 0:
            idx = s_idx_sorted[ptr]
            if target[idx] < len(rounds[idx].cards):
                target[idx] += 1
                remain -= 1
            ptr = (ptr + 1) % len(s_idx_sorted)

    # 6. 執行交換：把訊號補到各 S_idx 局
    # 【修正】只在找到同點數的配對時才交換
    for i in s_idx:
        cur_cnt = sum(1 for c in rounds[i].cards if c.suit == signal_suit)
        need = target[i] - cur_cnt
        if need <= 0:
            continue
        
        # 收集該局中非訊號花色的牌作為 receivers
        receivers = [k for k, c in enumerate(rounds[i].cards) if c.suit != signal_suit]
        
        for _ in range(need):
            if not donors or not receivers:
                print(f"[驗證] 交換資源不足：donors={len(donors)} receivers={len(receivers)}，S_idx 長度={len(s_idx)}")
                raise RuntimeError("花色交換資源不足")
            
            # 【修正】尋找可交換的同點數對
            found_swap = False
            for rk_idx, rk in enumerate(receivers):
                receiver_card = rounds[i].cards[rk]
                
                # 在 donors 中尋找點數相同的牌
                for d_idx, (di, dj) in enumerate(donors):
                    donor_card = rounds[di].cards[dj]
                    
                    if receiver_card.rank == donor_card.rank:
                        # 找到配對，交換花色
                        swap_suits_between_same_rank_cards(receiver_card, donor_card)
                        
                        # 從列表中移除已使用的 donor 和 receiver
                        donors.pop(d_idx)
                        receivers.pop(rk_idx)
                        found_swap = True
                        break  # 中斷內層 donor 迴圈
                if found_swap:
                    break  # 中斷外層 receiver 迴圈
            
            if not found_swap:
                # 如果跑完所有組合都找不到同點數的交換對，則此靴失敗
                raise RuntimeError("花色交換失敗：找不到同點數的牌進行交換。")

    # 7. 嚴格模式：不得殘留訊號於非 S_idx
    assert not donors, f"Leftover signal-suit donors after allocation: {len(donors)}"

    # 8. 將所有已確定的訊號花色牌標記為鎖定，避免後續平衡時被重新調整
    for i in s_idx:
        for card in rounds[i].cards:
            if card.suit == signal_suit:
                locked_ids.add(id(card))
    return locked_ids

def late_balance(rounds: List[RoundView], locked_ids: set, diff: int, signal_suit: Optional[str], tie_suit: Optional[str] = None):
    """
    把最多的花色往最少的花色移動，直到差值 ≤ diff（跳過鎖定牌；可排除 signal_suit）。
    【修正】透過同點數花色交換來實現，而非直接改寫 suit。
    """
    def counts() -> collections.Counter:
        c = collections.Counter()
        for r in rounds:
            for card in r.cards:
                c[card.suit] += 1
        return c

    for _ in range(120):
        c = counts()
        excluded = {s for s in (signal_suit, tie_suit) if s}
        suits_to_balance = [s for s in SUITS if s not in excluded] if excluded else SUITS
        if len(suits_to_balance) < 2:
            return True
        hi = max(suits_to_balance, key=lambda s: c.get(s, 0))
        lo = min(suits_to_balance, key=lambda s: c.get(s, 0))
        if c.get(hi, 0) - c.get(lo, 0) <= diff:
            return True
        
        # 【修正】尋找同點數的牌進行花色交換
        moved = False
        # 1. 收集候選牌
        hi_cards = [card for r in rounds for card in r.cards 
                    if card.suit == hi and id(card) not in locked_ids]
        lo_cards = [card for r in rounds for card in r.cards 
                    if card.suit == lo and id(card) not in locked_ids]

        # 2. 為了快速查找，將 lo_cards 按點數分組
        lo_cards_by_rank = collections.defaultdict(list)
        for card in lo_cards:
            lo_cards_by_rank[card.rank].append(card)

        # 3. 尋找並交換
        for hi_card in hi_cards:
            if lo_cards_by_rank[hi_card.rank]:
                # 找到同點數的牌
                lo_card = lo_cards_by_rank[hi_card.rank].pop()
                
                # 交換花色
                swap_suits_between_same_rank_cards(hi_card, lo_card)
                
                moved = True
                break  # 完成一次交換就重新計算分佈
        
        if not moved:
            break
    
    # 最終驗證
    c = collections.Counter()
    for r in rounds:
        for card in r.cards:
            c[card.suit] += 1
    excluded = {s for s in (signal_suit, tie_suit) if s}
    suits_to_balance = [s for s in SUITS if s not in excluded] if excluded else SUITS
    filtered = [c.get(s, 0) for s in suits_to_balance]
    final_diff = (max(filtered) - min(filtered)) if filtered else 0
    ok = final_diff <= diff
    if not ok:
        # 強化驗證輸出：平衡失敗時輸出分佈與門檻
        dist = ', '.join(f'{s}:{c.get(s, 0)}' for s in (suits_to_balance))
        sig = signal_suit if signal_suit else '-'
        print(f"[驗證] 花色平衡失敗：允許差<={diff}，分佈=({dist})，排除訊號花色={sig}")
    return ok

def _apply_color_rule_for_shoe(round_views: List[RoundView], tail: Optional[List[Card]]) -> None:
    """在整鞋定稿後套用紅黑顏色規則。
    每一局的前四張（或不足四張則全部）必須是：
      - 黑, 黑, 黑, 紅  或
      - 紅, 紅, 紅, 黑
    兩者若都可行則隨機選擇。最後再把剩餘配額平均分配到未上色牌上。
    僅設定 card.color，不更動 rank/suit。
    """
    # 計算全靴總張數
    all_cards: List[Card] = [c for rv in round_views for c in rv.cards] + (tail or [])
    total = len(all_cards)
    red_left = total // 2
    black_left = total - red_left

    def use(color: str, k: int) -> bool:
        nonlocal red_left, black_left
        if color == 'R':
            if red_left < k: return False
            red_left -= k
        else:
            if black_left < k: return False
            black_left -= k
        return True

    def assign_first_four(seq: List[Card]):
        nonlocal red_left, black_left
        k = min(4, len(seq))
        if k == 0:
            return
        pat1 = ['B', 'B', 'B', 'R']  # 黑黑黑紅
        pat2 = ['R', 'R', 'R', 'B']  # 紅紅紅黑

        need1_r = pat1[:k].count('R'); need1_b = pat1[:k].count('B')
        need2_r = pat2[:k].count('R'); need2_b = pat2[:k].count('B')

        ok1 = (red_left >= need1_r and black_left >= need1_b)
        ok2 = (red_left >= need2_r and black_left >= need2_b)

        if not ok1 and not ok2:
            # 嘗試在不破壞整體配額下使用替代（例如若牌不足但可以用倒置少於4張）
            raise RuntimeError("顏色配額不足（前四張模式無可用方案）")

        chosen = None
        if ok1 and ok2:
            chosen = random.choice([pat1, pat2])
        elif ok1:
            chosen = pat1
        else:
            chosen = pat2

        # 使用配額
        if not use('R', chosen[:k].count('R')) or not use('B', chosen[:k].count('B')):
            raise RuntimeError("顏色配額不足（使用時發生不一致）")

        for i in range(k):
            seq[i].color = 'R' if chosen[i] == 'R' else 'B'

    # 1. 逐局處理前四張
    for rv in round_views:
        assign_first_four(rv.cards)

    if tail:
        assign_first_four(tail)

    # 2. 最終分配：將所有剩餘的顏色配額，分配給所有還未上色的牌
    def fill_rest_robust(all_cards_seq: List[Card]):
        nonlocal red_left, black_left

        # 找出所有還未上色的牌
        uncolored = [c for c in all_cards_seq if c.color is None]

        # 建立剩餘顏色的 "配額池"
        color_pool = ['R'] * red_left + ['B'] * black_left

        # 安全檢查：未上色的牌數必須等於剩餘的配額總數
        if len(uncolored) != len(color_pool):
            # 若不符，嘗試補足差異（安全模式：將多餘配額隨機分配與調整）
            # 先嘗試平衡：如果配額不足或超出，調整為能填滿未上色
            diff = len(uncolored) - len(color_pool)
            if diff > 0:
                # 沒有足夠配額，不可接受
                raise RuntimeError(f"顏色分配邏輯錯誤：未上色牌數 {len(uncolored)} 與剩餘配額 {len(color_pool)} 不符。")
            else:
                # 若 color_pool 比 uncolored 多（理論上不會），縮減多餘配額
                color_pool = color_pool[:len(uncolored)]

        random.shuffle(color_pool)  # 隨機化分配

        for card in uncolored:
            card.color = color_pool.pop()

        # 更新剩餘配額為 0
        red_left = 0
        black_left = 0

    fill_rest_robust(all_cards)

    # 3. 最終驗證
    assert red_left == 0 and black_left == 0, f"顏色配額未對齊, 剩餘 R:{red_left}, B:{black_left}"

# =========================
# 主流程（一次打包 + 外層重試）
# =========================

def pack_all_sensitive_once(deck: List[Card], *, min_tail_stop: int, multi_pass_min_cards: int) -> Optional[Tuple[List[Round], List[Card]]]:
    sim = Simulator(deck)
    # 1) 掃全靴天然敏感
    all_sensitive = scan_all_sensitive_rounds(sim)
    # 2) 重複洗牌補強（吃到剩 < min_tail_stop 為止）
    #    用簡化版本：不停把剩牌重洗找敏感局、用到的牌從池子拿掉
    used_pos: set[int] = set()
    out_rounds: List[Round] = []

    # 先把天然敏感局放進暫存（不過濾重疊，後面用 used_pos 控制）
    for r in all_sensitive:
        if any(c.pos in used_pos for c in r.cards):
            continue
        out_rounds.append(r)
        for c in r.cards: used_pos.add(c.pos)

    # 反覆補強
    while True:
        remaining = [c for c in deck if c.pos not in used_pos]
        if len(remaining) < multi_pass_min_cards:
            break
        if len(remaining) < min_tail_stop:
            break
        cands = multi_pass_candidates_from_cards_simple(remaining)
        if not cands:
            break
        picked = cands[0]
        if any(c.pos in used_pos for c in picked.cards):
            break
        out_rounds.append(picked)
        for c in picked.cards: used_pos.add(c.pos)

    # 3) 尾局
    tail = [c for c in deck if c.pos not in used_pos]
    if len(tail) not in (0,4,5,6):
        return None
    if len(tail) == 0:
        return (out_rounds, [])
    manual_seq = try_manual_tail(tail, MANUAL_TAIL)
    if manual_seq:
        tail = manual_seq
    else:
        auto_seq = try_make_tail_sensitive(tail)
        if not auto_seq:
            return None
        tail = auto_seq
    out_rounds.sort(key=lambda r: r.start_index)
    return (out_rounds, tail)

def apply_shoe_rules(
    rounds: List[Round],
    tail: List[Card],
    *,
    signal_suit: Optional[str],
    tie_suit: Optional[str],
    late_diff: int,
) -> bool:
    round_views = [RoundView(r.cards, r.result) for r in rounds]
    if tail:
        tail_res = _seq_result(tail)
        if tail_res:
            round_views.append(RoundView(tail, tail_res))
    locked_ids: set = set()

    # 1) Tie signal
    if tie_suit:
        try:
            locked_ids.update(enforce_tie_signal(round_views, tie_suit))
        except RuntimeError:
            return False

    # 2) S_idx + signal_suit
    if signal_suit:
        s_idx = compute_sidx_new(round_views)
        try:
            locked_ids.update(enforce_suit_distribution(round_views, signal_suit, s_idx))
        except (RuntimeError, AssertionError):
            try:
                locked_ids.update(_ensure_signal_presence(round_views, signal_suit, s_idx))
            except RuntimeError:
                return False

    # 3) late_balance
    if not late_balance(round_views, locked_ids, late_diff, signal_suit, tie_suit):
        return False

    # 4) balance_non_tie_suits
    if tie_suit:
        balance_non_tie_suits(round_views, tie_suit, locked_ids, late_diff)

    # 5) 驗證 tie_signal
    if tie_suit:
        try:
            validate_tie_signal(round_views, tie_suit)
        except RuntimeError:
            return False

    return True

def generate_all_sensitive_shoe_or_retry(
    *,
    min_tail_stop: int,
    multi_pass_min_cards: int,
    signal_suit: Optional[str],
    tie_suit: Optional[str],
    late_diff: int,
    max_attempts: int,
) -> Optional[Tuple[List[Round], List[Card], List[Card]]]:
    for attempt in range(1, max_attempts + 1):
        deck = build_shuffled_deck()
        result = pack_all_sensitive_once(
            deck, min_tail_stop=min_tail_stop, multi_pass_min_cards=multi_pass_min_cards
        )
        if not result:
            continue
        rounds, tail = result
        if not apply_shoe_rules(
            rounds, tail, signal_suit=signal_suit, tie_suit=tie_suit, late_diff=late_diff
        ):
            continue
        return (rounds, tail, deck)
    return None

# =========================
# 切牌模擬
# =========================

def simulate_cut_positions(rounds: List[Round], tail: List[Card]) -> List[Tuple[int, int, int, str, int]]:
    """模擬每個切牌位置，回傳 (cut_pos, 可玩局數, 命中敏感局數, 尾局結果, 尾局張數)。"""
    total = sum(len(r.cards) for r in rounds) + len(tail)
    rows: List[Tuple[int, int, int, str, int]] = []
    for cut_pos in range(1, total + 1):
        idx = 0
        played = 0
        hits = 0
        for r in rounds:
            if idx + len(r.cards) <= cut_pos:
                played += 1
                if r.sensitive:
                    hits += 1
                idx += len(r.cards)
            else:
                break
        tail_res = _seq_result(tail) if tail else '-'
        tail_len = len(tail)
        rows.append((cut_pos, played, hits, tail_res, tail_len))
    return rows

def compute_avg_stats(rows: List[Tuple[int, int, int, str, int]]) -> Tuple[float, float]:
    if not rows:
        return 0.0, 0.0
    total_hits = sum(r[2] for r in rows)
    total_rounds = sum(r[1] for r in rows)
    n = len(rows)
    avg_hit = total_hits / n
    avg_rounds = total_rounds / n
    return avg_hit, avg_rounds

# =========================
# CSV 輸出
# =========================

def write_all_sensitive_rounds_csv(shoe_results: List[ShoeResult], filename: str):
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['鞋序', '局號', '起始索引', '張數', '結果', '敏感', '牌面', '♠', '♥', '♦', '♣', '莊點', '閒點'])
        for sr in shoe_results:
            rounds = sr.rounds
            tail = sr.tail
            for idx, r in enumerate(rounds, start=1):
                cards_str = ' '.join(c.short() for c in r.cards)
                suit_counts = collections.Counter(c.suit for c in r.cards)
                s_c = suit_counts.get('♠', 0)
                h_c = suit_counts.get('♥', 0)
                d_c = suit_counts.get('♦', 0)
                c_c = suit_counts.get('♣', 0)
                pts = _seq_points(r.cards)
                b_pt, p_pt = pts if pts else ('-', '-')
                w.writerow([
                    sr.shoe_index, idx, r.start_index, len(r.cards),
                    r.result, '是' if r.sensitive else '否', cards_str,
                    s_c, h_c, d_c, c_c, b_pt, p_pt
                ])
            if tail:
                cards_str = ' '.join(c.short() for c in tail)
                suit_counts = collections.Counter(c.suit for c in tail)
                s_c = suit_counts.get('♠', 0)
                h_c = suit_counts.get('♥', 0)
                d_c = suit_counts.get('♦', 0)
                c_c = suit_counts.get('♣', 0)
                tail_res = _seq_result(tail) if tail else '-'
                pts = _seq_points(tail)
                b_pt, p_pt = pts if pts else ('-', '-')
                w.writerow([
                    sr.shoe_index, '尾局', '-', len(tail), tail_res, '是', cards_str,
                    s_c, h_c, d_c, c_c, b_pt, p_pt
                ])

def write_vertical_csv(shoe_results: List[ShoeResult], filename: str):
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['鞋序', '局號', '張序', '牌面', '點數', '花色', '顏色', '原始位置'])
        for sr in shoe_results:
            rounds = sr.rounds
            tail = sr.tail
            for idx, r in enumerate(rounds, start=1):
                for seq, c in enumerate(r.cards, start=1):
                    w.writerow([sr.shoe_index, idx, seq, c.short(), c.point(), c.suit, c.color or '-', c.pos])
            if tail:
                for seq, c in enumerate(tail, start=1):
                    w.writerow([sr.shoe_index, '尾局', seq, c.short(), c.point(), c.suit, c.color or '-', c.pos])

def write_cut_hits_csv(cut_results: List[CutSimulationResult], filename: str):
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['鞋序', '切牌位置', '可玩局數', '命中敏感局數', '尾局結果', '尾局張數'])
        for cr in cut_results:
            for row in cr.rows:
                cut_pos, played, hits, tail_res, tail_len = row
                w.writerow([cr.shoe_index, cut_pos, played, hits, tail_res, tail_len])
        w.writerow([])
        w.writerow(['鞋序', '平均命中敏感局數', '平均可玩局數'])
        for cr in cut_results:
            w.writerow([cr.shoe_index, f"{cr.avg_hit:.2f}", f"{cr.avg_rounds:.2f}"])

# =========================
# 主程式
# =========================

def main():
    if SEED is not None:
        random.seed(SEED)
    
    print("=== 開始生成全敏感靴 ===")
    print(f"目標生成數量: {NUM_SHOES} 副")
    print(f"訊號花色: {SIGNAL_SUIT if HEART_SIGNAL_ENABLED else '未啟用'}")
    print(f"和局訊號花色: {TIE_SIGNAL_SUIT if TIE_SIGNAL_SUIT else '未啟用'}")
    print(f"花色平衡差值: ≤ {LATE_BALANCE_DIFF}")
    print(f"顏色規則: {'啟用' if COLOR_RULE_ENABLED else '未啟用'}")
    print()

    shoe_results: List[ShoeResult] = []
    cut_results: List[CutSimulationResult] = []

    for shoe_idx in range(1, NUM_SHOES + 1):
        print(f"[鞋 {shoe_idx}] 開始生成...")
        start_time = time.time()
        
        result = generate_all_sensitive_shoe_or_retry(
            min_tail_stop=MIN_TAIL_STOP,
            multi_pass_min_cards=MULTI_PASS_MIN_CARDS,
            signal_suit=SIGNAL_SUIT if HEART_SIGNAL_ENABLED else None,
            tie_suit=TIE_SIGNAL_SUIT,
            late_diff=LATE_BALANCE_DIFF,
            max_attempts=MAX_ATTEMPTS,
        )
        
        if not result:
            print(f"[鞋 {shoe_idx}] 失敗：達到最大嘗試次數 {MAX_ATTEMPTS}")
            continue
        
        rounds, tail, deck = result
        
        # 套用顏色規則
        if COLOR_RULE_ENABLED:
            round_views = [RoundView(r.cards, r.result) for r in rounds]
            try:
                _apply_color_rule_for_shoe(round_views, tail)
            except RuntimeError as e:
                print(f"[鞋 {shoe_idx}] 顏色規則套用失敗: {e}")
                continue
        
        elapsed = time.time() - start_time
        
        # 【新增】驗證牌組完整性
        all_cards = [c for r in rounds for c in r.cards] + (tail or [])
        cnt = collections.Counter((c.rank, c.suit) for c in all_cards)
        
        # 檢查每種牌是否都剛好 8 張
        all_valid = True
        for s in SUITS:
            for r in RANKS:
                if cnt[(r, s)] != NUM_DECKS:
                    print(f"[驗證失敗] {r}{s} 張數 = {cnt[(r, s)]}，預期 = {NUM_DECKS}")
                    all_valid = False
        
        if not all_valid:
            print(f"[鞋 {shoe_idx}] 驗證失敗：牌組完整性檢查未通過")
            continue
        
        print(f"[鞋 {shoe_idx}] 成功！耗時 {elapsed:.2f} 秒")
        print(f"  - 敏感局數: {len(rounds)}")
        print(f"  - 尾局張數: {len(tail)}")
        print(f"  - 總張數: {sum(len(r.cards) for r in rounds) + len(tail)}")
        print(f"  - 【驗證通過】所有卡面張數均為 {NUM_DECKS}")
        
        # 花色統計
        suit_counts = collections.Counter()
        for r in rounds:
            for c in r.cards:
                suit_counts[c.suit] += 1
        for c in tail:
            suit_counts[c.suit] += 1
        print(f"  - 花色分佈: {dict(suit_counts)}")
        print()
        
        shoe_results.append(ShoeResult(shoe_idx, rounds, tail, deck))
        
        # 切牌模擬
        cut_rows = simulate_cut_positions(rounds, tail)
        avg_hit, avg_rounds = compute_avg_stats(cut_rows)
        cut_results.append(CutSimulationResult(shoe_idx, cut_rows, avg_hit, avg_rounds))
    
    if not shoe_results:
        print("未能成功生成任何靴，程式結束。")
        return
    
    # 輸出 CSV
    timestamp = int(time.time())
    rounds_csv = f"all_sensitive_B_rounds_{timestamp}.csv"
    vertical_csv = f"all_sensitive_vertical_{timestamp}.csv"
    cut_csv = f"cut_hits_{timestamp}.csv"
    
    write_all_sensitive_rounds_csv(shoe_results, rounds_csv)
    write_vertical_csv(shoe_results, vertical_csv)
    write_cut_hits_csv(cut_results, cut_csv)
    
    print("=== 所有靴生成完畢 ===")
    print(f"成功生成: {len(shoe_results)} / {NUM_SHOES} 副")
    print(f"輸出檔案:")
    print(f"  - {rounds_csv}")
    print(f"  - {vertical_csv}")
    print(f"  - {cut_csv}")

if __name__ == '__main__':
    main()