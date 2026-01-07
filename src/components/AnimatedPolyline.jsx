import { useMap } from 'react-leaflet';
import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

export const AnimatedPolyline = ({ 
  routePath, 
  currentRouteIndex, 
  isRoutePlaying 
}) => {
  const map = useMap();
  const routePolylineRef = useRef(null);
  const progressPolylineRef = useRef(null);

  // Polyline 생성 함수
  const createPolylines = useCallback(() => {
    if (!map || routePath.length < 2) return;

    // 기존 polyline 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
    }
    if (progressPolylineRef.current) {
      progressPolylineRef.current.remove();
    }

    // 전체 경로 polyline 생성
    routePolylineRef.current = L.polyline(routePath, {
      color: '#3b82f6',
      weight: 4,
      opacity: isRoutePlaying ? 0.7 : 0
    }).addTo(map);

    // 진행 경로 polyline 생성
    const initialPath = currentRouteIndex > 0 
      ? routePath.slice(0, currentRouteIndex + 1) 
      : [routePath[0]];
    
    progressPolylineRef.current = L.polyline(initialPath, {
      color: '#10b981',
      weight: 5,
      opacity: isRoutePlaying && currentRouteIndex > 0 ? 1 : 0
    }).addTo(map);
  }, [map, routePath, isRoutePlaying, currentRouteIndex]);

  // 초기 생성 및 routePath 변경 시 재생성
  useEffect(() => {
    createPolylines();

    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      if (progressPolylineRef.current) {
        progressPolylineRef.current.remove();
        progressPolylineRef.current = null;
      }
    };
  }, [map, routePath]);

  // 동선 재생 상태에 따라 opacity 조절
  useEffect(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.setStyle({ opacity: isRoutePlaying ? 0.7 : 0 });
    }
    if (progressPolylineRef.current) {
      progressPolylineRef.current.setStyle({ 
        opacity: isRoutePlaying && currentRouteIndex > 0 ? 1 : 0 
      });
    }
  }, [isRoutePlaying]);

  // 진행 경로 업데이트 (애니메이션 중에만)
  useEffect(() => {
    if (!progressPolylineRef.current || !isRoutePlaying) return;

    if (currentRouteIndex > 0 && routePath.length > 0) {
      const progressPath = routePath.slice(0, currentRouteIndex + 1);
      progressPolylineRef.current.setLatLngs(progressPath);
      progressPolylineRef.current.setStyle({ opacity: 1 });
    } else if (routePath.length > 0) {
      progressPolylineRef.current.setLatLngs([routePath[0]]);
      progressPolylineRef.current.setStyle({ opacity: 0 });
    }
  }, [currentRouteIndex, isRoutePlaying, routePath]);

  return null;
};

// polyline 정리 함수 (호환성을 위해 유지)
export const resetPolylines = () => {
  // ref 방식으로 변경되어 컴포넌트 언마운트 시 자동 정리됨
};
