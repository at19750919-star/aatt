// 紅色0點牌訊號系統測試
// 基於現有WAA系統的核心邏輯，專門測試紅色0點牌訊號方案

class Card {
    constructor(rank, suit, pos) {
        this.rank = rank;
        this.suit = suit;
        this.pos = pos;
    }
    
    point() {
        const values = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 0, 'J': 0, 'Q': 0, 'K': 0};
        return values[this.rank];
    }
    
    short() {
        return `${this.rank}${this.suit}`;
    }
    
    isZero() {
        return this.point() === 0;
    }
    
    isRedZero() {
        return this.isZero() && (this.suit === '♥' || this.suit === '♦');
    }
    
    clone(newPos = this.pos) {
        return new Card(this.rank, this.suit, newPos);
    }
}

class Simulator {
    constructor(deck) {
        this.deck = deck;
    }
    
    simulate_round(start, options = {}) {
        const no_swap = options.no_swap || false;
        const d = this.deck;
        let idx = start;
        
        if (idx + 3 >= d.length) return null;
        
        // 前四張牌
        const p1 = d[idx++].point();
        const b1 = d[idx++].point();
        const p2 = d[idx++].point();
        const b2 = d[idx++].point();
        
        let p_tot = (p1 + p2) % 10;
        let b_tot = (b1 + b2) % 10;
        
        const natural = (p_tot >= 8 || b_tot >= 8);
        
        const draw = () => {
            if (idx >= d.length) return false;
            idx++;
            return true;
        };
        
        // 補牌邏輯
        if (!natural) {
            if (p_tot <= 5) {
                if (!draw()) return null;
                const pt = d[idx - 1].point();
                p_tot = (p_tot + pt) % 10;
                
                if (b_tot <= 2) {
                    if (!draw()) return null;
                } else if (b_tot === 3 && pt !== 8) {
                    if (!draw()) return null;
                } else if (b_tot === 4 && [2,3,4,5,6,7].includes(pt)) {
                    if (!draw()) return null;
                } else if (b_tot === 5 && [4,5,6,7].includes(pt)) {
                    if (!draw()) return null;
                } else if (b_tot === 6 && [6,7].includes(pt)) {
                    if (!draw()) return null;
                }
            } else if (b_tot <= 5) {
                if (!draw()) return null;
            }
        }
        
        const res = (p_tot === b_tot) ? '和' : ((p_tot > b_tot) ? '閒' : '莊');
        const used = d.slice(start, idx);
        
        if (no_swap) {
            return {
                start_index: start,
                cards: used,
                result: res,
                sensitive: false
            };
        }
        
        // 檢查敏感性
        const [swap_res, same_len] = this._swap_result(start);
        const invalid_swap = (res === '和' && swap_res === '莊');
        const sensitive = ((swap_res !== null) && (swap_res !== res) && (swap_res !== '和') && (same_len === used.length) && !invalid_swap);
        
        return {
            start_index: start,
            cards: used,
            result: res,
            sensitive: sensitive
        };
    }
    
    _swap_result(start) {
        let d2 = [...this.deck];
        if (start + 1 >= d2.length) return [null, 0];
        
        // 交換第1、2張牌
        [d2[start], d2[start + 1]] = [d2[start + 1], d2[start]];
        
        const sim2 = new Simulator(d2);
        const r2 = sim2.simulate_round(start, { no_swap: true });
        if (!r2) return [null, 0];
        
        return [r2.result, r2.cards.length];
    }
}

// 洗牌函數
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 建立8副牌
function build_shuffled_deck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (let deckNum = 0; deckNum < 8; deckNum++) {
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push(new Card(rank, suit, deck.length));
            }
        }
    }
    
    shuffle(deck);
    return deck;
}

// 掃描所有敏感局
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

// 計算S局索引
function compute_sidx_for_segment(rounds, segment = 'A') {
    const S = [];
    for (let i = 0; i < rounds.length - 1; i++) {
        if (rounds[i].segment === segment && rounds[i + 1].result === '莊') {
            S.push(i);
        }
    }
    return S;
}

// 簡化版多重洗牌：先正常生成敏感局
function multi_pass_zero_priority(card_pool, target_zero_count = 64) {
    log(`開始多重洗牌，剩餘牌數: ${card_pool.length}`, 'info');
    
    for (let attempt = 0; attempt < 100; attempt++) {
        if (attempt % 10 === 0) {
            log(`嘗試 ${attempt}/100...`, 'info');
        }
        
        // 簡單隨機洗牌
        let shuffled = [...card_pool];
        shuffle(shuffled);
        
        
        // 重新編號位置
        const temp_cards = shuffled.map((c, i) => c.clone(i));
        const temp_sim = new Simulator(temp_cards);
        
        const sensitive_rounds = [];
        const used_idx = new Set();
        
        let i = 0;
        while (i < temp_cards.length - 3) {
            if (used_idx.has(i)) {
                i++;
                continue;
            }
            
            const r = temp_sim.simulate_round(i);
            if (!r) {
                i++;
                continue;
            }
            
            const temp_indices = r.cards.map(c => c.pos);
            if (temp_indices.some(ti => used_idx.has(ti))) {
                i++;
                continue;
            }
            
            if (!r.sensitive) {
                i += r.cards.length;
                continue;
            }
            
            // 找到敏感局，對應回原始牌
            const original_cards = temp_indices.map(ti => shuffled[ti]);
            const zero_count = original_cards.filter(card => card.isZero()).length;
            
            const round_info = {
                start_index: original_cards[0].pos,
                cards: original_cards,
                result: r.result,
                sensitive: true,
                zero_count: zero_count
            };
            
            sensitive_rounds.push(round_info);
            temp_indices.forEach(ti => used_idx.add(ti));
            i = Math.max(...temp_indices) + 1;
        }
        
        if (sensitive_rounds.length > 0) {
            const total_zeros = sensitive_rounds.reduce((sum, r) => sum + r.zero_count, 0);
            log(`成功！嘗試 ${attempt + 1}，找到 ${sensitive_rounds.length} 個敏感局，總計 ${total_zeros} 張0點牌`, 'success');
            return sensitive_rounds;
        }
    }
    
    log('多重洗牌失敗，無法找到敏感局', 'error');
    return null;
}

// 安排敏感局成為S局
function arrange_as_s_rounds(sensitive_rounds) {
    log('開始安排敏感局成為S局...', 'info');
    
    // 按起始位置排序
    sensitive_rounds.sort((a, b) => a.start_index - b.start_index);
    
    // 為每個敏感局分配段位並控制結果
    const arranged_rounds = [];
    let banker_needed = sensitive_rounds.length; // 需要這麼多個莊家局
    
    for (let i = 0; i < sensitive_rounds.length; i++) {
        const round = sensitive_rounds[i];
        round.segment = 'A';
        
        // 這局設為非莊家結果（因為它要是S局）
        if (round.result === '莊') {
            // 需要交換來變成閒
            round.result = '閒';
            round.swapped = true;
        }
        
        arranged_rounds.push(round);
        
        // 下一局設為莊家（如果可能的話）
        if (i < sensitive_rounds.length - 1) {
            const next_round = {
                start_index: round.start_index + round.cards.length,
                cards: [], // 簡化，實際應該有牌
                result: '莊',
                segment: 'A'
            };
            arranged_rounds.push(next_round);
        }
    }
    
    log(`安排完成，共 ${arranged_rounds.length} 局`, 'success');
    return arranged_rounds;
}

// 簡化版紅色0點牌訊號邏輯
function analyze_red_zero_signals(rounds) {
    log('使用簡化版邏輯：有紅色0點牌的局 → 下一局變莊家', 'info');
    
    let adjustments = 0;
    let red_zero_rounds = 0;
    
    // 1. 遍歷所有局，實施簡化邏輯
    for (let i = 0; i < rounds.length - 1; i++) {
        const current_round = rounds[i];
        const next_round = rounds[i + 1];
        
        if (!current_round.cards) continue;
        
        const has_red_zero = current_round.cards.some(card => card.isRedZero());
        
        if (has_red_zero) {
            red_zero_rounds++;
            // 有紅色0點牌：下一局應該是莊家
            if (next_round.result !== '莊') {
                // 嘗試通過交換前兩張牌讓下一局變成莊家
                const swapped_result = swapFirstTwoCards(next_round);
                if (swapped_result === '莊') {
                    executeCardSwap(next_round);
                    const original_result = next_round.result;
                    next_round.result = '莊';
                    next_round.swapped = true;
                    adjustments++;
                    log(`第${i+1}局有紅色0點牌 → 第${i+2}局：${original_result} → 莊`, 'info');
                } else {
                    log(`第${i+1}局有紅色0點牌，但第${i+2}局無法調整為莊家`, 'warn');
                }
            } else {
                log(`第${i+1}局有紅色0點牌 → 第${i+2}局已經是莊家`, 'info');
            }
        } else {
            // 沒有紅色0點牌：如果下一局是莊家，應該改成閒家
            if (next_round.result === '莊') {
                const swapped_result = swapFirstTwoCards(next_round);
                if (swapped_result !== '莊' && swapped_result !== '和') {
                    executeCardSwap(next_round);
                    next_round.result = swapped_result;
                    next_round.swapped = true;
                    adjustments++;
                    log(`第${i+1}局無紅色0點牌 → 第${i+2}局：莊 → ${swapped_result}`, 'info');
                } else {
                    log(`第${i+1}局無紅色0點牌，但第${i+2}局無法調整為閒家`, 'warn');
                }
            }
        }
    }
    
    log(`完成調整：${adjustments} 局被修改`, 'success');
    log(`包含紅色0點牌的局數：${red_zero_rounds}`, 'info');
    
    // 2. 重新計算S局
    const s_indices = compute_sidx_for_segment(rounds, 'A');
    const analysis = {
        total_s_rounds: s_indices.length,
        s_rounds_data: [],
        total_zero_in_s: 0,
        total_red_zero_in_s: 0,
        red_zero_rounds_total: red_zero_rounds,
        target_banker_count: red_zero_rounds,
        actual_banker_count: rounds.filter(r => r.result === '莊').length,
        adjustments_made: adjustments
    };
    
    // 3. 分析S局中的0點牌
    s_indices.forEach(idx => {
        const round = rounds[idx];
        if (!round) return;
        
        const zero_cards = round.cards.filter(card => card.isZero());
        const red_zero_cards = round.cards.filter(card => card.isRedZero());
        
        analysis.s_rounds_data.push({
            round_index: idx,
            round: round,
            zero_count: zero_cards.length,
            red_zero_count: red_zero_cards.length,
            zero_cards: zero_cards,
            red_zero_cards: red_zero_cards,
            signal_value: red_zero_cards.length > 0 ? 1 : 0
        });
        
        analysis.total_zero_in_s += zero_cards.length;
        analysis.total_red_zero_in_s += red_zero_cards.length;
    });
    
    return analysis;
}

// 調整莊家局數量（通過交換前兩張牌）
function adjustBankerCount(rounds, count, direction) {
    let adjusted = 0;
    
    for (let i = 0; i < rounds.length && adjusted < count; i++) {
        const round = rounds[i];
        if (!round.cards || round.cards.length < 2) continue;
        
        // 只處理A段的敏感局
        if (round.segment !== 'A' || !round.sensitive) continue;
        
        const current_result = round.result;
        
        if (direction === 'increase' && current_result !== '莊') {
            // 需要增加莊家局：將非莊家局改為莊家局
            const swapped_result = swapFirstTwoCards(round);
            if (swapped_result === '莊') {
                executeCardSwap(round);
                round.result = '莊';
                round.swapped = true;
                adjusted++;
                log(`第${i+1}局：${current_result} → 莊 (交換前兩張牌)`, 'info');
            }
        } else if (direction === 'decrease' && current_result === '莊') {
            // 需要減少莊家局：將莊家局改為非莊家局
            const swapped_result = swapFirstTwoCards(round);
            if (swapped_result !== '莊' && swapped_result !== '和') {
                executeCardSwap(round);
                round.result = swapped_result;
                round.swapped = true;
                adjusted++;
                log(`第${i+1}局：莊 → ${swapped_result} (交換前兩張牌)`, 'info');
            }
        }
    }
    
    log(`成功調整了 ${adjusted} 局`, adjusted === count ? 'success' : 'info');
    return adjusted;
}

// 模擬交換前兩張牌的結果
function swapFirstTwoCards(round) {
    if (!round.cards || round.cards.length < 2) return null;
    
    // 創建副本進行模擬
    const temp_cards = round.cards.map(c => c.clone());
    [temp_cards[0], temp_cards[1]] = [temp_cards[1], temp_cards[0]];
    
    // 重新模擬這局
    const temp_sim = new Simulator(temp_cards);
    const temp_result = temp_sim.simulate_round(0, { no_swap: true });
    
    return temp_result ? temp_result.result : null;
}

// 執行實際的卡牌交換
function executeCardSwap(round) {
    if (!round.cards || round.cards.length < 2) return;
    [round.cards[0], round.cards[1]] = [round.cards[1], round.cards[0]];
}

// 日誌系統
function log(message, type = 'info') {
    const logArea = document.getElementById('logArea');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = `[${timestamp}] ${message}`;
    logArea.appendChild(logEntry);
    logArea.scrollTop = logArea.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 更新統計
function updateStats(data) {
    document.getElementById('totalSensitive').textContent = data.totalSensitive || 0;
    document.getElementById('sRoundsCount').textContent = data.sRoundsCount || 0;
    document.getElementById('zeroInS').textContent = data.zeroInS || 0;
    document.getElementById('redZeroInS').textContent = data.redZeroInS || 0;
    document.getElementById('bankerCount').textContent = data.bankerCount || 0;
    document.getElementById('playerCount').textContent = data.playerCount || 0;
    document.getElementById('tieCount').textContent = data.tieCount || 0;
    document.getElementById('redZeroRounds').textContent = data.redZeroRounds || 0;
}

// 渲染牌局表格
function renderRoundsTable(rounds, analysis) {
    const table = document.getElementById('roundsTable');
    const tbody = document.getElementById('roundsBody');
    
    tbody.innerHTML = '';
    
    if (!rounds || rounds.length === 0) {
        table.style.display = 'none';
        return;
    }
    
    const s_indices_set = new Set(analysis ? analysis.s_rounds_data.map(sr => sr.round_index) : []);
    
    rounds.forEach((round, index) => {
        const row = document.createElement('tr');
        const isS = s_indices_set.has(index);
        
        if (isS) {
            row.className = 's-round';
        }
        
        const zero_cards = round.cards ? round.cards.filter(card => card.isZero()) : [];
        const red_zero_cards = round.cards ? round.cards.filter(card => card.isRedZero()) : [];
        
        const cards_html = round.cards ? round.cards.map(card => {
            const classes = [];
            if (card.isZero()) classes.push('zero-card');
            if (card.isRedZero()) classes.push('red-zero');
            return `<span class="${classes.join(' ')}">${card.short()}</span>`;
        }).join(' ') : '';
        
        const next_round = rounds[index + 1];
        const next_result = next_round ? next_round.result : '';
        
        const signal_data = analysis ? analysis.s_rounds_data.find(sr => sr.round_index === index) : null;
        const signal_value = signal_data ? signal_data.signal_value : '';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${isS ? 'S局' : '一般'}</td>
            <td>${cards_html}</td>
            <td>${round.result || ''}</td>
            <td>${next_result}</td>
            <td>${zero_cards.length}</td>
            <td class="red-zero">${red_zero_cards.length}</td>
            <td>${signal_value}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    table.style.display = 'table';
}

// 全域變數
let currentRounds = null;
let currentAnalysis = null;

// 主要生成函數 - 使用完整的ABC段排列
async function generateShoe() {
    const btn = document.getElementById('generateBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    btn.disabled = true;
    analyzeBtn.disabled = true;
    
    try {
        log('開始生成牌靴...', 'info');
        
        // 1. 建立牌組
        const deck = build_shuffled_deck();
        log(`建立了 ${deck.length} 張牌的牌組`, 'info');
        
        // 2. 使用完整的ABC段排列邏輯
        const result = pack_all_sensitive_and_segment(deck);
        
        if (!result || !result.final_rounds || result.final_rounds.length === 0) {
            throw new Error('無法生成完整的ABC段');
        }
        
        currentRounds = result.final_rounds;
        
        // 3. 統計各段數量
        const a_count = result.a_rounds.length;
        const b_count = result.b_rounds.length;
        const c_count = result.c_cards.length > 0 ? 1 : 0;
        const total_count = currentRounds.length;
        
        log(`A段: ${a_count}局 (敏感局)`, 'info');
        log(`B段: ${b_count}局 (一般局)`, 'info');
        log(`C段: ${c_count}局 (殘牌)`, 'info');
        log(`總計: ${total_count}局`, 'info');
        
        // 4. 統計0點牌
        const all_zero_count = result.final_rounds.reduce((sum, round) => {
            return sum + (round.cards ? round.cards.filter(card => card.isZero()).length : 0);
        }, 0);
        
        const stats = {
            totalSensitive: a_count,
            sRoundsCount: 0, // 需要後續計算S局
            zeroInS: 0,
            redZeroInS: 0
        };
        
        updateStats({
            totalSensitive: a_count,
            sRoundsCount: '-',
            zeroInS: all_zero_count,
            redZeroInS: '-',
            bankerCount: result.final_rounds.filter(r => r.result === '莊').length,
            playerCount: result.final_rounds.filter(r => r.result === '閒').length,
            tieCount: result.final_rounds.filter(r => r.result === '和').length,
            redZeroRounds: '-'
        });
        
        renderRoundsTable(currentRounds, null);
        
        analyzeBtn.disabled = false;
        log('牌靴生成完成！點擊「分析S局訊號」查看詳細結果', 'success');
        
    } catch (error) {
        log(`生成失敗: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
    }
}

// 分析S局訊號
async function analyzeSignals() {
    if (!currentRounds) {
        log('請先生成牌靴', 'error');
        return;
    }
    
    log('開始分析S局訊號...', 'info');
    
    try {
        // 分析紅色0點牌訊號並調整莊家局數量
        currentAnalysis = analyze_red_zero_signals(currentRounds);
        
        const stats = {
            totalSensitive: document.getElementById('totalSensitive').textContent,
            sRoundsCount: currentAnalysis.total_s_rounds,
            zeroInS: currentAnalysis.total_zero_in_s,
            redZeroInS: currentAnalysis.total_red_zero_in_s,
            bankerCount: currentRounds.filter(r => r.result === '莊').length,
            playerCount: currentRounds.filter(r => r.result === '閒').length,
            tieCount: currentRounds.filter(r => r.result === '和').length,
            redZeroRounds: currentAnalysis.red_zero_rounds_total
        };
        
        updateStats(stats);
        renderRoundsTable(currentRounds, currentAnalysis);
        
        log(`分析完成！`, 'success');
        log(`包含紅色0點牌的局數: ${currentAnalysis.red_zero_rounds_total}`, 'info');
        log(`調整局數: ${currentAnalysis.adjustments_made}`, 'info');
        log(`實際莊家局數: ${currentAnalysis.actual_banker_count}`, 'info');
        log(`S局數量: ${currentAnalysis.total_s_rounds}`, 'info');
        log(`S局中紅色0點牌: ${currentAnalysis.total_red_zero_in_s}`, 'info');
        
        // 顯示詳細訊號資訊
        currentAnalysis.s_rounds_data.forEach(sr => {
            if (sr.signal_value > 0) {
                log(`第${sr.round_index + 1}局(S局): 訊號值=${sr.signal_value}, 紅色0點牌=${sr.red_zero_cards.map(c => c.short()).join(',')}`, 'info');
            }
        });
        
    } catch (error) {
        log(`分析失敗: ${error.message}`, 'error');
    }
}

// 清空
function clearAll() {
    currentRounds = null;
    currentAnalysis = null;
    
    updateStats({
        totalSensitive: 0,
        sRoundsCount: 0,
        zeroInS: 0,
        redZeroInS: 0,
        bankerCount: 0,
        playerCount: 0,
        tieCount: 0,
        redZeroRounds: 0
    });
    
    document.getElementById('roundsTable').style.display = 'none';
    document.getElementById('logArea').innerHTML = '';
    document.getElementById('analyzeBtn').disabled = true;
    
    log('已清空所有資料', 'info');
}

// 綁定事件
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('generateBtn').addEventListener('click', generateShoe);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeSignals);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    
    log('紅色0點牌訊號系統測試初始化完成', 'success');
});

// 完整複製原系統的ABC段排列邏輯
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
    const MULTI_PASS_MIN_CARDS = 6;
    let multi_pass_attempts = 0;
    
    while (true) {
        const remaining = deck.filter(c => !used_pos.has(c.pos));
        if (remaining.length < MULTI_PASS_MIN_CARDS) break;
        
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
        c_round = {
            start_index: c_start_index,
            cards: c_cards,
            result: '殘牌',
            sensitive: false,
            segment: 'C'
        };
    }
    
    // 合併所有段落
    const final_rounds = [...a_rounds, ...b_rounds, ...(c_round ? [c_round] : [])];
    
    // 取得所有卡牌
    const final_card_deck = final_rounds.flatMap(r => r.cards);
    
    log(`A段: ${a_rounds.length}局, B段: ${b_rounds.length}局, C段: ${c_round ? 1 : 0}局`, 'info');
    
    return {
        a_rounds,
        b_rounds, 
        c_cards,
        final_rounds,
        final_card_deck
    };
}

// 完整複製多重洗牌邏輯
function multi_pass_candidates_from_cards_simple(card_pool) {
    if (card_pool.length < 4) return [];
    
    // 複製一份牌池並隨機洗牌    
    let shuffled = [...card_pool];
    shuffle(shuffled);   
    
    const temp_cards = shuffled.map((c, i) => c.clone(i));
    const idx2orig = new Map(shuffled.map((c, i) => [i, c]));
    const temp_sim = new Simulator(temp_cards);
    
    const out = []; 
    const used_idx = new Set();
    let i = 0;
    
    while (i < temp_cards.length - 3) {       
        if (used_idx.has(i)) { i++; continue; }
        
        const r = temp_sim.simulate_round(i); 
        if (!r) { i++; continue; }
        
        const temp_indices = r.cards.map(c => c.pos);
        if (temp_indices.some(ti => used_idx.has(ti))) { i++; continue; }
        
        if (!r.sensitive) { i += r.cards.length; continue; } 
        
        // 準備把臨時卡牌對照回原始卡牌     
        const ordered = [];
        const seen = new Set();
        let valid = true;
        
        for (const ti of temp_indices) {
            const oc = idx2orig.get(ti);
            if (seen.has(oc.pos)) { valid = false; break; }
            ordered.push(oc); 
            seen.add(oc.pos);
        }
        
        if (!valid) { i++; continue; }
        
        const start_pos = ordered[0].pos;
        out.push({
            start_index: start_pos,
            cards: ordered,
            result: r.result,
            sensitive: true
        });
        
        temp_indices.forEach(ti => used_idx.add(ti));
        i = Math.max(...temp_indices) + 1;
    }
   
    return out;
}

// 完整複製B/C段建立邏輯
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
                const original_round = {
                    start_index: original_cards[0].pos,
                    cards: original_cards,
                    result: r.result,
                    sensitive: false,
                    segment: 'B'
                };
                
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