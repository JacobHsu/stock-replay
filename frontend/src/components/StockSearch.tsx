import React, { useState, useEffect, useRef } from 'react'
import { getStockInfo, searchStocks } from '../services/api'
import type { StockInfo } from '../types'

interface StockSearchProps {
  value: string
  onChange: (symbol: string) => void
  placeholder?: string
  className?: string
}

/**
 * Stock search component that supports both stock code and Chinese name input
 * Displays results as "8033.TW - 雷虎" but returns the symbol (e.g., "8033.TW")
 */
export const StockSearch: React.FC<StockSearchProps> = ({
  value,
  onChange,
  placeholder = 'Enter stock code or Chinese name (e.g., 8033 or 雷虎)',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('')
  const [displayValue, setDisplayValue] = useState('')
  const [suggestions, setSuggestions] = useState<StockInfo[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Initialize display value from prop
  useEffect(() => {
    if (value) {
      setDisplayValue(value)
      // Try to fetch stock info to get display name
      const fetchInfo = async () => {
        try {
          const info = await getStockInfo(value)
          setDisplayValue(info.display_name)
        } catch {
          // Keep the symbol if fetch fails
          setDisplayValue(value)
        }
      }
      fetchInfo()
    }
  }, [value])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.trim().length === 0) {
        setSuggestions([])
        setShowSuggestions(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Use search API which supports both code and Chinese name
        const results = await searchStocks(inputValue.trim())
        
        if (results.length > 0) {
          setSuggestions(results)
          setShowSuggestions(true)
        } else {
          setError('Stock not found')
          setSuggestions([])
          setShowSuggestions(false)
        }
      } catch (err) {
        setError('Search failed. Please try again.')
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setError(null)
  }

  const handleSelectStock = (stock: StockInfo) => {
    setDisplayValue(stock.display_name)
    setInputValue('')
    setShowSuggestions(false)
    setError(null)
    onChange(stock.symbol)
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <div className="relative">
      {/* Input field */}
      {(
        <>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className={`w-full px-3 py-2 bg-tv-bg border rounded text-tv-text placeholder-tv-textSecondary text-sm focus:outline-none focus:border-tv-primary transition-colors ${
              error ? 'border-tv-danger' : 'border-tv-border hover:border-tv-borderLight'
            } ${className}`}
          />

          {/* Loading indicator */}
          {loading && (
            <div className="absolute right-3 top-2.5 text-tv-primary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-1 text-xs text-tv-danger">{error}</div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-tv-surface border border-tv-border rounded shadow-tv-lg max-h-60 overflow-auto"
            >
              {suggestions.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  className="w-full px-4 py-2 text-left hover:bg-tv-surfaceHover transition-colors border-b border-tv-border last:border-b-0 group"
                >
                  <div className="font-medium text-tv-text text-sm">{stock.display_name}</div>
                  <div className="text-xs text-tv-textSecondary">{stock.symbol}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default StockSearch
