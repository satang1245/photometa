import { useEffect, useCallback, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const ImageLightbox = ({ 
  isOpen, 
  images, 
  currentIndex, 
  onClose, 
  onNavigate 
}) => {
  // 터치 스와이프를 위한 상태
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipingHorizontal, setIsSwipingHorizontal] = useState(null);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        onNavigate('prev');
        break;
      case 'ArrowRight':
        onNavigate('next');
        break;
      default:
        break;
    }
  }, [isOpen, onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 스와이프 오프셋 리셋
  useEffect(() => {
    setSwipeOffset(0);
  }, [currentIndex]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 터치 이벤트 핸들러
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    setIsSwipingHorizontal(null);
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // 방향 결정 (첫 이동 시)
    if (isSwipingHorizontal === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      setIsSwipingHorizontal(Math.abs(deltaX) > Math.abs(deltaY));
    }
    
    // 수평 스와이프인 경우에만 오프셋 적용
    if (isSwipingHorizontal) {
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwipingHorizontal) {
      setSwipeOffset(0);
      setIsSwipingHorizontal(null);
      return;
    }
    
    const swipeDistance = touchEndX.current - touchStartX.current;
    const threshold = 80; // 스와이프 임계값
    
    if (Math.abs(swipeDistance) > threshold) {
      if (swipeDistance > 0) {
        onNavigate('prev');
      } else {
        onNavigate('next');
      }
    }
    
    setSwipeOffset(0);
    setIsSwipingHorizontal(null);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors group"
        aria-label="닫기"
      >
        <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform" />
      </button>

      {/* 이미지 카운터 */}
      <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm">
        <span className="text-white text-xs sm:text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      {/* 이전 버튼 - 데스크톱에서만 표시 */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('prev')}
          className="hidden sm:block absolute left-4 md:left-8 z-10 p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all group hover:scale-110"
          aria-label="이전 이미지"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </button>
      )}

      {/* 메인 이미지 - 터치 스와이프 지원 */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 md:p-16 touch-pan-y"
        onClick={handleBackdropClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentImage.url}
          alt={`Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain select-none animate-fadeIn transition-transform duration-150"
          style={{ 
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
            opacity: swipeOffset !== 0 ? Math.max(0.5, 1 - Math.abs(swipeOffset) / 300) : 1
          }}
          draggable={false}
        />
        
        {/* 모바일 스와이프 힌트 */}
        {images.length > 1 && (
          <div className="sm:hidden absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/40 text-xs">
            <span>← 스와이프</span>
            <span>→</span>
          </div>
        )}
      </div>

      {/* 다음 버튼 - 데스크톱에서만 표시 */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('next')}
          className="hidden sm:block absolute right-4 md:right-8 z-10 p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all group hover:scale-110"
          aria-label="다음 이미지"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </button>
      )}

      {/* 하단 썸네일 스트립 */}
      {images.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 max-w-[95vw] sm:max-w-[90vw] overflow-x-auto">
          <div className="flex gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/50 backdrop-blur-sm">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => onNavigate(index)}
                className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-md sm:rounded-lg overflow-hidden transition-all ${
                  index === currentIndex 
                    ? 'ring-2 ring-white scale-105 sm:scale-110' 
                    : 'opacity-50 hover:opacity-80 active:opacity-90'
                }`}
              >
                <img
                  src={image.thumbnailUrl}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


