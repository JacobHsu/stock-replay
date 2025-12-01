import { DailyNews } from '../../types'

interface NewsModalProps {
  news: DailyNews
  allNews?: DailyNews[] // Optional: all news items for this date range
  onClose: () => void
  onContinue: () => void
}

export default function NewsModal({ news, allNews = [], onClose, onContinue }: NewsModalProps) {
  console.log('[NewsModal] Rendering with news:', news)
  console.log('[NewsModal] All news count:', allNews.length)
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="tv-panel max-w-2xl w-full p-6 space-y-6 animate-fadeIn shadow-tv-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tv-border pb-4">
          <h2 className="text-lg font-semibold text-tv-text flex items-center gap-2">
            <span>📰</span>
            News Alert
          </h2>
          <button
            onClick={onClose}
            className="text-tv-textSecondary hover:text-tv-text transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-tv-text text-sm">
          <span>📅</span>
          <span>{news.date}</span>
          {allNews.length > 1 && (
            <span className="text-tv-textSecondary">
              (含 {allNews.length - 1} 天前新聞)
            </span>
          )}
        </div>

        {/* News Content */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {allNews.length > 0 ? allNews.map((newsItem, index) => (
            <div key={index} className="bg-tv-bg border border-tv-border rounded p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-tv-textSecondary">
                    <span>{newsItem.date}</span>
                  </div>
                  <h3 className="text-base font-semibold text-tv-text">
                    {newsItem.primary_title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-tv-textSecondary">來源:</span>
                    <span className="text-tv-text">{newsItem.primary_source}</span>
                  </div>
                </div>
              </div>
              
              {newsItem.related_count > 0 && (
                <div className="pt-2 border-t border-tv-border">
                  <p className="text-tv-textSecondary text-xs">
                    其他相關報導 ({newsItem.related_count})
                  </p>
                </div>
              )}
            </div>
          )) : (
            <div className="bg-tv-bg border border-tv-border rounded p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <h3 className="text-base font-semibold text-tv-text">
                    {news.primary_title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-tv-textSecondary">來源:</span>
                    <span className="text-tv-text">{news.primary_source}</span>
                  </div>
                </div>
              </div>
              
              {news.related_count > 0 && (
                <div className="pt-2 border-t border-tv-border">
                  <p className="text-tv-textSecondary text-xs">
                    其他相關報導 ({news.related_count})
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Message */}
        <div className="bg-tv-primary/10 border border-tv-primary/30 rounded p-4">
          <p className="text-tv-text text-sm">
            <span className="text-tv-primary">⚠</span> 交易已暫停。請閱讀新聞後繼續播放。
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="tv-button-primary flex-1 px-6 py-2.5"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
