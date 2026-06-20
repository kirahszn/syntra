// src/components/RealTrading.jsx
import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { API_URL } from '../utils/api'
import { ethers } from 'ethers'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield, RefreshCw } from 'lucide-react'

export default function RealTrading({ isMobile = false }) {
  const { state } = useApp()
  const { walletAddress } = state // Get connected user's address
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tradeResult, setTradeResult] = useState(null)

  // Fetch user's balance
  const fetchBalance = async () => {
    if (!walletAddress) return
    
    try {
      const response = await fetch(`${API_URL}/api/balance?address=${walletAddress}`)
      const data = await response.json()
      if (data.success) {
        setBalance(data.balance)
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
    }
  }

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, 5000)
    return () => clearInterval(interval)
  }, [walletAddress])

  // Execute trade with USER's wallet
  const executeTrade = async (decision, amount) => {
    if (!window.ethereum) {
      setError('Please install MetaMask or Trust Wallet')
      return
    }

    setLoading(true)
    setError(null)
    setTradeResult(null)

    try {
      // Get trade parameters from backend
      const paramsRes = await fetch(`${API_URL}/api/trade-params`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          decision, 
          conviction: 80, 
          amount: amount || 0.001 
        })
      })
      const paramsData = await paramsRes.json()
      
      if (!paramsData.success) {
        throw new Error(paramsData.error || 'Failed to get trade params')
      }

      // Execute swap in browser using user's wallet
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      
      const router = new ethers.Contract(
        paramsData.tradeParams.routerAddress,
        [
          'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[])'
        ],
        signer
      )

      const amountIn = ethers.utils.parseEther(paramsData.tradeParams.amount.toString())
      const tx = await router.swapExactETHForTokens(
        0, // amountOutMin
        paramsData.tradeParams.path,
        walletAddress,
        paramsData.tradeParams.deadline,
        { value: amountIn, gasLimit: 300000 }
      )

      const receipt = await tx.wait()
      
      setTradeResult({
        success: true,
        txHash: receipt.transactionHash,
        price: paramsData.tradeParams.price,
        amount: paramsData.tradeParams.amount
      })
      
      await fetchBalance()
      
    } catch (error) {
      console.error('Trade error:', error)
      setError(error.message || 'Trade failed')
    } finally {
      setLoading(false)
    }
  }

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
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Manual Trading</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              {walletAddress ? 'Execute trades from your wallet' : 'Connect wallet to trade'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchBalance}
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
          {walletAddress && (
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          )}
        </div>
      )}

      {state.currentTrade && (
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          background: state.currentTrade.decision === 'BUY' 
            ? 'rgba(0,212,170,0.05)' 
            : 'rgba(255,107,107,0.05)',
          border: `1px solid ${state.currentTrade.decision === 'BUY' 
            ? 'rgba(0,212,170,0.1)' 
            : 'rgba(255,107,107,0.1)'}`,
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>AI Decision</p>
              <p style={{ 
                fontSize: '24px', 
                fontWeight: 700,
                color: state.currentTrade.decision === 'BUY' ? '#00D4AA' : '#FF6B6B'
              }}>
                {state.currentTrade.decision}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Conviction</p>
              <p style={{ fontSize: '24px', fontWeight: 700 }}>
                {Math.round(state.currentTrade.conviction)}%
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => executeTrade(state.currentTrade?.decision || 'BUY', 0.001)}
        disabled={!walletAddress || loading || state.currentTrade?.decision === 'NO BUY'}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: 600,
          border: 'none',
          cursor: (!walletAddress || loading || state.currentTrade?.decision === 'NO BUY') 
            ? 'default' 
            : 'pointer',
          background: (!walletAddress || loading || state.currentTrade?.decision === 'NO BUY')
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
          color: (!walletAddress || loading || state.currentTrade?.decision === 'NO BUY')
            ? 'rgba(255,255,255,0.3)'
            : 'white'
        }}
      >
        {!walletAddress ? 'Connect Wallet First' :
         loading ? 'Executing...' : 
         state.currentTrade?.decision === 'NO BUY' ? 'No Trade Signal' :
         `Execute Trade (${state.currentTrade?.decision || 'BUY'})`}
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
          ✅ Trade executed!
          <br />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            Tx: {tradeResult.txHash.slice(0, 20)}...{tradeResult.txHash.slice(-10)}
          </span>
          <br />
          <a
            href={`https://bscscan.com/tx/${tradeResult.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#6C3CE1' }}
          >
            View on BSCScan →
          </a>
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
        🔴 You control your funds. AI suggests trades, you approve in your wallet.
        {walletAddress && <span style={{ color: '#00D4AA', marginLeft: '8px' }}>✅ Connected</span>}
      </div>
    </div>
  )
}