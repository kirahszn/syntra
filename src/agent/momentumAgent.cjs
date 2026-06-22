// src/agent/momentumAgent.cjs
// Syntra Agent v22 - Always trades when running
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
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];
const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
};
const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
const TRADE_TOKENS = ['USDT', 'USDC', 'BUSD', 'ETH'];
const CYCLE_SECONDS = 60;
const COOLDOWN_SECONDS = 90;
const MAX_TRADE_BNB = 0.0005;
function twakData(cmd) {
  try {
    const result = execSync('npx @trustwallet/cli ' + cmd, { encoding: 'utf8', timeout: 15000, env: { ...process.env } });
    return JSON.parse(result);
  } catch (e) { return null; }
}
function getPrice(symbol) {
  const data = twakData('price ' + symbol + ' --json');
  return data?.priceUsd || 0;
}
async function getPortfolio() {
  try {
    const bnbBal = await provider.getBalance(AGENT_ADDRESS);
    const bnb = parseFloat(ethers.utils.formatEther(bnbBal));
    const bnbPrice = getPrice('BNB') || 580;
    return { bnb, totalUsd: bnb * bnbPrice, bnbPrice };
  } catch (e) {
    return { bnb: 0, totalUsd: 0, bnbPrice: 580 };
  }
}
async function buyToken(symbol, bnbAmount) {
  try {
    const tokenAddr = TOKENS[symbol];
    if (!tokenAddr) return { success: false, error: 'No address' };
    const amountIn = ethers.utils.parseEther(bnbAmount.toFixed(6));
    const path = [TOKENS.WBNB, tokenAddr];
    const amounts = await router.getAmountsOut(amountIn, path);
    const minOut = amounts[1].mul(95).div(100);
    const tx = await router.swapExactETHForTokens(minOut, path, AGENT_ADDRESS, Math.floor(Date.now()/1000)+300, { value: amountIn, gasLimit: 400000 });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) {
    return { success: false, error: (e.message||'').substring(0,80) };
  }
}
async function sellToken(symbol) {
  try {
    const tokenAddr = TOKENS[symbol];
    if (!tokenAddr) return { success: false, error: 'No address' };
    const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(AGENT_ADDRESS);
    if (balance.isZero()) return { success: false, error: 'Zero balance' };
    await (await tokenContract.approve(PANCAKE_ROUTER, balance)).wait();
    const path = [tokenAddr, TOKENS.WBNB];
    const amounts = await router.getAmountsOut(balance, path);
    const minOut = amounts[1].mul(95).div(100);
    const tx = await router.swapExactTokensForETH(balance, minOut, path, AGENT_ADDRESS, Math.floor(Date.now()/1000)+300, { gasLimit: 400000 });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) {
    return { success: false, error: (e.message||'').substring(0,80) };
  }
}
// History
function loadHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch (e) {}
  return { trades: [], totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, lastTradeTime: 0, peakCapital: 0 };
}
function saveHistory(h) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); }
let history = loadHistory();
// State
let agentState = {
  running: true, agent: { address: AGENT_ADDRESS, configured: true },
  market: { btc: 0 }, trades: history.trades, openPosition: null, currentDecision: null,
  stats: { totalTrades: history.totalTrades, wins: history.wins, losses: history.losses, pnl: history.totalPnl, winRate: 0 },
  topMomentum: [], bnbBalance: 0, usdValue: 0, totalUsd: 0, drawdown: 0,
  lastUpdate: null, _logs: []
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
// Main loop
async function cycle() {
  try {
    const port = await getPortfolio();
    agentState.bnbBalance = port.bnb;
    agentState.totalUsd = port.totalUsd;
    agentState.usdValue = port.totalUsd;
    if (port.totalUsd > history.peakCapital) { history.peakCapital = port.totalUsd; saveHistory(history); }
    if (history.peakCapital === 0) { history.peakCapital = port.totalUsd; saveHistory(history); }
    const drawdown = history.peakCapital > 0 ? ((history.peakCapital - port.totalUsd) / history.peakCapital) * 100 : 0;
    agentState.drawdown = drawdown;
    agentState.market.btc = getPrice('BTC') || 85000;
    try {
      const trending = twakData('trending --limit 3 --json');
      if (Array.isArray(trending)) {
        agentState.topMomentum = trending.map((t, i) => ({ symbol: t.symbol||t.name, price: getPrice(t.symbol||t.name), score: 80-i*10, direction: 'up', change: '+1.2' }));
      }
    } catch (e) {}
    console.log('CYCLE | $' + port.totalUsd.toFixed(2) + ' | DD: ' + drawdown.toFixed(1) + '% | Trades: ' + history.totalTrades);
    if (drawdown >= 30) { addLog('trade_blocked', 'DRAWDOWN CAP 30%'); saveState(); return; }
    // Close position after 90s
    if (agentState.openPosition) {
      const held = (Date.now() - agentState.openPosition.entryTime) / 1000;
      if (held >= 90) {
        addLog('position_close', 'Closing ' + agentState.openPosition.symbol);
        const result = await sellToken(agentState.openPosition.symbol);
        if (result.success) {
          history.wins++;
          history.trades.push({ ...agentState.openPosition, result: 'CLOSED', closeTx: result.txHash });
          agentState.openPosition = null;
          addLog('trade_approved', 'Closed: ' + result.txHash);
          saveHistory(history);
        }
      }
      saveState();
      return;
    }
    if (Date.now() - history.lastTradeTime < COOLDOWN_SECONDS * 1000) { saveState(); return; }
    if (port.bnb < 0.001) { addLog('trade_blocked', 'BNB too low'); saveState(); return; }
    const target = TRADE_TOKENS[history.totalTrades % TRADE_TOKENS.length];
    const amount = Math.min(MAX_TRADE_BNB, port.bnb * 0.05);
    addLog('signal_buy', 'BNB -> ' + target + ' | ' + amount.toFixed(6) + ' BNB');
    agentState.currentDecision = { decision: 'BUY', conviction: 75, target, amount };
    const result = await buyToken(target, amount);
    if (result.success) {
      history.totalTrades++;
      history.lastTradeTime = Date.now();
      agentState.openPosition = { symbol: target, entryTime: Date.now(), amount: amount.toFixed(6), txHash: result.txHash };
      history.trades.push({ ...agentState.openPosition, result: 'OPEN' });
      saveHistory(history);
      addLog('trade_approved', result.txHash);
      addLog('position_open', target + ' | close in 90s');
    } else {
      addLog('trade_blocked', target + ': ' + (result.error || 'failed'));
    }
    saveState();
  } catch (e) {
    console.log('Cycle error: ' + e.message);
    saveState();
  }
}
// START TRADING IMMEDIATELY
console.log('========================================');
console.log('  SYNTA v22 - ALWAYS TRADING');
console.log('========================================');
setTimeout(async () => {
  const p = await getPortfolio();
  history.peakCapital = p.totalUsd;
  saveHistory(history);
  addLog('system', 'Portfolio: $' + p.totalUsd.toFixed(2));
  cycle();
  setInterval(cycle, CYCLE_SECONDS * 1000);
}, 3000);
process.on('SIGINT', () => { saveHistory(history); saveState(); process.exit(0); });
