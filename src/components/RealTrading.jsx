// src/components/RealTrading.jsx - COMPLETE WORKING VERSION WITH TRADE RECORDING
import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useApp } from '../context/AppContext'
import { API_URL } from '../utils/api'
import { ethers } from 'ethers'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Shield, RefreshCw } from 'lucide-react'

export default function RealTrading({ isMobile = false }) {
  const { state, dispatch } = useApp()
  const { address, isConnected } = useAccount()
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tradeResult, setTradeResult] = useState(null)
  const [pendingTrade, setPendingTrade] = useState(null)

  const getPurchasedAgents = () => {
    return state.marketplace
      .filter(item => item.purchased)
      .map(item => item.agent)
  }

  const fetchBalance = async () => {
    if (!isConnected || !address) return
    try {
      const response = await fetch(`${API_URL}/api/balance?address=${address}`)
      const data = await response.json()
      if (data.success) {
        setBalance(data.balance)
      } else {
        console.error('Balance error:', data.error)
        setBalance(null)
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      setBalance(null)
    }
  }

  const checkPendingTrade = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`)
      const data = await response.json()
      if (data.success && data.pendingTrade) {
        console.log('📊 Pending trade found:', data.pendingTrade)
        setPendingTrade(data.pendingTrade)
      } else {
        setPendingTrade(null)
      }
    } catch (error) {
      console.error('Failed to check pending trade:', error)
    }
  }

  useEffect(() => {
    fetchBalance()
    checkPendingTrade()
    const balanceInterval = setInterval(fetchBalance, 5000)
    const tradeInterval = setInterval(checkPendingTrade, 2000)
    return () => {
      clearInterval(balanceInterval)
      clearInterval(tradeInterval)
    }
  }, [address, isConnected, state.marketplace])

  const executePendingTrade = async () => {
    console.log('🔍 executePendingTrade called')
    console.log('isConnected:', isConnected)
    console.log('address:', address)
    console.log('pendingTrade:', pendingTrade)

    if (!isConnected || !address) {
      setError('❌ Wallet not connected. Please connect your wallet first.')
      return
    }

    if (!pendingTrade) {
      setError('No trade to execute')
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
      console.log('📈 Executing trade with params:', pendingTrade)

      const provider = new ethers.providers.Web3Provider(window.ethereum)
      
      const network = await provider.getNetwork()
      console.log(`🔗 Network: ${network.chainId}`)
      
      if (network.chainId !== 56) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }]
          })
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (switchError) {
          setError('❌ Please switch to BNB Smart Chain')
          setLoading(false)
          return
        }
      }

      const signer = provider.getSigner()
      
      const router = new ethers.Contract(
        pendingTrade.routerAddress,
        [
          'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[])'
        ],
        signer
      )

      const amountIn = ethers.BigNumber.from(pendingTrade.amountIn)
      const deadline = pendingTrade.deadline || Math.floor(Date.now() / 1000) + 60 * 20

      console.log('🔔 Sending transaction with params:', {
        to: pendingTrade.routerAddress,
        value: ethers.utils.formatEther(amountIn),
        path: pendingTrade.path,
        deadline: deadline
      })

      console.log('🔔 Attempting to send transaction - WALLET POPUP SHOULD APPEAR NOW')
      
      const tx = await router.swapExactETHForTokens(
        0,
        pendingTrade.path,
        address,
        deadline,
        { 
          value: amountIn, 
          gasLimit: 300000 
        }
      )

      console.log('✅ Transaction sent:', tx.hash)
      
      console.log('⏳ Waiting for confirmation...')
      const receipt = await tx.wait()
      console.log('✅ Confirmed! Block:', receipt.blockNumber)

      // ✅ RECORD THE TRADE IN BACKEND
      try {
        const recordResponse = await fetch(`${API_URL}/api/record-trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: receipt.transactionHash,
            action: pendingTrade.action || 'BUY',
            amountIn: pendingTrade.amountIn,
            price: pendingTrade.price,
            expectedUSDT: pendingTrade.expectedUSDT || 0,
            blockNumber: receipt.blockNumber,
            walletAddress: address
          })
        })
        const recordData = await recordResponse.json()
        console.log('✅ Trade recorded in backend:', recordData)
      } catch (recordError) {
        console.error('Failed to record trade:', recordError)
      }

      setTradeResult({
        success: true,
        txHash: receipt.transactionHash,
        price: pendingTrade.price,
        amount: ethers.utils.formatEther(amountIn)
      })

      setPendingTrade(null)
      await fetchBalance()

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
      
      if (error.code === 4001) {
        setError('❌ You rejected the transaction in your wallet')
      } else if (error.code === -32603) {
        setError('❌ Transaction failed. Make sure you have enough BNB for gas fees.')
      } else if (error.message && error.message.includes('insufficient funds')) {
        setError('❌ Insufficient BNB balance. Please add more BNB for gas fees.')
      } else if (error.message && error.message.includes('user rejected')) {
        setError('❌ Transaction rejected in wallet')
      } else {
        setError(`❌ ${error.message || 'Trade failed'}`)
      }
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
            <p style={{ 
              fontSize: '13px', 
              color: !isConnected ? '#FF6B6B' : pendingTrade ? '#00D4AA' : 'rgba(255,255,255,0.4)'
            }}>
              {!isConnected ? '🔴 Wallet not connected' :
               pendingTrade ? '⚠️ Click "Confirm Trade in Wallet" to execute' : 'Waiting for AI signal...'}
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

      <div style={{
        padding: '10px 14px',
        borderRadius: '10px',
        marginBottom: '16px',
        background: isConnected ? 'rgba(0,212,170,0.05)' : 'rgba(255,107,107,0.05)',
        border: `1px solid ${isConnected ? 'rgba(0,212,170,0.1)' : 'rgba(255,107,107,0.15)'}`
      }}>
        <span style={{ fontSize: '13px', color: isConnected ? '#00D4AA' : '#FF6B6B' }}>
          {isConnected ? '🟢 Wallet Connected' : '🔴 Wallet Not Connected'}
        </span>
        {address && isConnected && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', float: 'right' }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
      </div>

      {balance !== null && isConnected ? (
        <div style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.04)',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Your Balance</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#00D4AA' }}>
            {Number(balance || 0).toFixed(4)} BNB
          </p>
        </div>
      ) : isConnected ? (
        <div style={{
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
          marginBottom: '20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)'
        }}>
          ⏳ Loading balance...
        </div>
      ) : null}

      {pendingTrade && isConnected && (
        <div style={{
          padding: '16px',
          borderRadius: '14px',
          marginBottom: '16px',
          background: 'rgba(0,212,170,0.1)',
          border: '1px solid rgba(0,212,170,0.2)'
        }}>
          <h4 style={{ fontSize: '14px', color: '#00D4AA', marginBottom: '8px' }}>
            🚀 AI Trade Ready
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Action</p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#00D4AA' }}>
                {pendingTrade.action || 'BUY'}
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
                ${Number(pendingTrade?.price || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={executePendingTrade}
        disabled={!isConnected || !address || loading || !pendingTrade}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: 600,
          border: 'none',
          cursor: (!isConnected || !address || loading || !pendingTrade) 
            ? 'default' 
            : 'pointer',
          background: (!isConnected || !address || loading || !pendingTrade)
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, #6C3CE1, #00D4AA)',
          color: (!isConnected || !address || loading || !pendingTrade)
            ? 'rgba(255,255,255,0.3)'
            : 'white'
        }}
      >
        {!isConnected ? '🔴 Connect Wallet First' :
         loading ? '⏳ Processing...' : 
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
          <br />
          <a
            href={`https://bscscan.com/tx/${tradeResult.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#6C3CE1' }}
          >
            🔗 View on BSCScan
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
        {!isConnected ? (
          '🔴 Connect your wallet to trade'
        ) : pendingTrade ? (
          '🔴 Click "Confirm Trade in Wallet" to execute'
        ) : purchasedCount > 0 ? (
          `🔴 Using ${purchasedCount}/3 purchased agents`
        ) : (
          '⚠️ No agents purchased - buy signals in Marketplace'
        )}
      </div>
    </div>
  )
}
