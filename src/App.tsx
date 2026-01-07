import { useState, useEffect, useRef } from 'react'
import * as React from 'react'
import type { ChangeEvent } from 'react'
import ExifReader from 'exifreader'
import html2canvas from 'html2canvas'
import { Upload, X, ChevronUp, ChevronDown, Map, Download } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Leaflet 마커 아이콘 설정
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// 자동차 아이콘 생성
const createCarIcon = () => {
  return L.divIcon({
    className: 'car-marker',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          font-size: 16px;
          font-weight: bold;
        ">🚗</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

interface ImageData {
  id: string;
  url: string;
  thumbnailUrl: string;
  metadata: any;
  file: File;
  loading?: boolean;
}

interface GPSCoordinates {
  lat: number;
  lon: number;
}

function App() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMapMode, setIsMapMode] = useState(false);
  const [isRoutePlaying, setIsRoutePlaying] = useState(false);
  const [currentRouteIndex, setCurrentRouteIndex] = useState<number>(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const selectedImage = images.find(img => img.id === selectedImageId) || images[currentIndex] || null;

  // 지도 업데이트 컴포넌트
  const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    map.setView(center, map.getZoom());
    return null;
  };

  // 애니메이션 마커 컴포넌트 (전역 마커 인스턴스 관리)
  const carMarkerRef = React.useRef<L.Marker | null>(null);
  const carMarkerAnimationRef = React.useRef<number | null>(null);
  const carMarkerPrevPositionRef = React.useRef<[number, number] | null>(null);

  const AnimatedMarker = ({ position, icon }: { position: [number, number]; icon: L.Icon | L.DivIcon }) => {
    const map = useMap();

    React.useEffect(() => {
      // 마커가 없으면 생성
      if (!carMarkerRef.current) {
        carMarkerRef.current = L.marker(position, { icon });
        carMarkerRef.current.addTo(map);
        carMarkerPrevPositionRef.current = position;
      } else {
        // 위치가 변경되었을 때만 애니메이션
        const prevPos = carMarkerPrevPositionRef.current;
        if (prevPos && (prevPos[0] !== position[0] || prevPos[1] !== position[1])) {
          // 기존 애니메이션 취소
          if (carMarkerAnimationRef.current) {
            cancelAnimationFrame(carMarkerAnimationRef.current);
          }

          // 부드러운 이동 애니메이션
          const startLat = prevPos[0];
          const startLon = prevPos[1];
          const endLat = position[0];
          const endLon = position[1];
          const duration = 800; // 0.8초
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easing function (ease-in-out)
            const eased = progress < 0.5 
              ? 2 * progress * progress 
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const currentLat = startLat + (endLat - startLat) * eased;
            const currentLon = startLon + (endLon - startLon) * eased;

            if (carMarkerRef.current) {
              carMarkerRef.current.setLatLng([currentLat, currentLon]);
            }

            if (progress < 1) {
              carMarkerAnimationRef.current = requestAnimationFrame(animate);
            } else {
              carMarkerPrevPositionRef.current = position;
              carMarkerAnimationRef.current = null;
            }
          };

          carMarkerAnimationRef.current = requestAnimationFrame(animate);
        } else if (!prevPos) {
          // 첫 위치 설정
          if (carMarkerRef.current) {
            carMarkerRef.current.setLatLng(position);
          }
          carMarkerPrevPositionRef.current = position;
        }
      }

      return () => {
        // cleanup은 하지 않음 (마커는 유지)
      };
    }, [position, map, icon]);

    return null;
  };

  // GPS 좌표 파싱 함수
  const parseGPS = (metadata: any): GPSCoordinates | null => {
    try {
      let lat: number | null = null;
      let lon: number | null = null;

      // GPSLatitude와 GPSLongitude가 배열인 경우
      if (metadata.GPSLatitude && Array.isArray(metadata.GPSLatitude.value)) {
        const latArray = metadata.GPSLatitude.value;
        const latRef = metadata.GPSLatitudeRef?.value?.[0] || 'N';
        
        // 도/분/초 형식을 십진수로 변환
        if (latArray.length >= 3) {
          lat = latArray[0] + latArray[1] / 60 + latArray[2] / 3600;
          if (latRef === 'S' && lat !== null) lat = -lat;
        } else if (latArray.length === 1) {
          lat = latArray[0];
          if (latRef === 'S' && lat !== null) lat = -lat;
        }
      } else if (metadata.GPSLatitude?.value) {
        // 단일 값인 경우
        const latValue = Array.isArray(metadata.GPSLatitude.value) 
          ? metadata.GPSLatitude.value[0] 
          : metadata.GPSLatitude.value;
        const latRef = metadata.GPSLatitudeRef?.value?.[0] || metadata.GPSLatitudeRef?.description || 'N';
        lat = typeof latValue === 'number' ? latValue : parseFloat(latValue);
        if (latRef === 'S') lat = -lat;
      }

      if (metadata.GPSLongitude && Array.isArray(metadata.GPSLongitude.value)) {
        const lonArray = metadata.GPSLongitude.value;
        const lonRef = metadata.GPSLongitudeRef?.value?.[0] || 'E';
        
        if (lonArray.length >= 3) {
          lon = lonArray[0] + lonArray[1] / 60 + lonArray[2] / 3600;
          if (lonRef === 'W' && lon !== null) lon = -lon;
        } else if (lonArray.length === 1) {
          lon = lonArray[0];
          if (lonRef === 'W' && lon !== null) lon = -lon;
        }
      } else if (metadata.GPSLongitude?.value) {
        const lonValue = Array.isArray(metadata.GPSLongitude.value)
          ? metadata.GPSLongitude.value[0]
          : metadata.GPSLongitude.value;
        const lonRef = metadata.GPSLongitudeRef?.value?.[0] || metadata.GPSLongitudeRef?.description || 'E';
        lon = typeof lonValue === 'number' ? lonValue : parseFloat(lonValue);
        if (lonRef === 'W') lon = -lon;
      }

      // description에서 직접 파싱 시도
      if (!lat && metadata.GPSLatitude?.description) {
        const latDesc = typeof metadata.GPSLatitude.description === 'string'
          ? metadata.GPSLatitude.description
          : String(metadata.GPSLatitude.description || '');
        // 숫자 추출 (소수점 포함, 더 정확한 패턴)
        const latMatch = latDesc.match(/(\d+\.\d+|\d+)/);
        if (latMatch) {
          lat = parseFloat(latMatch[1]);
          // description에서 North/South 확인
          const latDescLower = latDesc.toLowerCase();
          const isSouth = latDescLower.includes('south') || 
                         metadata.GPSLatitudeRef?.description?.toLowerCase() === 's' ||
                         metadata.GPSLatitudeRef?.value?.[0]?.toLowerCase() === 's';
          if (isSouth) lat = -lat;
        }
      }

      if (!lon && metadata.GPSLongitude?.description) {
        const lonDesc = typeof metadata.GPSLongitude.description === 'string'
          ? metadata.GPSLongitude.description
          : String(metadata.GPSLongitude.description || '');
        // 숫자 추출 (소수점 포함, 더 정확한 패턴)
        const lonMatch = lonDesc.match(/(\d+\.\d+|\d+)/);
        if (lonMatch) {
          lon = parseFloat(lonMatch[1]);
          // description에서 East/West 확인
          const lonDescLower = lonDesc.toLowerCase();
          const isWest = lonDescLower.includes('west') || 
                        metadata.GPSLongitudeRef?.description?.toLowerCase() === 'w' ||
                        metadata.GPSLongitudeRef?.value?.[0]?.toLowerCase() === 'w';
          if (isWest) lon = -lon;
        }
      }

      // 두 description이 하나의 문자열로 합쳐진 경우 파싱 (예: "35.09950555555556North latitude, 129.026East longitude")
      if ((!lat || !lon) && metadata.GPSLatitude && metadata.GPSLongitude) {
        const latDesc = typeof metadata.GPSLatitude.description === 'string'
          ? metadata.GPSLatitude.description
          : String(metadata.GPSLatitude.description || '');
        const lonDesc = typeof metadata.GPSLongitude.description === 'string'
          ? metadata.GPSLongitude.description
          : String(metadata.GPSLongitude.description || '');
        
        // 두 description을 합쳐서 파싱
        const combinedDesc = `${latDesc} ${lonDesc}`;
        // 두 개의 숫자를 모두 찾기
        const allNumbers = combinedDesc.match(/(\d+\.\d+|\d+)/g);
        if (allNumbers && allNumbers.length >= 2) {
          if (!lat) {
            lat = parseFloat(allNumbers[0]);
            const combinedLower = combinedDesc.toLowerCase();
            const isSouth = combinedLower.includes('south') || 
                          metadata.GPSLatitudeRef?.description?.toLowerCase() === 's' ||
                          metadata.GPSLatitudeRef?.value?.[0]?.toLowerCase() === 's';
            if (isSouth) lat = -lat;
          }
          if (!lon) {
            lon = parseFloat(allNumbers[1]);
            const combinedLower = combinedDesc.toLowerCase();
            const isWest = combinedLower.includes('west') || 
                          metadata.GPSLongitudeRef?.description?.toLowerCase() === 'w' ||
                          metadata.GPSLongitudeRef?.value?.[0]?.toLowerCase() === 'w';
            if (isWest) lon = -lon;
          }
        }
      }

      if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    } catch (error) {
      console.error('GPS 파싱 오류:', error);
    }
    return null;
  };

  // Canvas를 사용한 썸네일 생성 함수
  const createThumbnail = (file: File, maxSize: number = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context를 가져올 수 없습니다'));
        return;
      }

      img.onload = () => {
        // 비율 유지하면서 리사이즈
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // 고품질 리사이징
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG로 변환 (품질 0.85)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob);
              resolve(thumbnailUrl);
            } else {
              reject(new Error('썸네일 생성 실패'));
            }
          },
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = URL.createObjectURL(file);
    });
  };

  // 파일 처리 공통 함수 (최적화된 버전)
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const timestamp = Date.now();

    // 먼저 썸네일과 기본 정보만 빠르게 생성
    const quickImages: ImageData[] = [];
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const id = `${timestamp}-${i}`;
        const url = URL.createObjectURL(file);
        
        // 썸네일 생성 (비동기)
        const thumbnailUrl = await createThumbnail(file, 200);
        
        // 기본 이미지 데이터 먼저 추가 (메타데이터는 나중에)
        quickImages.push({
          id,
          url,
          thumbnailUrl,
          metadata: {},
          file,
          loading: true
        });
      } catch (error) {
        console.error('이미지 처리 중 오류:', error);
      }
    }

    // 썸네일이 있는 이미지들을 먼저 화면에 표시
    setImages(prev => {
      const updated = [...prev, ...quickImages];
      return sortImagesByTime(updated);
    });
    if (quickImages.length > 0 && !selectedImageId) {
      setSelectedImageId(quickImages[0].id);
      setCurrentIndex(images.length);
    }

    // 메타데이터는 백그라운드에서 처리
    for (let i = 0; i < quickImages.length; i++) {
      const imageData = quickImages[i];
      try {
        const metadata = await ExifReader.load(imageData.file);
        
        // 메타데이터 업데이트 및 시간순 정렬
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
        // 메타데이터 읽기 실패해도 이미지는 표시
        setImages(prev => prev.map(img => 
          img.id === imageData.id 
            ? { ...img, loading: false }
            : img
        ));
      }
    }
  };

  // 시간순으로 이미지 정렬
  const sortImagesByTime = (imageList: ImageData[]): ImageData[] => {
    return [...imageList].sort((a, b) => {
      const getImageTime = (image: ImageData): number => {
        if (!image.metadata || Object.keys(image.metadata).length === 0) {
          return 0;
        }
        
        // DateTimeOriginal 우선, 없으면 DateTime, 없으면 파일 수정 시간
        const dateTimeOriginal = image.metadata.DateTimeOriginal?.description;
        const dateTime = image.metadata.DateTime?.description;
        const dateStr = dateTimeOriginal || dateTime;
        
        if (dateStr) {
          try {
            const date = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
            return date.getTime();
          } catch (e) {
            return image.file.lastModified;
          }
        }
        
        return image.file.lastModified;
      };
      
      return getImageTime(a) - getImageTime(b);
    });
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await processFiles(files);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleThumbnailClick = (imageId: string, index: number) => {
    setSelectedImageId(imageId);
    setCurrentIndex(index);
  };

  const handleRemoveImage = (imageId: string) => {
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

  const navigateImage = (direction: 'prev' | 'next') => {
    if (images.length === 0) return;
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % images.length
      : (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    setSelectedImageId(images[newIndex].id);
  };

  // 키보드 방향키로 이미지 이동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 지도 모드이거나 이미지가 없으면 무시
      if (isMapMode || images.length === 0) return;
      
      // 입력 필드에 포커스가 있으면 무시 (사용자가 텍스트 입력 중일 수 있음)
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         (activeElement as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // 방향키 처리
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // 이전 이미지로 이동
        if (images.length > 0) {
          const newIndex = (currentIndex - 1 + images.length) % images.length;
          setCurrentIndex(newIndex);
          setSelectedImageId(images[newIndex].id);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // 다음 이미지로 이동
        if (images.length > 0) {
          const newIndex = (currentIndex + 1) % images.length;
          setCurrentIndex(newIndex);
          setSelectedImageId(images[newIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapMode, images, currentIndex]);

  const formatMetadata = (metadata: any) => {
    const formatted: any = {};
    
    // 카메라 정보
    if (metadata.Make || metadata.Model) {
      formatted.camera = `${metadata.Make?.description || ''} ${metadata.Model?.description || ''}`.trim();
    }
    
    // EXIF 정보
    const focalLength = metadata.FocalLength?.description;
    const exposureTime = metadata.ExposureTime?.description;
    const fNumber = metadata.FNumber?.description;
    if (focalLength || exposureTime || fNumber) {
      formatted.exif = `${focalLength || ''}, ${exposureTime || ''}, ${fNumber || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',');
    }
    
    // 날짜
    if (metadata.DateTimeOriginal) {
      const dateStr = metadata.DateTimeOriginal.description;
      if (dateStr) {
        try {
          const date = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
          formatted.date = `${date.getDate().toString().padStart(2, '0')}. ${months[date.getMonth()]}. ${date.getFullYear()}`;
        } catch (e) {
          formatted.date = dateStr;
        }
      }
    }
    
    // GPS 정보 (표시용)
    let gpsCoords = parseGPS(metadata);
    
    // parseGPS가 실패한 경우, description에서 직접 파싱 시도
    if (!gpsCoords && metadata.GPSLatitude && metadata.GPSLongitude) {
      // description이 문자열인지 확인하고 안전하게 변환
      const latDesc = typeof metadata.GPSLatitude.description === 'string' 
        ? metadata.GPSLatitude.description 
        : String(metadata.GPSLatitude.description || '');
      const lonDesc = typeof metadata.GPSLongitude.description === 'string'
        ? metadata.GPSLongitude.description
        : String(metadata.GPSLongitude.description || '');
      
      // 더 정확한 숫자 추출 (소수점 포함)
      const latMatch = latDesc.match(/(\d+\.\d+|\d+)/);
      const lonMatch = lonDesc.match(/(\d+\.\d+|\d+)/);
      
      if (latMatch && lonMatch) {
        let parsedLat = parseFloat(latMatch[1]);
        let parsedLon = parseFloat(lonMatch[1]);
        
        // 방향 확인 (description에서 직접 확인)
        const latDescLower = latDesc.toLowerCase();
        const lonDescLower = lonDesc.toLowerCase();
        const isSouth = latDescLower.includes('south') || 
                       latDescLower.includes('s ') ||
                       metadata.GPSLatitudeRef?.description?.toLowerCase() === 's' ||
                       metadata.GPSLatitudeRef?.value?.[0]?.toLowerCase() === 's';
        const isWest = lonDescLower.includes('west') || 
                      lonDescLower.includes('w ') ||
                      metadata.GPSLongitudeRef?.description?.toLowerCase() === 'w' ||
                      metadata.GPSLongitudeRef?.value?.[0]?.toLowerCase() === 'w';
        
        if (isSouth) parsedLat = -parsedLat;
        if (isWest) parsedLon = -parsedLon;
        
        if (!isNaN(parsedLat) && !isNaN(parsedLon) && parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180) {
          gpsCoords = { lat: parsedLat, lon: parsedLon };
        }
      }
    }
    
    if (gpsCoords) {
      const latRef = metadata.GPSLatitudeRef?.value?.[0] || metadata.GPSLatitudeRef?.description || 'N';
      const lonRef = metadata.GPSLongitudeRef?.value?.[0] || metadata.GPSLongitudeRef?.description || 'E';
      formatted.gps = `${Math.abs(gpsCoords.lat).toFixed(6)}°${latRef}, ${Math.abs(gpsCoords.lon).toFixed(6)}°${lonRef}`;
      formatted.gpsCoords = gpsCoords;
    } else if (metadata.GPSLatitude && metadata.GPSLongitude) {
      // description을 안전하게 문자열로 변환
      const lat = typeof metadata.GPSLatitude.description === 'string'
        ? metadata.GPSLatitude.description
        : String(metadata.GPSLatitude.description || '');
      const lon = typeof metadata.GPSLongitude.description === 'string'
        ? metadata.GPSLongitude.description
        : String(metadata.GPSLongitude.description || '');
      const latRef = typeof metadata.GPSLatitudeRef?.description === 'string'
        ? metadata.GPSLatitudeRef.description
        : metadata.GPSLatitudeRef?.value?.[0] || 'N';
      const lonRef = typeof metadata.GPSLongitudeRef?.description === 'string'
        ? metadata.GPSLongitudeRef.description
        : metadata.GPSLongitudeRef?.value?.[0] || 'E';
      
      if (lat && lon) {
        formatted.gps = `${lat}${latRef}, ${lon}${lonRef}`;
        
        // GPS 문자열에서 좌표를 다시 파싱 시도
        const latMatch = lat.match(/(\d+\.\d+|\d+)/);
        const lonMatch = lon.match(/(\d+\.\d+|\d+)/);
        
        if (latMatch && lonMatch) {
          let parsedLat = parseFloat(latMatch[1]);
          let parsedLon = parseFloat(lonMatch[1]);
          
          // 방향 확인
          const latLower = lat.toLowerCase();
          const lonLower = lon.toLowerCase();
          const isSouth = latLower.includes('south') || 
                         latLower.includes('s ') ||
                         latRef?.toLowerCase() === 's';
          const isWest = lonLower.includes('west') || 
                        lonLower.includes('w ') ||
                        lonRef?.toLowerCase() === 'w';
          
          if (isSouth) parsedLat = -parsedLat;
          if (isWest) parsedLon = -parsedLon;
          
          if (!isNaN(parsedLat) && !isNaN(parsedLon) && parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180) {
            formatted.gpsCoords = { lat: parsedLat, lon: parsedLon };
          }
        }
      }
    }
    
    return formatted;
  };

  const formattedMetadata = selectedImage ? formatMetadata(selectedImage.metadata) : {};

  // 모든 GPS 좌표 수집
  const getAllGPSLocations = () => {
    const locations: Array<{ image: ImageData; coords: GPSCoordinates }> = [];
    
    images.forEach(image => {
      if (image.metadata && Object.keys(image.metadata).length > 0) {
        // formatMetadata를 사용하여 GPS 좌표 파싱 (더 정확한 파싱)
        const formatted = formatMetadata(image.metadata);
        if (formatted.gpsCoords) {
          locations.push({ image, coords: formatted.gpsCoords });
        }
      }
    });
    
    return locations;
  };

  // 지도 중심 계산 (모든 마커를 포함하는 범위)
  const calculateMapBounds = (locations: Array<{ image: ImageData; coords: GPSCoordinates }>) => {
    if (locations.length === 0) return null;
    
    const lats = locations.map(loc => loc.coords.lat);
    const lons = locations.map(loc => loc.coords.lon);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    // 범위에 따라 줌 레벨 조정
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const maxDiff = Math.max(latDiff, lonDiff);
    
    let zoom = 13;
    if (maxDiff > 1) zoom = 8;
    else if (maxDiff > 0.5) zoom = 9;
    else if (maxDiff > 0.1) zoom = 11;
    else if (maxDiff > 0.05) zoom = 12;
    
    return { center: [centerLat, centerLon] as [number, number], zoom };
  };

  const gpsLocations = getAllGPSLocations();
  const mapBounds = calculateMapBounds(gpsLocations);

  // 시간순으로 정렬된 GPS 위치 (동선 애니메이션용)
  const getSortedRouteLocations = () => {
    const sortedImages = sortImagesByTime(images);
    const route: Array<{ image: ImageData; coords: GPSCoordinates; timestamp: number }> = [];
    
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
  const routePath = sortedRoute.map(loc => [loc.coords.lat, loc.coords.lon] as [number, number]);
  const currentRoutePosition = sortedRoute[currentRouteIndex]?.coords;

  // 동선 애니메이션 시작/중지
  const handleRouteAnimation = () => {
    if (isRoutePlaying) {
      setIsRoutePlaying(false);
      setCurrentRouteIndex(0);
      // 마커 초기화
      if (carMarkerRef.current) {
        carMarkerRef.current.remove();
        carMarkerRef.current = null;
      }
      carMarkerPrevPositionRef.current = null;
      if (carMarkerAnimationRef.current) {
        cancelAnimationFrame(carMarkerAnimationRef.current);
        carMarkerAnimationRef.current = null;
      }
    } else {
      if (sortedRoute.length === 0) {
        alert('GPS 정보가 있는 사진이 없습니다.');
        return;
      }
      // 마커 초기화
      if (carMarkerRef.current) {
        carMarkerRef.current.remove();
        carMarkerRef.current = null;
      }
      carMarkerPrevPositionRef.current = null;
      if (carMarkerAnimationRef.current) {
        cancelAnimationFrame(carMarkerAnimationRef.current);
        carMarkerAnimationRef.current = null;
      }
      setIsRoutePlaying(true);
      setCurrentRouteIndex(0);
    }
  };

  // useEffect로 애니메이션 관리
  useEffect(() => {
    if (isRoutePlaying && currentRouteIndex < sortedRoute.length - 1) {
      const timer = setTimeout(() => {
        setCurrentRouteIndex(prev => {
          if (prev >= sortedRoute.length - 1) {
            setIsRoutePlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isRoutePlaying, currentRouteIndex, sortedRoute.length]);

  // 지도 다운로드 함수
  const handleMapDownload = async () => {
    if (!mapContainerRef.current) return;
    
    try {
      // 지도 컨테이너만 캡처 (상단 헤더와 왼쪽 사이드바 제외)
      const canvas = await html2canvas(mapContainerRef.current, {
        backgroundColor: null,
        useCORS: true,
        scale: 1,
        logging: false,
        windowWidth: mapContainerRef.current.scrollWidth,
        windowHeight: mapContainerRef.current.scrollHeight,
      });
      
      // 캔버스를 이미지로 변환
      const dataUrl = canvas.toDataURL('image/png');
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      const fileName = `map-${new Date().toISOString().slice(0, 10)}.png`;
      link.download = fileName;
      link.href = dataUrl;
      
      // 다운로드 실행
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('지도 다운로드 중 오류 발생:', error);
      alert('지도 다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans text-white">
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm font-light">photo metadata viewer</span>
          </div>
          <div className="flex items-center gap-6">
            {images.length > 0 && (
              <button
                onClick={() => {
                  if (gpsLocations.length === 0) {
                    alert('GPS 정보가 있는 사진이 없습니다. GPS 정보가 포함된 사진을 업로드해주세요.');
                    return;
                  }
                  if (isMapMode) {
                    // 지도 모드 종료 시 마커 초기화
                    if (carMarkerRef.current) {
                      carMarkerRef.current.remove();
                      carMarkerRef.current = null;
                    }
                    carMarkerPrevPositionRef.current = null;
                    if (carMarkerAnimationRef.current) {
                      cancelAnimationFrame(carMarkerAnimationRef.current);
                      carMarkerAnimationRef.current = null;
                    }
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
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-black border-r border-gray-800 flex flex-col z-40 overflow-y-auto">
        <div className="p-6 flex-1 flex flex-col">
          {/* 컨트롤 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => navigateImage('prev')}
                className="hover:text-gray-400 transition-colors"
                disabled={images.length === 0}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigateImage('next')}
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

      {/* 메인 콘텐츠 영역 */}
      <main 
        className="flex-1 ml-64 pt-16 overflow-auto"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {images.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <label className="cursor-pointer group">
              <div className={`border-2 border-dashed rounded-lg p-16 transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}>
                <Upload className={`w-16 h-16 mx-auto mb-4 transition-colors ${
                  isDragging 
                    ? 'text-blue-500' 
                    : 'text-gray-600 group-hover:text-gray-500'
                }`} />
                <p className={`text-center transition-colors ${
                  isDragging 
                    ? 'text-blue-400' 
                    : 'text-gray-500'
                }`}>
                  {isDragging ? '여기에 사진을 놓으세요' : '사진을 업로드하세요'}
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleImageUpload} 
              />
            </label>
          </div>
        ) : isMapMode && mapBounds ? (
          <div ref={mapContainerRef} className="h-full w-full relative">
            {/* 동선 버튼 및 다운로드 버튼 */}
            <div className="absolute top-4 right-4 z-[9999] flex gap-2 pointer-events-auto">
              <button
                onClick={handleMapDownload}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-black/80 backdrop-blur-sm text-white hover:bg-black/90 shadow-lg border border-white/20"
                title="지도 다운로드"
              >
                <Download className="w-4 h-4" />
                <span>다운로드</span>
              </button>
              <button
                onClick={handleRouteAnimation}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg ${
                  isRoutePlaying
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRoutePlaying ? (
                  <>
                    <span>⏸</span>
                    <span>동선 중지</span>
                  </>
                ) : (
                  <>
                    <span>▶</span>
                    <span>동선</span>
                  </>
                )}
              </button>
            </div>
            <MapContainer
              center={mapBounds.center}
              zoom={mapBounds.zoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* 전체 경로 선 표시 */}
              {routePath.length > 1 && (
                <Polyline
                  positions={routePath}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.7
                  }}
                />
              )}
              {/* 현재까지 이동한 경로 (애니메이션용) */}
              {isRoutePlaying && currentRouteIndex > 0 && (
                <Polyline
                  positions={routePath.slice(0, currentRouteIndex + 1)}
                  pathOptions={{
                    color: '#10b981',
                    weight: 5,
                    opacity: 1
                  }}
                />
              )}
              {/* 자동차 마커 (현재 위치) - 애니메이션 */}
              {currentRoutePosition && (
                <>
                  <MapUpdater center={[currentRoutePosition.lat, currentRoutePosition.lon]} />
                  <AnimatedMarker 
                    key={`car-${currentRouteIndex}`}
                    position={[currentRoutePosition.lat, currentRoutePosition.lon]}
                    icon={createCarIcon()}
                  />
                  {/* 팝업용 마커 (클릭 가능) */}
                  <Marker
                    position={[currentRoutePosition.lat, currentRoutePosition.lon]}
                    icon={createCarIcon()}
                    interactive={true}
                    keyboard={true}
                    opacity={0}
                    zIndexOffset={1000}
                  >
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold">현재 위치</p>
                        <p className="text-sm text-gray-600">
                          {currentRouteIndex + 1} / {sortedRoute.length}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}
              {gpsLocations.map((location: { image: ImageData; coords: GPSCoordinates }, index: number) => (
                <Marker 
                  key={`${location.image.id}-${index}`}
                  position={[location.coords.lat, location.coords.lon]}
                  eventHandlers={{
                    click: () => {
                      const imageIndex = images.findIndex(img => img.id === location.image.id);
                      if (imageIndex !== -1) {
                        handleThumbnailClick(location.image.id, imageIndex);
                        setIsMapMode(false);
                      }
                    }
                  }}
                >
                  <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                    <div className="flex flex-col items-center gap-2 p-2">
                      <img 
                        src={location.image.thumbnailUrl} 
                        alt="Thumbnail"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-white shadow-lg"
                      />
                      <span className="text-xs text-gray-800 font-medium">이미지 {index + 1}</span>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="flex flex-col items-center gap-2">
                      <img 
                        src={location.image.thumbnailUrl} 
                        alt="Thumbnail"
                        className="w-32 h-32 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => {
                          const imageIndex = images.findIndex(img => img.id === location.image.id);
                          if (imageIndex !== -1) {
                            handleThumbnailClick(location.image.id, imageIndex);
                            setIsMapMode(false);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        이미지 보기
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
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
            {/* 썸네일 그리드 */}
            <div className="flex flex-wrap gap-4 justify-center items-center">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={`relative group cursor-pointer ${
                    selectedImageId === image.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''
                  }`}
                  onClick={() => handleThumbnailClick(image.id, index)}
                >
                  <div 
                    className="overflow-hidden border-2 border-gray-700 hover:border-gray-500"
                    style={{ width: '36px', height: '36px' }}
                  >
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
                      handleRemoveImage(image.id);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* 선택된 이미지 큰 화면 표시 */}
            {selectedImage && (
              <div className="mt-12 flex items-center justify-center">
                <div className="relative max-w-4xl">
                  <img 
                    src={selectedImage.url} 
                    alt="Selected"
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    loading="eager"
                  />
                  {selectedImage.loading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="text-white">메타데이터 로딩 중...</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
