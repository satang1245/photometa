import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapUpdater } from './MapUpdater.jsx';
import { reverseGeocode } from '../utils/geocodingUtils.js';

export const MetadataSidebar = ({ 
  images, 
  currentIndex, 
  selectedImage, 
  formattedMetadata, 
  selectedImageId,
  onNavigateImage,
  isMobile = false,
  onClose
}) => {
  const [address, setAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // GPS 좌표가 변경될 때마다 주소 조회
  useEffect(() => {
    const fetchAddress = async () => {
      if (formattedMetadata.gpsCoords) {
        setIsLoadingAddress(true);
        const { lat, lon } = formattedMetadata.gpsCoords;
        const result = await reverseGeocode(lat, lon);
        setAddress(result);
        setIsLoadingAddress(false);
      } else {
        setAddress(null);
      }
    };

    fetchAddress();
  }, [formattedMetadata.gpsCoords?.lat, formattedMetadata.gpsCoords?.lon]);
  return (
    <aside className={`${isMobile ? 'relative w-full' : 'fixed left-0 top-16 bottom-0 w-64'} bg-black border-r border-gray-800 flex flex-col z-40 overflow-y-auto`}>
      {/* 모바일 닫기 버튼 */}
      {isMobile && onClose && (
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <span className="text-sm text-gray-400">메타데이터</span>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className={`${isMobile ? 'p-4' : 'p-6'} flex-1 flex flex-col`}>
        {/* 컨트롤 */}
        <div className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={() => onNavigateImage('prev')}
              className="hover:text-gray-400 transition-colors p-1"
              disabled={images.length === 0}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onNavigateImage('next')}
              className="hover:text-gray-400 transition-colors p-1"
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
          <div className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
            <p className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-light text-gray-300 mb-2`}>
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
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  LOCATION
                </p>
                {isLoadingAddress ? (
                  <p className="text-gray-500 text-sm mb-4">주소 조회 중...</p>
                ) : address ? (
                  <p className="text-white mb-4 text-sm leading-relaxed">{address}</p>
                ) : (
                  <p className="text-white mb-4">{formattedMetadata.gps}</p>
                )}
                
                {/* 지도 표시 */}
                {formattedMetadata.gpsCoords && (
                  <div className="mt-4">
                    <div className={`w-full ${isMobile ? 'h-40' : 'h-48'} rounded-lg overflow-hidden border border-gray-700`}>
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


