import React from 'react'
import { TrendingUp } from 'lucide-react'

interface CryptoButtonsProps {
  currentSymbol: string
  onSelectCrypto: (symbol: string) => void
}

/**
 * 顯示熱門虛擬幣的快速切換按鈕
 */
export const CryptoButtons: React.FC<CryptoButtonsProps> = ({
  currentSymbol,
  onSelectCrypto,
}) => {
  // 熱門虛擬幣列表
  const cryptos = [
    { code: 'BTC', symbol: 'BTC-USD', name: 'Bitcoin' },
    { code: 'ETH', symbol: 'ETH-USD', name: 'Ethereum' },
    { code: 'SOL', symbol: 'SOL-USD', name: 'Solana' },
    { code: 'BNB', symbol: 'BNB-USD', name: 'Binance Coin' },
  ]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-tv-textSecondary text-xs">
        <TrendingUp className="w-3.5 h-3.5 text-tv-primary" />
        <span>熱門幣</span>
      </div>
      
      <div className="flex gap-1.5">
        {cryptos.map((crypto) => {
          const isActive = currentSymbol === crypto.symbol
          
          return (
            <button
              key={crypto.symbol}
              onClick={() => onSelectCrypto(crypto.symbol)}
              disabled={isActive}
              className={`
                px-2.5 py-1 rounded text-xs font-medium transition-all
                ${isActive 
                  ? 'bg-tv-primary text-white cursor-default' 
                  : 'bg-tv-surface text-tv-text hover:bg-tv-surfaceHover border border-tv-border hover:border-tv-primary'
                }
              `}
              title={crypto.name}
            >
              <span className="font-semibold">{crypto.code}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CryptoButtons
