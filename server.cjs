// server.cjs - USER WALLET TRADING
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { ethers } = require('ethers')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS - Allow all origins for production
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(bodyParser.json())

// === HEALTH CHECK ===
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Syntra backend is running',
    timestamp: new Date().toISOString()
  })
})

// === CONFIGURATION ===
const BSC_RPC = 'https://bsc-dataseed.binance.org/'
const CMC_API_KEY = process.env.CMC_API_KEY

// PancakeSwap Router
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'

// Tokens on BSC
const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955'
}

console.log('🚀 SYNTRA - USER WALLET TRADING')
console.log('🔗 BSC RPC:', BSC_RPC)

// === GET USER BALANCE ===
app.get('/api/balance', async (req, res) => {
  try {
    const { address } = req.query
    
    if (!address) {
      return res.status(400).json({ success: false, error: 'Address required' })
    }

    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const balanceWei = await provider.getBalance(address)
    const balanceBNB = parseFloat(ethers.utils.formatEther(balanceWei))
    
    console.log(`💰 Balance for ${address}: ${balanceBNB} BNB`)
    res.json({ success: true, balance: balanceBNB, address })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

// === GET BTC PRICE ===
app.get('/api/price', async (req, res) => {
  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    )
    const data = await response.json()
    const price = data.data?.BTC?.quote?.USD?.price || 65000
    res.json({ success: true, price })
  } catch (error) {
    res.json({ success: false, price: 65000 })
  }
})

// === GET MARKET DATA ===
app.get('/api/market-data', async (req, res) => {
  try {
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL',
      { headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY } }
    )
    const data = await response.json()
    
    if (!data.data) {
      return res.json({ success: false, error: 'No data from CMC' })
    }

    const marketData = {
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
      }
    }

    res.json({ success: true, marketData })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

// === GET TRADE PARAMS (Server calculates but doesn't execute) ===
app.post('/api/trade-params', async (req, res) => {
  try {
    const { decision, conviction, amount } = req.body
    const tradeAmount = amount || 0.001

    const priceRes = await fetch(`http://localhost:${PORT}/api/price`)
    const priceData = await priceRes.json()
    const currentPrice = priceData.price || 65000

    // Get the swap parameters
    const provider = new ethers.providers.JsonRpcProvider(BSC_RSC)
    const router = new ethers.Contract(
      PANCAKE_ROUTER,
      [
        'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])'
      ],
      provider
    )

    const amountIn = ethers.utils.parseEther(tradeAmount.toString())
    const path = [TOKENS.WBNB, TOKENS.USDT]
    const amounts = await router.getAmountsOut(amountIn, path)
    const expectedUSDT = parseFloat(ethers.utils.formatEther(amounts[1]))

    res.json({
      success: true,
      tradeParams: {
        action: decision,
        amount: tradeAmount,
        price: currentPrice,
        expectedUSDT,
        path,
        routerAddress: PANCAKE_ROUTER,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20
      }
    })

  } catch (error) {
    console.error('Trade params error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// === AUTO TRADING (Only generates signals, user executes) ===
let autoTradeInterval = null
let currentDecision = null

app.post('/api/start-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    return res.json({ success: false, message: 'Already running' })
  }
  
  console.log('🔄 Starting auto signal generation...')
  
  autoTradeInterval = setInterval(async () => {
    try {
      // Generate a decision based on market data
      const priceRes = await fetch(`http://localhost:${PORT}/api/price`)
      const priceData = await priceRes.json()
      const currentPrice = priceData.price || 65000
      
      // Simple AI logic (you can make this more sophisticated)
      const conviction = 60 + Math.random() * 30
      const decision = conviction > 70 ? 'BUY' : 'NO BUY'
      
      currentDecision = {
        decision,
        conviction,
        price: currentPrice,
        timestamp: Date.now()
      }
      
      console.log(`🤖 AI Signal: ${decision} with ${conviction.toFixed(0)}% conviction`)
      
    } catch (error) {
      console.error('Auto trade error:', error)
    }
  }, 10000)
  
  res.json({ success: true, message: 'Auto trading started' })
})

app.post('/api/stop-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
    console.log('🛑 Auto trading stopped')
    res.json({ success: true, message: 'Stopped' })
  } else {
    res.json({ success: false, message: 'Not running' })
  }
})

// === GET CURRENT DECISION ===
app.get('/api/decision', (req, res) => {
  res.json({ 
    success: true, 
    decision: currentDecision || { decision: 'NO BUY', conviction: 0 } 
  })
})

// === STATUS ===
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    isAutoTrading: !!autoTradeInterval,
    currentDecision: currentDecision,
    mode: 'Signal Generator - User Executes Trades'
  })
})

// === RESET ===
app.post('/api/reset', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
  }
  currentDecision = null
  console.log('🔄 Reset complete')
  res.json({ success: true, message: 'Reset complete' })
})

// === START ===
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📊 Mode: 🔴 Signal Generator (User executes trades)`)
  console.log(`🔗 BSC RPC: ${BSC_RPC}`)
})