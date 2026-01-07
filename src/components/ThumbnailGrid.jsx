import { X } from 'lucide-react';
import { useRef, useEffect } from 'react';

export const ThumbnailGrid = ({ images, selectedImageId, onThumbnailClick, onRemoveImage, previewRef, onTransitionStart, onTransitionEnd }) => {
  const containerRef = useRef(null);
  const itemRefs = useRef({});

  // 선택된 썸네일이 변경되면 해당 위치로 스크롤
  useEffect(() => {
    if (selectedImageId && itemRefs.current[selectedImageId] && containerRef.current) {
      const container = containerRef.current;
      const item = itemRefs.current[selectedImageId];
      
      setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const scrollLeft = item.offsetLeft - (containerRect.width / 2) + (itemRect.width / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [selectedImageId]);


  // 썸네일 클릭 시 바로 이미지 변경
  const handleThumbnailClick = (image, index, e) => {
    onThumbnailClick(image.id, index);
  };

  return (
    <div className="relative">
      {/* 타임라인 자(ruler) 컨테이너 */}
      <div 
        ref={containerRef}
        className="relative flex items-end gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-4 px-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent scroll-smooth"
      >
        {/* 기준선 (자의 몸체) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 rounded-full" />
        
        {images.map((image, index) => {
          const isSelected = selectedImageId === image.id;
          
          return (
            <div
              key={image.id}
              ref={(el) => { itemRefs.current[image.id] = el; }}
              className="relative group flex flex-col items-center flex-shrink-0"
            >
              {/* 사진 눈금 */}
              <div
                className={`relative cursor-pointer ${
                  isSelected 
                    ? 'z-10' 
                    : 'hover:z-5'
                }`}
                style={{
                  width: '36px',
                  height: '36px',
                  transition: 'box-shadow 300ms ease-out',
                  boxShadow: isSelected ? '0 10px 25px -5px rgba(255, 255, 255, 0.2)' : 'none'
                }}
                onClick={(e) => handleThumbnailClick(image, index, e)}
              >
                {/* 이미지 컨테이너 */}
                <div 
                  className="w-full h-full overflow-hidden rounded-sm"
                  style={{
                    border: isSelected ? '2px solid rgba(255, 255, 255, 0.8)' : '1px solid rgb(75, 85, 99)',
                    transition: 'border 300ms ease-out'
                  }}
                >
                  <img 
                    src={image.thumbnailUrl} 
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    style={{
                      filter: isSelected ? 'grayscale(0)' : 'grayscale(1)',
                      opacity: isSelected ? 1 : 0.7,
                      transition: 'filter 400ms ease-out, opacity 400ms ease-out, transform 300ms ease-out',
                      transform: isSelected ? 'scale(1)' : 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.filter = 'grayscale(0)';
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.filter = 'grayscale(1)';
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                    loading="lazy"
                  />
                  {/* 로딩 오버레이 */}
                  {image.loading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-2 h-2 md:w-3 md:h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {/* 삭제 버튼 */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage(image.id);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-20"
                  >
                    <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 좌우 그라데이션 페이드 */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
    </div>
  );
};
