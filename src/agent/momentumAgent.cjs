// src/agent/momentumAgent.cjs
// Syntra Agent v17 - TWAK via direct Node require
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
dotenv.config();
const PASSWORD = process.env.TWAK_WALLET_PASSWORD;
const AGENT_ADDRESS = process.env.AGENT_ADDRESS || '0x204b13fe30C141cfA4E8a3D6136aA3391db846C2';
const BSC_RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org/';
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
const TWAK_CMD = 'npx @trustwallet/cli';
const STATE_FILE = path.join(__dirname, '..', '..', 'agent-state.json');
const CONTROL_FILE = path.join(__dirname, '..', '..', 'agent-control.json');
const HISTORY_FILE = path.join(__dirname, '..', '..', 'trade-history.json');
const CYCLE_SECONDS = 15;
const COOLDOWN_SECONDS = 30;
const MAX_TRADE_BNB = 0.0002;
const TRADE_PAIRS = ['USDT', 'ETH', 'USDC'];
// ============================================
// BALANCE
// ============================================
async function getBnbBalance() {
  try {
    const balance = await provider.getBalance(AGENT_ADDRESS);
    const bnb = parseFloat(ethers.utils.formatEther(balance));
    let usd = bnb * 580;
    try {
      const priceFeed = new ethers.Contract(
        '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
        ['function latestAnswer() view returns (int256)'],
        provider
      );
      const price = await priceFeed.latestAnswer();
      usd = bnb * parseFloat(ethers.utils.formatUnits(price, 8));
    } catch (e) {}
    return { bnb, usd };
  } catch (e) {
    return { bnb: 0, usd: 0 };
  }
}
// ============================================
// SWAP VIA TWAK (direct Node call)
// ============================================
function twakSwap(amount, fromToken, toToken) {
  try {
    const cmd = TWAK_CMD + ' swap ' + amount + ' ' + fromToken + ' ' + toToken + ' --chain bsc --password "' + PASSWORD + '" --slippage 1 --json';
    const result = execSync(cmd, { encoding: 'utf8', timeout: 60000, env: { ...process.env } });
    const parsed = JSON.parse(result);
    const hash = parsed.txHash || parsed.transactionHash || parsed.hash;
    if (hash) return { success: true, txHash: hash, output: parsed.output };
    return { success: false, error: parsed.error || JSON.stringify(parsed) };
  } catch (e) {
    try { 
      const err = JSON.parse(e.stdout || e.stderr || '{}');
      return { success: false, error: err.error || e.message };
    } catch { 
      return { success: false, error: e.message }; 
    }
  }
}
// ============================================
// HISTORY
// ============================================
function loadHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch (e) {}
  return { trades: [], totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, lastTradeTime: 0 };
}
function saveHistory(h) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); }
let history = loadHistory();
// ============================================
// STATE
// ============================================
let agentState = {
  running: false, agent: { address: AGENT_ADDRESS, configured: true },
  market: { btc: 0 }, trades: history.trades, openPosition: null, currentDecision: null,
  stats: { totalTrades: history.totalTrades, wins: history.wins, losses: history.losses, pnl: history.totalPnl, winRate: 0 },
  topMomentum: [], bnbBalance: 0, usdtBalance: 0, usdValue: 0, lastUpdate: null, _logs: []
};
function saveState() {
  agentState.lastUpdate = new Date().toISOString();
  agentState.trades = history.trades;
  agentState.stats.totalTrades = history.totalTrades;
  agentState.stats.wins = history.wins;
  agentState.stats.losses = history.losses;
  agentState.stats.pnl = history.totalPnl;
  if (history.totalTrades > 0) agentState.stats.winRate = ((history.wins / history.totalTrades) * 100).toFixed(1);
  fs.writeFileSync(STATE_FILE, JSON.stringify(agentState, null, 2));
}
function addLog(type, message) {
  agentState._logs.unshift({ id: Date.now() + Math.random(), type, message, timestamp: Date.now() });
  if (agentState._logs.length > 100) agentState._logs = agentState._logs.slice(0, 100);
  console.log('  [' + type + '] ' + message);
}
// ============================================
// CONTROL
// ============================================
let tradingActive = true;
function checkControl() {
  try {
    if (fs.existsSync(CONTROL_FILE)) {
      const control = JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
      if (Date.now() - control.timestamp < 10000) {
        if (control.action === 'start' && !tradingActive) {
          tradingActive = true; agentState.running = true; saveState();
          addLog('system', 'STARTED');
          fs.writeFileSync(CONTROL_FILE, JSON.stringify({ action: 'none', timestamp: 0 }));
        }
        if (control.action === 'stop' && tradingActive) {
          tradingActive = false; agentState.running = false; saveState();
          addLog('system', 'STOPPED');
          fs.writeFileSync(CONTROL_FILE, JSON.stringify({ action: 'none', timestamp: 0 }));
        }
      }
    }
  } catch (e) {}
}
// ============================================
// MAIN LOOP
// ============================================
async function cycle() {
  checkControl();
  if (!tradingActive) { agentState.running = false; saveState(); return; }
  agentState.running = true;
  const bnbData = await getBnbBalance();
  agentState.bnbBalance = bnbData.bnb;
  agentState.usdValue = bnbData.usd;
  agentState.market.btc = bnbData.usd > 0 ? (bnbData.usd / 0.005) : 0;
  if (agentState.openPosition) {
    const heldSecs = (Date.now() - agentState.openPosition.entryTime) / 1000;
    console.log('  Holding: ' + agentState.openPosition.symbol + ' (' + heldSecs.toFixed(0) + 's)');
    if (heldSecs >= 60) {
      addLog('position_close', 'Closing ' + agentState.openPosition.symbol);
      const result = twakSwap(agentState.openPosition.amount + '', agentState.openPosition.symbol, 'BNB');
      if (result.success) {
        history.wins++;
        history.trades.push({ ...agentState.openPosition, result: 'CLOSED', closeTx: result.txHash });
        agentState.openPosition = null;
        addLog('trade_approved', 'Closed: ' + result.txHash);
      }
    }
    saveHistory(history); saveState();
    return;
  }
  console.log('CYCLE | BNB: ' + bnbData.bnb.toFixed(6) + ' | $' + bnbData.usd.toFixed(2) + ' | Trades: ' + history.totalTrades);
  if (bnbData.bnb < 0.0005) { addLog('trade_blocked', 'BNB too low'); saveState(); return; }
  const sinceLast = Date.now() - history.lastTradeTime;
  if (history.lastTradeTime > 0 && sinceLast < COOLDOWN_SECONDS * 1000) { saveState(); return; }
  const target = TRADE_PAIRS[history.totalTrades % TRADE_PAIRS.length];
  addLog('signal_buy', 'BUY ' + target + ' | ' + MAX_TRADE_BNB.toFixed(6) + ' BNB');
  const result = twakSwap(MAX_TRADE_BNB.toFixed(6), 'BNB', target);
  if (result.success) {
    history.totalTrades++;
    history.lastTradeTime = Date.now();
    agentState.openPosition = { symbol: target, entryTime: Date.now(), amount: MAX_TRADE_BNB.toFixed(6), txHash: result.txHash };
    history.trades.push({ ...agentState.openPosition, result: 'OPEN' });
    saveHistory(history);
    addLog('trade_approved', result.txHash);
    addLog('position_open', target + ' | close in 60s');
  } else {
    addLog('trade_blocked', target + ': ' + (result.error || 'failed').substring(0, 80));
  }
  saveState();
}
// ============================================
// START
// ============================================
console.log('========================================');
console.log('  SYNTA v17 - TWAK via direct Node call');
console.log('  CMD: ' + TWAK_CMD);
console.log('========================================');
fs.writeFileSync(CONTROL_FILE, JSON.stringify({ action: 'none', timestamp: 0 }));
saveState();
setInterval(checkControl, 2000);
addLog('system', 'v17 - TWAK direct');
cycle();
setInterval(cycle, CYCLE_SECONDS * 1000);
process.on('SIGINT', function() {
  agentState.running = false;
  saveHistory(history); saveState();
  process.exit(0);
});
