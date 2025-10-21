/**
 * 這是一個合併的腳本檔案，包含了所有 waa.py 和 app.py 的邏輯，
 * 已被 "翻譯" 為 JavaScript，使其能獨立在瀏覽器中運行。
 *
 * 【v3 - 狀態回報版】
 * - 將核心生成函式 generate_all_sensitive_shoe_or_retry 改為
 * 非同步(async)，防止瀏覽器因高強度重試而卡死。
 * - 新增 updateStatus 函式，用於在 UI (genInfo) 上即時回報
 * 當前的執行步驟和重試次數。
 * - 修改 apply_shoe_rules 函式，使其在規則失敗時，能透過
 * log_attempt_failure 函式回報 *失敗的原因*。
 */

// =============================================
// --- START: waa.py translated logic ---
// =============================================

const WAA_Logic = (() => {
  // --- waa.py: CONFIG ---
  // 這些是從 waa.py 移植過來的預設值
  const CONFIG = {
    SEED: null,
    MAX_ATTEMPTS: 1000000,
    HEART_SIGNAL_ENABLED: true,
    SIGNAL_SUIT: '♥',
    A_PASSWORD_SUIT: null,
    A_PASSWORD_COUNT: 0,
    B_PASSWORD_SUIT: null,
    B_PASSWORD_COUNT: 0,
    TIE_SIGNAL_SUIT: null,
    LATE_BALANCE_DIFF: 2,
    COLOR_RULE_ENABLED: true,
    MANUAL_TAIL: [],
    NUM_SHOES: 1,
    MIN_TAIL_STOP: 7,
    MULTI_PASS_MIN_CARDS: 4,
  };

  // --- waa.py: 基本常數與資料結構 ---
  const SUITS = ['♠', '♥', '♦', '♣'];
  const NUM_DECKS = 8;
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const CARD_VALUES = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 0, 'J': 0, 'Q': 0, 'K': 0
  };

  // 輔助函式：洗牌 (Fisher-Yates shuffle)
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // 輔助函式： Counter
  function multiset(items) {
    const counts = new Map();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return counts;
  }

  // 輔助函式：比較兩個 Map 是否相等
  function mapEquals(map1, map2) {
    if (map1.size !== map2.size) return false;
    for (const [key, val] of map1) {
      if (val !== map2.get(key)) return false;
    }
    return true;
  }
  
  // 輔助函式： itertools.permutations
  function* permutations(array, k) {
    if (k === 0) {
      yield [];
      return;
    }
    for (let i = 0; i < array.length; i++) {
      const first = array[i];
      const rest = [...array.slice(0, i), ...array.slice(i + 1)];
      for (const p of permutations(rest, k - 1)) {
        yield [first, ...p];
      }
    }
  }


  class Card {
    constructor(rank, suit, pos) {
      this.rank = rank;
      this.suit = suit;
      this.pos = pos; // 0..415 在原靴的絕對索引
      this.color = null; // 'R' 或 'B'
    }
    point() { return CARD_VALUES[this.rank]; }
    short() { return `${this.rank}${this.suit}`; }
    // 為了安全複製
    clone(newPos = this.pos) {
      const newCard = new Card(this.rank, this.suit, newPos);
      newCard.color = this.color;
      return newCard;
    }
  }

  function build_shuffled_deck() {
    const base = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        base.push(new Card(r, s, -1));
      }
    }
    let deck = [];
    for (let i = 0; i < NUM_DECKS; i++) {
      deck.push(...base.map(c => new Card(c.rank, c.suit, -1)));
    }
    shuffle(deck);
    deck.forEach((c, i) => c.pos = i);
    return deck;
  }

  class Simulator {
    constructor(deck) {
      this.deck = deck;
    }

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
          } else if (b_tot === 4 && [2, 3, 4, 5, 6, 7].includes(pt)) {
            if (!draw()) return null;
          } else if (b_tot === 5 && [4, 5, 6, 7].includes(pt)) {
            if (!draw()) return null;
          } else if (b_tot === 6 && [6, 7].includes(pt)) {
            if (!draw()) return null;
          }
        }
      }

      const res = (p_tot === b_tot) ? '和' : ((p_tot > b_tot) ? '閒' : '莊');
      const used = d.slice(start, idx);
      if (no_swap) {
        return { start_index: start, cards: used, result: res, sensitive: false };
      }

      const [swap_res, same_len] = this._swap_result(start);
      const invalid_swap = (res === '和' && swap_res === '莊');
      const sensitive = (
        (swap_res !== null) &&
        (swap_res !== res) &&
        (swap_res !== '和') &&
        (same_len === used.length) &&
        !invalid_swap
      );
      return { start_index: start, cards: used, result: res, sensitive: sensitive };
    }

    _swap_result(start) {
      let d2 = [...this.deck]; // 淺複製
      if (start + 1 >= d2.length) return [null, 0];
      [d2[start], d2[start + 1]] = [d2[start + 1], d2[start]];
      const sim2 = new Simulator(d2);
      const r2 = sim2.simulate_round(start, { no_swap: true });
      if (!r2) return [null, 0];
      return [r2.result, r2.cards.length];
    }
  }

  function scan_all_sensitive_rounds(sim) {
    const out = [];
    const last = sim.deck.length - 1;
    for (let i = 0; i < last; i++) {
      const r = sim.simulate_round(i);
      if (r && r.sensitive) {
        out.push(r);
      }
    }
    return out;
  }

  function multi_pass_candidates_from_cards_simple(card_pool) {
    if (card_pool.length < 4) return [];
    
    let shuffled = [...card_pool];
    shuffle(shuffled);
    
    const temp_cards = shuffled.map((c, i) => new Card(c.rank, c.suit, i));
    const idx2orig = new Map(shuffled.map((c, i) => [i, c]));
    const temp_sim = new Simulator(temp_cards);

    const out = [];
    const used_idx = new Set();
    let i = 0;
    while (i < temp_cards.length - 3) {
      if (used_idx.has(i)) {
        i++; continue;
      }
      const r = temp_sim.simulate_round(i);
      if (!r) {
        i++; continue;
      }
      const temp_indices = r.cards.map(c => c.pos);
      if (temp_indices.some(ti => used_idx.has(ti))) {
        i++; continue;
      }
      if (!r.sensitive) {
        i += r.cards.length; continue;
      }
      
      const ordered = [];
      const seen = new Set();
      let valid = true;
      for (const ti of temp_indices) {
        const oc = idx2orig.get(ti);
        if (seen.has(oc.pos)) { valid = false; break; }
        ordered.push(oc); seen.add(oc.pos);
      }
      if (!valid) {
        i++; continue;
      }
      
      const start_pos = ordered[0].pos;
      out.push({ start_index: start_pos, cards: ordered, result: r.result, sensitive: true });
      temp_indices.forEach(ti => used_idx.add(ti));
      i = Math.max(...temp_indices) + 1;
    }
    return out;
  }
  
  function _seq_result(cards) {
    if (!cards || cards.length < 4) return null;
    const tmp = cards.map((c, i) => new Card(c.rank, c.suit, i));
    const sim = new Simulator(tmp);
    const r = sim.simulate_round(0);
    return r ? r.result : null;
  }

  // 這是 app.py 和 waa.py 都需要的輔助函式
  const _seq_points = (cards) => {
    if (!cards || cards.length < 4) {
      return null;
    }
    
    const temp_deck = cards.map((c, i) => new Card(c.rank, c.suit, i));
    
    const [P1, B1, P2, B2] = temp_deck.slice(0, 4);
    
    let p_tot = (P1.point() + P2.point()) % 10;
    let b_tot = (B1.point() + B2.point()) % 10;
    
    let is_natural = (p_tot === 8 || p_tot === 9 || b_tot === 8 || b_tot === 9);
    
    let card_idx = 4;
    if (!is_natural) {
      let p3 = null;
      if (p_tot <= 5) {
        if (card_idx < temp_deck.length) {
          p3 = temp_deck[card_idx];
          p_tot = (p_tot + p3.point()) % 10;
          card_idx++;
        }
      }
      
      if (p3 === null) {
        if (b_tot <= 5) {
          if (card_idx < temp_deck.length) {
            let b3 = temp_deck[card_idx];
            b_tot = (b_tot + b3.point()) % 10;
          }
        }
      } else {
        const p3_point = p3.point();
        let should_draw = false;
        if (b_tot <= 2) should_draw = true;
        else if (b_tot === 3 && p3_point !== 8) should_draw = true;
        else if (b_tot === 4 && [2, 3, 4, 5, 6, 7].includes(p3_point)) should_draw = true;
        else if (b_tot === 5 && [4, 5, 6, 7].includes(p3_point)) should_draw = true;
        else if (b_tot === 6 && [6, 7].includes(p3_point)) should_draw = true;
        
        if (should_draw && card_idx < temp_deck.length) {
          let b3 = temp_deck[card_idx];
          b_tot = (b_tot + b3.point()) % 10;
        }
      }
    }
    return [b_tot, p_tot];
  };

  function _is_sensitive_sequence(cards) {
    if (cards.length < 4) return false;
    const temp = cards.map((c, i) => new Card(c.rank, c.suit, i));
    const sim = new Simulator(temp);
    const r = sim.simulate_round(0);
    return Boolean(r && r.sensitive && r.cards.length === temp.length);
  }

  function try_make_tail_sensitive(tail_cards) {
    const k = tail_cards.length;
    if (![4, 5, 6].includes(k)) return null;

    // 啟發式
    const heuristics = [];
    heuristics.push([...tail_cards]);
    heuristics.push([...tail_cards].reverse());
    if (k >= 2) {
      let t = [...tail_cards]; [t[0], t[1]] = [t[1], t[0]]; heuristics.push(t);
    }
    if (k >= 3) {
      let t = [...tail_cards]; [t[1], t[2]] = [t[2], t[1]]; heuristics.push(t);
    }
    for (const cand of heuristics) {
      if (_is_sensitive_sequence(cand)) return cand;
    }

    // 全排列
    for (const perm of permutations(tail_cards, k)) {
      if (_is_sensitive_sequence(perm)) return perm;
    }
    return null;
  }

  function try_manual_tail(tail_cards, manual) {
    if (!manual || manual.length === 0) return null;
    
    const target_ms = multiset(manual);
    const avail_ms = multiset(tail_cards.map(c => c.short()));
    
    if (!mapEquals(target_ms, avail_ms)) return null;

    const short2stack = new Map();
    for (const c of tail_cards) {
      const short = c.short();
      if (!short2stack.has(short)) short2stack.set(short, []);
      short2stack.get(short).push(c);
    }
    
    const ordered = [];
    for (const face of manual) {
      ordered.push(short2stack.get(face).pop());
    }
    return _is_sensitive_sequence(ordered) ? ordered : null;
  }
  
  const compute_sidx_new = (rounds) => {
    const S = [];
    for (let i = 0; i < rounds.length - 1; i++) {
      if (rounds[i + 1].result === '莊') {
        S.push(i);
      }
    }
    return S;
  };

  function swap_suits_between_same_rank_cards(card1, card2) {
    if (card1.rank !== card2.rank) {
      return;
    }
    [card1.suit, card2.suit] = [card2.suit, card1.suit];
  }

  function _ensure_signal_presence(rounds, signal_suit, s_idx) {
    const donors = [];
    rounds.forEach((r, i) => {
      if (s_idx.includes(i)) return;
      r.cards.forEach((card, j) => {
        if (card.suit === signal_suit) {
          donors.push([i, j]);
        }
      });
    });

    const locked_ids = new Set();
    
    for (const idx of s_idx) {
      const rv = rounds[idx];
      if (rv.cards.some(card => card.suit === signal_suit)) continue;
      
      const receivers = rv.cards
        .map((card, j) => (card.suit !== signal_suit ? j : -1))
        .filter(j => j !== -1);
      
      if (donors.length === 0 || receivers.length === 0) {
        throw new Error("Insufficient signal suit donors for S_idx coverage");
      }
      
      let found_swap = false;
      for (let rk_idx = 0; rk_idx < receivers.length; rk_idx++) {
        const rk = receivers[rk_idx];
        const receiver_card = rv.cards[rk];
        for (let d_idx = 0; d_idx < donors.length; d_idx++) {
          const [di, dj] = donors[d_idx];
          const donor_card = rounds[di].cards[dj];
          
          if (receiver_card.rank === donor_card.rank) {
            swap_suits_between_same_rank_cards(receiver_card, donor_card);
            donors.splice(d_idx, 1);
            receivers.splice(rk_idx, 1);
            found_swap = true;
            break;
          }
        }
        if (found_swap) break;
      }
      
      if (!found_swap) {
        throw new Error("S_idx 備用方案失敗：找不到同點數的牌進行交換。");
      }
    }
    
    for (const idx of s_idx) {
      for (const card of rounds[idx].cards) {
        if (card.suit === signal_suit) {
          locked_ids.add(card); // 在 JS 中，直接添加物件引用
        }
      }
    }
    return locked_ids;
  }
  
  function _is_tie_result(result) {
    if (typeof result !== 'string') return false;
    const val = result.trim();
    return ['和', 'Tie', 'T'].includes(val);
  }

  function enforce_tie_signal(rounds, tie_suit) {
    if (!tie_suit) return new Set();
    
    const tie_indices = [];
    for (let idx = 0; idx < rounds.length - 1; idx++) {
      if (_is_tie_result(rounds[idx + 1].result)) {
        tie_indices.push(idx);
      }
    }
    const locked_ids = new Set();
    
    for (const idx of tie_indices) {
      const rv = rounds[idx];
      for (const card_to_replace of rv.cards) {
        if (card_to_replace.suit === tie_suit) {
          locked_ids.add(card_to_replace);
          continue;
        }

        let found_donor = null;
        for (let other_idx = 0; other_idx < rounds.length; other_idx++) {
          if (other_idx === idx) continue;
          const other_rv = rounds[other_idx];
          for (const donor_card of other_rv.cards) {
            if (donor_card.rank === card_to_replace.rank &&
                donor_card.suit === tie_suit &&
                !locked_ids.has(donor_card)) {
              found_donor = donor_card;
              break;
            }
          }
          if (found_donor) break;
        }
        
        if (found_donor) {
          swap_suits_between_same_rank_cards(card_to_replace, found_donor);
          locked_ids.add(card_to_replace);
        } else {
          // **【關鍵】** 這是導致重試的主要原因
          throw new Error(`Tie signal enforcement failed: Cannot find donor for ${card_to_replace.short()}`);
        }
      }
    }
    
    const alt_suits = SUITS.filter(s => s !== tie_suit) || [tie_suit];
    for (let idx = 0; idx < rounds.length; idx++) {
      if (tie_indices.includes(idx)) continue;
      const rv = rounds[idx];
      const tie_count = rv.cards.filter(card => card.suit === tie_suit).length;
      if (tie_count === rv.cards.length && rv.cards.length > 0) {
        rv.cards[0].suit = alt_suits[Math.floor(Math.random() * alt_suits.length)];
      }
    }
    return locked_ids;
  }

  function balance_non_tie_suits(rounds, tie_suit, locked_ids, tolerance) {
    if (!tie_suit) return;
    const other_suits = SUITS.filter(s => s !== tie_suit);
    if (other_suits.length === 0) return;

    const counts = () => {
      const c = new Map();
      for (const rv of rounds) {
        for (const card of rv.cards) {
          c.set(card.suit, (c.get(card.suit) || 0) + 1);
        }
      }
      return c;
    };

    for (let i = 0; i < 160; i++) {
      const c = counts();
      let total_other = 0;
      other_suits.forEach(s => total_other += (c.get(s) || 0));
      if (total_other === 0) return;
      
      const target = total_other / other_suits.length;
      const hi = other_suits.reduce((a, b) => ((c.get(a) || 0) - target) > ((c.get(b) || 0) - target) ? a : b);
      const lo = other_suits.reduce((a, b) => ((c.get(a) || 0) - target) < ((c.get(b) || 0) - target) ? a : b);

      if ((c.get(hi) || 0) - target <= tolerance && target - (c.get(lo) || 0) <= tolerance) {
        return;
      }
      
      let moved = false;
      const hi_cards = rounds.flatMap(r => r.cards).filter(card => card.suit === hi && !locked_ids.has(card));
      const lo_cards = rounds.flatMap(r => r.cards).filter(card => card.suit === lo && !locked_ids.has(card));
      
      const lo_cards_by_rank = new Map();
      for (const card of lo_cards) {
        if (!lo_cards_by_rank.has(card.rank)) lo_cards_by_rank.set(card.rank, []);
        lo_cards_by_rank.get(card.rank).push(card);
      }

      for (const hi_card of hi_cards) {
        if (lo_cards_by_rank.has(hi_card.rank) && lo_cards_by_rank.get(hi_card.rank).length > 0) {
          const lo_card = lo_cards_by_rank.get(hi_card.rank).pop();
          swap_suits_between_same_rank_cards(hi_card, lo_card);
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  }

  function validate_tie_signal(rounds, tie_suit) {
    const tie_indices = [];
    for (let idx = 0; idx < rounds.length - 1; idx++) {
      if (_is_tie_result(rounds[idx + 1].result)) {
        tie_indices.push(idx);
      }
    }
    for (const idx of tie_indices) {
      if (rounds[idx].cards.some(card => card.suit !== tie_suit)) {
        throw new Error(`Tie signal enforcement failed for index ${idx}`);
      }
    }
    const forbidden = [];
    for (let idx = 0; idx < rounds.length; idx++) {
      if (!tie_indices.includes(idx) && rounds[idx].cards.some(card => card.suit === tie_suit)) {
        forbidden.push(idx);
      }
    }
    if (forbidden.length > 0) {
      throw new Error(`Tie signal suit present outside T rounds: ${forbidden.join(',')}`);
    }
  }

  function enforce_suit_distribution(rounds, signal_suit, s_idx) {
    const total_signal = rounds.flatMap(r => r.cards).filter(c => c.suit === signal_suit).length;
    
    let s_cap = 0;
    s_idx.forEach(i => s_cap += rounds[i].cards.length);

    if (s_idx.length > 0 && s_cap < total_signal) {
      const msg = `S_idx 容量不足 (${s_cap})，無法容納所有 ${signal_suit} (${total_signal})`;
      console.warn(`[驗證] ${msg}，S_idx 長度=${s_idx.length}`);
      throw new Error(msg);
    }

    const donors = [];
    rounds.forEach((r, i) => {
      if (s_idx.includes(i)) return;
      r.cards.forEach((card, j) => {
        if (card.suit === signal_suit) {
          donors.push([i, j]);
        }
      });
    });

    const locked_ids = new Set();
    if (s_idx.length === 0) return locked_ids;

    const target = new Array(rounds.length).fill(0);
    let current_signal_sum = 0;
    for (const i of s_idx) {
      const cur_sig = rounds[i].cards.filter(c => c.suit === signal_suit).length;
      target[i] = cur_sig;
      current_signal_sum += cur_sig;
    }
    
    let remain = total_signal - current_signal_sum;
    if (remain > 0) {
      const s_idx_sorted = [...s_idx].sort((a, b) => {
        const cap_a = rounds[a].cards.length - target[a];
        const cap_b = rounds[b].cards.length - target[b];
        return cap_b - cap_a;
      });
      
      let ptr = 0;
      while (remain > 0) {
        if (s_idx_sorted.length === 0) break; // 防止無限迴圈
        const idx = s_idx_sorted[ptr];
        if (target[idx] < rounds[idx].cards.length) {
          target[idx]++;
          remain--;
        }
        ptr = (ptr + 1) % s_idx_sorted.length;
      }
    }
    
    for (const i of s_idx) {
      const cur_cnt = rounds[i].cards.filter(c => c.suit === signal_suit).length;
      let need = target[i] - cur_cnt;
      if (need <= 0) continue;
      
      const receivers = rounds[i].cards
        .map((c, k) => (c.suit !== signal_suit ? k : -1))
        .filter(k => k !== -1);
      
      for (let n = 0; n < need; n++) {
        if (donors.length === 0 || receivers.length === 0) {
          const msg = "花色交換資源不足";
          console.warn(`[驗證] ${msg}：donors=${donors.length} receivers=${receivers.length}，S_idx 長度=${s_idx.length}`);
          throw new Error(msg);
        }
        
        let found_swap = false;
        for (let rk_idx = 0; rk_idx < receivers.length; rk_idx++) {
          const rk = receivers[rk_idx];
          const receiver_card = rounds[i].cards[rk];
          
          for (let d_idx = 0; d_idx < donors.length; d_idx++) {
            const [di, dj] = donors[d_idx];
            const donor_card = rounds[di].cards[dj];
            
            if (receiver_card.rank === donor_card.rank) {
              swap_suits_between_same_rank_cards(receiver_card, donor_card);
              donors.splice(d_idx, 1);
              receivers.splice(rk_idx, 1);
              found_swap = true;
              break;
            }
          }
          if (found_swap) break;
        }
        
        if (!found_swap) {
          throw new Error("花色交換失敗：找不到同點數的牌進行交換。");
        }
      }
    }
    
    if (donors.length > 0) {
      throw new Error(`Leftover signal-suit donors after allocation: ${donors.length}`);
    }
    
    for (const i of s_idx) {
      for (const card of rounds[i].cards) {
        if (card.suit === signal_suit) {
          locked_ids.add(card);
        }
      }
    }
    return locked_ids;
  }

  function late_balance(rounds, locked_ids, diff, signal_suit, tie_suit = null) {
    const counts = () => {
      const c = new Map();
      for (const r of rounds) {
        for (const card of r.cards) {
          c.set(card.suit, (c.get(card.suit) || 0) + 1);
        }
      }
      return c;
    };

    for (let i = 0; i < 120; i++) {
      const c = counts();
      const excluded = new Set([signal_suit, tie_suit].filter(Boolean));
      const suits_to_balance = SUITS.filter(s => !excluded.has(s));
      if (suits_to_balance.length < 2) return true;
      
      const hi = suits_to_balance.reduce((a, b) => (c.get(a) || 0) > (c.get(b) || 0) ? a : b);
      const lo = suits_to_balance.reduce((a, b) => (c.get(a) || 0) < (c.get(b) || 0) ? a : b);
      
      if ((c.get(hi) || 0) - (c.get(lo) || 0) <= diff) return true;
      
      let moved = false;
      const hi_cards = rounds.flatMap(r => r.cards).filter(card => card.suit === hi && !locked_ids.has(card));
      const lo_cards = rounds.flatMap(r => r.cards).filter(card => card.suit === lo && !locked_ids.has(card));

      const lo_cards_by_rank = new Map();
      for (const card of lo_cards) {
        if (!lo_cards_by_rank.has(card.rank)) lo_cards_by_rank.set(card.rank, []);
        lo_cards_by_rank.get(card.rank).push(card);
      }

      for (const hi_card of hi_cards) {
        if (lo_cards_by_rank.has(hi_card.rank) && lo_cards_by_rank.get(hi_card.rank).length > 0) {
          const lo_card = lo_cards_by_rank.get(hi_card.rank).pop();
          swap_suits_between_same_rank_cards(hi_card, lo_card);
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    
    // 最終驗證
    const c = counts();
    const excluded = new Set([signal_suit, tie_suit].filter(Boolean));
    const suits_to_balance = SUITS.filter(s => !excluded.has(s));
    const filtered = suits_to_balance.map(s => c.get(s) || 0);
    const final_diff = filtered.length > 0 ? (Math.max(...filtered) - Math.min(...filtered)) : 0;
    const ok = final_diff <= diff;
    if (!ok) {
      const dist = suits_to_balance.map(s => `${s}:${c.get(s) || 0}`).join(', ');
      console.warn(`[驗證] 花色平衡失敗：允許差<=${diff}，分佈=(${dist})`);
    }
    return ok;
  }

  function _apply_color_rule_for_shoe(round_views, tail) {
    const all_cards = [...round_views.flatMap(rv => rv.cards), ...(tail || [])];
    const total = all_cards.length;
    let red_left = Math.floor(total / 2);
    let black_left = total - red_left;

    const use = (color, k) => {
      if (color === 'R') {
        if (red_left < k) return false;
        red_left -= k;
      } else {
        if (black_left < k) return false;
        black_left -= k;
      }
      return true;
    };

    const assign_first_four = (seq) => {
      const k = Math.min(4, seq.length);
      if (k === 0) return;
      
      const pat1 = ['B', 'B', 'B', 'R']; // 黑黑黑紅
      const pat2 = ['R', 'R', 'R', 'B']; // 紅紅紅黑
      
      const count = (arr, val) => arr.filter(x => x === val).length;
      
      const need1_r = count(pat1.slice(0, k), 'R');
      const need1_b = count(pat1.slice(0, k), 'B');
      const need2_r = count(pat2.slice(0, k), 'R');
      const need2_b = count(pat2.slice(0, k), 'B');

      const ok1 = (red_left >= need1_r && black_left >= need1_b);
      const ok2 = (red_left >= need2_r && black_left >= need2_b);

      if (!ok1 && !ok2) throw new Error("顏色配額不足（前四張模式無可用方案）");

      let chosen = null;
      if (ok1 && ok2) chosen = (Math.random() < 0.5) ? pat1 : pat2;
      else if (ok1) chosen = pat1;
      else chosen = pat2;

      if (!use('R', count(chosen.slice(0, k), 'R')) || !use('B', count(chosen.slice(0, k), 'B'))) {
        throw new Error("顏色配額不足（使用時發生不一致）");
      }

      for (let i = 0; i < k; i++) {
        seq[i].color = (chosen[i] === 'R') ? 'R' : 'B';
      }
    };

    for (const rv of round_views) {
      assign_first_four(rv.cards);
    }
    if (tail) {
      assign_first_four(tail);
    }

    const fill_rest_robust = (all_cards_seq) => {
      const uncolored = all_cards_seq.filter(c => c.color === null);
      let color_pool = [...new Array(red_left).fill('R'), ...new Array(black_left).fill('B')];
      
      if (uncolored.length !== color_pool.length) {
        if (uncolored.length > color_pool.length) {
            throw new Error(`顏色分配邏輯錯誤：未上色牌數 ${uncolored.length} 與剩餘配額 ${color_pool.length} 不符。`);
        } else {
            color_pool = color_pool.slice(0, uncolored.length);
        }
      }
      
      shuffle(color_pool);
      
      for (const card of uncolored) {
        card.color = color_pool.pop();
      }
      
      red_left = 0;
      black_left = 0;
    };
    
    fill_rest_robust(all_cards);
    
    if (red_left !== 0 || black_left !== 0) {
      console.error(`顏色配額未對齊, 剩餘 R:${red_left}, B:${black_left}`);
    }
  }

  function pack_all_sensitive_once(deck, { min_tail_stop, multi_pass_min_cards }) {
    const sim = new Simulator(deck);
    const all_sensitive = scan_all_sensitive_rounds(sim);
    
    const used_pos = new Set();
    const out_rounds = [];

    for (const r of all_sensitive) {
      if (r.cards.some(c => used_pos.has(c.pos))) continue;
      out_rounds.push(r);
      r.cards.forEach(c => used_pos.add(c.pos));
    }

    while (true) {
      const remaining = deck.filter(c => !used_pos.has(c.pos));
      if (remaining.length < multi_pass_min_cards) break;
      if (remaining.length < min_tail_stop) break;
      
      const cands = multi_pass_candidates_from_cards_simple(remaining);
      if (cands.length === 0) break;
      
      const picked = cands[0];
      if (picked.cards.some(c => used_pos.has(c.pos))) break;
      
      out_rounds.push(picked);
      picked.cards.forEach(c => used_pos.add(c.pos));
    }

    let tail = deck.filter(c => !used_pos.has(c.pos));
    if (![0, 4, 5, 6].includes(tail.length)) return null;
    
    if (tail.length === 0) {
      return [out_rounds, []];
    }
    
    let manual_seq = try_manual_tail(tail, CONFIG.MANUAL_TAIL);
    if (manual_seq) {
      tail = manual_seq;
    } else {
      let auto_seq = try_make_tail_sensitive(tail);
      if (!auto_seq) return null;
      tail = auto_seq;
    }
    
    out_rounds.sort((a, b) => a.start_index - b.start_index);
    return [out_rounds, tail];
  }

  // **【v3 修改】** 新增 log_attempt_failure 參數，用於回報失敗原因
  function apply_shoe_rules(
    rounds, tail, 
    { signal_suit, tie_suit, late_diff },
    log_attempt_failure
  ) {
    const round_views = rounds.map(r => ({ cards: r.cards, result: r.result }));
    if (tail && tail.length > 0) {
      const tail_res = _seq_result(tail);
      if (tail_res) {
        round_views.push({ cards: tail, result: tail_res });
      }
    }
    let locked_ids = new Set();

    if (tie_suit) {
      try {
        locked_ids = new Set([...locked_ids, ...enforce_tie_signal(round_views, tie_suit)]);
      } catch (e) { 
        log_attempt_failure(`Tie signal failed: ${e.message}`); // 回報錯誤
        return false; 
      }
    }

    if (signal_suit) {
      // **【v5 修正】** // 1. 使用 Set 來儲存 s_idx，方便我們新增 "環繞" 規則
      const s_idx_set = new Set(compute_sidx_new(round_views));

      // 2. 檢查環繞條件 (尾局 -> 第 1 局)
      //    如果第 1 局(index 0)是 '莊'
      if (round_views.length > 0 && round_views[0].result === '莊') {
         // 並且尾局存在 (它是 round_views 的最後一項)
         const tail_round_index = round_views.length - 1;
         if (tail_round_index >= 0) {
             // 就把尾局的索引也加入 S_idx 強制執行列表
             s_idx_set.add(tail_round_index);
         }
      }
      
      // 3. 將 Set 轉回 Array，給後續函式使用
      const s_idx = Array.from(s_idx_set); 
      
      try {
        locked_ids = new Set([...locked_ids, ...enforce_suit_distribution(round_views, signal_suit, s_idx)]);
      } catch (e) {
        log_attempt_failure(`Signal suit (main) failed: ${e.message}`); // 回報錯誤
        try {
          locked_ids = new Set([...locked_ids, ..._ensure_signal_presence(round_views, signal_suit, s_idx)]);
        } catch (e2) { 
          log_attempt_failure(`Signal suit (fallback) failed: ${e2.message}`); // 回報錯誤
          return false; 
        }
      }
    }
    
    if (!late_balance(round_views, locked_ids, late_diff, signal_suit, tie_suit)) {
      log_attempt_failure('Late balance failed'); // 回報錯誤
      return false;
    }

    if (tie_suit) {
      balance_non_tie_suits(round_views, tie_suit, locked_ids, late_diff);
    }
    
    if (tie_suit) {
      try {
        validate_tie_signal(round_views, tie_suit);
      } catch (e) { 
        log_attempt_failure(`Tie signal validation failed: ${e.message}`); // 回報錯誤
        return false; 
      }
    }

    if (CONFIG.COLOR_RULE_ENABLED) {
        try {
             _apply_color_rule_for_shoe(round_views, tail);
        } catch (e) {
            log_attempt_failure(`Color rule failed: ${e.message}`); // 回報錯誤
            return false;
        }
    }

    return true;
  }

  // **【v3 修改】** // 1. 整個函式改為 async
  // 2. 傳入 updateStatus 和 log_attempt_failure 函式
  // 3. 將 for 迴圈改為 async while 迴圈，並在迴圈中 await
  async function generate_all_sensitive_shoe_or_retry({
    min_tail_stop, multi_pass_min_cards, signal_suit, tie_suit, late_diff, max_attempts,
    updateStatus, log_attempt_failure
  }) {
    
    let attempt = 1;
    while (attempt <= max_attempts) {
    
      // **【v3 新增】** 每 20 次嘗試回報一次狀態，並釋放 UI 執行緒
      if (attempt % 20 === 0) {
        updateStatus(`Processing attempt ${attempt} / ${max_attempts}...`);
        await new Promise(resolve => setTimeout(resolve, 0)); // 關鍵：防止卡死
      }
      
      const deck = build_shuffled_deck();
      const result = pack_all_sensitive_once(
        deck, { min_tail_stop, multi_pass_min_cards }
      );
      
      if (!result) {
        attempt++;
        continue; // 嘗試失敗，進入下一次
      }
      
      const [rounds, tail] = result;

      const rounds_copy = rounds.map(r => ({ ...r, cards: r.cards.map(c => c.clone()) }));
      const tail_copy = tail.map(c => c.clone());

      // **【v3 修改】** 傳入 log_attempt_failure 函式
      if (!apply_shoe_rules(
        rounds_copy, tail_copy, 
        { signal_suit, tie_suit, late_diff },
        log_attempt_failure // 傳入
      )) {
        attempt++;
        continue; // 嘗試失敗，進入下一次
      }
      
      // **【v3 新增】** 成功！
      updateStatus(`Success on attempt ${attempt}! Finalizing...`);
      return [rounds_copy, tail_copy, deck];
    }
    
    // **【v3 新增】**
    updateStatus(`Failed to generate after ${max_attempts} attempts.`);
    return null; // 達到最大嘗試次數
  }

  return {
    // 公開的函式和設定
    setConfig: (newConfig) => {
      Object.assign(CONFIG, newConfig);
    },
    generate_all_sensitive_shoe_or_retry,
    // 將輔助函式也導出，供 app.py 翻譯的邏輯使用
    helpers: {
      _seq_points,
      _seq_result,
      compute_sidx_new,
      RoundView: (cards, result) => ({ cards, result }), // 模擬
      HEART_SIGNAL_ENABLED: () => CONFIG.HEART_SIGNAL_ENABLED,
      SIGNAL_SUIT: () => CONFIG.SIGNAL_SUIT,
    }
  };
})();

// =============================================
// --- END: waa.py translated logic ---
// =============================================


// =============================================
// --- START: app.py helper logic ---
// =============================================

// 這是 INTERNAL_STATE，用來儲存由 waa.py 邏輯生成的 *原始* Card 物件
// 以便後續導出功能使用
const INTERNAL_STATE = {
    rounds: [], // 儲存 Round 物件
    tail: [],   // 儲存 Card 物件
    deck: []    // 儲存 Card 物件
};

// --- app.py: 花色對應 ---
// **【修正】** 這些變數現在在全域宣告 (下方 script.js 部分)，這裡只提供 app 翻譯邏輯需要的部分
const SUIT_LETTER_TO_SYMBOL_APP = { "S": "♠", "H": "♥", "D": "♦", "C": "♣" };
const SUIT_SYMBOL_TO_LETTER_APP = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };


function _suit_letter(val) {
    if (!val) return "";
    const s = String(val).trim();
    if (!s) return "";
    const upper = s.toUpperCase();
    if (SUIT_LETTER_TO_SYMBOL_APP[upper]) return upper;
    if (SUIT_SYMBOL_TO_LETTER_APP[s]) return SUIT_SYMBOL_TO_LETTER_APP[s];
    if (SUIT_SYMBOL_TO_LETTER_APP[upper]) return SUIT_SYMBOL_TO_LETTER_APP[upper]; // Handle 'h' -> 'H'
    return upper;
}

function _normalize_suit_input(val) {
    if (!val) return null;
    const letter = _suit_letter(val);
    return SUIT_LETTER_TO_SYMBOL_APP[letter] || letter;
}

// --- app.py: 工具函式 ---
function _suit_counts(rounds, tail) {
    const all_cards = [...rounds.flatMap(r => r.cards || []), ...(tail || [])];
    const counts = new Map();
    for (const card of all_cards) {
        const suit = _suit_letter(card.suit || null);
        const rank = card.rank || null;
        if (suit && rank) {
            const key = `${suit}_${rank}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    
    const suit_totals = new Map();
    for (const card of all_cards) {
        const suit = _suit_letter(card.suit || null);
        if (suit) {
            suit_totals.set(suit, (suit_totals.get(suit) || 0) + 1);
        }
    }
    return {
        by_rank_suit: Object.fromEntries(counts),
        suit_totals: Object.fromEntries(suit_totals),
    };
}

// 翻譯 app.py 的 _serialize_rounds
function _serialize_rounds(rounds) {
    const out = [];
    for (const r of rounds) {
        const seq_cards = r.cards || [];
        const cards = [];
        for (const c of seq_cards) {
            const suit_symbol = c.suit || "";
            cards.push({
                label: c.short(),
                suit: _suit_letter(suit_symbol),
                suit_symbol: suit_symbol,
            });
        }

        let banker_point = 0;
        let player_point = 0;
        let player_cards_labels = [];
        let banker_cards_labels = [];
        
        try {
            if (seq_cards.length >= 4) {
                const [P1, B1, P2, B2] = seq_cards.slice(0, 4);
                let player_cards = [P1, P2];
                let banker_cards = [B1, B2];
                let p_tot = (P1.point() + P2.point()) % 10;
                let b_tot = (B1.point() + B2.point()) % 10;
                let natural = (p_tot === 8 || p_tot === 9 || b_tot === 8 || b_tot === 9);
                let idx = 4;
                let p3 = null;
                if (!natural) {
                    if (p_tot <= 5 && idx < seq_cards.length) {
                        p3 = seq_cards[idx]; idx++;
                        player_cards.push(p3);
                        p_tot = (p_tot + p3.point()) % 10;
                    }
                    
                    const draw = () => {
                        if (idx >= seq_cards.length) return false;
                        const b3 = seq_cards[idx]; idx++;
                        banker_cards.push(b3);
                        b_tot = (b_tot + b3.point()) % 10;
                        return true;
                    };
                    
                    if (p3 === null) {
                        if (b_tot <= 5) {
                            draw();
                        }
                    } else {
                        const pt = p3.point();
                        if (b_tot <= 2) draw();
                        else if (b_tot === 3 && pt !== 8) draw();
                        else if (b_tot === 4 && [2, 3, 4, 5, 6, 7].includes(pt)) draw();
                        else if (b_tot === 5 && [4, 5, 6, 7].includes(pt)) draw();
                        else if (b_tot === 6 && [6, 7].includes(pt)) draw();
                    }
                }
                banker_point = b_tot;
                player_point = p_tot;
                player_cards_labels = player_cards.map(c => c.short());
                banker_cards_labels = banker_cards.map(c => c.short());
            } else {
                 const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
                 banker_point = bp_pp[0];
                 player_point = bp_pp[1];
            }
        } catch (e) {
            console.error("Error serializing round points", e, r);
            const bp_pp = WAA_Logic.helpers._seq_points(seq_cards) || [null, null];
            banker_point = bp_pp[0];
            player_point = bp_pp[1];
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

// 翻譯 app.py 的 _serialize_rounds_with_flags
function _serialize_rounds_with_flags(rounds, tail) {
    const ordered = [...rounds].sort((a, b) => a.start_index - b.start_index);
    const views = ordered.map(r => WAA_Logic.helpers.RoundView(r.cards, r.result));
    
    if (tail && tail.length > 0) {
        const tail_res = WAA_Logic.helpers._seq_result(tail) || '';
        views.push(WAA_Logic.helpers.RoundView(tail, tail_res));
    }
    
    let s_idx_positions = new Set();
    try {
        s_idx_positions = new Set(WAA_Logic.helpers.compute_sidx_new(views));
    } catch (e) {
        console.error("compute_sidx_new failed", e);
    }
    
    const serialized = _serialize_rounds(ordered);
    const signal_enabled = WAA_Logic.helpers.HEART_SIGNAL_ENABLED();
    const signal_suit = WAA_Logic.helpers.SIGNAL_SUIT();

    serialized.forEach((row, idx) => {
        const is_idx = s_idx_positions.has(idx);
        row["is_sidx"] = is_idx;
        if (!is_idx) {
            row["s_idx_ok"] = false;
            return;
        }
        let ok = true;
        if (signal_enabled && signal_suit) {
            ok = ordered[idx].cards.some(card => card.suit === signal_suit);
        }
        row["s_idx_ok"] = ok;
    });

    if (tail && tail.length > 0) {
        const tail_positions = tail.map(c => c.pos).filter(p => typeof p === 'number');
        let tail_start = tail_positions.length > 0 ? Math.min(...tail_positions) : null;
        if (tail_start === null) {
            tail_start = ordered.length > 0 ? (ordered[ordered.length - 1].start_index + ordered[ordered.length - 1].cards.length) : 0;
        }
        
        const tail_round = {
            start_index: tail_start,
            cards: tail,
            result: WAA_Logic.helpers._seq_result(tail) || '',
            sensitive: true, // 假設尾局是敏感的
        };
        
        const tail_serialized = _serialize_rounds([tail_round])[0];
        
        // **【v4 修正】** // 移除 app.py 中錯誤的 "尾局 S_idx" 邏輯。
        // 根據 waa.py 的 compute_sidx_new，尾局 (i+1) 只能作為
        // 觸發器，使前一局 (i) 成為 S_idx。尾局本身不應該是 S_idx 目標。
        
        tail_serialized["is_sidx"] = false; // 尾局永遠不是 S_idx 目標
        tail_serialized["s_idx_ok"] = false;
        tail_serialized["is_tail"] = true;
        serialized.push(tail_serialized);
    }
    
    return [serialized, ordered];
}

// =============================================
// --- END: app.py helper logic ---
// =============================================


// =============================================
// --- START: Original script.js logic (MODIFIED) ---
// =============================================

// const API_BASE = window.location.origin; // 不再需要

const STATE = {
  rounds: [], // 這裡將儲存 *序列化後* 的 rounds (供 UI 使用)
  suitCounts: {},
  previewCards: [],
  cutSummary: null,
};

// **【修正】** 這些是全域變數，在 app.py 翻譯區塊和原始 script.js 區塊都會用到
// 原始 script.js 定義
const SUIT_SYMBOL_TO_LETTER = {
  '\u2660': 'S',
  '\u2665': 'H',
  '\u2666': 'D',
  '\u2663': 'C',
};

// 從 app.py 翻譯區塊補充，確保全域可用
// const SUIT_LETTER_TO_SYMBOL = { "S": "♠", "H": "♥", "D": "♦", "C": "♣" };

const SIGNAL_SUIT_COLOR = {
  H: '#ff7a90',
  S: '#69c0ff',
  D: '#ffb74d',
  C: '#73d13d',
};

const SUIT_DISPLAY_NAME = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

const $ = (id) => document.getElementById(id);

function toast(message) {
  const node = $('toast');
  if (!node) return;
  node.textContent = message;
  node.style.display = 'block';
  setTimeout(() => {
    node.style.display = 'none';
  }, 2200);
}

// ** MODIFIED **
// 導出功能被修改，不再依賴 API
function csvDownloadHref(name) {
  // return `${API_BASE}/api/export/${name}`;
  return `javascript:void(0);`; // 不再使用
}

function suitLetterFromLabel(label) {
  if (!label) return '';
  const value = String(label).trim();
  if (!value) return '';
  const symbol = value.slice(-1);
  if (SUIT_SYMBOL_TO_LETTER[symbol]) return SUIT_SYMBOL_TO_LETTER[symbol];
  const upper = symbol.toUpperCase();
  // **【修正】** 這裡的 SUIT_SYMBOL_TO_LETTER 來自原始 script.js 的定義，
  // 但 app.py 的 _suit_letter 邏輯更完整，我們改用它的邏輯
  if (SUIT_SYMBOL_TO_LETTER_APP[symbol]) return SUIT_SYMBOL_TO_LETTER_APP[symbol];
  if (SUIT_LETTER_TO_SYMBOL_APP[upper]) return upper; // 'H' -> 'H'
  if (SUIT_SYMBOL_TO_LETTER_APP[upper]) return SUIT_SYMBOL_TO_LETTER_APP[upper]; // 'h' -> 'H'
  return upper;
}

function cardSuitFromCard(card) {
  if (!card) return '';
  if (typeof card === 'object') {
    if (card.suit) return card.suit;
    if (card.suit_symbol) return suitLetterFromLabel(card.suit_symbol);
    if (card.label) return suitLetterFromLabel(card.label);
  }
  return suitLetterFromLabel(card);
}

function cardLabel(card) {
  if (!card) return '';
  if (typeof card === 'object') {
    if (card.label) return card.label;
    if (card.short) return typeof card.short === 'function' ? card.short() : card.short;
  }
  return String(card);
}

function rankFromLabel(label) {
  if (!label) return '';
  const text = String(label).trim();
  if (!text) return '';
  const cleaned = text.replace(/[\u2660\u2665\u2666\u2663shdc]/gi, '');
  return cleaned.toUpperCase();
}

function gridValueFromLabel(label) {
  const rank = rankFromLabel(label);
  if (!rank) return '';
  if (rank === 'A') return '1';
  if (rank === 'T' || rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return '0';
  const num = Number.parseInt(rank, 10);
  if (!Number.isNaN(num)) return String(num % 10);
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
      rowTotal += val;
      html += `<td>${val}</td>`;
    }
    html += `<td>${rowTotal}</td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderSuits(counts) {
  renderStatsTable(counts);
}

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

function ensureRoundsHeader() {
  const headers = ['局號', '1', '2', '3', '4', '5', '6', '結果', '訊號', '\u9592\u5bb6\u724c', '\u838a\u5bb6\u724c', '閒家', '莊家', '卡牌'];
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
      const cardCells = [];
      for (let i = 0; i < 6; i += 1) {
        const card = cards[i];
        const label = cardLabel(card);
        const suit = cardSuitFromCard(card);
        let classes = 'mono';
        let inline = '';
        let coloredLabel = label;
        const suitSym = suit ? (SUIT_SYMBOL[suit] || '') : '';
        // 若是訊號花色，數字與花色都變色
        if (signal && !isTie && suit === signal && suitSym && label && label.endsWith(suitSym)) {
          classes += ` signal-card signal-card-${signal}`;
          const color = SIGNAL_SUIT_COLOR[signal];
          if (color) inline = ` style="color:${color}"`;
          // 整個label都染色
          coloredLabel = `<span style="color:${color}">${label}</span>`;
        } else if (suit && SUIT_COLOR[suit] && suitSym && label && label.endsWith(suitSym)) {
          // 只有花色符號變色，數字維持白色
          const numPart = label.slice(0, label.length - suitSym.length);
          coloredLabel = `${numPart}<span style="color:${SUIT_COLOR[suit]}">${suitSym}</span>`;
        }
        cardCells.push(`<td class="${classes}"${inline}>${coloredLabel}</td>`);
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
      if (isSIdx) {
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
      const rowClass = round.is_tail ? 'tail-row' : '';
      return `
        <tr class="${rowClass}">
          <td>${indexLabel}</td>
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

// 這個函式在 _serialize_rounds_with_flags 中已經排序過了
// 但前端還是保留，以防萬一
function sortedRoundsByStartIndex(rounds) {
  if (!Array.isArray(rounds)) return [];
  // 假設 rounds 已經是序列化後的物件，它沒有 start_index
  // 但 app.py 的 _serialize_rounds_with_flags 確保了順序
  return rounds;
}

function flattenRoundColorSequence(rounds) {
  // const sorted = sortedRoundsByStartIndex(rounds); // 不再需要
  const sorted = rounds;
  if (!sorted.length) return '';
  return sorted
    .map((round) => {
      const seq = round?.color_seq ?? round?.colors ?? '';
      if (Array.isArray(seq)) return seq.join('');
      if (typeof seq === 'string') return seq.replace(/\s+/g, '');
      return '';
    })
    .join('');
}

function buildDeckGrid(cards, signal, rounds = STATE.rounds) {
  const columns = 16;
  const rows = 26;
  const grid = [];
  const colorSequence = Array.isArray(rounds) && rounds.length ? flattenRoundColorSequence(rounds) : '';
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < columns; c += 1) {
      const idx = r * columns + c;
      const raw = idx < cards.length ? cards[idx] : '';
      const originalLabel = cardLabel(raw);
      if (!originalLabel) {
        row.push({ label: '', className: '', title: '' });
        continue;
      }
      const displayLabel = gridValueFromLabel(originalLabel);
      const suit = suitLetterFromLabel(originalLabel);
      const suitDisplay = suit ? SUIT_DISPLAY_NAME[suit] || suit : '';
      const isSignal = signal && suit === signal;
      const colorChar = colorSequence.charAt(idx).toUpperCase();
      const classes = [];
      if (colorChar === 'R') classes.push('card-red');
      else if (colorChar === 'B') classes.push('card-blue');
      if (isSignal) classes.push('signal-match');
      const className = classes.join(' ');
      row.push({
        label: displayLabel,
        className,
        title: suitDisplay ? `${originalLabel} (${suitDisplay})` : originalLabel,
      });
    }
    grid.push(row);
  }
  return grid;
}

function renderPreview(cards) {
  const container = $('gridPreview');
  if (!container) return;
  if (!cards || !cards.length) {
    container.innerHTML = '<div class="small">\u5c1a\u7121\u724c\u9774\u8cc7\u6599</div>';
    return;
  }
  const signal = $('signalSuit').value;
  const grid = buildDeckGrid(cards, signal, STATE.rounds);
  container.innerHTML = grid
    .map((row) =>
      row
        .map((cell) => {
          const title = cell.title ? ` title="${cell.title}"` : '';
          return `<div class="cell ${cell.className}"${title}>${cell.label}</div>`;
        })
        .join(''),
    )
    .join('');
}

function openPreviewWindow(immediatePrint = false) {
  if (!STATE.previewCards.length) {
    toast('\u5c1a\u672a\u7522\u751f\u724c\u9774');
    return;
  }
  const signal = $('signalSuit').value;
  const grid = buildDeckGrid(STATE.previewCards, signal, STATE.rounds);
  const gridHtml = grid
    .map((row) =>
      row
        .map((cell) => {
          const title = cell.title ? ` title="${cell.title}"` : '';
          return `<div class="cell ${cell.className}"${title}>${cell.label}</div>`;
        })
        .join(''),
    )
    .join('');
const html = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <style>
      /* === 基本版面設定（整體背景、字體大小）=== */
      body{margin:0;padding:24px;background:#0f111a;color:#eef3ff;font:14px/1.4 "Noto Sans TC",sans-serif;}
      body,table.deck td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      /* === 操作按鈕列（可視需要保留或移除）=== */
      .actions{margin-bottom:12px;display:flex;gap:8px;}
      .actions button{padding:6px 12px;border:1px solid #24324a;border-radius:6px;background:#1d4ed8;color:#f3f8ff;cursor:pointer;}
      /* === 表格外觀（外框、間距、字體大小）=== */
      .deck-wrapper{ /* 表格外框容器 */
        display:block; /* 讓外框可水平置中 */
        margin:0 auto; /* 水平置中 */
        border:1px solid #394968; /* 外框顏色 */
        background:#121b2c; /* 外框背景色 */
        padding:8px; /* 外框內距 */
        border-radius:8px; /* 圓角 */
        width:1000px; /* 表格寬度（可調整） */
        max-width:100vw;
      }
      table.deck{border-collapse:collapse;width:100%;} /* 讓表格寬度填滿外框 */
      table.deck td{ /* 單一格子 */
        width:36px; /* 格子寬度（可調整） */
        height:36px; /* 格子高度（可調整） */
        text-align:center; /* 文字置中 */
        font-weight:600; /* 字體加粗 */
        border:1px solid #2a3650; /* 格子邊框顏色 */
        color:#d8e6ff; /* 字體顏色（可調整） */
        font-size:24px; /* 字體大小（可調整） */
        font-family: auto; /* 字體（可調整） */
      }
      /* === 顏色設定（可自行調整）=== */
      table.deck td.card-red{background: #2d1b22;color: #ffd6dc;}
      table.deck td.card-blue{background: #162437;color: #d7e9ff;}
      table.deck td.signal-match{box-shadow:inset 0 0 0 2px #ffd591;}
      /* === 列印模式專用樣式 === */
      @media print{
        body{padding:8px;background:#fff;color:#000;} /* 列印時頁面背景與字色 */
        .actions{display:none !important;} /* 列印時隱藏操作按鈕 */
        title, h1, h2, h3, .title, .subtitle, .deck-title {display:none !important;} /* 列印時隱藏標題 */
        .deck-wrapper{
          border:2px solid #0e0e0eff; /* 列印時外框顏色 */
          background:#fff; /* 列印時外框背景色 */
          padding:0;
          border-radius:0;
          width:1200px !important; /* 列印時表格寬度（可調整） */
          max-width:100vw;
          margin:0 auto;
        }
        table.deck{width:100%;} /* 列印時表格寬度填滿外框 */
        table.deck td{
          border:1px solid #000000; /* 列印時格子邊框顏色 */
          color:#000000; /* 列印時字體顏色 */
          font-size:26x; /* 列印時字體大小（可調整） */
          font-family:font-family: auto;
          padding:0px;
          width:36px; /* 列印時格子寬度（可調整） */
          height:36px; /* 列印時格子高度（可調整） */
        }
        table.deck td.card-red{background: #f5c5c5ff !important;color:#000000 !important;} /* 紅色格子背景與字色 */
        table.deck td.card-blue{background: #c2bebeff !important;color:#000000 !important;} /* 藍色格子背景與字色 */
        table.deck td.signal-match{box-shadow:inset 0 0 0 2px #c20000ff !important; color: #c20000ff !important;} /* 黃色框線，並設定字體顏色 */
      }
    </style>
  </head>
  <body>
    <div class="actions">
      <button onclick="window.print()">\u5217\u5370</button>
      <button onclick="window.close()">\u95dc\u9589</button>
    </div>
    <div class="deck-wrapper">
      <table class="deck">
        <tbody>
          ${grid
            .map(
              (row) =>
                `<tr>${row
                  .map((cell) => `<td class="${cell.className}">${cell.label}</td>`)
                  .join('')}</tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    toast('\u700f\u89bd\u5668\u963b\u64cb\u5f48\u51fa\u8996\u7a97\uff0c\u8acb\u5141\u8a31\u5f8c\u518d\u8a66');
    URL.revokeObjectURL(url);
    return;
  }
  win.focus();
  win.onload = () => {
    if (immediatePrint) {
      try {
        win.print();
      } catch (err) {
        console.warn('preview print failed', err);
      }
    }
  };
  const revokeLater = () => {
    try {
      URL.revokeObjectURL(url);
    } catch (err) {
      // ignore
    }
  };
  win.addEventListener('beforeunload', revokeLater);
  setTimeout(revokeLater, 60000);
  if (immediatePrint) {
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        console.warn('preview print failed', err);
      }
    }, 300);
  }
}

function splitCutRows(hitRows) {
  const header1 = hitRows[0] || [];
  const header2 = hitRows[1] || [];
  const rawRows = hitRows.slice(2);
  const dataRows = [];
  const averages = [];
  for (const row of rawRows) {
    if (!row) continue;
    const hasData = row.some((cell) => String(cell || '').trim().length);
    if (!hasData) continue;
    if (row[0] === '\u5e73\u5747' || row[0] === 'Average') {
      averages.push(row);
      continue;
    }
    dataRows.push(row);
  }
  return { header1, header2, dataRows, averages };
}

// ** MODIFIED **
// 不再從 API 獲取
async function refreshCutSummary() {
  // toast("切牌統計功能在原始程式碼中不完整，無法刷新。");
  STATE.cutSummary = null;
  renderCutSummary(null);
}

// ** MODIFIED **
// 不再需要
/*
async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
*/

function downloadFile(name, content, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseCSV(text) {
  const source = normalizeLines(text);
  const out = [];
  let row = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuote) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out;
}

function linesFromCSVorTxt(text) {
  return normalizeLines(text).trim().split('\n').filter(Boolean);
}

function applyGenerateResponse(data) {
  STATE.rounds = data.rounds || [];
  STATE.suitCounts = data.suit_counts || {};
  const vertical = data.vertical || '';
  STATE.previewCards = vertical.split('\n').filter(Boolean);
  STATE.cutSummary = null;

  renderSuits(STATE.suitCounts);
  renderRounds(STATE.rounds);
  renderPreview(STATE.previewCards);
  renderCutSummary(null);
  // refreshCutSummary(); // 不再呼叫

  const tables = $('tables');
  if (tables) tables.style.display = 'grid';
}

// **【v3 新增】** // 用於在 UI 上顯示狀態的輔助函式
function updateStatus(message) {
  const node = $('genInfo');
  if (node) {
    node.textContent = message;
  }
  console.log(message); // 同時也印在 console
}

// **【v3 新增】** // 用於在 apply_shoe_rules 內部記錄失敗原因的變數
let current_failure_reason = null;
function log_attempt_failure(reason) {
    current_failure_reason = reason;
    // 立即在 console 印出，方便偵錯
    console.warn(`Attempt Failed: ${reason}`);
}

// ** MODIFIED (v3) **
// 核心函式：改為 async，並傳入 updateStatus
async function generateShoe() {
  const btn = $('btnGen');
  const spinner = $('spinGen');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  
  // **【v3 修改】** // 不再需要 setTimeout，因為 WAA_Logic.generate_all_sensitive_shoe_or_retry 
  // 內部已經是 async 並且會釋放執行緒
  // await new Promise(resolve => setTimeout(resolve, 50)); 

  try {
    updateStatus('Starting...'); // **【v3 新增】**
    
    const num_shoes = Number($('numShoes').value);
    const signal_suit = $('signalSuit').value;
    const tie_signal_suit = $('tieSuit').value || null;
    
    // 1. 設定 WAA_Logic 的 CONFIG
    WAA_Logic.setConfig({
        NUM_SHOES: num_shoes,
        SIGNAL_SUIT: _normalize_suit_input(signal_suit),
        TIE_SIGNAL_SUIT: _normalize_suit_input(tie_signal_suit)
    });

    // 2. 獲取 waa.py 中的預設參數 (app.py 在呼叫時使用的)
    const waa_params = {
        max_attempts: 1000000, // 來自 waa.py MAX_ATTEMPTS
        min_tail_stop: 7,       // 來自 waa.py MIN_TAIL_STOP
        multi_pass_min_cards: 4, // 來自 waa.py MULTI_PASS_MIN_CARDS
        signal_suit: _normalize_suit_input(signal_suit),
        tie_suit: _normalize_suit_input(tie_signal_suit),
        late_diff: 2,           // 來自 waa.py LATE_BALANCE_DIFF
        // **【v3 新增】** 傳入狀態函式
        updateStatus: updateStatus,
        log_attempt_failure: log_attempt_failure
    };

    // 3. **【v3 修改】** 執行 *await*
    const result = await WAA_Logic.generate_all_sensitive_shoe_or_retry(waa_params);

    if (!result) {
        // 失敗訊息已由 WAA_Logic 內部的 updateStatus 顯示
        toast(`創建失敗：請查看下方訊息或 F12 Console`);
        throw new Error("Generation failed after max attempts");
    }

    const [rounds, tail, deck] = result;

    if (!rounds || rounds.length === 0) {
       updateStatus('創建失敗：沒有生成任何敏感局');
       toast(`創建失敗：沒有生成任何敏感局`);
       throw new Error("No sensitive rounds");
    }

    // 4. 執行翻譯後的 app.py 序列化邏輯
    const [serialized_rounds, ordered_rounds] = _serialize_rounds_with_flags(rounds, tail);

    // 5. 儲存 *原始* 物件到內部狀態
    INTERNAL_STATE.rounds = ordered_rounds;
    INTERNAL_STATE.tail = tail;
    INTERNAL_STATE.deck = deck;

    // 6. 準備前端需要的資料
    const suit_counts = _suit_counts(ordered_rounds, tail);
    const vertical = [
        ...ordered_rounds.flatMap(r => r.cards), 
        ...(tail || [])
    ].map(c => c.short()).join('\n');
    
    const data = {
        rounds: serialized_rounds,
        suit_counts: suit_counts,
        vertical: vertical,
        meta: { rounds_len: ordered_rounds.length, tail_len: tail.length, deck_len: deck.length, fallback: null }
    };
    
    // 7. 更新 UI
    applyGenerateResponse(data);
    const count = (data.rounds || []).length;
    toast(`牌靴已完成，共 ${count} 局`);
    updateStatus(`Generation complete. ${count} rounds.`); // **【v3 新增】**

  } catch (err) {
    console.error(err);
    toast(`創建時發生錯誤: ${err.message}`);
    updateStatus(`Error: ${err.message}`); // **【v3 新增】**
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    // 5秒後清除狀態，除非還在跑
    setTimeout(() => {
        const node = $('genInfo');
        if (node && !($('btnGen').disabled)) {
            node.textContent = '';
        }
    }, 5000);
  }
}

// ** MODIFIED **
// 此功能在 app.py 中未實作
async function simulateCut() {
  const btn = $('btnCut');
  const spinner = $('spinCut');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  
  toast("「切牌」功能在原始程式碼中未被實作。");

  if (btn) btn.disabled = false;
  if (spinner) spinner.style.display = 'none';
}

// ** MODIFIED **
// 此功能在 app.py 中是空的
async function scanRounds() {
  if (!INTERNAL_STATE.rounds.length) {
    toast('\u8acb\u5148\u7522\u751f\u724c\u9774');
    return;
  }
  try {
    // 依照 app.py 的邏輯，固定回傳 0
    $('scanInfo').textContent = `\u547d\u4e2d 0 \u5c40`;
  } catch (err) {
    console.error(err);
    toast('\u6383\u63cf\u6642\u767c\u751f\u932f\u8aa4');
  }
}

// ** MODIFIED **
// 導出功能被修改，只導出 vertical
async function exportCombined() {
  try {
    if (!INTERNAL_STATE.rounds.length && !INTERNAL_STATE.tail.length) {
        toast("尚無資料可導出");
        return;
    }

    // 1. 本地生成 vertical txt
    const verticalTxt = [
        ...INTERNAL_STATE.rounds.flatMap(r => r.cards), 
        ...(INTERNAL_STATE.tail || [])
    ].map(c => c.short()).join('\n');

    // 2. 原始程式碼中的 cut_hits.csv 功能是損壞的，無法生成
    
    toast("切牌統計功能在原始程式碼中不完整。僅導出直式牌序。");

    // 3. 只下載 vertical
    downloadFile('vertical_export.txt', verticalTxt, 'text/plain');

  } catch (err) {
    console.error(err);
    toast('\u532f\u51fa\u5931\u5507');
  }
}

function bindControls() {
  renderSuits({});
  renderCutSummary(null);
  renderPreview([]);

  const btnGen = $('btnGen');
  if (btnGen) btnGen.addEventListener('click', generateShoe);

  const btnCut = $('btnCut');
  if (btnCut) btnCut.addEventListener('click', simulateCut);

  const btnScan = $('btnScan');
  if (btnScan) btnScan.addEventListener('click', scanRounds);

  const btnExport = $('btnExportCombined');
  if (btnExport) btnExport.addEventListener('click', exportCombined);

  const btnPreview = $('btnPreview');
  if (btnPreview) btnPreview.addEventListener('click', () => openPreviewWindow(false));

  const btnPrint = $('btnPrint');
  if (btnPrint) btnPrint.addEventListener('click', () => openPreviewWindow(true));

  const signalSelect = $('signalSuit');
  if (signalSelect) {
    signalSelect.addEventListener('change', () => {
      // 只有在資料存在時才重繪
      if (STATE.rounds && STATE.rounds.length > 0) {
        renderRounds(STATE.rounds);
      }
      if (STATE.previewCards && STATE.previewCards.length > 0) {
        renderPreview(STATE.previewCards);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindControls);
} else {
  bindControls();
}