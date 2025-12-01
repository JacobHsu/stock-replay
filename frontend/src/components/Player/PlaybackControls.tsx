import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react'

interface PlaybackControlsProps {
  isPlaying: boolean
  currentIndex: number
  totalCount: number
  playbackSpeed: number
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onReset: () => void
  onSeek: (index: number) => void
  onSpeedChange: (speed: number) => void
}

export default function PlaybackControls({
  isPlaying,
  currentIndex,
  totalCount,
  playbackSpeed,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onReset,
  onSeek,
  onSpeedChange,
}: PlaybackControlsProps) {
  const progress = totalCount > 0 ? (currentIndex / totalCount) * 100 : 0

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value)
    onSeek(index)
  }

  return (
    <div className="tv-panel p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-tv-text uppercase tracking-wide">
          Playback Control
        </h3>
        <div className="text-tv-textSecondary text-sm">
          {currentIndex} / {totalCount}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative h-1 bg-tv-bg rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-tv-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <input
          type="range"
          min="0"
          max={Math.max(0, totalCount - 1)}
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={totalCount === 0}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-transparent
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-tv-primary 
                     [&::-webkit-slider-thumb]:cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onReset}
          disabled={totalCount === 0}
          className="tv-button p-2 rounded hover:bg-tv-surfaceHover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={onPrevious}
          disabled={currentIndex === 0 || totalCount === 0}
          className="tv-button p-2 rounded hover:bg-tv-surfaceHover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={totalCount === 0}
          className={`p-3 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
            isPlaying ? 'bg-tv-primary text-white hover:bg-tv-primaryHover' : 'tv-button hover:bg-tv-surfaceHover'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalCount - 1 || totalCount === 0}
          className="tv-button p-2 rounded hover:bg-tv-surfaceHover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Speed Control */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-tv-textSecondary text-sm">Speed:</span>
        <div className="flex gap-1">
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              disabled={totalCount === 0}
              className={`px-3 py-1 rounded text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                playbackSpeed === speed
                  ? 'bg-tv-primary text-white font-semibold'
                  : 'bg-tv-surface text-tv-text hover:bg-tv-surfaceHover border border-tv-border'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="text-center text-tv-textSecondary text-sm">
        {isPlaying ? (
          <span>Playing at {playbackSpeed}x speed</span>
        ) : (
          <span>Paused</span>
        )}
      </div>
    </div>
  )
}
