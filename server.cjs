// server.cjs - PRODUCTION READY
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { ethers } = require('ethers')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// CORS - Allow ALL origins for production
app.use(cors({
  origin: '*', // Allow all origins (simplest for now)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(bodyParser.json())

// === CONFIGURATION ===
const BSC_RPC = 'https://bsc-dataseed.binance.org/'
const AGENT_ADDRESS = process.env.AGENT_ADDRESS
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
const CMC_API_KEY = process.env.CMC_API_KEY

console.log('🚀 SYNTRA - PRODUCTION')
console.log('📍 Agent:', AGENT_ADDRESS)

// === HEALTH CHECK ===
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Syntra backend is running',
    agent: AGENT_ADDRESS,
    timestamp: new Date().toISOString()
  })
})

// === GET REAL BALANCE ===
app.get('/api/balance', async (req, res) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const balanceWei = await provider.getBalance(AGENT_ADDRESS)
    const balanceBNB = parseFloat(ethers.utils.formatEther(balanceWei))
    res.json({ success: true, balance: balanceBNB })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

// === GET MARKET DATA ===
app.get('/api/market-data', async (req, res) => {
  try {
    if (!CMC_API_KEY) {
      return res.json({ success: false, error: 'CMC_API_KEY not configured' })
    }
    
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

// === TRADING STATE ===
let position = null
let trades = []
let totalPnL = 0

// === REAL BUY ===
async function executeRealBuy(amount) {
  const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider)
  
  const router = new ethers.Contract(
    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    [
      'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[])',
      'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])'
    ],
    wallet
  )
  
  const amountIn = ethers.utils.parseEther(amount.toString())
  const path = ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', '0x55d398326f99059fF775485246999027B3197955']
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20
  
  const amounts = await router.getAmountsOut(amountIn, path)
  const expectedUSDT = parseFloat(ethers.utils.formatEther(amounts[1]))
  
  const tx = await router.swapExactETHForTokens(
    0, path, wallet.address, deadline,
    { value: amountIn, gasLimit: 300000 }
  )
  
  const receipt = await tx.wait()
  
  return {
    txHash: receipt.transactionHash,
    expectedUSDT: expectedUSDT
  }
}

// === REAL SELL ===
async function executeRealSell(usdtAmount) {
  const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider)
  
  const router = new ethers.Contract(
    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    [
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[])',
      'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])'
    ],
    wallet
  )
  
  const amountIn = ethers.utils.parseEther(usdtAmount.toString())
  const path = ['0x55d398326f99059fF775485246999027B3197955', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c']
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20
  
  // Approve USDT
  const usdtContract = new ethers.Contract(
    '0x55d398326f99059fF775485246999027B3197955',
    ['function approve(address spender, uint amount) public returns (bool)'],
    wallet
  )
  
  await usdtContract.approve('0x10ED43C718714eb63d5aA57B78B54704E256024E', amountIn)
  
  const tx = await router.swapExactTokensForETH(
    amountIn, 0, path, wallet.address, deadline,
    { gasLimit: 300000 }
  )
  
  const receipt = await tx.wait()
  
  return {
    txHash: receipt.transactionHash,
    expectedBNB: parseFloat(ethers.utils.formatEther(await router.getAmountsOut(amountIn, path).then(a => a[1])))
  }
}

// === REAL TRADE ===
app.post('/api/trade', async (req, res) => {
  try {
    const { decision, conviction, amount } = req.body
    const tradeAmount = amount || 0.001

    const priceRes = await fetch(`http://localhost:${PORT}/api/price`)
    const priceData = await priceRes.json()
    const currentPrice = priceData.price || 65000

    if (decision === 'BUY') {
      const result = await executeRealBuy(tradeAmount)
      position = {
        entryPrice: currentPrice,
        amount: tradeAmount,
        usdtReceived: result.expectedUSDT,
        txHash: result.txHash
      }
      res.json({ success: true, action: 'BUY', price: currentPrice, amount: tradeAmount, txHash: result.txHash })
    } else if (decision === 'SELL' && position) {
      const result = await executeRealSell(position.usdtReceived.toFixed(2))
      const pnl = (result.expectedBNB - position.amount) * currentPrice
      totalPnL += pnl
      trades.push({ entryPrice: position.entryPrice, exitPrice: currentPrice, amount: position.amount, pnl, txHash: result.txHash })
      position = null
      res.json({ success: true, action: 'SELL', price: currentPrice, entryPrice: position?.entryPrice, pnl, txHash: result.txHash })
    } else {
      res.json({ success: false, error: 'Invalid decision or no position' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// === AUTO TRADING ===
let autoTradeInterval = null

app.post('/api/start-auto-trade', (req, res) => {
  if (autoTradeInterval) {
    return res.json({ success: false, message: 'Already running' })
  }
  
  console.log('🔄 Starting auto trading...')
  
  autoTradeInterval = setInterval(async () => {
    try {
      if (!position) {
        const buyRes = await fetch(`http://localhost:${PORT}/api/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'BUY', conviction: 75 })
        })
        const buyData = await buyRes.json()
        console.log('🤖 AI:', buyData.message)
      } else {
        const sellRes = await fetch(`http://localhost:${PORT}/api/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'SELL', conviction: 75 })
        })
        const sellData = await sellRes.json()
        console.log('🤖 AI:', sellData.message)
      }
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

// === STATUS ===
app.get('/api/status', async (req, res) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC)
    const balanceWei = await provider.getBalance(AGENT_ADDRESS)
    const balanceBNB = parseFloat(ethers.utils.formatEther(balanceWei))
    
    const wins = trades.filter(t => t.pnl > 0).length
    const losses = trades.filter(t => t.pnl < 0).length
    
    res.json({
      success: true,
      balance: balanceBNB,
      address: AGENT_ADDRESS,
      position: position,
      totalTrades: trades.length,
      wins: wins,
      losses: losses,
      winRate: trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0,
      totalPnL: totalPnL,
      isAutoTrading: !!autoTradeInterval,
      trades: trades.slice(-10).reverse()
    })
  } catch (error) {
    res.json({ success: false, error: error.message })
  }
})

// === RESET ===
app.post('/api/reset', (req, res) => {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval)
    autoTradeInterval = null
  }
  position = null
  trades = []
  totalPnL = 0
  res.json({ success: true, message: 'Reset complete' })
})

// === START ===
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📍 Agent: ${AGENT_ADDRESS}`)
  console.log(`📊 Mode: 🔴 PRODUCTION`)
})