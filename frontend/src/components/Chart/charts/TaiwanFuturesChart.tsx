'use client';

import { useState, useEffect } from 'react';
import { SimpleTradingViewChart } from './SimpleTradingViewChart';
// import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Skeleton } from '@/components/ui/skeleton';
import type { TriggerEvent } from '@/types';

// Temporary placeholder components
const Alert = ({ children, ...props }: any) => <div className="alert" {...props}>{children}</div>;
const AlertDescription = ({ children, ...props }: any) => <div {...props}>{children}</div>;
const Skeleton = ({ className, ...props }: any) => <div className={`animate-pulse bg-gray-700 ${className}`} {...props} />;

interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TaiwanFuturesChartProps {
  product?: string;
  timeRange?: string;
  interval?: string;
  height?: number;
  triggerEvents?: TriggerEvent[];
  showTriggerEvents?: boolean;
  showSignalNames?: boolean;
  enabledIndicators?: string[];
}

interface APIResponse {
  success: boolean;
  data: ChartData[];
  symbol: string;
  interval?: string;
  timezone?: string;
  count: number;
  start_time?: number;
  end_time?: number;
  error?: string;
  contracts_used?: string[];
}

export function TaiwanFuturesChart({ 
  product = 'MXF', 
  timeRange = '-1d',
  interval = '5m',
  height = 600,
  triggerEvents = [],
  showTriggerEvents = false,
  showSignalNames = false,
  enabledIndicators = []
}: TaiwanFuturesChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate appropriate data limit based on time range and interval
  const calculateDataLimit = (timeRange: string, interval: string): number => {
    const intervalMinutes = {
      '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440
    }[interval] || 5;

    const timeRangeDays = {
      '-1h': 1/24, '-6h': 6/24, '-12h': 12/24, '-1d': 1, '-3d': 3, 
      '-1w': 7, '-2w': 14, '-3w': 21, '-4w': 28, '-1M': 30, '-3M': 90, '-6M': 180, '-1y': 365
    }[timeRange] || 1;

    // Calculate theoretical data points and add buffer
    const theoreticalPoints = (timeRangeDays * 24 * 60) / intervalMinutes;
    const bufferMultiplier = 1.5; // 50% buffer for missing data and technical indicators
    
    return Math.min(Math.max(Math.ceil(theoreticalPoints * bufferMultiplier), 200), 50000);
  };

  // Fetch chart data from continuous futures API
  const fetchChartData = async () => {
    if (!product) {
      setChartData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dataLimit = calculateDataLimit(timeRange, interval);
      
      const params = new URLSearchParams({
        product: product,
        start_time: timeRange,
        interval: interval,
        limit: dataLimit.toString()
      });

      const response = await fetch(`/api/v1/taiwan-futures/continuous-kline?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: APIResponse = await response.json();

      if (data.success) {
        setChartData(data.data);
      } else {
        setError(data.error || 'Failed to fetch chart data');
        setChartData([]);
      }
      
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when props change
  useEffect(() => {
    fetchChartData();
  }, [product, timeRange, interval]);

  // Calculate Moving Averages
  const calculateMA = (data: ChartData[], period: number): (number | undefined)[] => {
    const result: (number | undefined)[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(undefined);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        result.push(sum / period);
      }
    }
    
    return result;
  };

  // Pre-calculate all MA values
  const ma5Values = calculateMA(chartData, 5);
  const ma10Values = calculateMA(chartData, 10);
  const ma20Values = calculateMA(chartData, 20);
  const ma60Values = calculateMA(chartData, 60);

  // Transform data for SimpleTradingViewChart (StockData format) with MA
  const transformedStockData = chartData.map((item, index) => {
    return {
      timestamp: new Date(item.time * 1000).toISOString(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      ma_5: ma5Values[index],
      ma_10: ma10Values[index],
      ma_20: ma20Values[index],
      ma_60: ma60Values[index]
    };
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertDescription className="text-red-800">
          載入圖表失敗: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!product) {
    return (
      <Alert>
        <AlertDescription>
          請選擇期貨產品以顯示圖表
        </AlertDescription>
      </Alert>
    );
  }

  if (chartData.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          暫無 {product} 圖表數據，請稍後重試或選擇其他時間範圍
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {product} 連續合約 • {chartData.length} 筆數據
          {enabledIndicators.length > 0 && (
            <span className="ml-2">• {enabledIndicators.length} 個指標已啟用</span>
          )}
        </div>
      </div>
      
      <SimpleTradingViewChart
        stockData={transformedStockData}
        height={height}
        showVolume={true}
        triggerEvents={triggerEvents}
        showTriggerEvents={showTriggerEvents}
        showSignalNames={showSignalNames}
        showMA={true}
        maPeriods={[5, 10, 20, 60]}
        showRSI={enabledIndicators.includes('rsi_divergence')}
        showBB={enabledIndicators.includes('bollinger_bands')}
        showMACD={enabledIndicators.includes('macd')}
      />
    </div>
  );
}
