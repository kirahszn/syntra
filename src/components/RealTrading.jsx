import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { API_URL } from '../utils/api'
import { ethers } from 'ethers'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield, RefreshCw } from 'lucide-react'

export default function RealTrading({ isMobile = false }) {
  const { state, dispatch } = useApp()
  const { walletAddress } = state
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tradeResult, setTradeResult] = useState(null)
  const [pendingTrade, setPendingTrade] = useState(null)

  // Get purchased agents
  const getPurchasedAgents = () => {
    return state.marketplace
      .filter(item => item.purchased)
      .map(item => item.agent)
  }

  // Fetch balance
  const fetchBalance = async () => {
    if (!walletAddress) return
    try {
      const response = await fetch(`${API_URL}/api/balance?address=${walletAddress}`)
      const data = await response.json()
      if (data.success) setBalance(data.balance)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }

  // Check for pending trades with purchased agents
  const checkPendingTrade = async () => {
    try {
      const purchased = getPurchasedAgents()
      const response = await fetch(`${API_URL}/api/decision?purchased=${purchased.join(',')}`)
      const data = await response.json()
      if (data.success && data.pendingTrade) {
        setPendingTrade(data.pendingTrade)
        console.log('📊 Pending trade ready for signing:', data.pendingTrade)
      }
    } catch (error) {
      console.error('Failed to check pending trade:', error)
    }
  }

  useEffect(() => {
    fetchBalance()
    checkPendingTrade()
    const balanceInterval = setInterval(fetchBalance, 5000)
    const tradeInterval = setInterval(checkPendingTrade, 3000)
    return () => {
      clearInterval(balanceInterval)
      clearInterval(tradeInterval)
    }
  }, [walletAddress, state.marketplace])

  // AUTO-EXECUTE TRADE (User just signs)
  const executePendingTrade = async () => {
    if (!pendingTrade || !walletAddress) {
      setError('No trade to execute or wallet not connected')
      return
    }

    if (!window.ethereum) {
      setError('Please install MetaMask or Trust Wallet')
      return
    }

    setLoading(true)
    setError(null)
    setTradeResult(null)

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      
      const router = new ethers.Contract(
        pendingTrade.routerAddress,
        [
          'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[])'
        ],
        signer
      )

      const amountIn = ethers.BigNumber.from(pendingTrade.amountIn)
      
      console.log('📈 Executing trade with params:', {
        amount: ethers.utils.formatEther(amountIn),
        path: pendingTrade.path,
        deadline: pendingTrade.deadline
      })

      const tx = await router.swapExactETHForTokens(
        0, // amountOutMin
        pendingTrade.path,
        walletAddress,
        pendingTrade.deadline,
        { value: amountIn, gasLimit: 300000 }
      )

      const receipt = await tx.wait()
      
      setTradeResult({
        success: true,
        txHash: receipt.transactionHash,
        price: pendingTrade.price,
        amount: ethers.utils.formatEther(amountIn)
      })
      
      setPendingTrade(null)
      await fetchBalance()
      
      // Dispatch to AppContext
      dispatch({
        type: 'UPDATE_TRADE_RESULT',
        payload: {
          result: 'EXECUTED',
          txHash: receipt.transactionHash,
          price: pendingTrade.price
        }
      })
      
    } catch (error) {
      console.error('Trade execution error:', error)
      setError(error.message || 'Trade failed')
    } finally {
      setLoading(false)
    }
  }

  const purchasedCount = getPurchasedAgents().length

  return (
    <div style={{
      padding: isMobile ? '16px' : '24px',
      borderRadius: '20px',
      background: 'rgba(20,20,30,0.8)',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '10px',
            borderRadius: '12px',
            background: 'rgba(0,212,170,0.1)'
          }}>
            <DollarSign size={24} style={{ color: '#00D4AA' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Trade Execution</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              {pendingTrade ? '⚠️ Trade ready to sign' : 'Waiting for AI signal...'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '100px',
            background: purchasedCount > 0 ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.05)',
            color: purchasedCount > 0 ? '#00D4AA' : 'rgba(255,255,255,0.3)'
          }}>
            {purchasedCount > 0 ? `✅ ${purchasedCount}/3 agents` : '⚠️ No agents'}
          </span>
          <button
            onClick={() => { fetchBalance(); checkPendingTrade(); }}
            style={{
              padding: '8px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)'
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {balance !== null && (
        <div style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.04)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Your Balance</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#00D4AA' }}>
            {balance.toFixed(4)} BNB
          </p>
        </div>
      )}

      {pendingTrade && (
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          background: 'rgba(0,212,170,0.05)',
          border: '1px solid rgba(0,212,170,0.2)',
          marginBottom: '16px'
        }}>
          <h4 style={{ fontSize: '14px', color: '#00D4AA', marginBottom: '8px' }}>
            🚀 AI Trade Ready
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Action</p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#00D4AA' }}>
                BUY
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Amount</p>
              <p style={{ fontSize: '18px', fontWeight: 700 }}>
                {ethers.utils.formatEther(pendingTrade.amountIn)} BNB
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Price</p>
              <p style={{ fontSize: '18px', fontWeight: 700 }}>
                ${pendingTrade.price.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={executePendingTrade}
        disabled={!walletAddress || loading || !pendingTrade}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: 600,
          border: 'none',
          cursor: (!walletAddress || loading || !pendingTrade) 
            ? 'default' 
            : 'pointer',
          background: (!walletAddress || loading || !pendingTrade)
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
          color: (!walletAddress || loading || !pendingTrade)
            ? 'rgba(255,255,255,0.3)'
            : 'white'
        }}
      >
        {!walletAddress ? 'Connect Wallet First' :
         loading ? '⏳ Sign in Wallet...' : 
         !pendingTrade ? '⏳ Waiting for AI Signal...' :
         '✅ Confirm Trade in Wallet'}
      </button>

      {tradeResult && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          borderRadius: '10px',
          background: 'rgba(0,212,170,0.05)',
          border: '1px solid rgba(0,212,170,0.1)',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.7)'
        }}>
          ✅ Trade Executed!
          <br />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            Tx: {tradeResult.txHash.slice(0, 20)}...{tradeResult.txHash.slice(-10)}
          </span>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          borderRadius: '10px',
          background: 'rgba(255,107,107,0.1)',
          border: '1px solid rgba(255,107,107,0.15)',
          color: '#FF6B6B',
          fontSize: '13px'
        }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '8px' }} />
          {error}
        </div>
      )}

      <div style={{
        marginTop: '16px',
        padding: '12px',
        borderRadius: '10px',
        background: 'rgba(255,107,107,0.05)',
        border: '1px solid rgba(255,107,107,0.1)',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)'
      }}>
        <Shield size={14} style={{ display: 'inline', marginRight: '8px' }} />
        {purchasedCount > 0 ? (
          `🔴 Using ${purchasedCount}/3 purchased agents for decisions`
        ) : (
          '⚠️ No agents purchased - buy signals in Marketplace'
        )}
        {pendingTrade && <span style={{ color: '#00D4AA', marginLeft: '8px' }}>✅ Trade Pending</span>}
      </div>
    </div>
  )
}