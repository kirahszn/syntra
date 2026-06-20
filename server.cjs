// server.cjs - with x402 Payment Support
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { ethers } = require('ethers')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(bodyParser.json())

// === CONFIGURATION ===
const BSC_RPC = 'https://bsc-dataseed.binance.org/'
const AGENT_ADDRESS = process.env.AGENT_ADDRESS
const CMC_API_KEY = process.env.CMC_API_KEY
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
const TOKENS = { WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', USDT: '0x55d398326f99059fF775485246999027B3197955' }

console.log('🚀 SYNTRA - REAL AGENTS WITH X402 PAYMENTS')

// === CMC DATA ===
let cachedMarketData = null
let lastFetch = 0

async function getMarketData() {
  const now = Date.now()
  if (cachedMarketData && (now - lastFetch) < 5000) return cachedMarketData

  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    )
    const data = await response.json()
    if (!data.data) throw new Error('No data')

    cachedMarketData = {
      btc: { price: data.data.BTC?.quote?.USD?.price || 0, change24h: data.data.BTC?.quote?.USD?.percent_change_24h || 0 },
      eth: { price: data.data.ETH?.quote?.USD?.price || 0, change24h: data.data.ETH?.quote?.USD?.percent_change_24h || 0 },
      sol: { price: data.data.SOL?.quote?.USD?.price || 0, change24h: data.data.SOL?.quote?.USD?.percent_change_24h || 0 },
      timestamp: now
    }
    lastFetch = now
    return cachedMarketData
  } catch (error) {
    console.error('CMC error:', error)
    return cachedMarketData || { btc: { price: 65000, change24h: 2 }, eth: { price: 3500, change24h: 1.5 }, sol: { price: 180, change24h: 5 } }
  }
}

// === REAL AGENT LOGIC ===
function getWhaleSignal(marketData) {
  const { price, change24h } = marketData.btc
  const bullish = change24h > 1.5
  const confidence = Math.min(92, Math.abs(change24h) * 6 + 30)
  return {
    name: 'Whale',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(Math.min(confidence, 92)),
    price: price,
    change24h: change24h,
    description: bullish ? 'Smart money moving in' : 'Whales dumping'
  }
}

function getNarrativeSignal(marketData) {
  const { price, change24h } = marketData.sol
  const momentum = Math.min(1, Math.abs(change24h) / 10 + 0.4)
  const bullish = momentum > 0.6
  const confidence = Math.min(88, momentum * 80 + 10)
  return {
    name: 'Narrative',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(Math.min(confidence, 88)),
    price: price,
    momentum: Math.round(momentum * 100),
    change24h: change24h,
    description: bullish ? 'Strong momentum' : 'Narrative fading'
  }
}

function getDerivativesSignal(marketData) {
  const { price, change24h } = marketData.eth
  const bullish = change24h > 1.0
  const confidence = Math.min(85, Math.abs(change24h) * 10 + 25)
  const squeezeRisk = Math.max(10, Math.min(90, 50 - change24h * 2))
  return {
    name: 'Derivatives',
    direction: bullish ? 'bullish' : 'bearish',
    confidence: Math.round(Math.min(confidence, 85)),
    price: price,
    squeezeRisk: Math.round(squeezeRisk),
    change24h: change24h,
    description: bullish ? 'Low leverage risk' : 'High squeeze risk'
  }
}

// === X402: GET PAYMENT QUOTE ===
app.post('/api/purchase-quote', (req, res) => {
  const { agent, price } = req.body
  
  console.log(`📊 x402 quote requested: ${agent} for ${price} BNB`)
  
  res.json({
    success: true,
    recipient: AGENT_ADDRESS,
    amount: price,
    token: 'BNB',
    chainId: 56,
    message: `Purchase ${agent} signal (x402 pay-per-request)`
  })
})

// === X402: CONFIRM PURCHASE ===
app.post('/api/confirm-purchase', async (req, res) => {
  const { agent, txHash, price } = req.body
  
  console.log(`🔍 Verifying x402 payment: ${txHash}`)
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const tx = await provider.getTransaction(txHash)
    
    if (!tx) {
      return res.status(400).json({ success: false, error: 'Transaction not found' })
    }
    
    // Check if payment was sent to correct address
    if (tx.to.toLowerCase() !== AGENT_ADDRESS.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Invalid recipient' })
    }
    
    // Check amount
    const sentAmount = parseFloat(ethers.utils.formatEther(tx.value))
    if (sentAmount < price) {
      return res.status(400).json({ success: false, error: 'Insufficient payment' })
    }
    
    console.log(`✅ x402 payment confirmed for ${agent}: ${txHash}`)
    
    res.json({
      success: true,
      agent,
      txHash,
      message: 'Signal purchased successfully (x402)'
    })
  } catch (error) {
    console.error('x402 verification error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// === AGENT SIGNALS ENDPOINT ===
app.get('/api/agent-signals', async (req, res) => {
  try {
    const marketData = await getMarketData()
    const signals = {
      whale: getWhaleSignal(marketData),
      narrative: getNarrativeSignal(marketData),
      derivatives: getDerivativesSignal(marketData)
    }
    res.json({ success: true, signals, marketData })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// === GET TRADE DECISION (Uses purchased agents) ===
app.get('/api/decision', async (req, res) => {
  try {
    const marketData = await getMarketData()
    const whale = getWhaleSignal(marketData)
    const narrative = getNarrativeSignal(marketData)
    const derivatives = getDerivativesSignal(marketData)

    const purchasedAgents = req.query.purchased ? req.query.purchased.split(',') : []
    
    const allSignals = { whale, narrative, derivatives }

    let activeSignals = []
    if (purchasedAgents.length > 0) {
      purchasedAgents.forEach(agentName => {
        if (allSignals[agentName]) {
          activeSignals.push(allSignals[agentName])
        }
      })
      console.log(`🔍 Using purchased agents: ${purchasedAgents.join(', ')}`)
    } else {
      activeSignals = Object.values(allSignals)
      console.log('🔍 Using all agents (no purchases)')
    }

    if (activeSignals.length === 0) {
      return res.json({
        success: true,
        decision: 'NO BUY',
        conviction: 0,
        signals: {},
        marketData: {
          btc: marketData.btc.price,
          eth: marketData.eth.price,
          sol: marketData.sol.price
        },
        timestamp: Date.now(),
        message: 'No agents purchased - buy signals to start trading'
      })
    }

    const bullishCount = activeSignals.filter(s => s.direction === 'bullish').length
    const avgConfidence = activeSignals.reduce((sum, s) => sum + s.confidence, 0) / activeSignals.length
    
    const decision = bullishCount > activeSignals.length / 2 && avgConfidence > 50 ? 'BUY' : 'NO BUY'
    const conviction = Math.round((bullishCount / activeSignals.length) * avgConfidence)

    const result = {
      decision: decision,
      conviction: conviction,
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
      timestamp: Date.now(),
      purchasedAgents: purchasedAgents,
      activeSignalCount: activeSignals.length
    }

    currentDecision = result
    res.json({ success: true, ...result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// === TRADING STATE ===
let autoTradeInterval = null
let currentDecision = null
let pendingTrade = null
let tradeHistory = []
let dailyLoss = 0
let dailyTrades = 0

// === RISK SETTINGS ===
let riskSettings = {
  drawdownCap: 10,
  maxTradeAmount: 0.01,
  maxDailyTrades: 10,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  tokenAllowlist: ['BTC', 'ETH', 'SOL']
}

// === RISK SETTINGS ENDPOINTS ===
app.post('/api/settings', (req, res) => {
  riskSettings = { ...riskSettings, ...req.body }
  console.log('✅ Risk settings updated:', riskSettings)
  res.json({ success: true, settings: riskSettings })
})

app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: riskSettings })
})

// === GET USER BALANCE ===
app.get('/api/balance', async (req, res) => {
  try {
    const { address } = req.query
    if (!address) return res.status(400).json({ error: 'Address required' })

    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const balanceWei = await provider.getBalance(address)
    const balanceBNB = parseFloat(ethers.utils.formatEther(balanceWei))
    
    res.json({ success: true, balance: balanceBNB })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

// === PRICE ===
app.get('/api/price', async (req, res) => {
  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    )
    const data = await response.json()
    res.json({ success: true, price: data.data?.BTC?.quote?.USD?.price || 65000 })
  } catch (error) {
    res.json({ success: false, price: 65000 })
  }
})

// === TRADE PARAMS ===
app.post('/api/trade-params', async (req, res) => {
  try {
    const { decision, amount, purchasedAgents } = req.body
    const tradeAmount = amount || 0.001
    const marketData = await getMarketData()
    const currentPrice = marketData.btc.price || 65000

    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const router = new ethers.Contract(
      PANCAKE_ROUTER,
      ['function getAmountsOut(uint amountIn, address[] path) view returns (uint[])'],
      provider
    )

    const amountIn = ethers.utils.parseEther(tradeAmount.toString())
    const path = [TOKENS.WBNB, TOKENS.USDT]
    const amounts = await router.getAmountsOut(amountIn, path)
    const expectedUSDT = parseFloat(ethers.utils.formatEther(amounts[1]))

    res.json({
      success: true,
      txData: {
        routerAddress: PANCAKE_ROUTER,
        path,
        amountIn: amountIn.toString(),
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
        expectedUSDT,
        price: currentPrice,
        action: decision,
        purchasedAgents: purchasedAgents || []
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// === AUTO TRADE ===
app.post('/api/start-auto-trade', (req, res) => {
  if (autoTradeInterval) return res.json({ success: false, message: 'Already running' })
  
  console.log('🔄 Starting auto trading with REAL agents...')
  
  // Reset daily counters
  dailyLoss = 0
  dailyTrades = 0
  
  autoTradeInterval = setInterval(async () => {
    try {
      const purchasedAgents = req.body.purchasedAgents || []
      
      // Check drawdown cap
      if (dailyLoss > riskSettings.drawdownCap) {
        console.log(`⚠️ Drawdown cap reached: $${dailyLoss} > $${riskSettings.drawdownCap}`)
        pendingTrade = null
        return
      }
      
      // Check daily trade limit
      if (dailyTrades >= riskSettings.maxDailyTrades) {
        console.log(`⚠️ Daily trade limit reached: ${dailyTrades}/${riskSettings.maxDailyTrades}`)
        pendingTrade = null
        return
      }
      
      const decisionRes = await fetch(`http://localhost:${PORT}/api/decision?purchased=${purchasedAgents.join(',')}`)
      const decisionData = await decisionRes.json()
      
      if (decisionData.success && decisionData.decision === 'BUY') {
        console.log(`🤖 AI: BUY with ${decisionData.conviction}% conviction`)
        console.log(`   Whale: ${decisionData.signals.whale.direction} (${decisionData.signals.whale.confidence}%)`)
        console.log(`   Narrative: ${decisionData.signals.narrative.direction} (${decisionData.signals.narrative.confidence}%)`)
        console.log(`   Derivatives: ${decisionData.signals.derivatives.direction} (${decisionData.signals.derivatives.confidence}%)`)
        
        const paramsRes = await fetch(`http://localhost:${PORT}/api/trade-params`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            decision: 'BUY', 
            amount: riskSettings.maxTradeAmount,
            purchasedAgents: purchasedAgents
          })
        })
        const paramsData = await paramsRes.json()
        if (paramsData.success) {
          pendingTrade = {
            ...paramsData.txData,
            decision: 'BUY',
            conviction: decisionData.conviction,
            signals: decisionData.signals
          }
          console.log('✅ Trade ready for user to sign')
        }
      } else {
        pendingTrade = null
        console.log('🤖 AI: NO BUY')
      }
    } catch (error) {
      console.error('Auto trade error:', error)
    }
  }, 15000)
  
  res.json({ success: true, message: 'Auto trading started' })
})

app.post('/api/stop-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
    pendingTrade = null
    console.log('🛑 Auto trading stopped')
    res.json({ success: true, message: 'Stopped' })
  } else {
    res.json({ success: false, message: 'Not running' })
  }
})

// === STATUS ===
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    isAutoTrading: !!autoTradeInterval,
    currentDecision: currentDecision,
    pendingTrade: pendingTrade,
    trades: tradeHistory,
    dailyLoss: dailyLoss,
    dailyTrades: dailyTrades
  })
})

// === RESET ===
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
  res.json({ success: true, message: 'Reset complete' })
})

// === START ===
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📊 Mode: 🔴 REAL AGENTS + X402 PAYMENTS`)
  console.log(`📍 Agent: ${AGENT_ADDRESS}`)
})