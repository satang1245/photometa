import { useMap } from 'react-leaflet';
import { useEffect } from 'react';

export const MapWheelHandler = ({ onAutoZoomDisabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!onAutoZoomDisabled) return;

    const mapContainer = map.getContainer();
    if (!mapContainer) return;

    const handleWheel = (e) => {
      // deltaY > 0: 아래로 스크롤 = 줌 아웃
      // 사용자가 휠로 줌 아웃하면 자동 줌/이동 비활성화
      if (e.deltaY > 0) {
        onAutoZoomDisabled();
      }
    };

    // DOM 이벤트로 직접 감지
    mapContainer.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      mapContainer.removeEventListener('wheel', handleWheel);
    };
  }, [map, onAutoZoomDisabled]);

  return null;
};

