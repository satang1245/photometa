import { useState, useEffect } from 'react';
import ExifReader from 'exifreader';
import { Upload, Map, LayoutGrid } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { createThumbnail, sortImagesByTime } from './utils/imageUtils.js';
import { formatMetadata } from './utils/metadataUtils.js';
import { resetCarMarker } from './components/AnimatedCarMarker.jsx';
import { MetadataSidebar } from './components/MetadataSidebar.jsx';
import { ImageUploader } from './components/ImageUploader.jsx';
import { ThumbnailGrid } from './components/ThumbnailGrid.jsx';
import { ImagePreview } from './components/ImagePreview.jsx';
import { MapMode } from './components/MapMode.jsx';
import { ImageLightbox } from './components/ImageLightbox.jsx';
import { BoardMode } from './components/BoardMode.jsx';

// Leaflet 마커 아이콘 설정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function App() {
  const [images, setImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMapMode, setIsMapMode] = useState(false);
  const [isRoutePlaying, setIsRoutePlaying] = useState(false);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isBoardMode, setIsBoardMode] = useState(false);
  const [boardPhotoLayouts, setBoardPhotoLayouts] = useState([]);

  const selectedImage = images.find(img => img.id === selectedImageId) || images[currentIndex] || null;

  // 파일 처리 공통 함수
  const processFiles = async (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: fileArray.length });

    const timestamp = Date.now();
    const quickImages = [];
    
    // 썸네일 생성 단계
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        const id = `${timestamp}-${i}`;
        const url = URL.createObjectURL(file);
        const thumbnailUrl = await createThumbnail(file, 200);
        
        quickImages.push({
          id,
          url,
          thumbnailUrl,
          metadata: {},
          file,
          loading: true
        });
        
        setUploadProgress({ current: i + 1, total: fileArray.length });
      } catch (error) {
        console.error('이미지 처리 중 오류:', error);
        setUploadProgress({ current: i + 1, total: fileArray.length });
      }
    }

    setImages(prev => {
      const updated = [...prev, ...quickImages];
      return sortImagesByTime(updated);
    });
    
    if (quickImages.length > 0 && !selectedImageId) {
      setSelectedImageId(quickImages[0].id);
      setCurrentIndex(images.length);
    }

    // 메타데이터는 백그라운드에서 처리 (로딩바는 썸네일 생성 완료 후 숨김)
    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });

    for (let i = 0; i < quickImages.length; i++) {
      const imageData = quickImages[i];
      try {
        const metadata = await ExifReader.load(imageData.file);
        setImages(prev => {
          const updated = prev.map(img => 
            img.id === imageData.id 
              ? { ...img, metadata, loading: false }
              : img
          );
          return sortImagesByTime(updated);
        });
      } catch (error) {
        console.error('메타데이터를 읽는 중 오류가 발생했습니다:', error);
        setImages(prev => prev.map(img => 
          img.id === imageData.id 
            ? { ...img, loading: false }
            : img
        ));
      }
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (files) {
      await processFiles(files);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleThumbnailClick = (imageId, index) => {
    setSelectedImageId(imageId);
    setCurrentIndex(index);
  };

  const handlePreviewClick = () => {
    setLightboxIndex(currentIndex);
    setIsLightboxOpen(true);
  };

  const handleLightboxNavigate = (direction) => {
    if (typeof direction === 'number') {
      // 특정 인덱스로 직접 이동
      setLightboxIndex(direction);
      setSelectedImageId(images[direction].id);
      setCurrentIndex(direction);
    } else if (direction === 'prev') {
      const newIndex = (lightboxIndex - 1 + images.length) % images.length;
      setLightboxIndex(newIndex);
      setSelectedImageId(images[newIndex].id);
      setCurrentIndex(newIndex);
    } else if (direction === 'next') {
      const newIndex = (lightboxIndex + 1) % images.length;
      setLightboxIndex(newIndex);
      setSelectedImageId(images[newIndex].id);
      setCurrentIndex(newIndex);
    }
  };

  const handleLightboxClose = () => {
    setIsLightboxOpen(false);
  };

  const handleRemoveImage = (imageId) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      URL.revokeObjectURL(image.url);
      URL.revokeObjectURL(image.thumbnailUrl);
    }
    const newImages = images.filter(img => img.id !== imageId);
    setImages(newImages);
    
    if (selectedImageId === imageId) {
      if (newImages.length > 0) {
        const newIndex = Math.min(currentIndex, newImages.length - 1);
        setSelectedImageId(newImages[newIndex].id);
        setCurrentIndex(newIndex);
      } else {
        setSelectedImageId(null);
        setCurrentIndex(0);
      }
    }
  };

  const navigateImage = (direction) => {
    if (images.length === 0) return;
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % images.length
      : (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    setSelectedImageId(images[newIndex].id);
  };

  const formattedMetadata = selectedImage ? formatMetadata(selectedImage.metadata) : {};

  // 모든 GPS 좌표 수집
  const getAllGPSLocations = () => {
    const locations = [];
    
    images.forEach(image => {
      if (image.metadata && Object.keys(image.metadata).length > 0) {
        const formatted = formatMetadata(image.metadata);
        if (formatted.gpsCoords) {
          locations.push({ image, coords: formatted.gpsCoords });
        }
      }
    });
    
    return locations;
  };

  // 지도 중심 계산
  const calculateMapBounds = (locations) => {
    if (locations.length === 0) return null;
    
    const lats = locations.map(loc => loc.coords.lat);
    const lons = locations.map(loc => loc.coords.lon);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const maxDiff = Math.max(latDiff, lonDiff);
    
    let zoom = 13;
    if (maxDiff > 1) zoom = 8;
    else if (maxDiff > 0.5) zoom = 9;
    else if (maxDiff > 0.1) zoom = 11;
    else if (maxDiff > 0.05) zoom = 12;
    
    return { center: [centerLat, centerLon], zoom };
  };

  const gpsLocations = getAllGPSLocations();
  const mapBounds = calculateMapBounds(gpsLocations);

  // 시간순으로 정렬된 GPS 위치 (동선 애니메이션용)
  const getSortedRouteLocations = () => {
    const sortedImages = sortImagesByTime(images);
    const route = [];
    
    sortedImages.forEach(image => {
      if (image.metadata && Object.keys(image.metadata).length > 0) {
        const formatted = formatMetadata(image.metadata);
        if (formatted.gpsCoords) {
          const dateTimeOriginal = image.metadata.DateTimeOriginal?.description;
          const dateTime = image.metadata.DateTime?.description;
          const dateStr = dateTimeOriginal || dateTime;
          let timestamp = image.file.lastModified;
          
          if (dateStr) {
            try {
              const date = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
              timestamp = date.getTime();
            } catch (e) {
              timestamp = image.file.lastModified;
            }
          }
          
          route.push({ image, coords: formatted.gpsCoords, timestamp });
        }
      }
    });
    
    return route.sort((a, b) => a.timestamp - b.timestamp);
  };

  const sortedRoute = getSortedRouteLocations();
  const routePath = sortedRoute.map(loc => [loc.coords.lat, loc.coords.lon]);
  const currentRoutePosition = sortedRoute[currentRouteIndex]?.coords;

  // 동선 애니메이션 시작/중지
  const handleRouteAnimation = () => {
    if (isRoutePlaying) {
      setIsRoutePlaying(false);
      setCurrentRouteIndex(0);
      resetCarMarker();
    } else {
      if (sortedRoute.length === 0) {
        alert('GPS 정보가 있는 사진이 없습니다.');
        return;
      }
      resetCarMarker();
      // autoZoomEnabled는 사용자가 설정한 값 유지 (자동으로 true로 설정하지 않음)
      setIsRoutePlaying(true);
      setCurrentRouteIndex(0);
    }
  };

  // useEffect로 애니메이션 관리
  useEffect(() => {
    if (isRoutePlaying && currentRouteIndex < sortedRoute.length - 1) {
      const timer = setTimeout(() => {
        setCurrentRouteIndex(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isRoutePlaying, currentRouteIndex, sortedRoute.length]);

  // 애니메이션이 끝났을 때 버튼만 초기화
  useEffect(() => {
    if (isRoutePlaying && currentRouteIndex >= sortedRoute.length - 1 && sortedRoute.length > 0) {
      // 마지막 지점에 도달했을 때 버튼만 초기화 (마커와 인덱스는 유지)
      setIsRoutePlaying(false);
    }
  }, [isRoutePlaying, currentRouteIndex, sortedRoute.length]);

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans text-white">
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm font-light">photo metadata viewer</span>
          </div>
          {/* 로딩바 */}
          {isUploading && (
            <div className="absolute top-full left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
              <div className="px-8 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">
                    사진 업로드 중... ({uploadProgress.current} / {uploadProgress.total})
                  </span>
                  <span className="text-sm text-gray-400">
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-6">
            {images.length > 0 && (
              <>
                <button
                  onClick={() => {
                    // 보드판 모드로 전환 시 지도 모드 비활성화
                    if (isMapMode) {
                      resetCarMarker();
                      setIsRoutePlaying(false);
                      setCurrentRouteIndex(0);
                      setIsMapMode(false);
                    }
                    setIsBoardMode(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-gray-800 text-gray-300"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-sm">보드판으로 보기</span>
                </button>
                <button
                  onClick={() => {
                    if (gpsLocations.length === 0) {
                      alert('GPS 정보가 있는 사진이 없습니다. GPS 정보가 포함된 사진을 업로드해주세요.');
                      return;
                    }
                    if (isMapMode) {
                      resetCarMarker();
                      setIsRoutePlaying(false);
                      setCurrentRouteIndex(0);
                    }
                    setIsMapMode(!isMapMode);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isMapMode 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : gpsLocations.length > 0
                      ? 'hover:bg-gray-800 text-gray-300'
                      : 'opacity-50 cursor-not-allowed text-gray-500'
                  }`}
                  disabled={gpsLocations.length === 0}
                >
                  <Map className="w-4 h-4" />
                  <span className="text-sm">지도 모드</span>
                  {gpsLocations.length > 0 && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      {gpsLocations.length}
                    </span>
                  )}
                </button>
              </>
            )}
            <label className="cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="text-sm">upload photos</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleImageUpload} 
              />
            </label>
          </div>
        </div>
      </header>

      {/* 왼쪽 사이드바 (메타데이터) */}
      <MetadataSidebar
        images={images}
        currentIndex={currentIndex}
        selectedImage={selectedImage}
        formattedMetadata={formattedMetadata}
        selectedImageId={selectedImageId}
        onNavigateImage={navigateImage}
      />

      {/* 메인 콘텐츠 영역 */}
      <main 
        className="flex-1 ml-64 pt-16 overflow-auto"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {images.length === 0 ? (
          <ImageUploader
            isDragging={isDragging}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileSelect={handleImageUpload}
          />
        ) : isMapMode && mapBounds ? (
          <MapMode
            mapBounds={mapBounds}
            routePath={routePath}
            isRoutePlaying={isRoutePlaying}
            currentRouteIndex={currentRouteIndex}
            currentRoutePosition={currentRoutePosition}
            sortedRoute={sortedRoute}
            gpsLocations={gpsLocations}
            images={images}
            onRouteAnimation={handleRouteAnimation}
            onThumbnailClick={handleThumbnailClick}
            onCloseMapMode={() => setIsMapMode(false)}
            autoZoomEnabled={autoZoomEnabled}
            onAutoZoomToggle={() => setAutoZoomEnabled(prev => !prev)}
            onAutoZoomDisabled={() => setAutoZoomEnabled(false)}
          />
        ) : (
          <div className={`p-8 min-h-full relative ${isDragging ? 'bg-blue-500/5' : ''}`}>
            {/* 드래그 오버 시 표시되는 오버레이 */}
            {isDragging && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center pointer-events-none">
                <div className="bg-black/90 border-2 border-dashed border-blue-500 rounded-lg p-16">
                  <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-400 text-center text-xl">여기에 사진을 놓으세요</p>
                </div>
              </div>
            )}
            <ThumbnailGrid
              images={images}
              selectedImageId={selectedImageId}
              onThumbnailClick={handleThumbnailClick}
              onRemoveImage={handleRemoveImage}
            />
            <ImagePreview selectedImage={selectedImage} onImageClick={handlePreviewClick} />
          </div>
        )}
      </main>

      {/* 이미지 라이트박스 (전체화면 모달) */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        images={images}
        currentIndex={lightboxIndex}
        onClose={handleLightboxClose}
        onNavigate={handleLightboxNavigate}
      />

      {/* 보드판 모드 */}
      {isBoardMode && (
        <BoardMode
          images={images}
          onClose={() => setIsBoardMode(false)}
          onImageClick={handleThumbnailClick}
          savedPhotoLayouts={boardPhotoLayouts}
          onPhotoLayoutsChange={setBoardPhotoLayouts}
        />
      )}
    </div>
  );
}

export default App;

