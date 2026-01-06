import { ChevronUp, ChevronDown } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapUpdater } from './MapUpdater.jsx';

export const MetadataSidebar = ({ 
  images, 
  currentIndex, 
  selectedImage, 
  formattedMetadata, 
  selectedImageId,
  onNavigateImage 
}) => {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-black border-r border-gray-800 flex flex-col z-40 overflow-y-auto">
      <div className="p-6 flex-1 flex flex-col">
        {/* 컨트롤 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={() => onNavigateImage('prev')}
              className="hover:text-gray-400 transition-colors"
              disabled={images.length === 0}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onNavigateImage('next')}
              className="hover:text-gray-400 transition-colors"
              disabled={images.length === 0}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">control</p>
          <p className="text-sm text-gray-300">photograph</p>
        </div>

        {/* 현재 이미지 번호 */}
        {images.length > 0 && (
          <div className="mb-8">
            <p className="text-4xl font-light text-gray-300 mb-2">
              {currentIndex + 1}/{images.length}
            </p>
          </div>
        )}

        {/* 메타데이터 정보 */}
        {selectedImage && Object.keys(formattedMetadata).length > 0 && (
          <div className="space-y-6 text-sm">
            {formattedMetadata.camera && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">CAMERA</p>
                <p className="text-white">{formattedMetadata.camera}</p>
              </div>
            )}
            
            {formattedMetadata.exif && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">EXIF</p>
                <p className="text-white">{formattedMetadata.exif}</p>
              </div>
            )}
            
            {formattedMetadata.date && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">DATE</p>
                <p className="text-white">{formattedMetadata.date}</p>
              </div>
            )}
            
            {formattedMetadata.gps && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">LAT. LONG</p>
                <p className="text-white mb-4">{formattedMetadata.gps}</p>
                
                {/* 지도 표시 */}
                {formattedMetadata.gpsCoords && (
                  <div className="mt-4">
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-700">
                      <MapContainer
                        key={`${formattedMetadata.gpsCoords.lat}-${formattedMetadata.gpsCoords.lon}-${selectedImageId}`}
                        center={[formattedMetadata.gpsCoords.lat, formattedMetadata.gpsCoords.lon]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={false}
                      >
                        <MapUpdater center={[formattedMetadata.gpsCoords.lat, formattedMetadata.gpsCoords.lon]} />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[formattedMetadata.gpsCoords.lat, formattedMetadata.gpsCoords.lon]}>
                          <Popup>
                            촬영 위치
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!selectedImage && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            <p>사진을 업로드하세요</p>
          </div>
        )}
      </div>
    </aside>
  );
};


