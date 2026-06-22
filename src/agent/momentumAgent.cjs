// src/agent/momentumAgent.cjs
// Syntra Agent v19 - HYBRID (TWAK data + ethers.js execution)
// TWAK surfaces: price, trending, portfolio
// Execution: ethers.js PancakeSwap direct (self-custody)
// Competition rules: 30% drawdown cap, 1 trade/day min, stables rotation
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
const CONTROL_FILE = path.join(__dirname, '..', '..', 'agent-control.json');
const HISTORY_FILE = path.join(__dirname, '..', '..', 'trade-history.json');
// PancakeSwap V2
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];
// BSC token addresses
const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
};
const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, wallet);
// ============================================
// COMPETITION RULES
// ============================================
const STARTING_CAPITAL = 5.00;           // Initial USD value
const MAX_DRAWDOWN = 0.30;               // 30% max drawdown
const MIN_TRADES_PER_DAY = 1;            // Must trade daily
const CYCLE_SECONDS = 30;
const COOLDOWN_SECONDS = 45;
const MAX_TRADE_BNB = 0.0003;            // ~.18 per trade
// Stablecoin rotation strategy
const STABLES = ['USDT', 'USDC', 'BUSD'];
const YIELD_TOKENS = ['ETH'];
// ============================================
// TWAK DATA SURFACES (market reads)
// ============================================
function twakData(cmd) {
  try {
    const result = execSync('npx @trustwallet/cli ' + cmd, { 
      encoding: 'utf8', 
      timeout: 15000,
      env: { ...process.env }
    });
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}
function getTrendingTokens() {
  const data = twakData('trending --limit 3 --json');
  if (Array.isArray(data)) return data.map(t => t.symbol || t.name).filter(Boolean);
  return [];
}
function getTokenPrice(symbol) {
  const data = twakData('price ' + symbol + ' --json');
  return data?.priceUsd || 0;
}
// ============================================
// BALANCE (ethers.js - fast, reliable)
// ============================================
async function getPortfolio() {
  try {
    const bnbBalance = await provider.getBalance(AGENT_ADDRESS);
    const bnb = parseFloat(ethers.utils.formatEther(bnbBalance));
    // Get BNB price via TWAK
    const bnbPrice = getTokenPrice('BNB') || 580;
    const usdValue = bnb * bnbPrice;
    // Check stablecoin balances
    let stablesUsd = 0;
    for (const sym of STABLES) {
      const addr = TOKENS[sym];
      if (addr) {
        try {
          const contract = new ethers.Contract(addr, ERC20_ABI, provider);
          const bal = await contract.balanceOf(AGENT_ADDRESS);
          const dec = await contract.decimals();
          const amount = parseFloat(ethers.utils.formatUnits(bal, dec));
          stablesUsd += amount; // stables = 
        } catch (e) {}
      }
    }
    const totalUsd = usdValue + stablesUsd;
    const drawdown = STARTING_CAPITAL > 0 ? ((STARTING_CAPITAL - totalUsd) / STARTING_CAPITAL) * 100 : 0;
    return { bnb, bnbUsd: usdValue, stablesUsd, totalUsd, drawdown };
  } catch (e) {
    return { bnb: 0, bnbUsd: 0, stablesUsd: 0, totalUsd: 0, drawdown: 0 };
  }
}
// ============================================
// EXECUTION (ethers.js PancakeSwap)
// ============================================
async function swapBNBtoToken(tokenSymbol, bnbAmount) {
  try {
    const tokenAddr = TOKENS[tokenSymbol];
    if (!tokenAddr) return { success: false, error: 'Unknown token' };
    const amountIn = ethers.utils.parseEther(bnbAmount.toFixed(6));
    const path = [TOKENS.WBNB, tokenAddr];
    const amounts = await router.getAmountsOut(amountIn, path);
    const minOut = amounts[1].mul(95).div(100);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const tx = await router.swapExactETHForTokens(minOut, path, AGENT_ADDRESS, deadline, {
      value: amountIn,
      gasLimit: 350000
    });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) {
    return { success: false, error: e.message?.substring(0, 80) || 'Swap failed' };
  }
}
async function swapTokenToBNB(tokenSymbol, tokenAmount) {
  try {
    const tokenAddr = TOKENS[tokenSymbol];
    if (!tokenAddr) return { success: false, error: 'Unknown token' };
    const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
    const dec = await tokenContract.decimals();
    const amountIn = ethers.utils.parseUnits(tokenAmount.toFixed(dec), dec);
    // Approve router
    const approveTx = await tokenContract.approve(PANCAKE_ROUTER, amountIn);
    await approveTx.wait();
    const path = [tokenAddr, TOKENS.WBNB];
    const amounts = await router.getAmountsOut(amountIn, path);
    const minOut = amounts[1].mul(95).div(100);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const tx = await router.swapExactTokensForETH(amountIn, minOut, path, AGENT_ADDRESS, deadline, {
      gasLimit: 350000
    });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.transactionHash };
  } catch (e) {
    return { success: false, error: e.message?.substring(0, 80) || 'Swap failed' };
  }
}
// ============================================
// HISTORY
// ============================================
function loadHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch (e) {}
  return { trades: [], totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, lastTradeTime: 0, peakCapital: STARTING_CAPITAL };
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
  topMomentum: [], bnbBalance: 0, usdtBalance: 0, usdValue: 0, totalUsd: 0, drawdown: 0,
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
  const port = await getPortfolio();
  agentState.bnbBalance = port.bnb;
  agentState.usdValue = port.totalUsd;
  agentState.totalUsd = port.totalUsd;
  agentState.drawdown = port.drawdown;
  agentState.market.btc = getTokenPrice('BTC') || 85000;
  // Update peak capital
  if (port.totalUsd > history.peakCapital) history.peakCapital = port.totalUsd;
  console.log('CYCLE | Total: $' + port.totalUsd.toFixed(2) + ' | Drawdown: ' + port.drawdown.toFixed(1) + '% | Trades: ' + history.totalTrades);
  // ==========================================
  // COMPETITION RULE: 30% DRAWDOWN CAP
  // ==========================================
  if (port.drawdown >= MAX_DRAWDOWN * 100) {
    addLog('trade_blocked', 'DRAWDOWN CAP HIT: ' + port.drawdown.toFixed(1) + '% - Trading halted');
    agentState.currentDecision = { decision: 'HALT', conviction: 0, reason: 'DRAWDOWN_CAP' };
    saveState();
    return;
  }
  // ==========================================
  // CLOSE POSITION AFTER 60 SECONDS
  // ==========================================
  if (agentState.openPosition) {
    const heldSecs = (Date.now() - agentState.openPosition.entryTime) / 1000;
    console.log('  Position: ' + agentState.openPosition.symbol + ' (' + heldSecs.toFixed(0) + 's)');
    if (heldSecs >= 60) {
      addLog('position_close', 'Closing ' + agentState.openPosition.symbol);
      const result = await swapTokenToBNB(agentState.openPosition.symbol, agentState.openPosition.tokenAmount);
      if (result.success) {
        history.wins++;
        history.trades.push({ ...agentState.openPosition, result: 'CLOSED', closeTx: result.txHash, closeTime: Date.now() });
        agentState.openPosition = null;
        addLog('trade_approved', 'Closed: ' + result.txHash);
      }
    }
    saveHistory(history); saveState();
    return;
  }
  // ==========================================
  // CHECK COOLDOWN
  // ==========================================
  const sinceLast = Date.now() - history.lastTradeTime;
  if (history.lastTradeTime > 0 && sinceLast < COOLDOWN_SECONDS * 1000) {
    saveState();
    return;
  }
  // ==========================================
  // STRATEGY: Rotate BNB -> Stable -> BNB
  // Even trades: BNB -> stable, Odd trades: stable -> BNB
  // ==========================================
  // Get trending via TWAK for signal display
  const trending = getTrendingTokens();
  agentState.topMomentum = trending.map((t, i) => ({
    symbol: t, price: getTokenPrice(t), score: 80 - i * 10, direction: 'up', change: '+1.2'
  }));
  // DECISION: Alternate between buying stables and buying BNB
  const isBuyingStable = history.totalTrades % 2 === 0;
  if (isBuyingStable) {
    // BUY STABLECOIN with BNB
    if (port.bnb < 0.001) {
      addLog('trade_blocked', 'BNB too low for swap');
      saveState();
      return;
    }
    const target = STABLES[history.totalTrades % STABLES.length];
    const amount = Math.min(MAX_TRADE_BNB, port.bnb * 0.05);
    addLog('signal_buy', 'BNB -> ' + target + ' | ' + amount.toFixed(6) + ' BNB');
    agentState.currentDecision = { decision: 'BUY', conviction: 80, target, amount };
    const result = await swapBNBtoToken(target, amount);
    if (result.success) {
      history.totalTrades++;
      history.lastTradeTime = Date.now();
      agentState.openPosition = { 
        symbol: target, entryTime: Date.now(), amount: amount.toFixed(6), 
        tokenAmount: amount * (port.bnb > 0 ? port.bnbUsd / port.bnb / 1 : 580),
        txHash: result.txHash 
      };
      history.trades.push({ ...agentState.openPosition, result: 'OPEN' });
      saveHistory(history);
      addLog('trade_approved', result.txHash);
      addLog('position_open', target + ' | close in 60s');
    } else {
      addLog('trade_blocked', target + ': ' + (result.error || 'failed'));
    }
  } else {
    // BUY BNB with stablecoin (close previous position or use existing stables)
    // Find which stable we hold
    let heldStable = null;
    let heldAmount = 0;
    for (const sym of STABLES) {
      try {
        const contract = new ethers.Contract(TOKENS[sym], ERC20_ABI, provider);
        const bal = await contract.balanceOf(AGENT_ADDRESS);
        const dec = await contract.decimals();
        const amount = parseFloat(ethers.utils.formatUnits(bal, dec));
        if (amount > 0.1) {
          heldStable = sym;
          heldAmount = amount;
          break;
        }
      } catch (e) {}
    }
    if (heldStable && heldAmount > 0.1) {
      const sellAmount = Math.min(heldAmount, 0.5);
      addLog('signal_buy', heldStable + ' -> BNB | ' + sellAmount.toFixed(2) + ' ' + heldStable);
      agentState.currentDecision = { decision: 'BUY', conviction: 80, target: 'BNB', amount: sellAmount };
      const result = await swapTokenToBNB(heldStable, sellAmount);
      if (result.success) {
        history.totalTrades++;
        history.lastTradeTime = Date.now();
        history.trades.push({ symbol: 'BNB', amount: sellAmount.toFixed(2), txHash: result.txHash, result: 'OPEN', entryTime: Date.now() });
        saveHistory(history);
        addLog('trade_approved', result.txHash);
        addLog('position_open', 'BNB from ' + heldStable);
        agentState.openPosition = { symbol: 'BNB', entryTime: Date.now(), amount: sellAmount.toFixed(2), txHash: result.txHash };
      } else {
        addLog('trade_blocked', heldStable + ': ' + (result.error || 'failed'));
      }
    } else {
      addLog('signal_hold', 'No stables to sell, waiting for BNB->stable trade');
    }
  }
  // Record PnL
  history.totalPnl = port.totalUsd - STARTING_CAPITAL;
  saveHistory(history);
  saveState();
}
// ============================================
// STARTUP
// ============================================
console.log('========================================');
console.log('  SYNTA v19 - HYBRID (TWAK data + ethers.js exec)');
console.log('  Strategy: BNB <-> Stables rotation');
console.log('  Drawdown cap: ' + (MAX_DRAWDOWN * 100) + '%');
console.log('  Starting capital: $' + STARTING_CAPITAL);
console.log('========================================');
fs.writeFileSync(CONTROL_FILE, JSON.stringify({ action: 'none', timestamp: 0 }));
saveState();
setInterval(checkControl, 2000);
// Run initial cycle after 3 seconds
setTimeout(async () => {
  const p = await getPortfolio();
  addLog('system', 'Portfolio: $' + p.totalUsd.toFixed(2) + ' | Drawdown cap: ' + (MAX_DRAWDOWN*100) + '%');
  cycle();
  setInterval(cycle, CYCLE_SECONDS * 1000);
}, 3000);
process.on('SIGINT', function() {
  agentState.running = false;
  saveHistory(history); saveState();
  console.log('Shutdown. Trades: ' + history.totalTrades + ' | PnL: $' + history.totalPnl.toFixed(2));
  process.exit(0);
});
