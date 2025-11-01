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
        } else if (b_tot === 4 && [1,2,3,4,5,6].includes(pt)) {
          if (!draw()) return null;
        } else if (b_tot === 5 && [4,5,6,7].includes(pt)) {
          if (!draw()) return null;
        } else if (b_tot === 6 && [6, 7].includes(pt)) {
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
MANUAL_TAIL: [],
NUM_SHOES: 1,
MIN_TAIL_STOP: 5,
MULTI_PASS_MIN_CARDS: 15,
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



const SWAP_TRACE = [];
let CURRENT_SWAP_CONTEXT = 'init';
/**
 * 重設交換追蹤紀錄
 */
function resetSwapTrace() {
SWAP_TRACE.length = 0;
}

if (typeof window !== 'undefined') {
window.SWAP_TRACE = SWAP_TRACE;
window.resetSwapTrace = resetSwapTrace;
}

/**

 *
 * @param {Array} deck - 完整的、包含所有卡牌的總牌靴陣列。
// =====================【V6 最終正確版 - 替換舊的 swap_suits...】=====================
/**

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

/*** 卡牌類別，包含點數、花色、位置等屬性*/
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
/*** 建立並洗牌一副完整的牌組*/
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


/*** 掃描所有敏感局，回傳敏感局陣列*/
function scan_all_sensitive_rounds(sim) {
const out = [];
const last = sim.deck.length - 1;
for (let i = 0; i < last; i++) {
const r = sim.simulate_round(i);
if (r && r.sensitive) { out.push(r); }
}
return out;
}
/** * 從卡牌池中多重嘗試找出敏感局候選 */
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

// =====================【V20 最終版 - 請完整替換此函式】=====================
function apply_combined_rules_internal(final_rounds, { signal_suit, tie_suit, late_diff }, log_attempt_failure) {
    let locked_ids = new Set();

    // 步驟 1: 處理和局訊號
    try {
        const tie_locked = enforce_tie_signal_combined(final_rounds, tie_suit);
        locked_ids = new Set([...locked_ids, ...tie_locked]);
    } catch (e) {
        log_attempt_failure(`Tie signal failed: ${e.message}`);
        throw e;
    }

    // 步驟 2: 處理S局訊號（可選規則）
    try {
        let mode = 'suit';
        try {
          const sel = document.getElementById('signalRule');
          if (sel && sel.value) mode = sel.value;
        } catch (e) { /* ignore */ }
        if (typeof STATE !== 'undefined' && STATE.signalMode) mode = STATE.signalMode;

        let signal_locked;
        if (mode === 'red0' && typeof window.distribute_signals_evenly_redzero === 'function') {
            // 先檢查 donors 是否足夠（紅0 數量 >= S 局數量），不足則丟錯重試
            const s_indices_chk = new Set(compute_sidx_for_segment(final_rounds, 'A'));
            const need = s_indices_chk.size;
            const countRed0 = final_rounds.flatMap(r=>r.cards||[])
              .reduce((t,c)=>{ const r=String(c.rank||'').toUpperCase(); const s=c.suit; const is0=(r==='10'||r==='J'||r==='Q'||r==='K'); const red=(s==='♥'||s==='♦'); return t + (is0&&red?1:0); },0);
            if (countRed0 < need) {
              const msg = `Red0 donors not enough: need ${need}, have ${countRed0}`;
              log_attempt_failure(msg);
              throw new Error(msg);
            }
            signal_locked = window.distribute_signals_evenly_redzero(final_rounds, locked_ids);
        } else if (mode === 'zero0' && typeof window.distribute_signals_evenly_zeroany === 'function') {
            // 0 點 donor 足量檢查
            const s_indices_chk = new Set(compute_sidx_for_segment(final_rounds, 'A'));
            const need = s_indices_chk.size;
            const countZero = final_rounds.flatMap(r=>r.cards||[])
              .reduce((t,c)=>{ const r=String(c.rank||'').toUpperCase(); return t + ((r==='10'||r==='J'||r==='Q'||r==='K')?1:0); },0);
            if (countZero < need) {
              const msg = `Zero donors not enough: need ${need}, have ${countZero}`;
              log_attempt_failure(msg);
              throw new Error(msg);
            }
            signal_locked = window.distribute_signals_evenly_zeroany(final_rounds, locked_ids);
        } else {
            signal_locked = distribute_signals_evenly(final_rounds, signal_suit, locked_ids);
        }
        locked_ids = new Set([...locked_ids, ...signal_locked]);
    } catch (e) {
        log_attempt_failure(`Even Distribution failed: ${e.message}`);
        throw e;
    }

    // 步驟 4 (原步驟3): 最終強制驗證 (S局和T局的)
    const s_indices_final = compute_sidx_for_segment(final_rounds, 'A');
    for (const idx of s_indices_final) {
        const s_round = final_rounds[idx];
        const has_signal = s_round.cards.some(card => card.suit === signal_suit);
        if (!has_signal) {
            const error_msg = `[驗證失敗] S局 #${idx + 1} ！`;
            log_attempt_failure(error_msg);
            // 我們必須拋出這個錯誤，因為S局訊號的優先級是最高的
            throw new Error(error_msg);
        }
    }
    console.log("[驗證成功] 所有S局均已包含訊號牌。");

    return final_rounds;
}

/**
 * [CHN] 【V8 最終完美版】均勻分配並集中訊號牌
 *      - 採用「補缺優先」和「均勻化」策略，確保訊號牌被合理地分配到所有S局。
 */
// ====================================================================================
// --- 【最終修正版 V2】請用這整段程式碼替換您現有的 distribute_signals_evenly 函式 ---
// ====================================================================================
// ====================================================================================
// --- 【最終修正版 V4】請用這整段程式碼替換您現有的 distribute_signals_evenly 函式 ---
// ====================================================================================
function distribute_signals_evenly(final_rounds, signal_suit, locked_ids) {
    // 【V3 修正】在這裡重新定義一次，確保它在此作用域內絕對可用
    const toPoint = (r) => r === 'A' ? 1 : (['10', 'J', 'Q', 'K'].includes(r) ? 0 : parseInt(r, 10));
    const samePoint = (a, b) => !!a && !!b && toPoint(a.rank) === toPoint(b.rank);

    if (!signal_suit) return locked_ids;

    console.log('[Signal Balancer V4 - 就近交換] 開始執行訊號牌平衡...');

    const MAX_ITERATIONS = 2000;

    const refreshCardMetadata = () => {
        final_rounds.forEach((round, round_index) => {
            (round.cards || []).forEach((card) => {
                card._round_index = round_index;
            });
        });
    };
    
    refreshCardMetadata();

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        const s_indices = new Set(compute_sidx_for_segment(final_rounds, 'A'));
        if (s_indices.size === 0) break;

        const all_cards = final_rounds.flatMap(r => r.cards);

        // --- 找出所有需要被移動的牌（捐贈者）和所有可以接收的位置（接收者） ---

        // 捐贈者：所有在非S局的、未鎖定的訊號牌
        const donors = all_cards.filter(card =>
            !s_indices.has(card._round_index) &&
            card.suit === signal_suit &&
            !locked_ids.has(card)
        );

        // 接收者：所有在S局的、未鎖定的非訊號牌
        const receivers = all_cards.filter(card =>
            s_indices.has(card._round_index) &&
            card.suit !== signal_suit &&
            !locked_ids.has(card)
        );
        
        // --- 尋找最佳交換對：距離最短 ---
        let best_swap = null;
        let min_distance = Infinity;

        for (const donor of donors) {
            for (const receiver of receivers) {
                // 檢查點數是否匹配
                if (samePoint(donor, receiver)) {
                    const distance = Math.abs(donor._round_index - receiver._round_index);
                    
                    // 【核心邏輯】如果距離更短，就更新為最佳交換
                    if (distance < min_distance) {
                        min_distance = distance;
                        best_swap = { donor, receiver };
                    }
                }
            }
        }

        // --- 執行交換 ---
        if (best_swap) {
            const { donor, receiver } = best_swap;
            console.log(`[就近交換] 找到最佳配對 (距離: ${min_distance})：將 #${donor._round_index+1} 局的 ${donor.short()} 與 #${receiver._round_index+1} 局的 ${receiver.short()} 交換。`);
            
            swap_cards_in_rounds(donor, receiver);
            
            // 鎖定這兩張牌，防止它們在後續被再次移動
            locked_ids.add(donor);
            locked_ids.add(receiver);

            refreshCardMetadata(); // 交換後刷新元數據
        } else {
            // 如果找不到任何可以交換的配對，說明平衡過程已達極限
            console.log('[Signal Balancer V4] 找不到更多可執行的「就近交換」，平衡結束。');
            break;
        }
    }

    // --- 最終驗證 (與 V3 版本相同) ---
    console.log('[Signal Balancer V4] 進行最終驗證...');
    const s_indices_final = new Set(compute_sidx_for_segment(final_rounds, 'A'));
    let all_s_ok = true;
    for (const idx of s_indices_final) {
        const s_round = final_rounds[idx];
        if (!s_round.cards.some(c => c.suit === signal_suit)) {
            all_s_ok = false;
            const error_msg = `[驗證失敗] S局 #${idx + 1} 最終仍然沒有訊號牌！`;
            console.error(error_msg);
            throw new Error(error_msg);
        }
    }
    if(all_s_ok) {
        console.log('[驗證成功] 所有 S 局均包含訊號牌。');
    }

    const final_all_cards = final_rounds.flatMap(r => r.cards);
    const remaining_illegals = final_all_cards.filter(c =>
        c.suit === signal_suit && !s_indices_final.has(c._round_index)
    );

    if (remaining_illegals.length > 0) {
        const hdr = `[驗證警告] 仍有 ${remaining_illegals.length} 張訊號牌殘留在非 S 局，原因可能是點數不匹配或已被鎖定。`;
        console.warn(hdr);
        remaining_illegals.forEach(c => {
          const line = `- 殘留牌: ${c.short()} 位於 #${c._round_index+1} 局`;
          console.log(`  ${line}`);
          pushSignal(line);
        });
    } else {
        console.log('[驗證成功] 所有非 S 局均已無訊號牌。');
    }

    return locked_ids;
}

// =====================【V20 預先標記版 - 請替換此函式】=====================
async function generate_all_sensitive_shoe_or_retry({max_attempts, signal_suit, tie_suit, late_diff, updateStatus, log_attempt_failure}) {
    let attempt = 1;
    while (attempt <= max_attempts) {
        console.log(`--- 開始第 ${attempt} 次嘗試 ---`);
        if (attempt % 20 === 0) {
            updateStatus(`Processing attempt ${attempt} / ${max_attempts}...`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        try {
            const deck = build_shuffled_deck();
            const { a_rounds, b_rounds, c_cards, final_rounds, final_card_deck } = pack_all_sensitive_and_segment(deck);

            INTERNAL_STATE.rounds = final_rounds;

            if (a_rounds.length === 0) {
                attempt++;
                log_attempt_failure("No A segments found.");
                continue;
            }

            // 【V20 核心新增】為每張牌預先標記它所在的牌局索引和段位
            const s_indices = new Set(compute_sidx_for_segment(final_rounds, 'A'));
            const tie_indices = new Set();
            for (let i = 0; i < final_rounds.length - 1; i++) {
                if (final_rounds[i].segment === 'A' && _is_tie_result(final_rounds[i + 1].result)) {
                    tie_indices.add(i);
                }
            }

            final_rounds.forEach((round, round_index) => {
                round.cards.forEach(card => {
                    card._round_index = round_index;
                    card._segment = round.segment; // A, B, or C
                    // 標記這張牌是否在一個 S 局或 T 訊號局中
                    card.is_s_or_t_signal = s_indices.has(round_index) || tie_indices.has(round_index);
                });
            });

            apply_combined_rules_internal(final_rounds, { signal_suit, tie_suit, late_diff }, log_attempt_failure);

            const rounds_for_ui = final_rounds;
            const tail_for_ui = c_cards.filter(c => !final_rounds.flatMap(r => r.cards).some(fc => fc.pos === c.pos));

            const rounds_copy = rounds_for_ui.map(r => ({ ...r, cards: r.cards.map(c => c.clone()) }));
            const tail_copy = tail_for_ui.map(c => c.clone());
            const deck_for_ui = rounds_copy.flatMap(r => r.cards).concat(tail_copy);

            updateStatus(`Success on attempt ${attempt}! Finalizing...`);
            return [rounds_copy, tail_copy, deck_for_ui];

        } catch (e) {
            let zhMsg = e.message;
            console.error(`第 ${attempt} 次嘗試失敗，原因: ${zhMsg}`);
            log_attempt_failure(`第 ${attempt} 次嘗試失敗，原因: ${zhMsg}`);
            attempt++;
            continue;
        }
    }
    updateStatus(`Failed to generate after ${max_attempts} attempts.`);
    return null;
}

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
 let result_text = r.result || "";
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
            else if (b_tot === 4 && [1,2,3,4,5,6].includes(pt)) draw();
            else if (b_tot === 5 && [4,5,6,7].includes(pt)) draw();
            else if (b_tot === 6 && [6, 7].includes(pt)) draw();
        }
    }
    banker_point = b_tot;
    player_point = p_tot;
    player_cards_labels = player_cards.map(c => c.short());
    banker_cards_labels = banker_cards.map(c => c.short());
    // 用模擬結果覆蓋顯示的結果（莊/閒/和）
    result_text = sim_r.result || result_text;
} else {
const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
banker_point = bp_pp;
player_point = bp_pp[11];
const rr = (WAA_Logic.helpers._seq_result && WAA_Logic.helpers._seq_result(seq_cards)) || null;
if (rr) result_text = rr;
}
} else {
const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
banker_point = bp_pp;
player_point = bp_pp[11];
const rr = (WAA_Logic.helpers._seq_result && WAA_Logic.helpers._seq_result(seq_cards)) || null;
if (rr) result_text = rr;
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
result: result_text || "",
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
// 重要：用當前卡牌重新計算每局結果，避免使用舊的 r.result
const all_rounds_views = ordered.map(r => {
  let computed = null;
  try {
    if (Array.isArray(r.cards) && r.cards.length >= 4 && WAA_Logic?.helpers?._seq_result) {
      computed = WAA_Logic.helpers._seq_result(r.cards);
    }
  } catch (e) { /* ignore and fallback */ }
  const view = WAA_Logic.helpers.RoundView(r.cards, computed || r.result);
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
const has_signal_suit = ordered[idx].cards.some(card => card.suit === signal_suit);

        // 2. 如果這不是一個合規的S局 (is_idx 為 false)，但它卻包含了訊號花色
        if (!is_idx && has_signal_suit && ordered[idx].segment === 'A') {
            // 我們把它「偽裝」成一個不合規的S局，來觸發UI顯示紅色叉叉
            row["is_sidx"] = true;  // 標記為S類局
            row["s_idx_ok"] = false; // 標記為不合規
            return; // 處理完畢，跳到下一輪 forEach
        }
        
        // --- 以下是您原始程式碼的判斷邏輯，完全保留 ---
        if (ordered[idx].segment !== 'A') { row["s_idx_ok"] = false; return; }
        if (!is_idx) { row["s_idx_ok"] = false; return; }
        let ok = true;
        if (signal_enabled && signal_suit) { ok = has_signal_suit; } // 重用上面計算的 has_signal_suit
        row["s_idx_ok"] = ok;
    });
 
    
    return [serialized, ordered];
}
const STATE = {};
STATE.edit = { mode: 'none', first: null, target: null, armed: false };
STATE.cutSummary = null;
STATE.didAutoColor = false;
STATE.previewRounds = [];
STATE.baseDeck = null; // 套用後的基準牌序（切牌永遠以此為基準）
STATE.warnings = [];
STATE.warnType = null; // 'signal' | 'swap'
function renderWarningsPanel() {
  const box = document.getElementById('warnings');
  if (!box) return;
  const list = (STATE.warnType
    ? (STATE.warnings || []).filter(w => w && w.type === STATE.warnType)
    : (STATE.warnings || []));
  if (list.length === 0) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  box.innerHTML = list.map(w => `<div class="log-line">${w.msg}</div>`).join('');
}
function pushWarning(type, msg) {
  if (!STATE.warnings) STATE.warnings = [];
  STATE.warnings.push({ type, msg });
  renderWarningsPanel();
}
function clearWarnings(type) {
  if (!type) { STATE.warnings = []; renderWarningsPanel(); return; }
  STATE.warnings = (STATE.warnings || []).filter(w => w && w.type !== type);
  renderWarningsPanel();
}
function snapshotPreviewRounds() {
  if (!Array.isArray(INTERNAL_STATE.rounds)) return [];
  return INTERNAL_STATE.rounds.map((round) => {
    const segmentValue = round.segment_label ?? round.segment ?? '';
    const length = Array.isArray(round.cards) ? round.cards.length : 0;
    return {
      segment: segmentValue,
      segment_label: segmentValue,
      cards: Array.from({ length })
    };
  });
}
// =================================================================================
// --- 【最終修正版】請用這整段程式碼替換您現有的 window.autoColorSwap 函式 ---
// =================================================================================
window.autoColorSwap = function autoColorSwap() {
  // 紅0 模式時不執行卡色（避免與紅0訊號互相干擾）
  try {
    const sel = document.getElementById('signalRule');
    const mode = sel && sel.value ? sel.value : (STATE && STATE.signalMode);
    if (mode === 'red0') { toast('紅0 模式不需要卡色'); return; }
  } catch (e) {}

  const rounds = INTERNAL_STATE.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0) return;

  // 1) 小工具和規則定義 (保持不變)
  const sSet = new Set(WAA_Logic.helpers.compute_sidx_new(rounds));
  const isS = (idx) => sSet.has(idx);
  const toPoint = (r) => r === 'A' ? 1 : (['10', 'J', 'Q', 'K'].includes(r) ? 0 : parseInt(r, 10));
  const samePoint = (a, b) => !!a && !!b && toPoint(a.rank) === toPoint(b.rank);
  const heartCount = (r) => (r.cards || []).reduce((t, c) => t + (c && c.suit === '♥' ? 1 : 0), 0);
  const signalOK = (r, idx) => isS(idx) ? heartCount(r) >= 1 : heartCount(r) === 0;
  
  const lockedRounds = new Set();
  const lockedPos = new Map();
  const isLocked = (ridx, posIdx) => {
    if (!lockedRounds.has(ridx)) return false;
    const set = lockedPos.get(ridx);
    return set ? set.has(posIdx) : false;
  };
  const lockFirstFour = (ridx) => {
    lockedRounds.add(ridx);
    const set = new Set([0, 1, 2, 3]);
    lockedPos.set(ridx, set);
  };

  function legalSuitPair(cA, cB, idxA, idxB) {
    if (!samePoint(cA, cB)) return false;
    const basicOK = (cA.suit === '♥' && cB.suit === '♥') || (cA.suit !== '♥' && cB.suit !== '♥');
    if (basicOK) return true;
    if (isS(idxA) && isS(idxB) && heartCount(rounds[idxA]) >= 2 && heartCount(rounds[idxB]) >= 2) {
      const postA = heartCount(rounds[idxA]) + (cB.suit === '♥' ? 1 : 0) - (cA.suit === '♥' ? 1 : 0);
      const postB = heartCount(rounds[idxB]) + (cA.suit === '♥' ? 1 : 0) - (cB.suit === '♥' ? 1 : 0);
      return postA >= 1 && postB >= 1;
    }
    return false;
  }

  function roundTier(idx) {
    const seg = rounds[idx]?.segment;
    if (idx === undefined || seg === undefined) return 3;
    if (seg === 'A') return 1;
    if (seg === 'B') return 2;
    if (seg === 'C') return 3;
    return 3;
  }

  // 【最終修正版 - 嚴格遵守向前看原則】
function* sourceCandidates(needColor, current_ridx, current_pidx) { // 增加了當前處理的位置索引
    const current_round = rounds[current_ridx];

    // 1. 【局內向前看】只從當前位置的下一張牌開始尋找
    for (let q = current_pidx + 1; q < current_round.cards.length; q++) {
        if (isLocked(current_ridx, q)) continue;
        if (current_round.cards[q].back_color === needColor) {
            yield { r: current_ridx, c: q, cost: 0 };
        }
    }

    // 2. 【局間向前看】只從當前局的下一局開始尋找
    const ids = [...rounds.keys()].filter(i => i > current_ridx); // 關鍵改動：i > current_ridx
    ids.sort((i, j) => roundTier(i) - roundTier(j) || i - j);

    for (const i of ids) {
        const round_to_search = rounds[i];
        // 在未來的牌局裡，可以從頭開始找
        for (let q = 0; q < round_to_search.cards.length; q++) {
            if (isLocked(i, q)) continue;
            if (round_to_search.cards[q].back_color === needColor) {
                yield { r: i, c: q, cost: roundTier(i) };
            }
        }
    }
}


  // --- 【核心修正】將 solvePattern 放在 autoColorSwap 內部，確保它可以訪問所有需要的變數 ---
  function solvePattern(ridx, pattern) {
      const round_to_solve = rounds[ridx];
      
      const original_cards_str = round_to_solve.cards.map(c => c.short()).join(', ');
      const original_colors_str = round_to_solve.cards.map(c => c.back_color).join('');
      console.log(`\n--- 開始處理 #${ridx+1} 局 ---`);
      console.log(`【日誌 #${ridx+1}】原始牌型：[${original_cards_str}]`);
      console.log(`【日誌 #${ridx+1}】原始顏色：${original_colors_str}`);
      console.log(`【日誌 #${ridx+1}】目標模式：${pattern.join('')}`);

      if (!signalOK(round_to_solve, ridx)) {
          console.log(`【日誌 #${ridx+1}】跳過：初始狀態不滿足訊號規則。`);
          return false;
      }

      const sandbox_round = { ...round_to_solve, cards: round_to_solve.cards.map(c => c.clone()) };
      const swap_instructions = [];
      const n = Math.min(4, sandbox_round.cards.length);

      for (let p = 0; p < n; p++) {
          if (sandbox_round.cards[p].back_color === pattern[p]) continue;

          console.log(`【日誌 #${ridx+1}】位置 ${p+1}：需要顏色 '${pattern[p]}'。當前沙盤牌：${sandbox_round.cards[p].short()} (顏色: ${sandbox_round.cards[p].back_color})。`);

          let best = null;
          
          for (const cand of sourceCandidates(pattern[p], ridx)) {
              if (swap_instructions.some(instr => (instr.to.r === cand.r && instr.to.c === cand.c))) continue;
              if (p === cand.c && ridx === cand.r) continue;

              const temp_sandbox_A = { ...sandbox_round };
              const temp_sandbox_B = { ...rounds[cand.r] };
              
              const temp_card_A = temp_sandbox_A.cards[p];
              const temp_card_B = temp_sandbox_B.cards[cand.c];
              
              const is_safe = legalSuitPair(temp_card_A, temp_card_B, ridx, cand.r);
              if (!is_safe) continue;

              // 模擬交換並檢查訊號
              const temp_A_cards = [...temp_sandbox_A.cards];
              const temp_B_cards = [...temp_sandbox_B.cards];
              [temp_A_cards[p], temp_B_cards[cand.c]] = [temp_B_cards[cand.c], temp_A_cards[p]];
              
              if (!signalOK({cards: temp_A_cards}, ridx) || !signalOK({cards: temp_B_cards}, cand.r)) {
                  continue;
              }

              const cost = cand.cost;
              const is_better = !best || cost < best.cost || (cost === best.cost && cand.r < best.src.r);

              if (is_better) {
                  console.log(`【日誌 #${ridx+1}】位置 ${p+1}：找到更優方案 -> ${rounds[cand.r].cards[cand.c].short()} (來自 #${cand.r+1} 第 ${cand.c+1} 張, 成本: ${cost})。`);
                  best = { src: cand, cost: cost };
              }
          }

          if (!best) {
              const failMsg = `【日誌 #${ridx+1}】失敗於位置 ${p+1}：未找到任何安全且可行的交換方案。`;
              console.log(`%c${failMsg}`, 'color: red; font-weight: bold;');
              return false;
          }

          const best_cand_card = rounds[best.src.r].cards[best.src.c];
          sandbox_round.cards[p] = best_cand_card;
          
          const instruction = {
              from: { r: ridx, c: p },
              to: { r: best.src.r, c: best.src.c }
          };
          swap_instructions.push(instruction);
          
          console.log(`%c【日誌 #${ridx+1}】規劃於位置 ${p+1}：已規劃與 #${best.src.r+1} 局的第 ${best.src.c+1} 張牌 ${best_cand_card.short()} 進行交換。`, 'color: blue;');
      }

      if (swap_instructions.length > 0) {
          console.log(`%c【日誌 #${ridx+1}】方案已定，開始執行 ${swap_instructions.length} 個交換操作...`, 'color: green; font-weight: bold;');
          swap_instructions.forEach(instr => {
              performCardSwap(instr.from, instr.to);
          });
          console.log(`%c【日誌 #${ridx+1}】所有交換執行完畢。`, 'color: green; font-weight: bold;');
      } else {
          console.log(`【日誌 #${ridx+1}】無需交換，原始牌型已滿足目標。`);
      }

      return true;
  }

  function scoreRound(r, pattern) {
    const n = Math.min(4, r.cards.length);
    let match = 0, deficit = 0;
    for (let i = 0; i < n; i++) {
      if (r.cards[i].back_color === pattern[i]) match++;
      else deficit++;
    }
    return { match, deficit };
  }

  // 9) 主流程 (保持不變)
  for (let ridx = 0; ridx < rounds.length; ridx++) {
    if (rounds[ridx]?.segment === 'B') continue;
    if (!signalOK(rounds[ridx], ridx)) continue;

    const pat1 = ['B', 'B', 'B', 'R'];
    const pat2 = ['R', 'R', 'R', 'B'];
    const s1 = scoreRound(rounds[ridx], pat1);
    const s2 = scoreRound(rounds[ridx], pat2);
    
    // 修正：當 match 和 deficit 都相同時，優先選擇 pat1 (BBBR)
    const first = (s1.match > s2.match || (s1.match === s2.match && s1.deficit < s2.deficit)) ? pat1 : s2.match > s1.match ? pat2 : pat1;
    const second = (first === pat1) ? pat2 : pat1;

    if (solvePattern(ridx, first) || solvePattern(ridx, second)) {
      lockFirstFour(ridx);
    }
  }
  
  // 10) 刷新 UI
  const updatedDeck = INTERNAL_STATE.rounds
    .flatMap((r) => r.cards)
    .concat(INTERNAL_STATE.tail || []);
  INTERNAL_STATE.deck = updatedDeck.slice();
  STATE.previewRounds = snapshotPreviewRounds();
  STATE.previewCards = updatedDeck.slice();
  STATE.didAutoColor = true;
  updateMainTable();
  renderSuits(_suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail));

  // 11) 最終摘要：只顯示目前仍不達標的 S 局（避免中途失敗但最終成功的雜訊）
  try {
    const sSetFinal = new Set(WAA_Logic.helpers.compute_sidx_new(INTERNAL_STATE.rounds));
    const failures = [];
    for (let i = 0; i < INTERNAL_STATE.rounds.length; i++) {
      if (!sSetFinal.has(i)) continue;
      if ((INTERNAL_STATE.rounds[i].cards || []).filter(c => c && c.suit === '♥').length < 1) {
        failures.push(i + 1);
      }
    }
    STATE.warnType = 'swap';
    clearWarnings('swap');
    if (failures.length > 0) {
      pushWarning('swap', `【卡色警訊】仍有 ${failures.length} 個 S 局未包含訊號牌。`);
      failures.forEach(n => pushWarning('swap', `- 局 #${n} 未達成`));
    } else {
      // 若都合格，清空卡色類警訊顯示
      clearWarnings('swap');
      renderWarningsPanel();
    }
  } catch (e) { /* ignore */ }
};



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
  // 1. 基於更新後的 INTERNAL_STATE，重新計算所有統計數據
  const updated_suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
  
  // 2. 呼叫渲染函式，用新的統計數據刷新右上角的表格
  renderSuits(updated_suit_counts);

  // 3. 立即刷新主表格（結果/訊號會重新計算）與右側預覽
  try {
    updateMainTable();
    const updatedDeck = INTERNAL_STATE.rounds.flatMap(r => r.cards).concat(INTERNAL_STATE.tail || []);
    STATE.previewRounds = snapshotPreviewRounds();
    STATE.previewCards = updatedDeck.slice();
    renderPreview(STATE.previewCards);
  } catch (e) { /* no-op */ }



}
// =====================【替換區塊結束】=====================


function performRoundSwap(i, j) {
  if (i === j) return;
  // 【重要】確保操作的是 INTERNAL_STATE.rounds
  const tmp = INTERNAL_STATE.rounds[i];
  INTERNAL_STATE.rounds[i] = INTERNAL_STATE.rounds[j];
  INTERNAL_STATE.rounds[j] = tmp;

  // 交換後立即刷新：結果/訊號/預覽/統計
  try {
    const updated_suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
    renderSuits(updated_suit_counts);
    updateMainTable();
    const updated_deck = INTERNAL_STATE.rounds.flatMap(r => r.cards).concat(INTERNAL_STATE.tail || []);
    STATE.previewRounds = snapshotPreviewRounds();
    STATE.previewCards = updated_deck.slice();
    renderPreview(STATE.previewCards);
  } catch (e) { /* no-op */ }
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
function _compute_bpt(rounds) {
  const res = { B: 0, P: 0, T: 0, total: 0 };
  if (!Array.isArray(rounds)) return res;
  for (const r of rounds) {
    if (!r || !Array.isArray(r.cards) || r.cards.length < 4) continue;
    let rr = null;
    try {
      const sim = new Simulator(r.cards.map((c, i) => c.clone(i)));
      const r0 = sim.simulate_round(0, { no_swap: true });
      rr = r0 ? r0.result : null;
    } catch (_) { rr = null; }
    if (!rr) continue;
    const val = String(rr);
    if (['莊', 'Banker', 'B'].includes(val)) res.B++;
    else if (['閒', 'Player', 'P'].includes(val)) res.P++;
    else if (['和', 'Tie', 'T'].includes(val)) res.T++;
  }
  res.total = res.B + res.P + res.T;
  return res;
}
function renderBPTSummary(counts) {
  const el = $('bptSummary');
  if (!el) return;
  if (!counts || !counts.total) { el.innerHTML = ''; return; }
  const pct = (n) => ((n / counts.total) * 100).toFixed(1) + '%';
  el.innerHTML = `
    <div class="bpt-chip b"><span class="label">莊</span>${counts.B}（${pct(counts.B)}）</div>
    <div class="bpt-chip p"><span class="label">閒</span>${counts.P}（${pct(counts.P)}）</div>
    <div class="bpt-chip t"><span class="label">和</span>${counts.T}（${pct(counts.T)}）</div>
    <div class="bpt-chip"><span class="label">總</span>${counts.total}</div>
  `;
}
function renderCutSummary(summary) {
  const container = $('cutSummary');
  if (!container) return;
  if (!summary) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  if (typeof summary.cutPosition === 'number' && typeof summary.deckSize === 'number') {
    const remaining = typeof summary.remaining === 'number'
      ? summary.remaining
      : Math.max(summary.deckSize - summary.cutPosition, 0);
    container.innerHTML = `
      <div class="small">\u5207\u724c\u4f4d\u7f6e\uff1a<span class="mono">${summary.cutPosition}</span> / ${summary.deckSize}</div>
      <div class="small">\u5207\u5f8c\u9802\u7aef\u5269\u9918\uff1a<span class="mono">${remaining}</span></div>
    `;
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
const headers = ['局', '段', '卡牌', '1', '2', '3', '4', '5', '6', '結果', '訊號', '\u9592\u5bb6\u724c', '\u838a\u5bb6\u724c', '閒家', '莊家'];
  $('thead').innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
}

// =====================【V13 調整欄位順序 - 請完整替換舊的 renderRounds】=====================
function renderRounds(rounds) {
  const tbody = $('tbody');
  if (!tbody) return;
  if (!rounds || !rounds.length) {
    tbody.innerHTML = '';
    return;
  }
  ensureRoundsHeader(); // 這個會呼叫我們修改過的新表頭
  const signal = $('signalSuit').value;
  const SUIT_COLOR = { S: '#69c0ff', H: '#ff7a90', D: '#ffb74d', C: '#73d13d' };
  const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const tieSet = new Set(['Tie', 'T', '\u548c']);

  const rowsHtml = rounds.map((round, index) => {
    const cards = round.cards || [];
    const result = round.result || round.winner || '';
    const winnerClass = result === 'Banker' || result === '\u838a' || result === 'B' ? 'win-bank' : result === 'Player' || result === '\u9592' || result === 'P' ? 'win-player' : result === 'Tie' || result === '\u548c' || result === 'T' ? 'win-tie' : '';
    
    const color_seq = round.color_seq || '';
    // 左表「卡牌」欄：將 R 顯示為 X（紅色），B 顯示為 O（藍色）
    const colorHtml = color_seq
      ? color_seq.split('')
          .map(ch => (
            ch === 'R'
              ? '<span class="color-r">X</span>'
              : (ch === 'B'
                ? '<span class="color-b">O</span>'
                : `<span>${ch}</span>`)
          ))
          .join('')
      : '';

    const tieLetter = ($('tieSuit') && $('tieSuit').value) || '';
    const nextRes = rounds[index + 1]?.result || rounds[index + 1]?.winner || '';
    const isTieSignalRound = ((round.segment_label ?? round.segment) === 'A') && tieSet.has(nextRes);

    const cardCells = [];
    for (let i = 0; i < 6; i += 1) {
      const card = cards[i];
      const raw = cardLabel(card) || '';
      const label = String(raw || '—');
      const suit = cardSuitFromCard(card);
      
      let classes = 'mono card-cell';
      let inline = '';
      let coloredLabel = label;
      const suitSym = suit ? (SUIT_SYMBOL[suit] || '') : '';

      const card_color = color_seq[i];
      if (card_color === 'R') {
          classes += ' card-bg-red';
      } else if (card_color === 'B') {
          classes += ' card-bg-blue';
      }

      if (isTieSignalRound && tieLetter && suit === tieLetter && suitSym && label.endsWith(suitSym)) {
        classes += ` signal-card signal-card-${tieLetter}`;
        const color = SUIT_COLOR[tieLetter];
        if (color) inline = ` style="color:${color}"`;
        coloredLabel = `<span style="color:${color}">${label}</span>`;
      } else if (signal && suit === signal && suitSym && label.endsWith(suitSym)) {
        classes += ` signal-card signal-card-${signal}`;
        const color = SIGNAL_SUIT_COLOR[signal];
        if (color) inline = ` style="color:${color}"`;
        coloredLabel = `<span style="color:${color}">${label}</span>`;
      } else if (suit && SUIT_COLOR[suit] && suitSym && label.endsWith(suitSym)) {
        const numPart = label.slice(0, label.length - suitSym.length);
        coloredLabel = `${numPart}<span style="color:${SUIT_COLOR[suit]}">${suitSym}</span>`;
      }

      const isFirst = STATE.edit && STATE.edit.first && STATE.edit.first.r === index && STATE.edit.first.c === i;
      const isSecond = STATE.edit && STATE.edit.second && STATE.edit.second.r === index && STATE.edit.second.c === i;
      if (isFirst || isSecond) {
        const outlineColor = isFirst ? '#ffd666' : '#69c0ff';
        const styleToAdd = `outline: 2px solid ${outlineColor}; background: rgba(255, 214, 102, 0.12);`;
        if (inline.includes('style=')) {
          inline = inline.replace(/"$/, `; ${styleToAdd}"`);
        } else {
          inline = ` style="${styleToAdd}"`;
        }
      }

      cardCells.push(`<td class="${classes}" data-r="${index}" data-c="${i}"${inline}>${coloredLabel}</td>`);
    }

    const playerCards = (round.player || round.player_cards || []).join('/') || '';
    const bankerCards = (round.banker || round.banker_cards || []).join('/') || '';
    const isSIdx = Boolean(round.is_sidx);
    const sIdxOk = Boolean(round.s_idx_ok);
    let sIdxText = '';
    let sIdxClass = '';

    if (isTieSignalRound) {
      const sym = SUIT_SYMBOL[tieLetter] || '♣';
      const color = SUIT_COLOR[tieLetter] || '#73d13d';
      sIdxText = `<span style="color:${color};font-weight:700">${sym}</span>`;
      sIdxClass = 'sidx-ok';
    } else if (isSIdx) {
      if (sIdxOk) {
        const sym = SUIT_SYMBOL[signal] || '♥';
        const color = SUIT_COLOR[signal] || '#ff7a90';
        sIdxText = `<span style="color:${color};font-weight:700">${sym}</span>`;
        sIdxClass = 'sidx-ok';
      } else {
        sIdxText = '&#10006;';
        sIdxClass = 'sidx-bad';
      }
    }

    const indexLabel = round.is_tail ? '\u5c3e\u5c40' : index + 1;
    let rowClass = round.is_tail ? 'tail-row' : '';
    if (STATE.edit && STATE.edit.mode === 'round') {
      const isFirst = STATE.edit.first && STATE.edit.first.r === index;
      const isSecond = STATE.edit.second && STATE.edit.second.r === index;
      if (isFirst) rowClass += ' highlight-first';
      if (isSecond) rowClass += ' highlight-second';
    }

    const segmentLabel = round.segment_label ?? round.segment ?? '';
    return `<tr class="${rowClass} round-row" data-r="${index}">
      <td>${indexLabel}</td>
      <td class="mono segment-cell">${segmentLabel}</td>
      <td class="mono color-seq">${colorHtml}</td>
      ${cardCells.join('')}
      <td class="${winnerClass}">${result}</td>
      <td class="mono ${sIdxClass}">${sIdxText}</td>
      <td class="mono">${playerCards}</td>
      <td class="mono">${bankerCards}</td>
      <td>${round.player_point ?? ''}</td>
      <td>${round.banker_point ?? ''}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rowsHtml;
}

function sortedRoundsByStartIndex(rounds) { /* stub */ }
function flattenRoundColorSequence(rounds) { /* stub */ }
function buildDeckGrid(cards, signal, rounds = STATE.rounds) {
    if (!Array.isArray(cards) || cards.length === 0) return [];
    const signalLetter = _suit_letter(signal);
    // 建立 T_idx（和局訊號）的牌位集合，來源以 INTERNAL_STATE.rounds 為準
    const tIdxPositions = new Set();
    try {
        const srcRounds = Array.isArray(INTERNAL_STATE.rounds) ? INTERNAL_STATE.rounds : [];
        let cursor = 0;
        for (let i = 0; i < srcRounds.length; i++) {
            const r = srcRounds[i];
            const len = Array.isArray(r.cards) ? r.cards.length : 0;
            const nextRes = srcRounds[i + 1]?.result;
            const isTie = nextRes && ['和', 'Tie', 'T'].includes(String(nextRes));
            const seg = r.segment_label ?? r.segment ?? '';
            if (seg === 'A' && isTie) {
                for (let k = 0; k < len; k++) tIdxPositions.add(cursor + k);
            }
            cursor += len;
        }
    } catch (e) { /* noop */ }
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
    const COLS = 15; // 預覽固定欄數
    return (cards || []).map((card, idx) => {
        const label = cardLabel(card);
        const suit = suitLetterFromLabel(label);
        const numeric = gridValueFromLabel(label);
        const classes = ['cell'];
        if (signalLetter && suit === signalLetter) {
            classes.push('signal-match');
        }
        if (tIdxPositions.has(idx)) {
            // 為了只畫一個外框，依據鄰接關係決定四邊是否加粗
            classes.push('tbox');
            const col = idx % COLS;
            const hasLeft = (col > 0) && tIdxPositions.has(idx - 1);
            const hasRight = (col < COLS - 1) && tIdxPositions.has(idx + 1);
            const hasTop = (idx - COLS >= 0) && tIdxPositions.has(idx - COLS);
            const hasBottom = tIdxPositions.has(idx + COLS);
            if (!hasLeft) classes.push('tbox-left');
            if (!hasRight) classes.push('tbox-right');
            if (!hasTop) classes.push('tbox-top');
            if (!hasBottom) classes.push('tbox-bottom');
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
        return { value: display, className: classes.join(' '), suit };
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
    const previewRounds = (Array.isArray(STATE.previewRounds) && STATE.previewRounds.length)
        ? STATE.previewRounds
        : STATE.rounds;
    const gridData = buildDeckGrid(cards, signalValue, previewRounds);
    const COLS = 15;
    const ROWS = 28;
    const MAX = COLS * ROWS; // 420 cells
    const padded = gridData.slice(0, MAX);
    while (padded.length < MAX) padded.push({ className: 'cell', value: '' });
    container.innerHTML = padded.map(cell => `<div class="${cell.className}">${cell.value ?? ''}</div>`).join('');
}
function openPreviewWindow(immediatePrint = false) {
    if (!STATE.previewCards || STATE.previewCards.length === 0) {
        toast('Please generate a shoe before previewing');
        return;
    }
    const signalSelect = $('signalSuit');
    const signalValue = signalSelect ? signalSelect.value : null;
    const previewRounds = (Array.isArray(STATE.previewRounds) && STATE.previewRounds.length)
        ? STATE.previewRounds
        : STATE.rounds;
    const gridData = buildDeckGrid(STATE.previewCards, signalValue, previewRounds);
    if (!Array.isArray(gridData) || gridData.length === 0) {
        toast('No preview data available');
        return;
    }
    const COLS = 15;
    const ROWS = 28;
    const MAX = COLS * ROWS; // 420 cells
    const padded = gridData.slice(0, MAX);
    while (padded.length < MAX) padded.push({ className: 'cell', value: '' });
    const gridHtml = padded.map((cell) => `<div class="${cell.className}">${cell.value ?? ''}</div>`).join('');
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
      .grid-preview{display:grid;grid-template-columns:repeat(15,1fr);gap:0;border:1px solid #ffffff12;border-radius:12px;overflow:hidden;}
      .cell{display:flex;align-items:center;justify-content:center;height:40px;font-size:22px;font-weight:600;border:1px solid #1d2840;background:#0e1420;color:#e6eef8;}
      .cell.card-red{background-color:#676712;border-left:1px solid #63333d;color:#e6eef8;}
      .cell.card-blue{background-color:#041337;border-left:1px solid #2a4075;color:#e6eef8;}
      .cell.signal-match{box-shadow:none;color:#ff4d4f;}
      /* T_idx 單一外框：依邊界加粗，內部細線 */
      .cell.tbox{box-shadow:none}
      .cell.tbox-left{border-left:3px solid #ff4d4f}
      .cell.tbox-right{border-right:3px solid #ff4d4f}
      .cell.tbox-top{border-top:3px solid #ff4d4f}
      .cell.tbox-bottom{border-bottom:3px solid #ff4d4f}
      @media print {
    body { padding:12px; background: #fff; color: #222; }
    .toolbar { display:none; }
    .grid-preview { width:1200px; max-width:100%; margin:0 auto; border-color: #bbb; }
    .cell { border:1px solid #000; color: #000; background: #fff; }
    .cell.card-red { background: #00ffff; color: #000; }      /* 鮮紅色背景，白字 */
    .cell.card-blue { background: #ffff00; color: #000; }     /* 鮮藍色背景，白字 */
    .cell.signal-match { box-shadow:none; color: #ff0000 !important; } /* 移除框線，僅紅字 */
    .cell.tbox-left{border-left:3px solid #ff4d4f}
    .cell.tbox-right{border-right:3px solid #ff4d4f}
    .cell.tbox-top{border-top:3px solid #ff4d4f}
    .cell.tbox-bottom{border-bottom:3px solid #ff4d4f}
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
function refreshCutSummary() { renderCutSummary(STATE.cutSummary || null); }
function downloadFile(name, content, type = 'text/csv') { /* stub */ }
function csvEscape(value) { /* stub */ }
function normalizeLines(text) { /* stub */ }
function parseCSV(text) { /* stub */ }
function linesFromCSVorTxt(text) { /* stub */ }

// [CHN] 【修正版】將後端數據應用到前端 UI 的核心函式
function applyGenerateResponse(data) {
  // INTERNAL_STATE 是我們唯一的、真實的數據來源 (Single Source of Truth)
  INTERNAL_STATE.rounds = data.ordered_rounds || [];
  INTERNAL_STATE.tail = data.tail || [];
  INTERNAL_STATE.deck = data.deck || [];
  STATE.rounds = INTERNAL_STATE.rounds;
  STATE.previewCards = Array.isArray(INTERNAL_STATE.deck) ? [...INTERNAL_STATE.deck] : [];
  STATE.previewRounds = snapshotPreviewRounds();
  STATE.cutSummary = null;
  STATE.didAutoColor = false;
  
  // 2. 首次計算並渲染所有 UI 元件
  updateMainTable(); // 首次渲染主表格

  // 首次也需要渲染右側面板
  const suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
  renderSuits(suit_counts);
  renderPreview(STATE.previewCards);
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
  try { renderBPTSummary(_compute_bpt(ordered_rounds)); } catch (e) {}
}

function rebuildRoundsFromDeck(deck) {
  const sim = new Simulator(deck);
  const rounds = [];
  let cursor = 0;
  const deckLen = Array.isArray(deck) ? deck.length : 0;
  while (cursor + 3 < deckLen) {
    const info = sim.simulate_round(cursor);
    if (!info || !Array.isArray(info.cards) || info.cards.length === 0) {
      break;
    }
    if (!info.segment) {
      info.segment = 'A';
    }
    rounds.push(info);
    cursor = info.start_index + info.cards.length;
  }
  const tailCards = (cursor < deckLen) ? deck.slice(cursor) : [];
  return { rounds, tail: tailCards };
}

async function generateShoe() {
  const btn = $('btnGen');
  const spinner = $('spinGen');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  try {
    // 清空兩類警示：創建時只會渲染花色訊號
    clearSignal();
    clearSwap();
    updateStatus('Starting...');
    const num_shoes = Number($('numShoes').value);
    const signal_rule = ($('signalRule') && $('signalRule').value) || 'suit';
    const signal_suit = (signal_rule === 'red0' || signal_rule === 'backcolor' || signal_rule === 'zero0') ? '' : ($('signalSuit') ? $('signalSuit').value : '');
    const tie_signal_suit = $('tieSuit').value || '♣';
    // 取得尾段輸入框的值
    const multi_pass_min_cards = Number($('multiPassMinCards').value) || 15;
    WAA_Logic.setConfig({
      NUM_SHOES: num_shoes,
      HEART_SIGNAL_ENABLED: !(signal_rule === 'red0' || signal_rule === 'backcolor' || signal_rule === 'zero0'),
      SIGNAL_SUIT: _normalize_suit_input(signal_suit),
      TIE_SIGNAL_SUIT: _normalize_suit_input(tie_signal_suit),
      MULTI_PASS_MIN_CARDS: multi_pass_min_cards
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
    // 若為背色模式，生成後自動執行卡色（就近交換 BBBR/RRRB）
    try {
      if (signal_rule === 'backcolor' && typeof window.autoColorSwap === 'function') {
        window.autoColorSwap();
      }
    } catch (e) { console.warn('autoColorSwap after generate failed', e); }
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

async function simulateCut() {
  if (!Array.isArray(INTERNAL_STATE.rounds) || INTERNAL_STATE.rounds.length === 0) {
    toast('\u8acb\u5148\u7522\u751f\u4e00\u7d44\u978b\u724c');
    return;
  }
  if (!STATE.didAutoColor) {
    toast('\u8acb\u5148\u57f7\u884c\u5361\u8272\u4ea4\u63db');
    return;
  }
  const deckArray = [];
  INTERNAL_STATE.rounds.forEach((round) => {
    if (round && Array.isArray(round.cards)) {
      deckArray.push(...round.cards);
    }
  });
  if (Array.isArray(INTERNAL_STATE.tail) && INTERNAL_STATE.tail.length) {
    deckArray.push(...INTERNAL_STATE.tail);
  }
  if (deckArray.length === 0) {
    toast('\u6c92\u6709\u53ef\u7528\u7684\u5361\u724c\u53ef\u4f9b\u5207\u724c');
    return;
  }
  const input = $('cutPos');
  const btn = $('btnCut');
  const spinner = $('spinCut');
  const rawValue = input ? Number(input.value) : NaN;
  if (!Number.isFinite(rawValue)) {
    toast('\u5207\u724c\u5f35\u6578\u7121\u6548');
    return;
  }
  // 切牌改成永遠以「套用按鈕」後的牌序為基準
  const base = (Array.isArray(STATE.baseDeck) && STATE.baseDeck.length) ? STATE.baseDeck : deckArray;
  const deckSize = base.length;
  if (deckSize <= 1) {
    toast('\u5361\u724c\u6578\u91cf\u592a\u5c11\uff0c\u7121\u9700\u5207\u724c');
    return;
  }
  const cutIndexRaw = Math.floor(rawValue);
  if (cutIndexRaw < 0) {
    toast('\u5207\u724c\u5f35\u6578\u4e0d\u80fd\u70ba\u8ca0\u6578');
    return;
  }
  const normalizedCut = deckSize === 0 ? 0 : (cutIndexRaw % deckSize);
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  try {
    if (input) input.value = normalizedCut;
    const rotatedOrder = normalizedCut === 0
      ? base.slice()
      : base.slice(normalizedCut).concat(base.slice(0, normalizedCut));
    rotatedOrder.forEach((card, idx) => {
      if (card && typeof card === 'object') {
        card.pos = idx;
      }
    });

    const { rounds: rebuiltRounds, tail: rebuiltTail } = rebuildRoundsFromDeck(rotatedOrder);
    INTERNAL_STATE.rounds = rebuiltRounds;
    INTERNAL_STATE.tail = rebuiltTail;
    INTERNAL_STATE.deck = rotatedOrder.slice();

    STATE.rounds = INTERNAL_STATE.rounds;
    STATE.didAutoColor = true;
    STATE.cutSummary = {
      cutPosition: normalizedCut,
      deckSize,
      remaining: deckSize - normalizedCut
    };
    renderPreview(STATE.previewCards);
    renderCutSummary(STATE.cutSummary);
    updateMainTable();
    renderSuits(_suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail));
    toast(`\u5df2\u65bc\u7b2c ${normalizedCut} \u5f35\u5207\u724c`);
  } catch (err) {
    console.error('\u5207\u724c\u5931\u6557:', err);
    toast(`\u5207\u724c\u5931\u6557\uff1a${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}
async function scanRounds() { /* stub */ }
async function exportCombined() { /* stub */ }

function bindControls() {
  // --- 步驟 1: 綁定頁面上已存在的靜態按鈕 ---
  const btnGen = $('btnGen');
  if (btnGen) { btnGen.addEventListener('click', generateShoe); }

  const btnCut = $('btnCut');
  if (btnCut) { btnCut.addEventListener('click', simulateCut); }

  const signalSuit = $('signalSuit');
  if (signalSuit) { signalSuit.addEventListener('change', refreshCutSummary); }

  const tieSuit = $('tieSuit');
  if (tieSuit) { tieSuit.addEventListener('change', refreshCutSummary); }

  const btnExportCombined = $('btnExportCombined');
  if (btnExportCombined) {
    btnExportCombined.addEventListener('click', exportRawDataToCSV);
  }
  
  const btnPreview = $('btnPreview');
  const btnPrint = $('btnPrint');
  const btnExportPreview = $('btnExportPreview');
  const signalRuleSel = $('signalRule');
  if (btnPreview) { btnPreview.addEventListener('click', () => openPreviewWindow(false)); }
  if (btnPrint) { btnPrint.addEventListener('click', () => openPreviewWindow(true)); }
  if (btnExportPreview) { btnExportPreview.addEventListener('click', exportPreviewToXLSX); }
  const btnOpenAssistant = $('btnOpenAssistant');
if (btnOpenAssistant) {
    btnOpenAssistant.addEventListener('click', () => {
        window.open('assistant.html', '_blank');
    });
}



  // --- 步驟 2: 動態創建編輯工具列 ---
  const host = btnGen ? btnGen.parentElement : null;
  if (host && !$('editToolbar')) {
    host.insertAdjacentHTML('afterend', `
      <div id="editToolbar" class="btn-row">
        <button id="btnEdit" type="button" style="background-color: #667292;">編輯</button>
        <button id="btnSwap" type="button" style="background-color: #667292;">卡交換</button>
        <button id="btnRound" type="button" style="background-color: #667292;">局交換</button>
        <button id="btnCancelEdit" type="button" style="background-color: #667292;">取消</button>
        <button id="btnAutoSwap" type="button" style="background-color: #6667ab;">卡色</button>
        <button id="btnApplyChanges" type="button" style="background-color: #6667ab;">套用</button>
      </div>
    `);
  }

  // --- 步驟 3: 在創建之後，才獲取並綁定這些動態按鈕 ---
  // 將所有動態按鈕的獲取和綁定邏輯都移到這裡！
  
  const btnAutoSwap = $('btnAutoSwap');
  if (btnAutoSwap) {
    btnAutoSwap.addEventListener('click', () => {
      if (!INTERNAL_STATE.rounds || INTERNAL_STATE.rounds.length === 0) {
        toast('請先創建牌靴');
        return;
      }
      try {
        autoColorSwap();
        updateMainTable();
        const suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
        renderSuits(suit_counts);
        const updated_deck = INTERNAL_STATE.rounds
          .flatMap(r => r.cards)
          .concat(INTERNAL_STATE.tail);
        STATE.previewRounds = snapshotPreviewRounds();
        STATE.previewCards = updated_deck.slice();
        renderPreview(STATE.previewCards);
        toast('自動交換完成');
      } catch (e) {
        console.error(e);
        toast('自動交換失敗：' + e.message);
      }
    });
  }

  const btnEdit = $('btnEdit');
  const btnSwap = $('btnSwap');
  const btnRound = $('btnRound');
  const btnCancelEdit = $('btnCancelEdit');
  const btnApplyChanges = $('btnApplyChanges');

  // 編輯按鈕 (使用我們上一輪的 DEBUG 版本)
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
        STATE.edit = { mode: 'card', first: null, second: null, armed: false };
        console.log('[DEBUG] 進入卡牌編輯模式。STATE:', STATE.edit);
        toast('編輯模式：請點選第一張牌');
    });
  } else {
    console.error('[CRITICAL] 找不到 #btnEdit 按鈕！綁定失敗。');
  }

  // 局交換按鈕 (使用我們上一輪的 DEBUG 版本)
  if (btnRound) {
    btnRound.addEventListener('click', () => {
        STATE.edit = { mode: 'round', first: null, second: null, armed: false };
        console.log('[DEBUG] 進入局交換模式。STATE:', STATE.edit);
        toast('局交換模式：請點選第一局');
    });
  } else {
    console.error('[CRITICAL] 找不到 #btnRound 按鈕！綁定失敗。');
  }

  // 交換按鈕 (使用我們上一輪的 DEBUG 版本)
  if (btnSwap) {
    btnSwap.addEventListener('click', () => {
        console.log('[DEBUG] "交換" 按鈕被點擊。目前的 STATE:', JSON.parse(JSON.stringify(STATE.edit || {})));
        if (!STATE.edit || STATE.edit.mode === 'none') {
            console.log('[DEBUG] 判斷：模式為 none，操作中止。');
            return;
        }
        const { mode, first, second, armed } = STATE.edit;
        if (first && second) {
            console.log(`[DEBUG] 判斷：first 和 second 皆有值，準備執行交換。 first: ${JSON.stringify(first)}, second: ${JSON.stringify(second)}`);
            if (mode === 'card') {
                performCardSwap(first, second);
                toast('卡牌交換成功！');
            } else {
                performRoundSwap(first.r, second.r);
                toast('牌局交換成功！');
            }
            STATE.edit = { mode: 'none', first: null, second: null, armed: false };
            console.log('[DEBUG] 交換完成，STATE 已重置。');
            updateMainTable();
        } else if (first && !armed) {
            STATE.edit.armed = true;
            console.log('[DEBUG] 判斷：僅 first 有值，進入 armed 狀態。');
            toast(mode === 'card' ? '請點選要交換的第二張牌' : '請點選要交換的第二局');
        } else {
            console.log('[DEBUG] 判斷：其他情況，提示使用者先選取。');
        }
    });
  } else {
    console.error('[CRITICAL] 找不到 #btnSwap 按鈕！綁定失敗。');
  }

  // 取消按鈕
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
        const wasEditing = STATE.edit && STATE.edit.mode !== 'none';
        STATE.edit = { mode: 'none', first: null, second: null, armed: false };
        if (wasEditing) {
            updateMainTable();
        }
        console.log('[DEBUG] 已取消編輯，STATE 已重置。');
        toast('已取消編輯');
    });
  }

  // 套用變更按鈕
  if (btnApplyChanges) {
    btnApplyChanges.addEventListener('click', () => {
      if (!INTERNAL_STATE.rounds) {
        toast('沒有資料可套用');
        return;
      }
      const suit_counts = _suit_counts(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);
      renderSuits(suit_counts);
      const updated_deck = INTERNAL_STATE.rounds.flatMap(r => r.cards).concat(INTERNAL_STATE.tail);
      STATE.previewRounds = snapshotPreviewRounds();
      STATE.previewCards = updated_deck.slice();
      // 設定基準牌序：之後「切牌」都以這個順序為基準
      STATE.baseDeck = updated_deck.slice();
      renderPreview(STATE.previewCards);
      toast('變更已套用至預覽和統計');
    });
  }

  // 訊號規則切換：紅0 模式時停用「卡色」按鈕
  function refreshSignalModeUI(){
    const mode = signalRuleSel && signalRuleSel.value ? signalRuleSel.value : 'suit';
    STATE.signalMode = mode;
    const btnAuto = $('btnAutoSwap');
    if (btnAuto) {
      if (mode === 'red0' || mode === 'zero0') { btnAuto.disabled = true; btnAuto.title = '此模式不需要卡色'; }
      else { btnAuto.disabled = false; btnAuto.title = ''; }
    }
    // 紅0 模式時關閉訊號花色選擇，避免誤用
    const suitSel = $('signalSuit');
    if (suitSel) {
      if (mode === 'red0' || mode === 'backcolor' || mode === 'zero0') { suitSel.disabled = true; suitSel.title = '此模式：訊號花色停用'; }
      else { suitSel.disabled = false; suitSel.title = ''; }
    }
  }
  if (signalRuleSel) signalRuleSel.addEventListener('change', refreshSignalModeUI);
  refreshSignalModeUI();

  // --- 步驟 4: 綁定表格點擊事件 (這個位置不變) ---
  const tbody = $('tbody');
  if (tbody && !tbody._editBound) {
    tbody._editBound = true;
    // ... (tbody 的事件監聽器程式碼，使用我們上一輪的 DEBUG 版本) ...
    tbody.addEventListener('click', (e) => {
        if (!STATE.edit || STATE.edit.mode === 'none') return;
        console.log('[DEBUG] 表格被點擊。目前的 STATE:', JSON.parse(JSON.stringify(STATE.edit)));
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
                console.log(`[DEBUG] 點擊設定 first card: {r: ${r}, c: ${c}}`);
            } else {
                STATE.edit.second = { r, c };
                console.log(`[DEBUG] 點擊設定 second card: {r: ${r}, c: ${c}}`);
                toast('已選定兩張牌，請再次點擊「交換」按鈕確認');
            }
            needsUpdate = true;
        } else if (mode === 'round' && tr) {
            const r = Number(tr.dataset.r);
            if (!Number.isFinite(r)) return;
            if (!armed) {
                STATE.edit.first = { r };
                STATE.edit.second = null;
                console.log(`[DEBUG] 點擊設定 first round: {r: ${r}}`);
            } else {
                STATE.edit.second = { r };
                console.log(`[DEBUG] 點擊設定 second round: {r: ${r}}`);
                toast('已選定兩局，請再次點擊「交換」按鈕確認');
            }
            needsUpdate = true;
        }
        if (needsUpdate) {
            console.log('[DEBUG] 觸發 updateMainTable() 刷新UI。');
            updateMainTable();
        }
    });
  }
} // bindControls 函式結束





// --- 頁面載入時執行綁定 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindControls);
} else {
  bindControls();
}

// ===================== 快捷鍵（Hotkeys） =====================
// 目的：用鍵盤觸發常用操作；避免在輸入框時干擾
(() => {
  const isTyping = (el) => {
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  };

  // 單鍵快捷
  const keymap = {
    'z': 'btnEdit',         // 編輯
    'x': 'btnSwap',         // 卡交換（手動交換兩張牌）
    'k': 'btnAutoSwap',     // 卡色（自動交換）
    'a': 'btnApplyChanges', // 套用
    'g': 'btnGen',          // 創建
    'v': 'btnPreview',      // 預覽
    'u': 'btnExportCombined', // 導出 CSV
    'c': 'btnCut',          // 切牌
  };
  // Ctrl 組合快捷（支援 Cmd on macOS）
  const ctrlKeymap = {
    'x': 'btnExportPreview', // Ctrl+X → Excel 匯出
  };

  const helpText = '快捷鍵: Z=編輯, X=卡交換, K=卡色, A=套用, G=創建, V=預覽, Ctrl+X=Excel, U=導出, C=切牌, Esc=取消編輯, ?=說明';

  document.addEventListener('keydown', (ev) => {
    // 在輸入情境時不觸發
    if (isTyping(ev.target)) return;
    const key = (ev.key || '').toLowerCase();
    if (!key) return;

    if (key === '?') { toast(helpText); ev.preventDefault(); return; }
    if (key === 'escape') { const b = document.getElementById('btnCancelEdit'); if (b) b.click(); return; }

    const useCtrl = !!(ev.ctrlKey || ev.metaKey);
    const id = (useCtrl ? ctrlKeymap[key] : keymap[key]);
    if (!id) return;
    const btn = document.getElementById(id);
    if (btn && typeof btn.click === 'function') {
      btn.click();
      // 給一個簡短提示
      if (!useCtrl && key === 'z') toast('編輯模式');
      else if (!useCtrl && key === 'x') toast('卡交換：請依畫面操作');
      else if (useCtrl && key === 'x') toast('Excel 匯出');
      ev.preventDefault();
    }
  }, { passive: true });
})();


function exportRawDataToCSV() {
    if (!INTERNAL_STATE.rounds || INTERNAL_STATE.rounds.length === 0) {
        toast('沒有數據可導出。請先生成牌靴。');
        return;
    }

    // 1. 獲取與 UI 顯示完全一致的序列化數據
    const [serialized_rounds, ] = _serialize_rounds_with_flags(INTERNAL_STATE.rounds, INTERNAL_STATE.tail);

    // 2. 定義我們要導出的 CSV 表頭 (已更新)
    const headers = [
        "round_number", "segment", "color_seq", 
        "card_1", "card_2", "card_3", "card_4", "card_5", "card_6",
        "result", "signal"
    ];

    // 3. 將每一局的數據，轉換成 CSV 的一行
    const csv_rows = serialized_rounds.map((round, index) => {
        const row = [];
        
        // 【修正】使用 index + 1 作為局號
        row.push(index + 1); 
        
        row.push(round.segment_label);
        row.push(round.color_seq);

        for (let i = 0; i < 6; i++) {
            row.push(round.cards[i] ? round.cards[i].label.replace(/,/g, ';') : ""); // 防止逗號干擾CSV
        }

        row.push(round.result);

        // 【修正】判斷 S/T 訊號，並轉換為 "S", "T" 或 ""
        const is_s = round.is_sidx;
        // 重新計算 T 局，因為它依賴於下一局的結果
        const next_round = serialized_rounds[index + 1];
        const is_t = (round.segment_label === 'A') && (next_round && ['和', 'Tie', 'T'].includes(next_round.result));
        const signal_char = is_s ? "S" : (is_t ? "T" : "");
        row.push(signal_char);

        return row.join(',');
    });

    // 4. 將表頭和所有行數據組合在一起
    const csv_content = [headers.join(','), ...csv_rows].join('\n');

    // 5. 創建並下載 CSV 檔案
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv_content], { type: 'text/csv;charset=utf-8;' }); // 添加 BOM 防止 Excel 亂碼
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "br_processed_data.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 將右側預覽格（15x28）輸出為可用 Excel 開啟的 CSV
function exportPreviewToCSV() {
    if (!STATE.previewCards || STATE.previewCards.length === 0) {
        toast('沒有預覽資料可導出');
        return;
    }
    const signalSelect = $('signalSuit');
    const signalValue = signalSelect ? signalSelect.value : null;
    const previewRounds = (Array.isArray(STATE.previewRounds) && STATE.previewRounds.length)
        ? STATE.previewRounds
        : STATE.rounds;
    const gridData = buildDeckGrid(STATE.previewCards, signalValue, previewRounds);
    const COLS = 15;
    const ROWS = 28;
    const MAX = COLS * ROWS;
    const padded = gridData.slice(0, MAX);
    while (padded.length < MAX) padded.push({ value: '', className: 'cell' });

    const rows = [];
    for (let r = 0; r < ROWS; r++) {
        const start = r * COLS;
        const cells = padded.slice(start, start + COLS).map(cell => {
            const v = cell && typeof cell.value !== 'undefined' && cell.value !== null ? String(cell.value) : '';
            // 逗號用分號替代，避免破壞 CSV 欄位
            return v.replace(/,/g, ';');
        });
        rows.push(cells.join(','));
    }
    const content = rows.join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'br_preview_grid.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 將右側預覽格（15x28）輸出為 .xlsx，並根據格子類別套用文字顏色與框線
async function exportPreviewToXLSX() {
    try {
        if (!STATE.previewCards || STATE.previewCards.length === 0) {
            toast('沒有預覽資料可導出');
            return;
        }
        if (typeof ExcelJS === 'undefined' || !ExcelJS.Workbook) {
            // 無法載入 ExcelJS 時，退回 CSV
            console.warn('ExcelJS not available, falling back to CSV');
            exportPreviewToCSV();
            return;
        }
        const signalSelect = $('signalSuit');
        const signalValue = signalSelect ? signalSelect.value : null;
        const previewRounds = (Array.isArray(STATE.previewRounds) && STATE.previewRounds.length)
            ? STATE.previewRounds
            : STATE.rounds;
        const gridData = buildDeckGrid(STATE.previewCards, signalValue, previewRounds);
        const COLS = 15;
        const ROWS = 28;
        const MAX = COLS * ROWS;
        const padded = gridData.slice(0, MAX);
        while (padded.length < MAX) padded.push({ value: '', className: 'cell' });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Preview');
        // 放大整體尺寸，目標約 1.5 張 A4 高度
        // 讓字幾乎填滿格子：提高列高
        ws.properties.defaultRowHeight = 36;

        // A4 設定並自動縮放至單頁
        // 取消「寬度壓成 1 頁」的限制，改用固定縮放比例
        ws.pageSetup = {
          paperSize: 9, // A4
          orientation: 'portrait',
          fitToPage: false,
          scale: 170,                // 放大比例（可調 150~200）
          horizontalCentered: true,
          verticalCentered: true,
          margins: { left: 0.1, right: 0.1, top: 0.12, bottom: 0.12, header: 0.1, footer: 0.1 }
        };

        // 每 5 欄插入一個窄的空白間隔欄
        const GROUP = 5;
        const SEP_COUNT = Math.floor((COLS - 1) / GROUP); // 15 -> 2
        const TOTAL_COLS = COLS + SEP_COUNT; // 17
        const isSpacerCol = (sc) => (sc === 6 || sc === 12); // 針對 15 欄固定位置
        // 縮小欄寬，讓 Excel 自動縮放變大：資料欄越窄 → 字越大
        for (let c = 1; c <= TOTAL_COLS; c++) {
          ws.getColumn(c).width = isSpacerCol(c) ? 0.8 : 4.0; // 分隔欄 0.8、資料欄 4.0（單字更貼邊）
        }

        const borderThin = { style: 'thin', color: { argb: 'FF333333' } };
        const borderBold = { style: 'medium', color: { argb: 'FFFF4D4F' } }; // 紅色外框

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const idx = r * COLS + c;
                const cellInfo = padded[idx] || { value: '', className: 'cell', suit: '' };
                const v = (cellInfo.value === 0 ? '0' : (cellInfo.value ?? ''));
                // 寫入到包含間隔欄後的實際欄位
                const sheetCol = (c + 1) + Math.floor(c / GROUP);
                const cell = ws.getCell(r + 1, sheetCol);
                cell.value = v;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };

                // 文字顏色：紅心(H)紅字，其它黑字
                const suit = (cellInfo.suit || '').toUpperCase();
                const fontColor = suit === 'H' ? 'FFFF0000' : 'FF000000';
                // 放大字體，幾乎填滿格子
                cell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: fontColor } };
                // 盡量減少視覺邊距（不縮排、不換行、置中）
                cell.alignment = { horizontal: 'center', vertical: 'middle', indent: 0, wrapText: false };

                // 背景：R 卡淺黃色、B 卡淺藍色（依 class 判斷）
                const cls = String(cellInfo.className || '');
                if (cls.includes('card-red')) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // 淺黃
                } else if (cls.includes('card-blue')) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0080FF' } }; // 淺藍
                }

                // 邊框：基本細框；若為 T_idx 外框邊界則加粗
                const edges = {
                  top: cls.includes('tbox-top') ? borderBold : borderThin,
                  left: cls.includes('tbox-left') ? borderBold : borderThin,
                  right: cls.includes('tbox-right') ? borderBold : borderThin,
                  bottom: cls.includes('tbox-bottom') ? borderBold : borderThin,
                };
                cell.border = edges;
            }
        }

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = 'br_preview_grid.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Export XLSX failed:', err);
        toast('Excel 匯出失敗，已改用 CSV');
        exportPreviewToCSV();
    }
}








// 新：分離兩種警示類型供不同面板使用
STATE.warnSignal = [];
STATE.warnSwap = [];
function renderWarningBlocks() {
  const sBox = document.getElementById('warningsSignal');
  const sBody = document.getElementById('warningsSignalBody');
  const xBox = document.getElementById('warningsSwap');
  const xBody = document.getElementById('warningsSwapBody');
  if (sBox && sBody) {
    if (!STATE.warnSignal || STATE.warnSignal.length === 0) {
      sBox.style.display = 'none'; sBody.innerHTML = '';
    } else {
      sBox.style.display = '';
      // 只呈現殘留牌列表，並做成多行橫向的區塊
      const items = STATE.warnSignal
        .filter(m => /殘留牌/.test(m))
        .map(m => {
          const m2 = m.replace(/^-\s*/, '').replace(/^殘留牌:\s*/, '');
          // 例："5♥ 位於 #1 局" → "5♥ #1"
          const t = m2.replace(/\s*位於\s*#(\d+)\s*局.*/, ' #$1');
          return `<div class=\"warn-chip\">${t}</div>`;
        }).join('');
      sBody.innerHTML = `<div class=\"warn-grid\">${items}</div>`;
    }
  }
  if (xBox && xBody) {
    if (!STATE.warnSwap || STATE.warnSwap.length === 0) {
      xBox.style.display = 'none'; xBody.innerHTML = '';
    } else {
      xBox.style.display = ''; xBody.innerHTML = STATE.warnSwap.map(m => `<div class=\"log-line\">${m}</div>`).join('');
    }
  }
}
function pushSignal(msg){ (STATE.warnSignal ||= []).push(msg); renderWarningBlocks(); }
function pushSwap(msg){ (STATE.warnSwap ||= []).push(msg); renderWarningBlocks(); }
function clearSignal(){ STATE.warnSignal = []; renderWarningBlocks(); }
function clearSwap(){ STATE.warnSwap = []; renderWarningBlocks(); }
