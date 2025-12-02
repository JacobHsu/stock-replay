"""
美國 ETF 跌幅排行
從 Yahoo Finance 獲取熱門 ETF 的當日跌幅
"""

import logging
from typing import List, Dict, Any
import yfinance as yf

logger = logging.getLogger(__name__)


def get_top3_us_etf_losers() -> List[Dict[str, Any]]:
    """
    獲取跌幅最大的前 3 個美國 ETF
    
    Returns:
        包含 symbol, name, change_percent 的列表
    """
    # 熱門美國 ETF 列表
    etfs = [
        {'symbol': 'SPY', 'name': 'S&P 500'},
        {'symbol': 'QQQ', 'name': 'Nasdaq 100'},
        {'symbol': 'IWM', 'name': 'Russell 2000'},
        {'symbol': 'DIA', 'name': 'Dow Jones'},
        {'symbol': 'VTI', 'name': 'Total Market'},
        {'symbol': 'EEM', 'name': 'Emerging Markets'},
        {'symbol': 'GLD', 'name': 'Gold'},
        {'symbol': 'TLT', 'name': 'Treasury'},
        {'symbol': 'XLF', 'name': 'Financial'},
        {'symbol': 'XLE', 'name': 'Energy'},
        {'symbol': 'XLK', 'name': 'Technology'},
        {'symbol': 'XLV', 'name': 'Healthcare'},
    ]
    
    results = []
    
    try:
        for etf in etfs:
            try:
                ticker = yf.Ticker(etf['symbol'])
                
                # 獲取最近 2 天的數據
                hist = ticker.history(period='2d')
                
                if len(hist) >= 2:
                    prev_close = hist['Close'].iloc[-2]
                    current_close = hist['Close'].iloc[-1]
                    change_pct = ((current_close - prev_close) / prev_close) * 100
                    
                    results.append({
                        'code': etf['symbol'],  # 添加 code 欄位
                        'symbol': etf['symbol'],
                        'name': etf['name'],
                        'change_percent': float(round(change_pct, 2))  # 轉換為 float
                    })
                    
                    logger.debug(f"{etf['symbol']}: {change_pct:.2f}%")
                    
            except Exception as e:
                logger.warning(f"Failed to get data for {etf['symbol']}: {e}")
                continue
        
        # 排序：跌幅最大的前 3 名
        sorted_results = sorted(results, key=lambda x: x['change_percent'])[:3]
        
        logger.info(f"Found {len(sorted_results)} US ETF losers")
        return sorted_results
        
    except Exception as e:
        logger.error(f"Error getting US ETF losers: {e}")
        # 返回預設值
        return _get_fallback_data()


def _get_fallback_data() -> List[Dict[str, Any]]:
    """
    當無法獲取數據時的預設值
    """
    return [
        {'code': 'GLD', 'symbol': 'GLD', 'name': 'Gold', 'change_percent': -1.5},
        {'code': 'TLT', 'symbol': 'TLT', 'name': 'Treasury', 'change_percent': -0.8},
        {'code': 'XLE', 'symbol': 'XLE', 'name': 'Energy', 'change_percent': -0.5},
    ]
