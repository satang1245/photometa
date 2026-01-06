import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const ImageLightbox = ({ 
  isOpen, 
  images, 
  currentIndex, 
  onClose, 
  onNavigate 
}) => {
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

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
        aria-label="닫기"
      >
        <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>

      {/* 이미지 카운터 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
        <span className="text-white text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      {/* 이전 버튼 */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('prev')}
          className="absolute left-4 md:left-8 z-10 p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all group hover:scale-110"
          aria-label="이전 이미지"
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </button>
      )}

      {/* 메인 이미지 */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 md:p-16"
        onClick={handleBackdropClick}
      >
        <img
          src={currentImage.url}
          alt={`Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain select-none animate-fadeIn"
          draggable={false}
        />
      </div>

      {/* 다음 버튼 */}
      {images.length > 1 && (
        <button
          onClick={() => onNavigate('next')}
          className="absolute right-4 md:right-8 z-10 p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all group hover:scale-110"
          aria-label="다음 이미지"
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
        </button>
      )}

      {/* 하단 썸네일 스트립 */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 max-w-[90vw] overflow-x-auto">
          <div className="flex gap-2 p-2 rounded-xl bg-black/50 backdrop-blur-sm">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => onNavigate(index)}
                className={`flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden transition-all ${
                  index === currentIndex 
                    ? 'ring-2 ring-white scale-110' 
                    : 'opacity-50 hover:opacity-80'
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


