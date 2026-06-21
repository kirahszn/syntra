const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { ethers } = require('ethers')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))
app.use(bodyParser.json())

const BSC_RPC = process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org/'
const CMC_API_KEY = process.env.CMC_API_KEY
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'

const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955'
}

const TOKEN_DECIMALS = {
  WBNB: 18,
  USDT: 18
}

const MIN_USDT_POSITION = 0.000001

const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)

const agentWallet = process.env.AGENT_PRIVATE_KEY
  ? new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider)
  : null

const AGENT_ADDRESS = agentWallet?.address || process.env.AGENT_ADDRESS

const routerAbi = [
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])',
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[])',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[])'
]

const erc20Abi = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint amount) public returns (bool)'
]

const router = new ethers.Contract(PANCAKE_ROUTER, routerAbi, provider)
const routerWithSigner = agentWallet ? router.connect(agentWallet) : null

let cachedMarketData = null
let lastFetch = 0

let autoTradeInterval = null
let autoTradePurchasedAgents = []
let currentDecision = null
let pendingTrade = null
let tradeHistory = []
let dailyLoss = 0
let dailyTrades = 0
let openPosition = null
let isExecutingTrade = false
let agentLogs = []

function addAgentLog(type, message, data = {}) {
  const log = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message,
    data,
    timestamp: Date.now()
  }

  agentLogs.unshift(log)
  agentLogs = agentLogs.slice(0, 80)

  console.log(message)
}

let riskSettings = {
  drawdownCap: Number(process.env.MAX_DAILY_LOSS || 0.1),
  maxTradeAmount: Number(process.env.MAX_TRADE_AMOUNT || 0.00001),
  maxDailyTrades: Number(process.env.MAX_DAILY_TRADES || 20),
  stopLossPercent: Number(process.env.STOP_LOSS_PERCENT || 0.1),
  takeProfitPercent: Number(process.env.TAKE_PROFIT_PERCENT || 0.2),
  tokenAllowlist: ['WBNB', 'USDT']
}

console.log('🚀 SYNTRA AUTONOMOUS AGENT BACKEND')
console.log(`📍 Agent Wallet: ${AGENT_ADDRESS || 'Not configured'}`)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Syntra autonomous backend is running',
    agent: AGENT_ADDRESS || 'Not set',
    hasAgentPrivateKey: Boolean(agentWallet),
    timestamp: new Date().toISOString()
  })
})

async function getMarketData() {
  const now = Date.now()
  if (cachedMarketData && now - lastFetch < 5000) return cachedMarketData

  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    )

    const data = await response.json()
    if (!data.data) throw new Error('No CMC data returned')

    cachedMarketData = {
      btc: {
        price: data.data.BTC?.quote?.USD?.price || 0,
        change24h: data.data.BTC?.quote?.USD?.percent_change_24h || 0
      },
      eth: {
        price: data.data.ETH?.quote?.USD?.price || 0,
        change24h: data.data.ETH?.quote?.USD?.percent_change_24h || 0
      },
      sol: {
        price: data.data.SOL?.quote?.USD?.price || 0,
        change24h: data.data.SOL?.quote?.USD?.percent_change_24h || 0
      },
      timestamp: now
    }

    lastFetch = now
    return cachedMarketData
  } catch (error) {
    console.error('CMC error:', error.message)

    return cachedMarketData || {
      btc: { price: 65000, change24h: 0 },
      eth: { price: 3500, change24h: 0 },
      sol: { price: 180, change24h: 0 },
      timestamp: now
    }
  }
}

function getWhaleSignal(marketData) {
  const change24h = marketData.btc.change24h
  const bullish = change24h > 1.5
  const confidence = Math.min(92, Math.abs(change24h) * 6 + 30)

  return {
    name: 'Whale',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(confidence),
    price: marketData.btc.price,
    change24h,
    description: bullish ? 'Smart money moving in' : 'Whales dumping'
  }
}

function getNarrativeSignal(marketData) {
  const change24h = marketData.sol.change24h
  const momentum = Math.min(1, Math.abs(change24h) / 10 + 0.4)
  const bullish = momentum > 0.6
  const confidence = Math.min(88, momentum * 80 + 10)

  return {
    name: 'Narrative',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(confidence),
    price: marketData.sol.price,
    momentum: Math.round(momentum * 100),
    change24h,
    description: bullish ? 'Strong momentum' : 'Narrative fading'
  }
}

function getDerivativesSignal(marketData) {
  const change24h = marketData.eth.change24h
  const bullish = change24h > 1.0
  const confidence = Math.min(85, Math.abs(change24h) * 10 + 25)

  return {
    name: 'Derivatives',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(confidence),
    price: marketData.eth.price,
    change24h,
    description: bullish ? 'Low leverage risk' : 'High squeeze risk'
  }
}

async function generateDecision(purchasedAgents = []) {
  const marketData = await getMarketData()

  const whale = getWhaleSignal(marketData)
  const narrative = getNarrativeSignal(marketData)
  const derivatives = getDerivativesSignal(marketData)

  const allSignals = { whale, narrative, derivatives }

  let activeSignals = []

  if (purchasedAgents.length > 0) {
    purchasedAgents.forEach(agentName => {
      if (allSignals[agentName]) activeSignals.push(allSignals[agentName])
    })
  } else {
    activeSignals = Object.values(allSignals)
  }

  if (activeSignals.length === 0) {
    return {
      decision: 'NO BUY',
      conviction: 0,
      signals: allSignals,
      marketData,
      purchasedAgents,
      activeSignalCount: 0,
      timestamp: Date.now()
    }
  }

  const bullishCount = activeSignals.filter(s => s.direction === 'bullish').length
  const avgConfidence = activeSignals.reduce((sum, s) => sum + s.confidence, 0) / activeSignals.length

  const decision =
    bullishCount > activeSignals.length / 2 && avgConfidence > 50
      ? 'BUY'
      : 'NO BUY'

  const conviction = Math.round((bullishCount / activeSignals.length) * avgConfidence)

  return {
    decision,
    conviction,
    signals: {
      whale: { direction: whale.direction, confidence: whale.confidence },
      narrative: { direction: narrative.direction, confidence: narrative.confidence },
      derivatives: { direction: derivatives.direction, confidence: derivatives.confidence }
    },
    marketData: {
      btc: marketData.btc.price,
      eth: marketData.eth.price,
      sol: marketData.sol.price
    },
    purchasedAgents,
    activeSignalCount: activeSignals.length,
    timestamp: Date.now()
  }
}

function formatToken(rawAmount, decimals = 18) {
  return Number(ethers.utils.formatUnits(rawAmount, decimals))
}

function parseToken(amount, decimals = 18) {
  return ethers.utils.parseUnits(amount.toString(), decimals)
}

async function getUsdtBalance() {
  const usdt = new ethers.Contract(TOKENS.USDT, erc20Abi, provider)
  const rawBalance = await usdt.balanceOf(AGENT_ADDRESS)
  return formatToken(rawBalance, TOKEN_DECIMALS.USDT)
}

async function recoverOpenPositionFromWallet() {
  if (openPosition) return openPosition
  if (!AGENT_ADDRESS) return null

  const usdtBalance = await getUsdtBalance()

  if (usdtBalance <= MIN_USDT_POSITION) return null

  const estimatedBNBValue = await getUsdtToBnbValue(usdtBalance)

  openPosition = {
    entryTxHash: 'RECOVERED_FROM_WALLET',
    entryBNB: estimatedBNBValue,
    usdtAmount: usdtBalance,
    entryPrice: 0,
    walletAddress: AGENT_ADDRESS,
    openedAt: Date.now(),
    conviction: 0,
    recovered: true
  }

  console.log('♻️ Recovered open position from wallet USDT balance:', openPosition)

  return openPosition
}

async function getBnbToUsdtValue(bnbAmount) {
  const amountIn = ethers.utils.parseEther(bnbAmount.toString())
  const path = [TOKENS.WBNB, TOKENS.USDT]
  const amounts = await router.getAmountsOut(amountIn, path)

  return formatToken(amounts[1], TOKEN_DECIMALS.USDT)
}

async function getUsdtToBnbValue(usdtAmount) {
  const amountIn = parseToken(usdtAmount, TOKEN_DECIMALS.USDT)
  const path = [TOKENS.USDT, TOKENS.WBNB]
  const amounts = await router.getAmountsOut(amountIn, path)

  return Number(ethers.utils.formatEther(amounts[1]))
}

function getStats() {
  const totalTrades = tradeHistory.length
  const wins = tradeHistory.filter(t => t.result === 'WIN').length
  const losses = tradeHistory.filter(t => t.result === 'LOSS').length
  const totalPnL = tradeHistory.reduce((sum, t) => sum + Number(t.pnl || 0), 0)
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0

  return { totalTrades, wins, losses, totalPnL, winRate }
}

async function recordTrade(tradeInput) {
  const existingTrade = tradeHistory.find(t => t.txHash === tradeInput.txHash)
  if (existingTrade) return existingTrade

  let pnl = 0
  let result = 'OPEN'

  if (tradeInput.action === 'BUY') {
    openPosition = {
      entryTxHash: tradeInput.txHash,
      entryBNB: Number(tradeInput.bnbAmount || 0),
      usdtAmount: Number(tradeInput.expectedUSDT || 0),
      entryPrice: Number(tradeInput.price || 0),
      walletAddress: AGENT_ADDRESS,
      openedAt: Date.now(),
      conviction: Number(tradeInput.conviction || 75)
    }

    result = 'OPEN'
  }

  if (tradeInput.action === 'SELL') {
    const exitBNB = Number(tradeInput.expectedBNB || 0)
    const entryBNB = Number(openPosition?.entryBNB || 0)

    pnl = exitBNB - entryBNB
    result = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'

    if (pnl < 0) dailyLoss += Math.abs(pnl)

    openPosition = null
  }

  const trade = {
    id: `${Date.now()}-${tradeInput.txHash.slice(-6)}`,
    txHash: tradeInput.txHash,
    action: tradeInput.action,
    amountIn: tradeInput.amountIn || '0',
    bnbAmount: Number(tradeInput.bnbAmount || 0),
    price: Number(tradeInput.price || 0),
    expectedUSDT: Number(tradeInput.expectedUSDT || 0),
    expectedBNB: Number(tradeInput.expectedBNB || 0),
    blockNumber: tradeInput.blockNumber || 0,
    walletAddress: AGENT_ADDRESS,
    conviction: Number(tradeInput.conviction || 75),
    pnl,
    result,
    reason: tradeInput.reason || null,
    timestamp: Date.now()
  }

  tradeHistory.push(trade)
  dailyTrades += 1
  pendingTrade = null

  console.log('✅ Trade recorded:', trade)
  return trade
}

function validateAgentWallet() {
  if (!agentWallet || !routerWithSigner) {
    throw new Error('AGENT_PRIVATE_KEY is missing. Agent wallet cannot trade autonomously.')
  }
}

async function executeAutoBuy(decisionData) {
  validateAgentWallet()

  if (isExecutingTrade) return null
  isExecutingTrade = true

  try {
    const bnbAmount = Number(riskSettings.maxTradeAmount)

    if (dailyTrades >= riskSettings.maxDailyTrades) {
      throw new Error('Max daily trades reached')
    }

    if (dailyLoss >= riskSettings.drawdownCap) {
      throw new Error('Daily loss cap reached')
    }

    const balance = await provider.getBalance(AGENT_ADDRESS)
    const amountIn = ethers.utils.parseEther(bnbAmount.toString())

    if (balance.lt(amountIn)) {
      throw new Error('Insufficient BNB in agent wallet')
    }

const usdtBeforeBuy = await getUsdtBalance()
const expectedUSDT = await getBnbToUsdtValue(bnbAmount)
    const marketData = await getMarketData()

    const path = [TOKENS.WBNB, TOKENS.USDT]
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20

    console.log(`🤖 AUTO BUY: ${bnbAmount} BNB → approx ${expectedUSDT} USDT`)

    const tx = await routerWithSigner.swapExactETHForTokens(
      0,
      path,
      AGENT_ADDRESS,
      deadline,
      {
        value: amountIn,
        gasLimit: 300000
      }
    )

    console.log('📤 BUY tx sent:', tx.hash)

    const receipt = await tx.wait()

    const usdtAfterBuy = await getUsdtBalance()
const actualUSDTReceived = Math.max(usdtAfterBuy - usdtBeforeBuy, 0)

    console.log('✅ BUY confirmed:', receipt.transactionHash)

    return await recordTrade({
      txHash: receipt.transactionHash,
      action: 'BUY',
      amountIn: amountIn.toString(),
      bnbAmount,
      price: marketData.btc.price,
      expectedUSDT: actualUSDTReceived || expectedUSDT,
      blockNumber: receipt.blockNumber,
      conviction: decisionData.conviction,
      reason: 'AI_BUY'
    })
  } finally {
    isExecutingTrade = false
  }
}

async function executeAutoSell(reason = 'EXIT') {
  validateAgentWallet()

  if (!openPosition) return null
  if (isExecutingTrade) return null

  isExecutingTrade = true

  try {
    const usdt = new ethers.Contract(TOKENS.USDT, erc20Abi, provider)
    const usdtWithSigner = usdt.connect(agentWallet)

const walletUsdtBalance = await getUsdtBalance()
const sellAmount = Math.min(openPosition.usdtAmount, walletUsdtBalance)

if (sellAmount <= MIN_USDT_POSITION) {
  throw new Error('No meaningful USDT balance to sell')
}

const amountIn = parseToken(sellAmount, TOKEN_DECIMALS.USDT)
    const balance = await usdt.balanceOf(AGENT_ADDRESS)

    if (balance.lt(amountIn)) {
      throw new Error('Insufficient USDT in agent wallet to sell')
    }

    const expectedBNB = await getUsdtToBnbValue(sellAmount)
    const allowance = await usdt.allowance(AGENT_ADDRESS, PANCAKE_ROUTER)

    if (allowance.lt(amountIn)) {
      console.log('🔐 Approving USDT for PancakeSwap...')
      const approveTx = await usdtWithSigner.approve(PANCAKE_ROUTER, amountIn)
      await approveTx.wait()
      console.log('✅ USDT approved')
    }

    const path = [TOKENS.USDT, TOKENS.WBNB]
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20

    console.log(`🤖 AUTO SELL: ${sellAmount} USDT → approx ${expectedBNB} BNB`)

    const tx = await routerWithSigner.swapExactTokensForETH(
      amountIn,
      0,
      path,
      AGENT_ADDRESS,
      deadline,
      {
        gasLimit: 300000
      }
    )

    console.log('📤 SELL tx sent:', tx.hash)

    const receipt = await tx.wait()

    console.log('✅ SELL confirmed:', receipt.transactionHash)

    return await recordTrade({
      txHash: receipt.transactionHash,
      action: 'SELL',
      amountIn: amountIn.toString(),
      price: openPosition.entryPrice,
      expectedBNB,
      blockNumber: receipt.blockNumber,
      conviction: openPosition.conviction,
      reason
    })
  } finally {
    isExecutingTrade = false
  }
}

async function agentTick() {
  if (isExecutingTrade) return
await recoverOpenPositionFromWallet()
  if (dailyLoss >= riskSettings.drawdownCap) {
    console.log(`⚠️ Drawdown cap reached: ${dailyLoss}`)
    return
  }

  if (dailyTrades >= riskSettings.maxDailyTrades) {
    console.log(`⚠️ Daily trade limit reached: ${dailyTrades}/${riskSettings.maxDailyTrades}`)
    return
  }

  if (openPosition) {
    const currentBNBValue = await getUsdtToBnbValue(openPosition.usdtAmount)
    const pnlBNB = currentBNBValue - openPosition.entryBNB
    const pnlPercent = (pnlBNB / openPosition.entryBNB) * 100

   addAgentLog('position', `📊 Open position PnL: ${pnlPercent.toFixed(2)}%`, {
  pnlPercent,
  entryBNB: openPosition.entryBNB,
  currentBNBValue
})

    if (pnlPercent >= riskSettings.takeProfitPercent) {
      await executeAutoSell('TAKE_PROFIT')
      return
    }

    if (pnlPercent <= -riskSettings.stopLossPercent) {
      await executeAutoSell('STOP_LOSS')
      return
    }

    return
  }

  const decisionData = await generateDecision(autoTradePurchasedAgents)
  currentDecision = decisionData

  if (decisionData.decision === 'BUY') {
addAgentLog('buy_signal', `🤖 AI BUY with ${decisionData.conviction}% conviction`, decisionData)
    await executeAutoBuy(decisionData)
  } else {
   addAgentLog('no_buy', `🤖 AI NO BUY with ${decisionData.conviction}% conviction`, decisionData)
  }
}

app.get('/api/agent-wallet', async (req, res) => {
  try {
    if (!AGENT_ADDRESS) {
      return res.status(400).json({
        success: false,
        error: 'Agent wallet not configured'
      })
    }

    const bnbBalance = await provider.getBalance(AGENT_ADDRESS)
    const usdt = new ethers.Contract(TOKENS.USDT, erc20Abi, provider)
    const usdtBalance = await usdt.balanceOf(AGENT_ADDRESS)

    res.json({
      success: true,
      address: AGENT_ADDRESS,
      bnbBalance: Number(ethers.utils.formatEther(bnbBalance)),
     usdtBalance: formatToken(usdtBalance, TOKEN_DECIMALS.USDT),
      canAutoTrade: Boolean(agentWallet)
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/start-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    return res.json({ success: false, message: 'Already running' })
  }

  if (!agentWallet) {
    return res.status(400).json({
      success: false,
      message: 'AGENT_PRIVATE_KEY missing. Autonomous trading cannot start.'
    })
  }

  autoTradePurchasedAgents = req.body.purchasedAgents || []
 addAgentLog('start', '🔄 Starting autonomous agent trading...')
  console.log('📋 Purchased agents:', autoTradePurchasedAgents)

  autoTradeInterval = setInterval(async () => {
    try {
      await agentTick()
    } catch (error) {
      console.error('Auto trade error:', error.message)
    }
  }, 10000)

  res.json({
    success: true,
    message: 'Autonomous agent trading started',
    agentWallet: AGENT_ADDRESS
  })
})

app.post('/api/stop-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
addAgentLog('stop', '🛑 Autonomous trading stopped')
    return res.json({ success: true, message: 'Stopped' })
  }

  res.json({ success: false, message: 'Not running' })
})

app.get('/api/status', async (req, res) => {
  await recoverOpenPositionFromWallet()
  const stats = getStats()

  res.json({
    success: true,
    mode: 'AUTONOMOUS_AGENT_WALLET',
    isAutoTrading: Boolean(autoTradeInterval),
    currentDecision,
    pendingTrade,
    openPosition,
    trades: tradeHistory,
    dailyLoss,
    dailyTrades,
    riskSettings,
    agentWallet: {
      address: AGENT_ADDRESS,
      configured: Boolean(agentWallet)
    },
    ...stats
  })
})

app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: riskSettings })
})

app.post('/api/settings', (req, res) => {
  riskSettings = {
    ...riskSettings,
    ...req.body,
    drawdownCap: Number(req.body.drawdownCap ?? riskSettings.drawdownCap),
    maxTradeAmount: Number(req.body.maxTradeAmount ?? riskSettings.maxTradeAmount),
    maxDailyTrades: Number(req.body.maxDailyTrades ?? riskSettings.maxDailyTrades),
    stopLossPercent: Number(req.body.stopLossPercent ?? riskSettings.stopLossPercent),
    takeProfitPercent: Number(req.body.takeProfitPercent ?? riskSettings.takeProfitPercent)
  }

  console.log('✅ Risk settings updated:', riskSettings)
  res.json({ success: true, settings: riskSettings })
})

app.get('/api/decision', async (req, res) => {
  try {
    const purchasedAgents = req.query.purchased ? req.query.purchased.split(',') : []
    const decision = await generateDecision(purchasedAgents)
    currentDecision = decision
    res.json({ success: true, ...decision })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/agent-signals', async (req, res) => {
  try {
    const marketData = await getMarketData()

    res.json({
      success: true,
      signals: {
        whale: getWhaleSignal(marketData),
        narrative: getNarrativeSignal(marketData),
        derivatives: getDerivativesSignal(marketData)
      },
      marketData
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/market-data', async (req, res) => {
  try {
    const marketData = await getMarketData()
    res.json({ success: true, marketData })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/balance', async (req, res) => {
  try {
    const address = req.query.address || AGENT_ADDRESS

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address required'
      })
    }

    const balanceWei = await provider.getBalance(address)

    res.json({
      success: true,
      balance: Number(ethers.utils.formatEther(balanceWei))
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/purchase-quote', (req, res) => {
  const { agent, price } = req.body

  res.json({
    success: true,
    recipient: AGENT_ADDRESS,
    amount: price,
    token: 'BNB',
    chainId: 56,
    message: `Purchase ${agent} signal`
  })
})

app.post('/api/confirm-purchase', async (req, res) => {
  const { agent, txHash, price } = req.body

  try {
    const tx = await provider.getTransaction(txHash)

    if (!tx) {
      return res.status(400).json({ success: false, error: 'Transaction not found' })
    }

    if (tx.to.toLowerCase() !== AGENT_ADDRESS.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Invalid recipient' })
    }

    const sentAmount = parseFloat(ethers.utils.formatEther(tx.value))

    if (sentAmount < Number(price)) {
      return res.status(400).json({ success: false, error: 'Insufficient payment' })
    }

    res.json({
      success: true,
      agent,
      txHash,
      message: 'Signal purchased successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/reset', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
  }

  currentDecision = null
  pendingTrade = null
  tradeHistory = []
  dailyLoss = 0
  dailyTrades = 0
  openPosition = null
  autoTradePurchasedAgents = []

  res.json({ success: true, message: 'Reset complete' })
})

app.get('/api/agent-logs', (req, res) => {
  res.json({
    success: true,
    logs: agentLogs
  })
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📊 Mode: Autonomous Agent Wallet`)
  console.log(`📍 Agent: ${AGENT_ADDRESS || 'Not configured'}`)
})