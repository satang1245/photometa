import { useState, useEffect, useCallback, useRef } from 'react';
import ExifReader from 'exifreader';
import { Upload, Map, LayoutGrid, Menu, X } from 'lucide-react';
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
import { useIndexedDB } from './hooks/useIndexedDB.js';

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
  const [boardViewState, setBoardViewState] = useState({ scale: 1, offset: null });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // IndexedDB 훅
  const {
    isDBReady,
    isLoading: isDBLoading,
    saveImage,
    saveAllImages,
    loadAllImages,
    deleteImage: deleteImageFromDB,
    saveState,
    loadState
  } = useIndexedDB();

  // 저장 디바운스를 위한 타이머 ref
  const saveTimerRef = useRef(null);

  const selectedImage = images.find(img => img.id === selectedImageId) || images[currentIndex] || null;

  // IndexedDB에서 데이터 복원
  useEffect(() => {
    const restoreData = async () => {
      if (!isDBReady || isInitialized) return;
      
      console.log('[App] 데이터 복원 시작, isDBReady:', isDBReady);
      
      try {
        // 저장된 이미지 불러오기
        const savedImages = await loadAllImages();
        
        console.log('[App] 불러온 이미지 개수:', savedImages.length);
        
        if (savedImages.length > 0) {
          const sortedImages = sortImagesByTime(savedImages);
          setImages(sortedImages);
          
          // 저장된 선택 상태 복원
          const savedSelectedId = await loadState('selectedImageId');
          const savedCurrentIndex = await loadState('currentIndex');
          
          if (savedSelectedId && sortedImages.find(img => img.id === savedSelectedId)) {
            setSelectedImageId(savedSelectedId);
          } else if (sortedImages.length > 0) {
            setSelectedImageId(sortedImages[0].id);
          }
          
          if (savedCurrentIndex !== null && savedCurrentIndex < sortedImages.length) {
            setCurrentIndex(savedCurrentIndex);
          }
          
          // 보드 레이아웃 복원
          const savedBoardLayouts = await loadState('boardPhotoLayouts');
          if (savedBoardLayouts) {
            setBoardPhotoLayouts(savedBoardLayouts);
          }
          
          const savedBoardViewState = await loadState('boardViewState');
          if (savedBoardViewState) {
            setBoardViewState(savedBoardViewState);
          }
          
          console.log('[App] 데이터 복원 완료');
        } else {
          console.log('[App] 저장된 이미지 없음');
        }
      } catch (error) {
        console.error('데이터 복원 오류:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    restoreData();
  }, [isDBReady, isInitialized, loadAllImages, loadState]);

  // 이미지 변경 시 IndexedDB에 저장 (디바운스 적용)
  useEffect(() => {
    if (!isDBReady || !isInitialized) return;
    
    // 기존 타이머 취소
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // 1초 후에 저장 (디바운스)
    saveTimerRef.current = setTimeout(async () => {
      console.log('[App] 이미지 저장 시작, 개수:', images.length);
      await saveAllImages(images);
    }, 1000);
    
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [images, isDBReady, isInitialized, saveAllImages]);

  // 선택 상태 변경 시 저장
  useEffect(() => {
    if (!isDBReady || !isInitialized) return;
    
    saveState('selectedImageId', selectedImageId);
    saveState('currentIndex', currentIndex);
  }, [selectedImageId, currentIndex, isDBReady, isInitialized, saveState]);

  // 보드 레이아웃 변경 시 저장 (직렬화 가능한 데이터만 저장)
  useEffect(() => {
    if (!isDBReady || !isInitialized) return;
    
    // HTMLImageElement 등 직렬화 불가능한 객체 제거
    const serializableLayouts = boardPhotoLayouts.map(layout => ({
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      rotation: layout.rotation,
      pinColor: layout.pinColor,
      cameraInfo: layout.cameraInfo,
      dateInfo: layout.dateInfo,
      // image 객체에서 id만 저장 (나중에 복원할 때 사용)
      imageId: layout.image?.id
    }));
    
    saveState('boardPhotoLayouts', serializableLayouts);
  }, [boardPhotoLayouts, isDBReady, isInitialized, saveState]);

  // 보드 뷰 상태 변경 시 저장
  useEffect(() => {
    if (!isDBReady || !isInitialized) return;
    
    saveState('boardViewState', boardViewState);
  }, [boardViewState, isDBReady, isInitialized, saveState]);

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

  const handleRemoveImage = async (imageId) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      URL.revokeObjectURL(image.url);
      URL.revokeObjectURL(image.thumbnailUrl);
    }
    
    // IndexedDB에서도 삭제
    await deleteImageFromDB(imageId);
    
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

  // DB 로딩 중일 때 로딩 화면 표시
  if (isDBLoading || !isInitialized) {
    return (
      <div className="flex h-screen bg-black items-center justify-center font-sans text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans text-white">
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-[600] bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            {/* 모바일 메타데이터 사이드바 토글 버튼 */}
            {images.length > 0 && (
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="md:hidden p-2 -ml-2 hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="메타데이터 보기"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500"></div>
            <span className="text-xs md:text-sm font-light">photo metadata viewer</span>
          </div>
          {/* 로딩바 */}
          {isUploading && (
            <div className="absolute top-full left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
              <div className="px-4 md:px-8 py-2 md:py-3">
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <span className="text-xs md:text-sm text-gray-300">
                    업로드 중... ({uploadProgress.current} / {uploadProgress.total})
                  </span>
                  <span className="text-xs md:text-sm text-gray-400">
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 md:h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center gap-6">
            {images.length > 0 && (
              <>
                <button
                  onClick={() => {
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

          {/* 모바일 메뉴 버튼 */}
          <div className="flex md:hidden items-center gap-2">
            <label className="cursor-pointer p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <Upload className="w-5 h-5" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleImageUpload} 
              />
            </label>
            {images.length > 0 && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="메뉴"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {isMobileMenuOpen && images.length > 0 && (
          <div className="md:hidden bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={() => {
                  if (isMapMode) {
                    resetCarMarker();
                    setIsRoutePlaying(false);
                    setCurrentRouteIndex(0);
                    setIsMapMode(false);
                  }
                  setIsBoardMode(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-gray-800 text-gray-300"
              >
                <LayoutGrid className="w-5 h-5" />
                <span>보드판으로 보기</span>
              </button>
              <button
                onClick={() => {
                  if (gpsLocations.length === 0) {
                    alert('GPS 정보가 있는 사진이 없습니다.');
                    return;
                  }
                  if (isMapMode) {
                    resetCarMarker();
                    setIsRoutePlaying(false);
                    setCurrentRouteIndex(0);
                  }
                  setIsMapMode(!isMapMode);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isMapMode 
                    ? 'bg-blue-600 text-white' 
                    : gpsLocations.length > 0
                    ? 'hover:bg-gray-800 text-gray-300'
                    : 'opacity-50 text-gray-500'
                }`}
                disabled={gpsLocations.length === 0}
              >
                <Map className="w-5 h-5" />
                <span>지도 모드</span>
                {gpsLocations.length > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded ml-auto">
                    {gpsLocations.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 왼쪽 사이드바 (메타데이터) - 데스크톱 */}
      <div className="hidden md:block">
        <MetadataSidebar
          images={images}
          currentIndex={currentIndex}
          selectedImage={selectedImage}
          formattedMetadata={formattedMetadata}
          selectedImageId={selectedImageId}
          onNavigateImage={navigateImage}
        />
      </div>

      {/* 모바일 사이드바 오버레이 */}
      {isMobileSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[510] bg-black/50"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-72 bg-black border-r border-gray-800 overflow-y-auto z-[461]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-16">
              <MetadataSidebar
                images={images}
                currentIndex={currentIndex}
                selectedImage={selectedImage}
                formattedMetadata={formattedMetadata}
                selectedImageId={selectedImageId}
                onNavigateImage={navigateImage}
                isMobile={true}
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <main 
        className="flex-1 ml-0 md:ml-64 pt-14 md:pt-16 overflow-auto"
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
          <div className={`p-4 md:p-8 min-h-full relative ${isDragging ? 'bg-blue-500/5' : ''}`}>
            {/* 드래그 오버 시 표시되는 오버레이 */}
            {isDragging && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center pointer-events-none">
                <div className="bg-black/90 border-2 border-dashed border-blue-500 rounded-lg p-8 md:p-16">
                  <Upload className="w-12 h-12 md:w-16 md:h-16 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-400 text-center text-base md:text-xl">여기에 사진을 놓으세요</p>
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
          savedViewState={boardViewState}
          onViewStateChange={setBoardViewState}
        />
      )}
    </div>
  );
}

export default App;

