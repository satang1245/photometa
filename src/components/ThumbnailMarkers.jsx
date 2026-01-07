import { memo, useMemo, useRef, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// 썸네일 이미지로 커스텀 마커 아이콘 생성
const createThumbnailIcon = (thumbnailUrl, isActive = false, stackIndex = 0) => {
  const angle = stackIndex * (Math.PI / 4);
  const radius = stackIndex * 8;
  const offsetX = Math.cos(angle) * radius;
  const offsetY = Math.sin(angle) * radius;
  
  return L.divIcon({
    className: `thumbnail-marker-container marker-stack-${stackIndex}`,
    html: `
      <div class="thumbnail-marker ${isActive ? 'active' : ''}" style="transform: translate(${offsetX}px, ${offsetY}px);">
        <div class="thumbnail-marker-inner">
          <img src="${thumbnailUrl}" alt="location" loading="lazy" />
        </div>
      </div>
    `,
    iconSize: [54, 62],
    iconAnchor: [27 - offsetX, 62 - offsetY],
    popupAnchor: [offsetX, -62 + offsetY],
  });
};

// 가까운 좌표끼리 그룹화하여 스택 인덱스 계산
const calculateStackIndices = (locations) => {
  const threshold = 0.0005;
  const stackIndices = new Map();
  const groups = [];
  
  locations.forEach((location, index) => {
    let foundGroup = null;
    
    for (const group of groups) {
      const firstLoc = locations[group[0]];
      const latDiff = Math.abs(location.coords.lat - firstLoc.coords.lat);
      const lonDiff = Math.abs(location.coords.lon - firstLoc.coords.lon);
      
      if (latDiff < threshold && lonDiff < threshold) {
        foundGroup = group;
        break;
      }
    }
    
    if (foundGroup) {
      stackIndices.set(index, foundGroup.length);
      foundGroup.push(index);
    } else {
      stackIndices.set(index, 0);
      groups.push([index]);
    }
  });
  
  return stackIndices;
};

// 개별 썸네일 마커 - Leaflet 직접 제어
const ThumbnailMarker = memo(({ location, index, stackIndex, images, onThumbnailClick, onCloseMapMode, map }) => {
  const markerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const icon = createThumbnailIcon(location.image.thumbnailUrl, false, stackIndex);
    
    // 마커 생성
    const marker = L.marker([location.coords.lat, location.coords.lon], {
      icon,
      zIndexOffset: stackIndex * 100
    });

    // 팝업 생성
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div class="flex flex-col items-center gap-2">
        <img src="${location.image.thumbnailUrl}" alt="Thumbnail" class="w-32 h-32 rounded-lg object-cover" />
        <button class="popup-view-btn px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
          이미지 보기
        </button>
      </div>
    `;
    
    const popup = L.popup().setContent(popupContent);
    marker.bindPopup(popup);
    
    // 버튼 클릭 이벤트
    popupContent.querySelector('.popup-view-btn')?.addEventListener('click', () => {
      const imageIndex = images.findIndex(img => img.id === location.image.id);
      if (imageIndex !== -1) {
        onThumbnailClick(location.image.id, imageIndex);
        onCloseMapMode();
      }
    });

    // 클릭 이벤트
    marker.on('click', () => {
      marker.openPopup();
    });

    // 호버 이벤트
    marker.on('mouseover', () => {
      marker.setZIndexOffset(10000);
      marker.getElement()?.classList.add('marker-hovered');
    });

    marker.on('mouseout', () => {
      marker.setZIndexOffset(stackIndex * 100);
      marker.getElement()?.classList.remove('marker-hovered');
    });

    marker.addTo(map);
    markerRef.current = marker;
    popupRef.current = popup;

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map, location.image.id, location.coords.lat, location.coords.lon, stackIndex]);

  return null;
});

ThumbnailMarker.displayName = 'ThumbnailMarker';

// 전체 썸네일 마커들을 관리하는 컴포넌트
export const ThumbnailMarkers = memo(({ gpsLocations, images, onThumbnailClick, onCloseMapMode }) => {
  const map = useMap();
  
  const stackIndices = useMemo(() => {
    return calculateStackIndices(gpsLocations);
  }, [gpsLocations]);

  return (
    <>
      {gpsLocations.map((location, index) => (
        <ThumbnailMarker
          key={location.image.id}
          location={location}
          index={index}
          stackIndex={stackIndices.get(index) || 0}
          images={images}
          onThumbnailClick={onThumbnailClick}
          onCloseMapMode={onCloseMapMode}
          map={map}
        />
      ))}
    </>
  );
});

ThumbnailMarkers.displayName = 'ThumbnailMarkers';


