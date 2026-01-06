import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

// 전역 마커 인스턴스 관리
const carMarkerRef = { current: null };
const carMarkerAnimationRef = { current: null };
const carMarkerPrevPositionRef = { current: null };

export const createCarIcon = () => {
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

export const AnimatedCarMarker = ({ position, icon }) => {
  const map = useMap();

  useEffect(() => {
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
        
        // 거리 계산 (하버사인 공식 사용)
        const R = 6371; // 지구 반지름 (km)
        const dLat = (endLat - startLat) * Math.PI / 180;
        const dLon = (endLon - startLon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // 거리 (km)
        
        // 거리에 따라 애니메이션 시간 계산 (최소 0.2초, 최대 0.6초)
        // 거리가 멀수록 더 오래 이동 (최대 10km 기준으로 계산)
        const maxDistance = 10; // 최대 거리 (km)
        const minDuration = 200; // 최소 시간 (ms)
        const maxDuration = 600; // 최대 시간 (ms)
        const normalizedDistance = Math.min(distance / maxDistance, 1); // 0~1 사이로 정규화
        const duration = minDuration + (maxDuration - minDuration) * normalizedDistance;
        
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

// 마커 초기화 함수
export const resetCarMarker = () => {
  if (carMarkerRef.current) {
    carMarkerRef.current.remove();
    carMarkerRef.current = null;
  }
  carMarkerPrevPositionRef.current = null;
  if (carMarkerAnimationRef.current) {
    cancelAnimationFrame(carMarkerAnimationRef.current);
    carMarkerAnimationRef.current = null;
  }
};

