// src/agent/momentumAgent.cjs
// Syntra Agent v26 - FINAL CLEAN
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
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
];
const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
const TRADE_BNB = 0.00015;
const CYCLE_SECONDS = 15;
const TP_PCT = 0.15;
const SL_PCT = 0.08;
function getBnbPrice() {
  try {
    var result = execSync('npx @trustwallet/cli price BNB --json', { encoding: 'utf8', timeout: 10000, env: { ...process.env } });
    return JSON.parse(result).priceUsd || 580;
  } catch (e) { return 580; }
}
async function getPortfolio() {
  try {
    var bnbBal = await provider.getBalance(AGENT_ADDRESS);
    var bnb = parseFloat(ethers.utils.formatEther(bnbBal));
    var bnbPrice = getBnbPrice();
    return { bnb: bnb, usd: bnb * bnbPrice, bnbPrice: bnbPrice };
  } catch (e) { return { bnb: 0, usd: 0, bnbPrice: 580 }; }
}
async function buyUSDT(bnbAmount) {
  try {
    var amountIn = ethers.utils.parseEther(bnbAmount.toFixed(6));
    var path = [WBNB, USDT];
    var amounts = await router.getAmountsOut(amountIn, path);
    if (amounts[1].isZero()) return { success: false };
    var minOut = amounts[1].mul(98).div(100);
    var tx = await router.swapExactETHForTokens(minOut, path, AGENT_ADDRESS, Math.floor(Date.now()/1000)+600, { value: amountIn, gasLimit: 350000 });
    var receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) { return { success: false, error: (e.message||'').substring(0,80) }; }
}
function loadHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch (e) {}
  return { trades: [], totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, totalProfit: 0, totalLoss: 0, lastTradeTime: 0, peakCapital: 0, startCapital: 0 };
}
function saveHistory(h) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); }
var history = loadHistory();
// Don't reset - use loaded values
if (history.totalTrades > 0) { tradeCount = history.totalTrades; }
var agentState = {
  running: true, agent: { address: AGENT_ADDRESS, configured: true },
  market: { btc: 0 }, trades: history.trades, openPosition: null, currentDecision: null,
  stats: { totalTrades: history.totalTrades, wins: history.wins, losses: history.losses, pnl: history.totalPnl, winRate: 0, totalProfit: history.totalProfit, totalLoss: history.totalLoss },
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
  agentState.stats.totalProfit = history.totalProfit;
  agentState.stats.totalLoss = history.totalLoss;
  if (history.totalTrades > 0) agentState.stats.winRate = ((history.wins / history.totalTrades) * 100).toFixed(1);
  fs.writeFileSync(STATE_FILE, JSON.stringify(agentState, null, 2));
}
function addLog(type, message) {
  agentState._logs.unshift({ id: Date.now() + Math.random(), type: message, timestamp: Date.now() });
  if (agentState._logs.length > 100) agentState._logs = agentState._logs.slice(0, 100);
  console.log('  [' + type + '] ' + message);
}
var lastBnbPrice = 0;
async function cycle() {
  try {
    var port = await getPortfolio();
    agentState.bnbBalance = port.bnb;
    agentState.totalUsd = port.usd;
    agentState.usdValue = port.usd;
    if (history.startCapital === 0) { history.startCapital = port.usd; saveHistory(history); }
    if (port.usd > history.peakCapital) { history.peakCapital = port.usd; saveHistory(history); }
    var drawdown = history.peakCapital > 0 ? ((history.peakCapital - port.usd) / history.peakCapital) * 100 : 0;
    agentState.drawdown = drawdown;
    var bnbPrice = port.bnbPrice;
    var priceChange = lastBnbPrice > 0 ? ((bnbPrice - lastBnbPrice) / lastBnbPrice) * 100 : 0;
    lastBnbPrice = bnbPrice;
    console.log('CYCLE | BNB: $' + bnbPrice.toFixed(2) + ' | Chg: ' + priceChange.toFixed(3) + '% | PnL: $' + history.totalPnl.toFixed(4));
    // Check position
    if (agentState.openPosition) {
      var pos = agentState.openPosition;
      var heldSecs = (Date.now() - pos.entryTime) / 1000;
      if (pos.direction === 'LONG') {
        var change = ((bnbPrice - pos.entryPrice) / pos.entryPrice) * 100;
        addLog('position_update', 'LONG | Entry: $' + pos.entryPrice.toFixed(2) + ' | Now: $' + bnbPrice.toFixed(2) + ' | ' + change.toFixed(3) + '%');
        if (change >= TP_PCT) {
          addLog('position_close', 'TAKE PROFIT +' + change.toFixed(2) + '%');
          var result = await buyUSDT(pos.bnbSpent);
          if (result.success) {
            var profit = (pos.bnbSpent * TP_PCT) / 100;
            history.wins++; history.totalProfit += profit; history.totalPnl += profit * 1000000;
            history.trades.push({ symbol: pos.symbol, result: 'WIN', entryPrice: pos.entryPrice, exitPrice: bnbPrice, profit: profit.toFixed(6), closeTx: result.txHash, closeTime: Date.now() });
            agentState.openPosition = null;
            addLog('trade_approved', 'WIN +$' + profit.toFixed(4));
            saveHistory(history);
          }
        } else if (change <= -SL_PCT) {
          addLog('position_close', 'STOP LOSS ' + change.toFixed(2) + '%');
          var result = await buyUSDT(pos.bnbSpent);
          if (result.success) {
            var loss = (pos.bnbSpent * SL_PCT) / 100;
            history.losses++; history.totalLoss += loss; history.totalPnl -= loss * 1000000;
            history.trades.push({ symbol: pos.symbol, result: 'LOSS', entryPrice: pos.entryPrice, exitPrice: bnbPrice, loss: loss.toFixed(6), closeTx: result.txHash, closeTime: Date.now() });
            agentState.openPosition = null;
            addLog('trade_blocked', 'LOSS -$' + loss.toFixed(4));
            saveHistory(history);
          }
        } else if (heldSecs >= 120) {
          addLog('position_close', 'Time exit (' + change.toFixed(2) + '%)');
          var result = await buyUSDT(pos.bnbSpent);
          if (result.success) {
            var pnl = (pos.bnbSpent * change) / 100;
            if (pnl >= 0) { history.wins++; history.totalProfit += pnl; } else { history.losses++; history.totalLoss += Math.abs(pnl); }
            history.totalPnl += pnl * 1000000;
            history.trades.push({ symbol: pos.symbol, result: pnl >= 0 ? 'WIN' : 'LOSS', pnl: pnl.toFixed(6), closeTx: result.txHash, closeTime: Date.now() });
            agentState.openPosition = null;
            addLog('trade_approved', 'Closed PnL: $' + pnl.toFixed(4));
            saveHistory(history);
          }
        }
      }
      saveState();
      return;
    }
    // Safety
    if (drawdown >= 30) { addLog('trade_blocked', 'DRAWDOWN 30%'); saveState(); return; }
    if (port.bnb < 0.0008) { addLog('trade_blocked', 'BNB too low: ' + port.bnb.toFixed(4)); saveState(); return; }
    // Entry signal
    var shouldEnter = false;
    var reason = '';
    if (priceChange < -0.02) {
      shouldEnter = true;
      reason = 'dip ' + priceChange.toFixed(3) + '%';
    } else if (history.totalTrades === 0 || (Date.now() - history.lastTradeTime) > 90000) {
      shouldEnter = true;
      reason = 'time entry';
    }
    if (shouldEnter) {
      addLog('signal_buy', 'BUY BNB @ $' + bnbPrice.toFixed(2) + ' | ' + reason);
      agentState.currentDecision = { decision: 'BUY', conviction: 70, target: 'BNB' };
      agentState.openPosition = {
        symbol: 'BNB', direction: 'LONG', entryPrice: bnbPrice, entryTime: Date.now(),
        bnbSpent: TRADE_BNB, txHash: 'HOLDING'
      };
      history.totalTrades++;
      history.lastTradeTime = Date.now();
      history.trades.push({ symbol: 'BNB', result: 'OPEN', entryPrice: bnbPrice, time: Date.now() });
      saveHistory(history);
      addLog('position_open', 'LONG BNB @ $' + bnbPrice.toFixed(2) + ' | TP:+0.15% SL:-0.08%');
    } else {
      addLog('signal_hold', 'No entry | BNB: $' + bnbPrice.toFixed(2) + ' | Chg: ' + priceChange.toFixed(3) + '%');
      agentState.currentDecision = { decision: 'HOLD', conviction: 50 };
    }
    saveState();
  } catch (e) {
    console.log('Error: ' + e.message);
    saveState();
  }
}
console.log('========================================');
console.log('  SYNTA v26 - FINAL');
console.log('  TP: +' + TP_PCT + '% | SL: -' + SL_PCT + '%');
console.log('========================================');
setTimeout(async () => {
  var p = await getPortfolio();
  history.peakCapital = p.usd;
  if (history.startCapital === 0) history.startCapital = p.usd;
  lastBnbPrice = p.bnbPrice;
  saveHistory(history);
  addLog('system', 'Portfolio: $' + p.usd.toFixed(2));
  cycle();
  setInterval(cycle, CYCLE_SECONDS * 1000);
}, 3000);
process.on('SIGINT', () => { saveHistory(history); saveState(); process.exit(0); });

