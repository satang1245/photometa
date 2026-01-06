import { X } from 'lucide-react';

export const ThumbnailGrid = ({ images, selectedImageId, onThumbnailClick, onRemoveImage }) => {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 justify-center items-center">
      {images.map((image, index) => (
        <div
          key={image.id}
          className={`relative group cursor-pointer transition-all ${
            selectedImageId === image.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
          }`}
          onClick={() => onThumbnailClick(image.id, index)}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-gray-700 hover:border-gray-500 transition-colors">
            <img 
              src={image.thumbnailUrl} 
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {image.loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          {/* 삭제 버튼 - 모바일에서는 선택된 이미지에 항상 표시 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveImage(image.id);
            }}
            className={`absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 rounded-full flex items-center justify-center transition-opacity hover:bg-red-600 ${
              selectedImageId === image.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};


