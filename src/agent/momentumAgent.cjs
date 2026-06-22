// src/agent/momentumAgent.cjs
// Syntra Agent FINAL - Clean, stable, won't drain
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
dotenv.config();
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const AGENT_ADDRESS = process.env.AGENT_ADDRESS || '0x204b13fe30C141cfA4E8a3D6136aA3391db846C2';
const BSC_RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org/';
const provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const STATE_FILE = path.join(__dirname, '..', '..', 'agent-state.json');
const HISTORY_FILE = path.join(__dirname, '..', '..', 'trade-history.json');
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
];
// ONLY these tokens - verified BSC liquidity
const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
};
const TRADE_TOKENS = ['USDT', 'USDC', 'BUSD'];
const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
// CONSERVATIVE SETTINGS
const MIN_BNB_RESERVE = 0.002;    // Keep at least 0.002 BNB for gas
const TRADE_BNB = 0.0003;         // Tiny trades ~.18
const CYCLE_SECONDS = 30;        // Check every 5 minutes
const MAX_TRADES = 10;            // Max 10 trades total
// ============================================
// BALANCE
// ============================================
async function getPortfolio() {
  try {
    const bnbBal = await provider.getBalance(AGENT_ADDRESS);
    const bnb = parseFloat(ethers.utils.formatEther(bnbBal));
    return { bnb, usd: bnb * 580 };
  } catch (e) {
    return { bnb: 0, usd: 0 };
  }
}
// ============================================
// SWAP (safe, with pre-check)
// ============================================
async function safeSwap(symbol) {
  try {
    const tokenAddr = TOKENS[symbol];
    if (!tokenAddr) return { success: false, error: 'No address' };
    const amountIn = ethers.utils.parseEther(TRADE_BNB.toFixed(6));
    const path = [TOKENS.WBNB, tokenAddr];
    // Check liquidity first
    let amounts;
    try {
      amounts = await router.getAmountsOut(amountIn, path);
      if (amounts[1].isZero()) return { success: false, error: 'No liquidity' };
    } catch (e) {
      return { success: false, error: 'No pool' };
    }
    const minOut = amounts[1].mul(95).div(100);
    const tx = await router.swapExactETHForTokens(
      minOut, path, AGENT_ADDRESS, Math.floor(Date.now()/1000)+600,
      { value: amountIn, gasLimit: 350000 }
    );
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) {
    return { success: false, error: (e.message||'').substring(0,80) };
  }
}
// ============================================
// HISTORY
// ============================================
function loadHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch (e) {}
  return { trades: [], totalTrades: 0, lastTradeTime: 0, peakCapital: 0 };
}
function saveHistory(h) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); }
let history = loadHistory();
// ============================================
// STATE
// ============================================
let agentState = {
  running: true, agent: { address: AGENT_ADDRESS, configured: true },
  market: { btc: 0 }, trades: history.trades, openPosition: null,
  stats: { totalTrades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0 },
  topMomentum: [], bnbBalance: 0, usdValue: 0, totalUsd: 0, drawdown: 0,
  lastUpdate: null, _logs: []
};
function saveState() {
  agentState.lastUpdate = new Date().toISOString();
  agentState.trades = history.trades;
  agentState.stats.totalTrades = history.totalTrades;
  if (history.totalTrades > 0) agentState.stats.winRate = ((history.wins / history.totalTrades) * 100).toFixed(1);
  fs.writeFileSync(STATE_FILE, JSON.stringify(agentState, null, 2));
}
function addLog(type, message) {
  agentState._logs.unshift({ id: Date.now(), type, message, timestamp: Date.now() });
  if (agentState._logs.length > 50) agentState._logs = agentState._logs.slice(0, 50);
  console.log('  [' + type + '] ' + message);
}
// ============================================
// MAIN LOOP
// ============================================
async function cycle() {
  try {
    const port = await getPortfolio();
    agentState.bnbBalance = port.bnb;
    agentState.totalUsd = port.usd;
    agentState.usdValue = port.usd;
    if (port.usd > history.peakCapital) { history.peakCapital = port.usd; saveHistory(history); }
    if (history.peakCapital === 0) { history.peakCapital = port.usd; saveHistory(history); }
    const drawdown = history.peakCapital > 0 ? ((history.peakCapital - port.usd) / history.peakCapital) * 100 : 0;
    agentState.drawdown = drawdown;
    agentState.market.btc = 85000;
    console.log('CYCLE | BNB: ' + port.bnb.toFixed(4) + ' | $' + port.usd.toFixed(2) + ' | DD: ' + drawdown.toFixed(1) + '% | Trades: ' + history.totalTrades);
    // SAFETY CHECKS
    if (drawdown >= 30) { addLog('trade_blocked', 'DRAWDOWN 30% - HALTED'); saveState(); return; }
    if (history.totalTrades >= MAX_TRADES) { addLog('system', 'Max trades reached'); saveState(); return; }
    if (port.bnb < MIN_BNB_RESERVE + TRADE_BNB) { addLog('trade_blocked', 'BNB reserve too low'); saveState(); return; }
    // Cooldown 5 min
    if (Date.now() - history.lastTradeTime < CYCLE_SECONDS * 1000) { saveState(); return; }
    // TRADE
    const target = TRADE_TOKENS[history.totalTrades % TRADE_TOKENS.length];
    addLog('signal_buy', target + ' | ' + TRADE_BNB.toFixed(4) + ' BNB');
    const result = await safeSwap(target);
    if (result.success) {
      history.totalTrades++;
      history.lastTradeTime = Date.now();
      history.trades.push({ symbol: target, amount: TRADE_BNB, txHash: result.txHash, time: Date.now(), result: 'OPEN' });
      saveHistory(history);
      addLog('trade_approved', result.txHash);
      addLog('position_open', target + ' held');
    } else {
      addLog('trade_blocked', target + ': ' + (result.error || 'failed'));
    }
    saveState();
  } catch (e) {
    console.log('Error: ' + e.message);
    saveState();
  }
}
// ============================================
// START
// ============================================
console.log('========================================');
console.log('  SYNTA FINAL - Safe Mode');
console.log('  Min BNB: ' + MIN_BNB_RESERVE + ' | Trade: ' + TRADE_BNB);
console.log('  Max trades: ' + MAX_TRADES + ' | Cycle: ' + CYCLE_SECONDS + 's');
console.log('========================================');
setTimeout(async () => {
  const p = await getPortfolio();
  history.peakCapital = p.usd;
  saveHistory(history);
  addLog('system', 'Portfolio: $' + p.usd.toFixed(2));
  cycle();
  setInterval(cycle, CYCLE_SECONDS * 1000);
}, 3000);
process.on('SIGINT', () => { saveHistory(history); saveState(); process.exit(0); });
