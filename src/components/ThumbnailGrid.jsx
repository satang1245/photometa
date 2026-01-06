import { X } from 'lucide-react';

export const ThumbnailGrid = ({ images, selectedImageId, onThumbnailClick, onRemoveImage }) => {
  return (
    <div className="flex flex-wrap gap-4 justify-center items-center">
      {images.map((image, index) => (
        <div
          key={image.id}
          className={`relative group cursor-pointer transition-all ${
            selectedImageId === image.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
          }`}
          onClick={() => onThumbnailClick(image.id, index)}
        >
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-700 hover:border-gray-500 transition-colors">
            <img 
              src={image.thumbnailUrl} 
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {image.loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveImage(image.id);
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};


