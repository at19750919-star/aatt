// combined_final.js
// 合併 9999.txt (結構化劃分) 和 wwa.txt (UI 框架、敏感局與訊號邏輯)
// =============================================
// --- START: waa.py translated logic ---
// =============================================
function makeRoundInfo(start, cards, result, sensitive) {
const r = {
start_index: start,
cards: cards,
result: result,
sensitive: sensitive,
segment: null,
get suit_counts() {
const counts = new Map();
for (const card of this.cards) { counts.set(card.suit, (counts.get(card.suit) || 0) + 1); }
return counts;
},
get card_count() { return this.cards.length; }
};
return r;
}
class Simulator {
constructor(deck) { this.deck = deck; }
simulate_round(start, { no_swap = false } = {}) {
const d = this.deck;
if (start + 3 >= d.length) return null;
const [P1, B1, P2, B2] = d.slice(start, start + 4);
let idx = start + 4;
let p_tot = (P1.point() + P2.point()) % 10;
let b_tot = (B1.point() + B2.point()) % 10;
let natural = (p_tot === 8 || p_tot === 9 || b_tot === 8 || b_tot === 9);
let p_cards = [P1, P2];
let b_cards = [B1, B2];
if (!natural) {
let p3 = null;
if (p_tot <= 5) {
if (idx >= d.length) return null;
p3 = d[idx]; p_cards.push(p3); idx++; p_tot = (p_tot + p3.point()) % 10;
}
if (p3 === null) {
if (b_tot <= 5) {
if (idx >= d.length) return null;
let b3 = d[idx]; b_cards.push(b3); idx++; b_tot = (b_tot + b3.point()) % 10;
}
} else {
const pt = p3.point();
const draw = () => {
if (idx >= d.length) return false;
let b3 = d[idx]; b_cards.push(b3); idx++; b_tot = (b_tot + b3.point()) % 10; return true;
};
if (b_tot <= 2) {
if (!draw()) return null;
} else if (b_tot === 3 && pt !== 8) {
if (!draw()) return null;
} else if (b_tot === 4 && [1-6].includes(pt)) {
if (!draw()) return null;
} else if (b_tot === 5 && [3-6].includes(pt)) {
if (!draw()) return null;
} else if (b_tot === 6 && [5, 6].includes(pt)) {
if (!draw()) return null;
}
}
}
const res = (p_tot === b_tot) ? '和' : ((p_tot > b_tot) ? '閒' : '莊');
const used = d.slice(start, idx);
if (no_swap) { return makeRoundInfo(start, used, res, false); }
const [swap_res, same_len] = this._swap_result(start);
const invalid_swap = (res === '和' && swap_res === '莊');
const sensitive = ((swap_res !== null) && (swap_res !== res) && (swap_res !== '和') && (same_len === used.length) && !invalid_swap);
return makeRoundInfo(start, used, res, sensitive);
}
_swap_result(start) {
let d2 = [...this.deck];
if (start + 1 >= d2.length) return [null, 0];
[d2[start], d2[start + 1]] = [d2[start + 1], d2[start]];
const sim2 = new Simulator(d2);
const r2 = sim2.simulate_round(start, { no_swap: true });
if (!r2) return [null, 0];
return [r2.result, r2.cards.length];
}
}
const WAA_Logic = (() => {
const CONFIG = {
SEED: null,
MAX_ATTEMPTS: 2000,
HEART_SIGNAL_ENABLED: true,
SIGNAL_SUIT: '♥',
TIE_SIGNAL_SUIT: '♣',
LATE_BALANCE_DIFF: 2,
COLOR_RULE_ENABLED: true,
MANUAL_TAIL: [],
NUM_SHOES: 1,
MIN_TAIL_STOP: 5,
MULTI_PASS_MIN_CARDS: 25,
};
const SUITS = ['♠', '♥', '♦', '♣'];
const NUM_DECKS = 8;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_VALUES = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,'10': 0, 'J': 0, 'Q': 0, 'K': 0};
/*** 洗牌函式，使用 Fisher-Yates 演算法隨機打亂陣列內容*/
function shuffle(array) {
for (let i = array.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[array[i], array[j]] = [array[j], array[i]];
}
}
/**
 * 統計陣列中每個元素出現的次數，回傳 Map
 */
function multiset(items) {
const counts = new Map();
for (const item of items) { counts.set(item, (counts.get(item) || 0) + 1); }
return counts;
}
/**
 * 比較兩個 Map 是否完全相等
 */
function mapEquals(map1, map2) {
if (map1.size !== map2.size) return false;
for (const [key, val] of map1) { if (val !== map2.get(key)) return false; }
return true;
}
/**
 * 產生陣列的所有 k 長度排列組合（遞迴產生器）
 */
function* permutations(array, k) {
if (k === 0) { yield []; return; }
for (let i = 0; i < array.length; i++) {
const first = array[i];
const rest = [...array.slice(0, i), ...array.slice(i + 1)];
for (const p of permutations(rest, k - 1)) { yield [first, ...p]; }
}
}
const SWAP_TRACE = [];
let CURRENT_SWAP_CONTEXT = 'init';
/**
 * 重設交換追蹤紀錄
 */
function resetSwapTrace() {
SWAP_TRACE.length = 0;
}
/**
 * 設定交換上下文標籤，執行函式 fn
 */
function withSwapContext(label, fn) {
const prev = CURRENT_SWAP_CONTEXT;
CURRENT_SWAP_CONTEXT = label || 'unknown';
try {
return fn();
} finally {
CURRENT_SWAP_CONTEXT = prev;
}
}
/**
 * 取得卡牌交換追蹤用的簡短描述字串
 */
function describeCardForTrace(card) {
if (!card) return 'unknown';
const short = (card && typeof card.short === 'function') ? card.short() : `${card.rank || '?'}${card.suit || '?'}`;
const round = (typeof card._round_index === 'number') ? `r${card._round_index}` : 'r?';
const spot = (typeof card._card_index === 'number') ? `c${card._card_index}` : '';
const seg = card._segment ? `-${card._segment}` : '';
return `${short}@${round}${seg}${spot}`;
}
/**
 * 推送交換追蹤紀錄到 SWAP_TRACE
 */
function pushSwapTrace(entry) {
SWAP_TRACE.push(entry);
if (typeof console !== 'undefined' && console.debug) {
console.debug(`[swap ${entry.step}] ${entry.context}: ${entry.a_before} <-> ${entry.b_before}`);
}
}
if (typeof window !== 'undefined') {
window.SWAP_TRACE = SWAP_TRACE;
window.resetSwapTrace = resetSwapTrace;
}
/**
 * 交換兩張同點數卡牌的花色
 * @deprecated - 此函式已被廢棄，改為使用物理交換的 swap_cards_by_position
 */
/*
function swap_suits_between_same_rank_cards(card1, card2) {
    if (card1.rank !== card2.rank) { throw new Error("Swap Error: Cards must have the same rank for suit exchange."); }
    const entry = {
        step: SWAP_TRACE.length + 1,
        context: CURRENT_SWAP_CONTEXT || 'unknown',
        a_before: describeCardForTrace(card1),
        b_before: describeCardForTrace(card2),
        timestamp: Date.now(),
    };
    const suitA = card1.suit;
    const suitB = card2.suit;
    [card1.suit, card2.suit] = [suitB, suitA];
    entry.a_after = describeCardForTrace(card1);
    entry.b_after = describeCardForTrace(card2);
    pushSwapTrace(entry);
}
*/
/**
 * [CHN] 【新版核心】交換兩張牌在總牌靴 (deck) 中的物理位置。
 *      - 這個操作只交換位置，牌本身的所有屬性（rank, suit, color）都保持不變。
 *      - 這是符合物理現實的交換。
 *
 * @param {Array} deck - 完整的、包含所有卡牌的總牌靴陣列。
// =====================【V6 最終正確版 - 替換舊的 swap_suits...】=====================
/**
 * [CHN] 【V6 終極正確版】交換兩個在 final_rounds 中的卡牌物件
 *      - 這個函式直接修改 final_rounds 的結構，確保 UI 能正確反映交換結果。
 *      - 它依賴於一個能訪問到當前總牌局陣列的地方 (我們將使用全域的 INTERNAL_STATE.rounds)。
 *
 * @param {Card} card1 - 要交換的第一張牌物件。
 * @param {Card} card2 - 要交換的第二張牌物件。
 */
function swap_cards_in_rounds(card1, card2) {
    // 依賴全域的 INTERNAL_STATE.rounds 來定位和修改
    const rounds = INTERNAL_STATE.rounds;
    if (!rounds) {
        console.error("交換失敗：INTERNAL_STATE.rounds 未定義。");
        return;
    }

    let info1 = null, info2 = null;

    // 為了效能，一次循環找到兩張牌的位置
    for (let i = 0; i < rounds.length; i++) {
        const cards = rounds[i].cards;
        if (!info1) {
            const c1_idx = cards.indexOf(card1);
            if (c1_idx !== -1) {
                info1 = { r_idx: i, c_idx: c1_idx };
            }
        }
        if (!info2) {
            const c2_idx = cards.indexOf(card2);
            if (c2_idx !== -1) {
                info2 = { r_idx: i, c_idx: c2_idx };
            }
        }
        if (info1 && info2) break; // 兩張都找到了，就跳出
    }

    if (!info1 || !info2) {
        console.error("交換失敗：無法在 INTERNAL_STATE.rounds 中定位到卡牌。");
        if (!info1) console.error("Card1 not found:", card1.short());
        if (!info2) console.error("Card2 not found:", card2.short());
        return;
    }

    // 執行交換
    const { r_idx: r1, c_idx: c1 } = info1;
    const { r_idx: r2, c_idx: c2 } = info2;

    [rounds[r1].cards[c1], rounds[r2].cards[c2]] = [rounds[r2].cards[c2], rounds[r1].cards[c1]];

    // 為了日誌清晰，可以打印交換資訊
    console.log(`[交換成功] 將 ${rounds[r2].cards[c2].short()} (原在局 #${r1+1}) 與 ${rounds[r1].cards[c1].short()} (原在局 #${r2+1}) 交換。`);
}
// =====================【V6 替換區塊結束】=====================


/**
 * 卡牌類別，包含點數、花色、位置等屬性
 */
class Card {
constructor(rank, suit, pos) {
this.rank = rank;
this.suit = suit;
this.pos = pos;
this.color = null;
}
point() { return CARD_VALUES[this.rank]; }
short() { return `${this.rank}${this.suit}`; }
clone(newPos = this.pos) {
const newCard = new Card(this.rank, this.suit, newPos);
newCard.color = this.color;
newCard.back_color = this.back_color;
newCard._fixed_first4 = this._fixed_first4;
newCard._password_tag = this._password_tag;
return newCard;
}
}
/**
 * 建立並洗牌一副完整的牌組
 */
function build_shuffled_deck() {
const baseR = [];
const baseB = [];
for (const s of SUITS) {
for (const r of RANKS) {
baseR.push(new Card(r, s, -1));
baseB.push(new Card(r, s, -1));
}
}
let deck = [];
for (let i = 0; i < 4; i++) {
deck.push(...baseR.map(c => {
const card = new Card(c.rank, c.suit, -1);
card.back_color = 'R';
card.color = 'R';
return card;
}));
deck.push(...baseB.map(c => {
const card = new Card(c.rank, c.suit, -1);
card.back_color = 'B';
card.color = 'B';
return card;
}));
}
shuffle(deck);
deck.forEach((c, i) => c.pos = i);
return deck;
}


/**
 * 掃描所有敏感局，回傳敏感局陣列
 */
function scan_all_sensitive_rounds(sim) {
const out = [];
const last = sim.deck.length - 1;
for (let i = 0; i < last; i++) {
const r = sim.simulate_round(i);
if (r && r.sensitive) { out.push(r); }
}
return out;
}
/**
 * 從卡牌池中多重嘗試找出敏感局候選
 */
function multi_pass_candidates_from_cards_simple(card_pool) {// 如果牌池少於4張，無法組成一局，直接回傳空陣列   
    if (card_pool.length < 4) return [];// 複製一份牌池並隨機洗牌    
    let shuffled = [...card_pool];// 建立一份臨時卡牌（每張卡牌都重新編號 pos）
    shuffle(shuffled);   
    const temp_cards = shuffled.map((c, i) => c.clone(i));// 建立臨時編號到原始卡牌的對照表   
    const idx2orig = new Map(shuffled.map((c, i) => [i, c]));// 用臨時卡牌建立模擬器  
    const temp_sim = new Simulator(temp_cards);// 儲存所有找到的敏感局
    const out = []; // 記錄已經用過的臨時卡牌編號
    const used_idx = new Set();
    let i = 0;// 從頭開始掃描，直到剩下不足4張  
    while (i < temp_cards.length - 3) { // 跳過已經用過的起始位置      
        if (used_idx.has(i)) { i++; continue; }// 嘗試從第 i 張開始模擬一局    
        const r = temp_sim.simulate_round(i); // 如果模擬失敗（牌不夠或規則不符），跳到下一張     
        if (!r) { i++; continue; }// 取得這局用到的所有臨時卡牌編號      
        const temp_indices = r.cards.map(c => c.pos);// 如果這局有用到已經用過的卡牌，跳過       
        if (temp_indices.some(ti => used_idx.has(ti))) { i++; continue; }// 如果這局不是敏感局，直接跳過這局所用的所有卡牌      
        if (!r.sensitive) { i += r.cards.length; continue; } // 準備把臨時卡牌對照回原始卡牌     
        const ordered = [];
        const seen = new Set();
        let valid = true;
        for (const ti of temp_indices) {
            const oc = idx2orig.get(ti);// 如果原始卡牌重複，這局無效            
            if (seen.has(oc.pos)) { valid = false; break; }
            ordered.push(oc); seen.add(oc.pos);// 如果有重複卡牌，跳過
        }
        
        if (!valid) { i++; continue; }// 取得這局的起始位置（原始卡牌的 pos）       
        const start_pos = ordered.pos; // 加入敏感局到結果     
        out.push(makeRoundInfo(start_pos, ordered, r.result, true));// 標記這局用到的所有臨時卡牌編號       
        temp_indices.forEach(ti => used_idx.add(ti));// 跳到下一個未用過的卡牌位置       
        i = Math.max(...temp_indices) + 1;// 回傳所有找到的敏感局
    }
   
    return out;
}
/**
* 根據 9999.txt 的 build_C_segments 邏輯，從剩餘牌組中提取完整的 B 段牌局 (B rounds)
*/
function build_B_and_C_segments_from_tail(tail_cards) {
if (!tail_cards || tail_cards.length < 4) return { b_rounds: [], c_cards: tail_cards };
const temp_deck = tail_cards.map((c, i) => c.clone(i));
const sim = new Simulator(temp_deck);
const b_rounds = [];
const used_card_idx_in_temp = new Set();
let i_ptr = 0;
const Nleft = temp_deck.length;
while (i_ptr < Nleft) {
const start_pos = i_ptr;
const r = sim.simulate_round(start_pos, { no_swap: true });
if (r) {
const current_round_cards_temp = r.cards;
const is_valid = current_round_cards_temp.every(c => !used_card_idx_in_temp.has(c.pos));
if (is_valid) {
const original_cards = current_round_cards_temp.map(c => tail_cards[c.pos]);
const original_round = makeRoundInfo(original_cards.pos, original_cards, r.result, false);
original_round.segment = 'B';
b_rounds.push(original_round);
current_round_cards_temp.forEach(c => used_card_idx_in_temp.add(c.pos));
i_ptr += current_round_cards_temp.length;
} else {
i_ptr++;
}
} else {
i_ptr++;
}
}
const used_original_pos = new Set(b_rounds.flatMap(r => r.cards).map(c => c.pos));
const c_cards = tail_cards.filter(c => !used_original_pos.has(c.pos));
return { b_rounds, c_cards };
}


/**
 * [CHN] 花色調整
 *
 * @param {Array} final_rounds - 所有牌局的陣列 (包含 A/B/C 段)。
 * @param {string} signal_suit - 要集中的訊號花色 (例如 '♥')。
 * @param {number} tolerance - 允許留在非S局的訊號牌最大數量 (容錯值)。
 * @param {Set} locked_ids - 一個包含已被其他規則鎖定、不可交換的卡牌物件的 Set。
 * @returns {Set} - 返回一個更新後的 locked_ids，包含了本次交換後所有被鎖定的訊號牌。
 * @throws {Error} - 如果最終無法滿足容錯條件，則拋出錯誤。
 */

// =====================【替換區塊結束】=====================

function pack_all_sensitive_and_segment(deck) {
    // 建立模擬器
    const sim = new Simulator(deck);
    // 掃描所有敏感局
    const all_sensitive = scan_all_sensitive_rounds(sim);
    // 記錄已用過的牌位置
    const used_pos = new Set();
    // 儲存 A 段敏感局
    const a_rounds = [];
    // 先把所有敏感局加入 A 段
    for (const r of all_sensitive) {
        // 如果這局有用過的牌就跳過
        if (r.cards.some(c => used_pos.has(c.pos))) continue;
        r.segment = 'A';
        a_rounds.push(r);
        r.cards.forEach(c => used_pos.add(c.pos));
    }
    // 持續多重洗牌挑選敏感局
    const MAX_MULTI_PASS_ATTEMPTS = 200;
    let multi_pass_attempts = 0;
    while (true) {
        const remaining = deck.filter(c => !used_pos.has(c.pos));
        if (remaining.length < CONFIG.MULTI_PASS_MIN_CARDS) break;
        const cands = multi_pass_candidates_from_cards_simple(remaining);
        const picked = Array.isArray(cands)
            ? cands.find(r => Array.isArray(r.cards) && r.cards.length > 0 && !r.cards.some(c => used_pos.has(c.pos)))
            : cands;
        // 檢查挑出來的敏感局是否合法
        if (!picked || !Array.isArray(picked.cards) || picked.cards.length === 0) {
             multi_pass_attempts++;
            if (multi_pass_attempts >= MAX_MULTI_PASS_ATTEMPTS) break;
            continue;
        }
        if (picked.cards.some(c => used_pos.has(c.pos))) break;
        picked.segment = 'A';
        a_rounds.push(picked);
        picked.cards.forEach(c => used_pos.add(c.pos));
    }
    // 按起始位置排序 A 段
    a_rounds.sort((a, b) => a.start_index - b.start_index);
    // 剩下的牌進行 B/C 段分配
    const tail_cards = deck.filter(c => !used_pos.has(c.pos));
    const { b_rounds, c_cards } = build_B_and_C_segments_from_tail(tail_cards);
    // C 段（殘牌）如果有就建立一個 round
    let c_round = null;
    if (c_cards.length > 0) {
        const c_start_index = Math.min(...c_cards.map(c => c.pos)) || 0;
        c_round = makeRoundInfo(c_start_index, c_cards, '殘牌', false);
        c_round.segment = 'C';
    }
    // 合併所有段落
    const final_rounds = [...a_rounds, ...b_rounds, ...(c_round ? [c_round] : [])];
    // 取得所有卡牌
    const final_card_deck = final_rounds.flatMap(r => r.cards);
    // 回傳所有段落與卡牌
    return { a_rounds, b_rounds, c_cards, final_rounds, final_card_deck };
}
const _is_tie_result = (result) => {
if (typeof result !== 'string') return false;
const val = result.trim();
return ['和', 'Tie', 'T'].includes(val);
};
const compute_sidx_for_segment = (rounds, segment = 'A') => {
const S = [];
for (let i = 0; i < rounds.length - 1; i++) {
if (rounds[i].segment === segment && rounds[i + 1].result === '莊') {
S.push(i);
}
}
return S;
};
// ====================================================================================================
// =====================【V6 最終正確版 - 統一替換所有規則函式 START】================================
// ====================================================================================================

// 【V6 正確版 - 和局訊號】
function enforce_tie_signal_combined(final_rounds, tie_suit) { // 不再需要 deck
    if (!tie_suit) return new Set();

    const all_cards = final_rounds.flatMap(r => r.cards);
    const tie_indices = [];
    for (let idx = 0; idx < final_rounds.length - 1; idx++) {
        if (final_rounds[idx].segment === 'A' && _is_tie_result(final_rounds[idx + 1].result)) {
            tie_indices.push(idx);
        }
    }

    const locked_ids = new Set();
    for (const idx of tie_indices) {
        const round_to_fill = final_rounds[idx];
        for (const card_to_replace of round_to_fill.cards) {
            if (card_to_replace.suit === tie_suit) {
                locked_ids.add(card_to_replace);
                continue;
            }

            // 在所有牌中尋找可交換的 donor
            const donor_card = all_cards.find(card =>
                card.rank === card_to_replace.rank &&
                card.suit === tie_suit &&
                !locked_ids.has(card)
            );

            if (donor_card) {
                swap_cards_in_rounds(card_to_replace, donor_card);
                locked_ids.add(card_to_replace);
                locked_ids.add(donor_card);
            } else {
                throw new Error(`Tie signal enforcement failed: Cannot find same-rank donor for ${card_to_replace.short()}`);
            }
        }
        round_to_fill.cards.forEach(c => locked_ids.add(c));
    }
    return locked_ids;
}

// 【V6 正確版 - apply_combined_rules_internal】
function apply_combined_rules_internal(final_rounds, { signal_suit, tie_suit, late_diff }, log_attempt_failure) { // 不再需要 deck
    let locked_ids = new Set();

    // 步驟 1: 處理和局訊號
    try {
        const tie_locked = enforce_tie_signal_combined(final_rounds, tie_suit);
        locked_ids = new Set([...locked_ids, ...tie_locked]);
    } catch (e) {
        log_attempt_failure(`Tie signal failed: ${e.message}`);
        throw e;
    }

    // 步驟 2: 處理S局訊號
    try {
        const signal_locked = distribute_signals_evenly(final_rounds, signal_suit, locked_ids);
        locked_ids = new Set([...locked_ids, ...signal_locked]);
    } catch (e) {
        log_attempt_failure(`Even Distribution failed: ${e.message}`);
        throw e;
    }

    // 步驟 3: 最終強制驗證 (我們恢復它，確保100%成功)
    const s_indices_final = compute_sidx_for_segment(final_rounds, 'A');
    for (const idx of s_indices_final) {
        const s_round = final_rounds[idx];
        const has_signal = s_round.cards.some(card => card.suit === signal_suit);
        if (!has_signal) {
            const error_msg = `最終驗證失敗：S局 #${idx + 1} 仍然沒有訊號牌！`;
            log_attempt_failure(error_msg);
            throw new Error(error_msg);
        }
    }
    console.log("[驗證成功] 所有S局均已包含訊號牌。");

    // 步驟 4: 後期平衡 (在當前模型下，它們沒有意義，但我們保留空函式以防出錯)
    late_balance();
    balance_non_tie_suits();

    return final_rounds;
}

// =====================【V8 最終完美版 - 替換 distribute_signals_evenly】=====================
/**
 * [CHN] 【V8 最終完美版】均勻分配並集中訊號牌
 *      - 採用「補缺優先」和「均勻化」策略，確保訊號牌被合理地分配到所有S局。
 */
function distribute_signals_evenly(final_rounds, signal_suit, locked_ids) {
    if (!signal_suit) return locked_ids;

    const all_cards = final_rounds.flatMap(r => r.cards);
    const MAX_ITERATIONS = 1000;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        const s_indices = new Set(compute_sidx_for_segment(final_rounds, 'A'));
        if (s_indices.size === 0) break;

        // --- 1. 全局盤點，計算每個S局的「缺乏度」 ---
        let s_round_stats = [];
        s_indices.forEach(idx => {
            const s_round = final_rounds[idx];
            const signal_count = s_round.cards.filter(c => c.suit === signal_suit).length;
            const has_receiver_slot = s_round.cards.some(c => c.suit !== signal_suit && !locked_ids.has(c));
            
            // 只有當S局還有可被換出的空位時，才將其納入考慮
            if (has_receiver_slot) {
                s_round_stats.push({
                    round_index: idx,
                    signal_count: signal_count,
                });
            }
        });

        // 按「訊號牌數量」從少到多排序，這樣總是優先處理最缺牌的S局
        s_round_stats.sort((a, b) => a.signal_count - b.signal_count);

        // --- 2. 尋找並執行一次「最優交換」 ---
        let swap_done_in_iter = false;
        
        // 從最缺牌的S局開始嘗試
        for (const stat of s_round_stats) {
            const target_s_round = final_rounds[stat.round_index];
            const potential_receivers = target_s_round.cards.filter(c => c.suit !== signal_suit && !locked_ids.has(c));

            // 為這個最缺的S局，尋找一個可交換的 donor
            for (const receiver_card of potential_receivers) {
                // donor 必須在非S局中
                const donor_card = all_cards.find(card =>
                    !s_indices.has(card._round_index) &&
                    card.rank === receiver_card.rank &&
                    card.suit === signal_suit &&
                    !locked_ids.has(card)
                );

                if (donor_card) {
                    // 找到了！執行交換
                    console.log(`[均勻化交換] 將 ${receiver_card.short()} (來自最缺的S局 #${stat.round_index + 1}) 與 ${donor_card.short()} 交換。`);
                    swap_cards_in_rounds(receiver_card, donor_card);
                    locked_ids.add(receiver_card);
                    locked_ids.add(donor_card);
                    
                    swap_done_in_iter = true;
                    break; // 內層循環中斷，去處理下一個最缺的S局
                }
            }
            if (swap_done_in_iter) {
                break; // 外層循環中斷，每次迭代只做一次最優交換
            }
        }

        // 如果本輪沒有發生任何交換，說明已經達到最優或資源枯竭
        if (!swap_done_in_iter) {
            console.log("[交換結束] 無法再進行任何均勻化交換。");
            break;
        }
    }

    // --- 最終驗證 (可選，但建議保留) ---
    // 確保所有S局至少有一張訊號牌
    const s_indices_final = new Set(compute_sidx_for_segment(final_rounds, 'A'));
    for (const idx of s_indices_final) {
        const s_round = final_rounds[idx];
        if (!s_round.cards.some(c => c.suit === signal_suit)) {
            throw new Error(`交換失敗：即使在均勻化後，S局 #${idx + 1} 仍然沒有訊號牌。`);
        }
    }

    return locked_ids;
}
// =====================【V8 替換區塊結束】=====================



// 【V6 正確版 - 後期平衡 (空函式)】
function late_balance() {
    // 在當前模型下無意義，保持為空。
}

// 【V6 正確版 - 非和局花色平衡 (空函式)】
function balance_non_tie_suits() {
    // 在當前模型下無意義，保持為空。
}

// =====================【V6 最終正確版 - 替換總入口函式】=====================
async function generate_all_sensitive_shoe_or_retry({max_attempts, signal_suit, tie_suit, late_diff, updateStatus, log_attempt_failure}) {
    let attempt = 1;
    while (attempt <= max_attempts) {
        console.log(`--- 開始第 ${attempt} 次嘗試 ---`);
        if (attempt % 20 === 0) {
            updateStatus(`Processing attempt ${attempt} / ${max_attempts}...`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        try {
            const initial_deck = build_shuffled_deck();
            const { a_rounds, b_rounds, c_cards, final_rounds, final_card_deck } = pack_all_sensitive_and_segment(initial_deck);

            if (a_rounds.length === 0) {
                attempt++;
                log_attempt_failure("No A segments found.");
                continue;
            }

            // 【核心】將本次生成的 final_rounds 存入全域狀態，讓交換函式可以訪問
INTERNAL_STATE.rounds = final_rounds;

// 【V7 新增】為每張牌預先標記它所在的牌局索引，方便後續查找
final_rounds.forEach((round, round_index) => {
    round.cards.forEach(card => {
        card._round_index = round_index;
    });
});

            // 呼叫我們新的規則函式 (不再需要傳遞 deck)
            apply_combined_rules_internal(final_rounds, { signal_suit, tie_suit, late_diff }, log_attempt_failure);

            // --- 準備最終返回的數據 ---
            // 因為我們直接修改了 final_rounds，所以它本身就是最終結果
            const final_deck_for_ui = final_rounds.flatMap(r => r.cards);
            const used_pos_in_final_deck = new Set(final_deck_for_ui.map(c => c.pos));
            const final_tail_cards = c_cards.filter(c => !used_pos_in_final_deck.has(c)); // 從初始的c_cards過濾

            const rounds_for_ui = final_rounds;
            const tail_for_ui = final_tail_cards;

            const rounds_copy = rounds_for_ui.map(r => ({ ...r, cards: r.cards.map(c => c.clone()) }));
            const tail_copy = tail_for_ui.map(c => c.clone());

            updateStatus(`Success on attempt ${attempt}! Finalizing...`);
            return [rounds_copy, tail_copy, final_deck_for_ui];

        } catch (e) {
            let zhMsg = e.message;
            console.error(`第 ${attempt} 次嘗試失敗，原因: ${zhMsg}`);
            log_attempt_failure(`第 ${attempt} 次嘗試失敗，原因: ${zhMsg}`);
            attempt++;
            continue; // 失敗了就重試
        }
    }
    updateStatus(`Failed to generate after ${max_attempts} attempts.`);
    return null;
}
// =====================【V6 替換區塊結束】=====================

// =====================【V4 替換區塊結束】=====================

return {
setConfig: (newConfig) => { Object.assign(CONFIG, newConfig); },
getConfig: () => ({ ...CONFIG }),
generate_all_sensitive_shoe_or_retry,
helpers: {
_seq_points: (cards) => {
if (!cards || cards.length < 4) return [null, null];
const temp_deck = cards.map((c, i) => new Card(c.rank, c.suit, i));
const [P1, B1, P2, B2] = temp_deck.slice(0, 4);
let p_tot = (P1.point() + P2.point()) % 10;
let b_tot = (B1.point() + B2.point()) % 10;
// Full Baccarat point calculation logic assumed complete based on Simulator
return [b_tot, p_tot];
},
_seq_result: (cards) => {
if (!cards || cards.length < 4) return null;
const tmp = cards.map((c, i) => new Card(c.rank, c.suit, i));
const sim = new Simulator(tmp);
const r = sim.simulate_round(0, { no_swap: true });
return r ? r.result : null;
},
compute_sidx_new: compute_sidx_for_segment,
RoundView: (cards, result) => ({ cards, result, segment: null }),
HEART_SIGNAL_ENABLED: () => CONFIG.HEART_SIGNAL_ENABLED,
SIGNAL_SUIT: () => CONFIG.SIGNAL_SUIT,
}
};
})();

const INTERNAL_STATE = {};
const SUIT_LETTER_TO_SYMBOL_APP = { "S": "♠", "H": "♥", "D": "♦", "C": "♣" };
const SUIT_SYMBOL_TO_LETTER_APP = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
function _suit_letter(val) {
if (!val) return "";
const s = String(val).trim();
if (!s) return "";
const upper = s.toUpperCase();
if (SUIT_LETTER_TO_SYMBOL_APP[upper]) return upper;
if (SUIT_SYMBOL_TO_LETTER_APP[s]) return SUIT_SYMBOL_TO_LETTER_APP[s];
if (SUIT_SYMBOL_TO_LETTER_APP[upper]) return SUIT_SYMBOL_TO_LETTER_APP[upper];
return upper;
}
function _normalize_suit_input(val) {
if (!val) return null;
const letter = _suit_letter(val);
return SUIT_LETTER_TO_SYMBOL_APP[letter] || letter;
}
function _suit_counts(rounds, tail) {
const seenPos = new Set();
const unique_cards = [];
const pushCard = (card) => {
if (!card) return;
const { pos } = card;
if (pos !== undefined && pos !== null) {
if (seenPos.has(pos)) return;
seenPos.add(pos);
}
unique_cards.push(card);
};
if (Array.isArray(rounds)) {
rounds.forEach((round) => {
(round.cards || []).forEach(pushCard);
});
}
if (Array.isArray(tail)) {
tail.forEach(pushCard);
}
const counts = new Map();
for (const card of unique_cards) {
const suit = _suit_letter(card.suit || null);
const rank = card.rank || null;
if (suit && rank) {
const key = `${suit}_${rank}`;
counts.set(key, (counts.get(key) || 0) + 1);
}
}
const suit_totals = new Map();
for (const card of unique_cards) {
const suit = _suit_letter(card.suit || null);
if (suit) { suit_totals.set(suit, (suit_totals.get(suit) || 0) + 1); }
}
const cards_by_rank_suit = {};
for (const card of unique_cards) {
const suit = _suit_letter(card.suit || null);
const rank = card.rank || null;
if (suit && rank) {
const key = `${suit}_${rank}`;
if (!cards_by_rank_suit[key]) cards_by_rank_suit[key] = [];
cards_by_rank_suit[key].push(card);
}
}
return {
by_rank_suit: Object.fromEntries(counts),
suit_totals: Object.fromEntries(suit_totals),
cards_by_rank_suit,
};
}
function _serialize_rounds(rounds) {
const out = [];
for (const r of rounds) {
const seq_cards = r.cards || [];
const cards = [];
for (const c of seq_cards) {
const suit_symbol = c.suit || "";
cards.push({ label: c.short(), suit: _suit_letter(suit_symbol), suit_symbol: suit_symbol });
}
let banker_point = 0;
let player_point = 0;
let player_cards_labels = [];
let banker_cards_labels = [];
try {
if (seq_cards.length >= 4) {
const sim = new Simulator(seq_cards.map((c,i) => c.clone(i)));
const sim_r = sim.simulate_round(0, { no_swap: true });
if (sim_r) { 
    // Re-calculate points (copied from source wwa.txt logic [7-10])
    const [P1, B1, P2, B2] = seq_cards.slice(0, 4);
    let player_cards = [P1, P2];
    let banker_cards = [B1, B2];
    let p_tot = (P1.point() + P2.point()) % 10;
    let b_tot = (B1.point() + B2.point()) % 10;
    let natural = (p_tot === 8 || p_tot === 9 || b_tot === 8 || b_tot === 9);
    let idx = 4;
    let p3 = null;
    if (!natural) {
        if (p_tot <= 5 && idx < seq_cards.length) { p3 = seq_cards[idx]; idx++; player_cards.push(p3); p_tot = (p_tot + p3.point()) % 10; }
        const draw = () => { if (idx >= seq_cards.length) return false; const b3 = seq_cards[idx]; idx++; banker_cards.push(b3); b_tot = (b_tot + b3.point()) % 10; return true; };
        if (p3 === null) { if (b_tot <= 5) { draw(); } } 
        else {
            const pt = p3.point();
            if (b_tot <= 2) draw();
            else if (b_tot === 3 && pt !== 8) draw();
            else if (b_tot === 4 && [1-6].includes(pt)) draw();
            else if (b_tot === 5 && [3-6].includes(pt)) draw();
            else if (b_tot === 6 && [5, 6].includes(pt)) draw();
        }
    }
    banker_point = b_tot;
    player_point = p_tot;
    player_cards_labels = player_cards.map(c => c.short());
    banker_cards_labels = banker_cards.map(c => c.short());
} else {
const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
banker_point = bp_pp;
player_point = bp_pp[11];
}
} else {
const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
banker_point = bp_pp;
player_point = bp_pp[11];
}
} catch (e) {
console.error("Error serializing round points", e, r);
const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
banker_point = bp_pp;
player_point = bp_pp[11];
}
const rb = (c) => {
const col = c.color;
if (col === 'R' || col === 'B') return col;
const letter = _suit_letter(c.suit || '');
return (letter === 'H' || letter === 'D') ? 'R' : 'B';
};
const color_seq = seq_cards.map(rb).join('');
out.push({
result: r.result || "",
cards: cards,
player_point: player_point ?? 0,
banker_point: banker_point ?? 0,
player: player_cards_labels,
banker: banker_cards_labels,
color_seq: color_seq,
});
}
return out;
}
function _serialize_rounds_with_flags(rounds, tail) {
const ordered = [...rounds].sort((a, b) => a.start_index - b.start_index);
const all_rounds_views = ordered.map(r => {
  const view = WAA_Logic.helpers.RoundView(r.cards, r.result);
  view.segment = r.segment || null;
  view.sensitive = Boolean(r.sensitive);
  return view;
});

let s_idx_positions = new Set();
try {
s_idx_positions = new Set(WAA_Logic.helpers.compute_sidx_new(all_rounds_views));
} catch (e) { console.error("compute_sidx_new failed", e); }
const serialized = _serialize_rounds(ordered);
const signal_enabled = WAA_Logic.helpers.HEART_SIGNAL_ENABLED();
const signal_suit = WAA_Logic.helpers.SIGNAL_SUIT();
serialized.forEach((row, idx) => {
const is_idx = s_idx_positions.has(idx);
row["is_sidx"] = is_idx;
row["segment_label"] = ordered[idx].segment || ''; // III-A: 新增段位標籤
if (ordered[idx].segment !== 'A') { row["s_idx_ok"] = false; return; }
if (!is_idx) { row["s_idx_ok"] = false; return; }
let ok = true;
if (signal_enabled && signal_suit) { ok = ordered[idx].cards.some(card => card.suit === signal_suit); }
row["s_idx_ok"] = ok;
});
return [serialized, ordered];
}
const STATE = {};
STATE.edit = { mode: 'none', first: null, target: null, armed: false };

// =====================【請用這個新版本替換舊的 performCardSwap】=====================
/**
 * [CHN] 執行手動卡牌交換，並立即更新統計數據
 */
function performCardSwap(a, b) {
  if (!a || !b) return;

  // 確保操作的是 INTERNAL_STATE.rounds 中的真實卡牌物件
  const A = INTERNAL_STATE.rounds?.[a.r]?.cards?.[a.c];
  const B = INTERNAL_STATE.rounds?.[b.r]?.cards?.[b.c];
  
  // 如果任何一張牌不存在，則中止操作
  if (A === undefined || B === undefined) {
    console.error("卡牌交換失敗：找不到指定的卡牌物件。");
    return;
  }
  
  // 執行交換：交換兩張牌在陣列中的位置
  [INTERNAL_STATE.rounds[a.r].cards[a.c], INTERNAL_STATE.rounds[b.r].cards[b.c]] = [B, A];

  // 【新增的關鍵步驟】
  // 1. 基於更新後的 INTERNAL_STATE，重新計算所有統計數據
  console.log("卡牌交換完成，正在重新計算統計數據...");
  const updated_suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
  
  // 2. 呼叫渲染函式，用新的統計數據刷新右上角的表格
  renderSuits(updated_suit_counts);
  console.log("右上角統計表格已更新。");

}
// =====================【替換區塊結束】=====================


function performRoundSwap(i, j) {
  if (i === j) return;
  // 【重要】確保操作的是 INTERNAL_STATE.rounds
  const tmp = INTERNAL_STATE.rounds[i];
  INTERNAL_STATE.rounds[i] = INTERNAL_STATE.rounds[j];
  INTERNAL_STATE.rounds[j] = tmp;
}

const SUIT_SYMBOL_TO_LETTER = {};
const SIGNAL_SUIT_COLOR = {};
const SUIT_DISPLAY_NAME = {};
const $ = (id) => document.getElementById(id);
function toast(message) {
const node = $('toast');
if (!node) return;
node.textContent = message;
node.style.display = 'block';
setTimeout(() => { node.style.display = 'none'; }, 2200);
}
function csvDownloadHref(name) { return `javascript:void(0);`; }
// [CHN] 【AAA.JS 版本】從卡牌標籤中提取花色字母
function suitLetterFromLabel(label) {
  if (!label) return '';
  const value = String(label).trim();
  if (!value) return '';
  const symbol = value.slice(-1);
  // 優先使用 SUIT_SYMBOL_TO_LETTER_APP 進行轉換
  if (SUIT_SYMBOL_TO_LETTER_APP[symbol]) return SUIT_SYMBOL_TO_LETTER_APP[symbol];
  const upper = symbol.toUpperCase();
  if (SUIT_LETTER_TO_SYMBOL_APP[upper]) return upper;
  return upper;
}

// [CHN] 【AAA.JS 版本】從卡牌物件中獲取花色字母
function cardSuitFromCard(card) {
  if (!card) return '';
  if (typeof card === 'object') {
    if (card.suit) return card.suit;
    if (card.suit_symbol) return _suit_letter(card.suit_symbol);
    if (card.label) return suitLetterFromLabel(card.label);
  }
  return suitLetterFromLabel(card);
}

// [CHN] 【AAA.JS 版本】【關鍵修正】從卡牌物件中獲取牌面標籤
function cardLabel(card) {
  if (!card) return '';
  if (typeof card === 'object') {
    // 這是最重要的邏輯，它確保能讀到序列化後物件的 label 屬性
    if (card.label) return card.label;
    if (card.short) return typeof card.short === 'function' ? card.short() : card.short;
  }
  return String(card);
}

// [CHN] 【AAA.JS 版本】從標籤中提取點數
function rankFromLabel(label) {
  if (!label) return '';
  const text = String(label).trim();
  if (!text) return '';
  const cleaned = text.replace(/[\u2660\u2665\u2666\u2663SHDC]/gi, '');
  return cleaned.toUpperCase();
}

// [CHN] 【AAA.JS 版本】從標籤中獲取用於預覽網格的數值
function gridValueFromLabel(label) {
  const rank = rankFromLabel(label);
  if (!rank) return '';
  if (rank === 'A') return '1';
  if (['10', 'J', 'Q', 'K'].includes(rank)) return '0';
  const num = parseInt(rank, 10);
  if (!isNaN(num) && num >= 2 && num <= 9) return String(num);
  return rank;
}

function renderStatsTable(suitCounts) {
  const container = $('suits');
  if (!container) return;
  if (!suitCounts || !suitCounts.by_rank_suit) {
    container.innerHTML = '<div class="small">尚無資料</div>';
    return;
  }
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['S','H','D','C'];
  const suitSymbols = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const byRankSuit = suitCounts.by_rank_suit || {};
  const suitTotals = suitCounts.suit_totals || {};
  let html = '<table class="stats-table"><thead><tr><th></th>';
  html += ranks.map(r => `<th>${r}</th>`).join('');
  html += '<th>合計</th></tr></thead><tbody>';
  for (const suit of suits) {
    html += `<tr><td>${suitSymbols[suit]}</td>`;
    let rowTotal = 0;
    for (const rank of ranks) {
      const key = `${suit}_${rank}`;
      const val = byRankSuit[key] || 0;
      // 新增：計算黑/紅張數
      let black = 0, red = 0;
      if (val && suitCounts.cards_by_rank_suit && suitCounts.cards_by_rank_suit[key]) {
        for (const card of suitCounts.cards_by_rank_suit[key]) {
          if (card.color === 'B') black++;
          else if (card.color === 'R') red++;
        }
      }
      rowTotal += val;
      html += `<td>${black}/${red}</td>`;
    }
    html += `<td>${rowTotal}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}
function renderSuits(counts) { renderStatsTable(counts); }
function renderCutSummary(summary) {
  const container = $('cutSummary');
  if (!container) return;
  if (!summary) {
    container.innerHTML = '';
    return;
  }
  const hitValue = typeof summary.avg_hit === 'number' ? summary.avg_hit.toFixed(3) : summary.avg_hit;
  const roundValue = typeof summary.avg_rounds === 'number' ? summary.avg_rounds.toFixed(3) : summary.avg_rounds;
  container.innerHTML = `
    <div class="small">\u5e73\u5747\u547d\u4e2d\u5f35\u6578\uff1a<span class="mono">${hitValue}</span></div>
    <div class="small">\u5e73\u5747\u6d88\u8017\u5c40\u6578\uff1a<span class="mono">${roundValue}</span></div>
  `;
}
function ensureRoundsHeader() { // III-B: 新增段位欄位
const headers = ['局號', '段位', '1', '2', '3', '4', '5', '6', '結果', '訊號', '\u9592\u5bb6\u724c', '\u838a\u5bb6\u724c', '閒家', '莊家', '卡牌'];
  $('thead').innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
}

function renderRounds(rounds) {
  const tbody = $('tbody');
  if (!tbody) return;
  if (!rounds || !rounds.length) {
    tbody.innerHTML = '';
    return;
  }
  ensureRoundsHeader();
  const signal = $('signalSuit').value;
  // 花色顏色對應
  const SUIT_COLOR = {
    S: '#69c0ff', // 黑桃
    H: '#ff7a90', // 紅心
    D: '#ffb74d', // 方塊
    C: '#73d13d', // 梅花
  };
  const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const tieSet = new Set(['Tie', 'T', '\u548c']);
  const rowsHtml = rounds
    .map((round, index) => {
      const cards = round.cards || [];
      const result = round.result || round.winner || '';
      const winnerClass =
        result === 'Banker' || result === '\u838a' || result === 'B'
          ? 'win-bank'
          : result === 'Player' || result === '\u9592' || result === 'P'
            ? 'win-player'
            : result === 'Tie' || result === '\u548c' || result === 'T'
              ? 'win-tie'
              : '';
      const isTie = tieSet.has(result);
const tieLetter = ($('tieSuit') && $('tieSuit').value) || '';
const nextRes = rounds[index + 1]?.result || rounds[index + 1]?.winner || '';
const isTieSignalRound = ((round.segment_label ?? round.segment) === 'A') && tieSet.has(nextRes);


      const cardCells = [];
      for (let i = 0; i < 6; i += 1) {
  const card = cards[i];
  // 保底：若 card 為空或無 label/short，仍回傳可見文字
  const raw = cardLabel(card) || (card && card.short ? (typeof card.short === 'function' ? card.short() : card.short) : '');
  const label = String(raw || '—'); // 永不為空
  const suit = cardSuitFromCard(card);
  let classes = 'mono';
  let inline = '';
  let coloredLabel = label;
  const suitSym = suit ? (SUIT_SYMBOL[suit] || '') : '';
  if (isTieSignalRound && tieLetter && suit === tieLetter && suitSym && label && label.endsWith(suitSym)) {
  classes += ` signal-card signal-card-${tieLetter}`;
  const color = SUIT_COLOR[tieLetter];
  if (color) inline = ` style="color:${color}"`;
  coloredLabel = `<span style="color:${color}">${label}</span>`;
  } else if (signal && suit === signal && suitSym && label && label.endsWith(suitSym)) {
  classes += ` signal-card signal-card-${signal}`;
  const color = SIGNAL_SUIT_COLOR[signal];
  if (color) inline = ` style="color:${color}"`;
  coloredLabel = `<span style="color:${color}">${label}</span>`;
} else if (suit && SUIT_COLOR[suit] && suitSym && label && label.endsWith(suitSym)) {
  const numPart = label.slice(0, label.length - suitSym.length);
  coloredLabel = `${numPart}<span style="color:${SUIT_COLOR[suit]}">${suitSym}</span>`;
}


  // 帶上資料座標，供點兩格交換使用
const isFirst = STATE.edit && STATE.edit.first &&
              STATE.edit.first.r === index && STATE.edit.first.c === i;
const isSecond = STATE.edit && STATE.edit.second &&
               STATE.edit.second.r === index && STATE.edit.second.c === i;

if (isFirst || isSecond) {
  const outlineColor = isFirst ? '#ffd666' : '#69c0ff'; // 第一張用黃色，第二張用藍色
  const styleToAdd = `outline: 2px solid ${outlineColor}; background: rgba(255, 214, 102, 0.12);`;
  
  if (inline.includes('style=')) {
    inline = inline.replace(/"$/, `; ${styleToAdd}"`);
  } else {
    inline = ` style="${styleToAdd}"`;
  }
}

cardCells.push(
  `<td class="${classes} card-cell" data-r="${index}" data-c="${i}"${inline}>${coloredLabel}</td>`
);

      }
      const playerCards = (round.player || round.player_cards || []).join('/') || '';
      const bankerCards = (round.banker || round.banker_cards || []).join('/') || '';
      const colorSeq = round.color_seq || round.colors || '';
      const colorHtml = colorSeq
        ? colorSeq
            .split('')
            .map((ch) => {
              if (ch === 'R') return '<span class="color-r">R</span>';
              if (ch === 'B') return '<span class="color-b">B</span>';
              return `<span>${ch}</span>`;
            })
            .join('')
        : '';
      const isSIdx = Boolean(round.is_sidx);
      const sIdxOk = Boolean(round.s_idx_ok);
      // S_idx 欄顯示訊號花色符號，顏色隨 signal 變
      let sIdxText = '';
let sIdxClass = '';
if (isTieSignalRound) {
  const sym = SUIT_SYMBOL[tieLetter] || '♣';
  const color = SUIT_COLOR[tieLetter] || '#73d13d';
  sIdxText = `<span style="color:${color};font-weight:700">${sym}</span>`;
  sIdxClass = 'sidx-ok';
} else if (isSIdx) {
    // 這是 S 局
    if (sIdxOk) {
        // S 局，且有訊號牌 -> 顯示 ♥
        const sym = SUIT_SYMBOL[signal] || '♥';
        const color = SUIT_COLOR[signal] || '#ff7a90';
        sIdxText = `<span style="color:${color};font-weight:700">${sym}</span>`;
        sIdxClass = 'sidx-ok';
    } else {
        // S 局，但沒有訊號牌 -> 顯示 ✗
        sIdxText = '&#10006;';
        sIdxClass = 'sidx-bad';
    }
} else {
    // 這不是 S 局
    // 檢查這個非S局裡是否意外包含了訊號牌
    const hasStraySignal = cards.some(card => card && card.suit === signal);
    if (hasStraySignal) {
        // 如果有，也顯示一個叉，表示這是一個「污染」
        sIdxText = '&#10006;';
        sIdxClass = 'sidx-bad';
    }
    // 如果沒有，就保持空白
}


      const indexLabel = round.is_tail ? '\u5c3e\u5c40' : index + 1;
      // 【新的高亮邏輯 for 牌局】
let rowClass = round.is_tail ? 'tail-row' : '';

if (STATE.edit && STATE.edit.mode === 'round') {
  const isFirst = STATE.edit.first && STATE.edit.first.r === index;
  const isSecond = STATE.edit.second && STATE.edit.second.r === index;

  if (isFirst) {
    rowClass += ' highlight-first'; // 添加高亮 class
  }
  if (isSecond) {
    rowClass += ' highlight-second'; // 添加高亮 class
  }
}

      const segmentLabel = round.segment_label ?? round.segment ?? '';
      return `
        <tr class="${rowClass} round-row" data-r="${index}">
  <td>${indexLabel}</td>
  <td class="mono segment-cell">${segmentLabel}</td>
  ${cardCells.join('')}

          <td class="${winnerClass}">${result}</td>
          <td class="mono ${sIdxClass}">${sIdxText}</td>
          <td class="mono">${playerCards}</td>
          <td class="mono">${bankerCards}</td>
          <td>${round.player_point ?? ''}</td>
          <td>${round.banker_point ?? ''}</td>
          <td class="mono color-seq">${colorHtml}</td>
        </tr>
      `;
    })
    .join('');
  tbody.innerHTML = rowsHtml;

}
function sortedRoundsByStartIndex(rounds) { /* stub */ }
function flattenRoundColorSequence(rounds) { /* stub */ }
function buildDeckGrid(cards, signal, rounds = STATE.rounds) {
    if (!Array.isArray(cards) || cards.length === 0) return [];
    const signalLetter = _suit_letter(signal);
    const segmentByIndex = new Map();
    if (Array.isArray(rounds)) {
        let cursor = 0;
        rounds.forEach((round) => {
            if (!round || !Array.isArray(round.cards)) return;
            const seg = round.segment_label || round.segment || '';
            const len = round.cards.length;
            for (let i = 0; i < len; i++) {
                segmentByIndex.set(cursor + i, seg);
            }
            cursor += len;
        });
    }
    return (cards || []).map((card, idx) => {
        const label = cardLabel(card);
        const suit = suitLetterFromLabel(label);
        const numeric = gridValueFromLabel(label);
        const classes = ['cell'];
        if (signalLetter && suit === signalLetter) {
            classes.push('signal-match');
        }
        let colorCode = card && typeof card === 'object' ? card.color : null;
        if (!colorCode) {
            colorCode = (suit === 'H' || suit === 'D') ? 'R' : (suit ? 'B' : null);
        }
        if (colorCode === 'R') {
            classes.push('card-red');
        } else if (colorCode === 'B') {
            classes.push('card-blue');
        }
        const display = (numeric === '0' ? '0' : numeric) || '';
        const seg = segmentByIndex.get(idx);
        if (seg === 'C') {
            classes.push('segment-c');
        } else if (seg === 'B') {
            classes.push('segment-b');
        } else if (seg === 'A') {
            classes.push('segment-a');
        }
        return { value: display, className: classes.join(' ') };
    });
}
function renderPreview(cards) {
    const container = $('gridPreview');
    if (!container) return;
    if (!Array.isArray(cards) || cards.length === 0) {
        container.innerHTML = '<div class="small">尚無資料</div>';
        return;
    }
    const signalSelect = $('signalSuit');
    const signalValue = signalSelect ? signalSelect.value : null;
    const gridData = buildDeckGrid(cards, signalValue, STATE.rounds);
    container.innerHTML = gridData.map(cell => `<div class="${cell.className}">${cell.value ?? ''}</div>`).join('');
}
function openPreviewWindow(immediatePrint = false) {
    if (!STATE.previewCards || STATE.previewCards.length === 0) {
        toast('Please generate a shoe before previewing');
        return;
    }
    const signalSelect = $('signalSuit');
    const signalValue = signalSelect ? signalSelect.value : null;
    const gridData = buildDeckGrid(STATE.previewCards, signalValue, STATE.rounds);
    if (!Array.isArray(gridData) || gridData.length === 0) {
        toast('No preview data available');
        return;
    }
    const gridHtml = gridData.map((cell) => `<div class="${cell.className}">${cell.value ?? ''}</div>`).join('');
    const html = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>Shoe Preview</title>
    <style>
      body{margin:0;padding:24px;background:#0f111a;color:#eef3ff;font:14px/1.4 "Noto Sans TC",sans-serif;}
      body,.cell{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .toolbar{display:flex;gap:12px;margin-bottom:16px;}
      .toolbar button{padding:8px 16px;border:1px solid #24324a;border-radius:6px;background:#1d4ed8;color:#f3f8ff;cursor:pointer;}
      .toolbar button.secondary{background: #24324a;}
      .grid-preview{display:grid;grid-template-columns:repeat(16,1fr);gap:0;border:1px solid #ffffff12;border-radius:12px;overflow:hidden;}
      .cell{display:flex;align-items:center;justify-content:center;height:40px;font-size:22px;font-weight:600;border:1px solid #1d2840;}
      .cell.card-red{background: #2d1b22;color: #ffd6dc;}
      .cell.card-blue{background: #162437;color #d7e9ff;}
      .cell.signal-match{box-shadow:inset 0 0 0 2px #ffd591;}
      @media print{
        body{padding:12px;background: #000;color: #000;}
        .toolbar{display:none;}
        .grid-preview{width:1200px;max-width:100%;margin:0 auto;border-color: #000;}
        .cell{border:1px solid #000;color: #000;background: #000;}
        .cell.card-red{background: #f5c5c5;}
        .cell.card-blue{background: #eff0f7ff;}
        .cell.signal-match{box-shadow:inset 0 0 0 2px #f80404ff;}
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Print</button>
      <button class="secondary" onclick="window.close()">Close</button>
    </div>
    <div class="grid-preview">${gridHtml}</div>
  </body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        URL.revokeObjectURL(url);
        toast('Popup blocked. Please allow pop-ups and try again.');
        return;
    }
    win.focus();
    const revokeLater = () => {
        try {
            URL.revokeObjectURL(url);
        } catch (err) {
            console.warn('failed to revoke preview URL', err);
        }
    };
    const cleanupTimer = setTimeout(revokeLater, 60000);
    const handleUnload = () => {
        clearTimeout(cleanupTimer);
        revokeLater();
    };
    win.addEventListener('beforeunload', handleUnload, { once: true });
    if (immediatePrint) {
        let printed = false;
        const triggerPrint = () => {
            if (printed) return;
            printed = true;
            try {
                win.print();
            } catch (err) {
                console.warn('preview print failed', err);
            }
        };
        win.addEventListener('load', () => setTimeout(triggerPrint, 100), { once: true });
        setTimeout(triggerPrint, 500);
    }
}
function splitCutRows(hitRows) { /* stub */ }
async function refreshCutSummary() { STATE.cutSummary = null; renderCutSummary(null); }
function downloadFile(name, content, type = 'text/csv') { /* stub */ }
function csvEscape(value) { /* stub */ }
function normalizeLines(text) { /* stub */ }
function parseCSV(text) { /* stub */ }
function linesFromCSVorTxt(text) { /* stub */ }
// [CHN] 【最終修正版】將後端數據應用到前端 UI 的核心函式
// ▼▼▼ 請從這裡開始複製 ▼▼▼

// [CHN] 【修正版】將後端數據應用到前端 UI 的核心函式
function applyGenerateResponse(data) {
  // 1. 【重要】將所有最原始的、未經修改的數據儲存到 INTERNAL_STATE
  // INTERNAL_STATE 是我們唯一的、真實的數據來源 (Single Source of Truth)
  INTERNAL_STATE.rounds = data.ordered_rounds || [];
  INTERNAL_STATE.tail = data.tail || [];
  INTERNAL_STATE.deck = data.deck || [];
  
  // 2. 首次計算並渲染所有 UI 元件
  updateMainTable(); // 首次渲染主表格

  // 首次也需要渲染右側面板
  const suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
  renderSuits(suit_counts);
  renderPreview(INTERNAL_STATE.deck);
  renderCutSummary(null); // 清空切牌摘要

  // 3. 顯示表格區域
  const tables = $('tables');
  if (tables) tables.style.display = 'grid';
}

// [CHN] 更新狀態訊息顯示的函式
function updateStatus(message) {
  const node = $('genInfo');
  if (node) {
    node.textContent = message;
  }
  console.log(message);
}

// [CHN] 記錄失敗嘗試原因的函式
function log_attempt_failure(reason) {
    console.warn(`Attempt Failed: ${reason}`);
}

// [CHN] 【核心更新函式】只重新計算並刷新主表格 (左側)
function updateMainTable() {
  if (!INTERNAL_STATE.rounds || INTERNAL_STATE.rounds.length === 0) {
    return;
  }
  // 1. 從唯一的真實數據來源 INTERNAL_STATE.rounds 重新計算所有衍生數據
  const [serialized_rounds, ordered_rounds] = _serialize_rounds_with_flags(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
  // 2. 將計算好的最新序列化數據傳給 renderRounds 來更新畫面
  renderRounds(serialized_rounds);
  console.log("Main table UI updated.");
}

async function generateShoe() {
  const btn = $('btnGen');
  const spinner = $('spinGen');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  try {
    updateStatus('Starting...');
    const num_shoes = Number($('numShoes').value);
    const signal_suit = $('signalSuit').value;
    const tie_signal_suit = $('tieSuit').value || '♣';
    WAA_Logic.setConfig({
      NUM_SHOES: num_shoes,
      SIGNAL_SUIT: _normalize_suit_input(signal_suit),
      TIE_SIGNAL_SUIT: _normalize_suit_input(tie_signal_suit)
    });
    const current_config = WAA_Logic.getConfig();
    const waa_params = {
      max_attempts: current_config.MAX_ATTEMPTS,
      min_tail_stop: current_config.MIN_TAIL_STOP,
      multi_pass_min_cards: current_config.MULTI_PASS_MIN_CARDS,
      late_diff: current_config.LATE_BALANCE_DIFF,
      signal_suit: _normalize_suit_input(signal_suit),
      tie_suit: _normalize_suit_input(tie_signal_suit),
      updateStatus: updateStatus,
      log_attempt_failure: log_attempt_failure
    };
    const result = await WAA_Logic.generate_all_sensitive_shoe_or_retry(waa_params);
    if (!result) {
      toast(`創建失敗：請查看下方訊息或 F12 Console`);

      throw new Error("Generation failed after max attempts");
    }
    const [rounds, tail, deck] = result;
    if (!rounds || rounds.length === 0) {
      updateStatus('創建失敗：沒有生成任何敏感局');
      toast(`創建失敗：沒有生成任何敏感局`);
      throw new Error("No sensitive rounds");
    }
    
    // --- 數據處理與打包 ---
    const [serialized_rounds, ordered_rounds] = _serialize_rounds_with_flags(rounds, tail);
    const suit_counts = _suit_counts(ordered_rounds, tail);
    
    // 將所有需要用到的數據打包，特別是 ordered_rounds (原始對象陣列)
    const data_for_ui = {
        rounds: serialized_rounds,
        ordered_rounds: ordered_rounds, // <--- 確保傳遞原始數據
        tail: tail,
        deck: deck,
        suit_counts: suit_counts,
        meta: { rounds_len: ordered_rounds.length, tail_len: tail.length, deck_len: deck.length }
    };

    // 呼叫 UI 更新函式
    applyGenerateResponse(data_for_ui);
    const count = (data_for_ui.rounds || []).length;
    toast(`牌靴已完成，共 ${count} 局`);
    updateStatus(`Generation complete. ${count} rounds.`);
  } catch (err) {
    console.error('創建時發生錯誤:', err);
    toast(`創建時發生錯誤：${err.message}`);
    updateStatus(`錯誤：${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function simulateCut() { /* stub */ }
async function scanRounds() { /* stub */ }
async function exportCombined() { /* stub */ }

function bindControls() {
  const btnGen = $('btnGen');
  if (btnGen) { btnGen.addEventListener('click', generateShoe); }
  const signalSuit = $('signalSuit');
  if (signalSuit) { signalSuit.addEventListener('change', refreshCutSummary); }
  const tieSuit = $('tieSuit');
  if (tieSuit) { tieSuit.addEventListener('change', refreshCutSummary); }
  
  // --- 編輯相關按鈕的綁定 ---
  const host = btnGen ? btnGen.parentElement : null;
  if (host && !$('editToolbar')) {
    host.insertAdjacentHTML('afterend', `
      <div id="editToolbar" class="btn-row">
        <button id="btnEdit" type="button">編輯</button>
        <button id="btnSwap" type="button">交換</button>
        <button id="btnRound" type="button">局交換</button>
        <button id="btnApplyChanges" type="button" style="background-color: #1d8d5a;">套用變更</button>
        <button id="btnCancelEdit" type="button">取消</button>
      </div>
    `);
  }

  const btnEdit = $('btnEdit');
  const btnSwap = $('btnSwap');
  const btnRound = $('btnRound');
  const btnCancelEdit = $('btnCancelEdit');
  const btnApplyChanges = $('btnApplyChanges');
  const btnPreview = $('btnPreview');
  const btnPrint = $('btnPrint');

  if (btnPreview) { btnPreview.addEventListener('click', () => openPreviewWindow(false)); }
  if (btnPrint) { btnPrint.addEventListener('click', () => openPreviewWindow(true)); }

  // 編輯按鈕：只改變狀態，不刷新 UI
  if (btnEdit) btnEdit.addEventListener('click', () => {
    STATE.edit = { mode: 'card', first: null, second: null, armed: false };
    toast('編輯模式：請點選第一張牌');
  });

  // 局交換按鈕：只改變狀態，不刷新 UI
  if (btnRound) btnRound.addEventListener('click', () => {
    STATE.edit = { mode: 'round', first: null, second: null, armed: false };
    toast('局交換模式：請點選第一局');
  });

  // 交換按鈕
  if (btnSwap) btnSwap.addEventListener('click', () => {
    if (!STATE.edit || STATE.edit.mode === 'none') return;
    const { mode, first, second, armed } = STATE.edit;

    if ((mode === 'card' || mode === 'round') && first && second) {
      // 情況1：已選好兩者，執行交換
      if (mode === 'card') {
        performCardSwap(first, second);
        toast('卡牌交換成功！');
      } else {
        performRoundSwap(first.r, second.r);
        toast('牌局交換成功！');
      }
      STATE.edit = { mode: 'none', first: null, second: null, armed: false };
      updateMainTable(); // 交換後，用最新數據刷新主表格
    } else if (first && !armed) {
      // 情況2：只選好第一個，進入待選第二個的模式
      STATE.edit.armed = true;
      toast(mode === 'card' ? '請點選要交換的第二張牌' : '請點選要交換的第二局');
    }
  });

  // 取消按鈕
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => {
    const wasEditing = STATE.edit && STATE.edit.mode !== 'none';
    STATE.edit = { mode: 'none', first: null, second: null, armed: false };
    if (wasEditing) {
      updateMainTable(); // 取消時，刷新一次以清除高亮
    }
    toast('已取消編輯');
  });
  
  // 套用變更按鈕
  if (btnApplyChanges) {
    btnApplyChanges.addEventListener('click', () => {
      if (!INTERNAL_STATE.rounds) {
        toast('沒有資料可套用');
        return;
      }
      // 1. 重新計算花色統計並渲染
      const suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
      renderSuits(suit_counts);
      // 2. 重新產生預覽網格的資料並渲染
      const updated_deck = INTERNAL_STATE.rounds.flatMap(r => r.cards).concat(INTERNAL_STATE.tail);
      STATE.previewCards = updated_deck; // 更新預覽數據源
      renderPreview(updated_deck);
      toast('變更已套用至預覽和統計');
    });
  }

  // 表格點擊事件委派 (只綁定一次)
  const tbody = $('tbody');
  if (tbody && !tbody._editBound) {
    tbody._editBound = true;
    tbody.addEventListener('click', (e) => {
      if (!STATE.edit || STATE.edit.mode === 'none') return;

      const td = e.target.closest('.card-cell');
      const tr = e.target.closest('.round-row');
      const { mode, armed } = STATE.edit;

      let needsUpdate = false;

      if (mode === 'card' && td) {
        const r = Number(td.dataset.r), c = Number(td.dataset.c);
        if (!Number.isFinite(r) || !Number.isFinite(c)) return;
        if (!armed) {
          STATE.edit.first = { r, c };
          STATE.edit.second = null;
        } else {
          STATE.edit.second = { r, c };
          toast('已選定兩張牌，請再次點擊「交換」按鈕確認');
        }
        needsUpdate = true;
      } else if (mode === 'round' && tr) {
        const r = Number(tr.dataset.r);
        if (!Number.isFinite(r)) return;
        if (!armed) {
          STATE.edit.first = { r };
          STATE.edit.second = null;
        } else {
          STATE.edit.second = { r };
          toast('已選定兩局，請再次點擊「交換」按鈕確認');
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateMainTable(); // 每次有效點擊都刷新主表格以更新高亮
      }
    });
  }
}

// --- 頁面載入時執行綁定 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindControls);
} else {
  bindControls();
}

// ▲▲▲ 複製到這裡結束 ▲▲▲
