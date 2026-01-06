import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

// 하버사인 공식으로 거리 계산 (km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 현재 위치를 중심으로, 다음 위치와의 거리 비율에 따라 줌 레벨을 조정하면서
// 지도가 자동차 마커를 따라가도록 하는 컴포넌트
// enabled가 false이면 자동 줌과 마커 따라다니기 모두 비활성화
export const MapBoundsUpdater = ({ currentPosition, nextPosition, enabled }) => {
  const map = useMap();

  useEffect(() => {
    // enabled가 false이면 아무것도 하지 않음 (사용자가 휠로 줌 아웃한 경우)
    if (!enabled) return;
    
    if (!currentPosition) return;

    // 다음 위치가 없으면 현재 줌 유지하면서 마커만 따라감
    if (!nextPosition) {
      map.setView(currentPosition, map.getZoom(), {
        animate: true,
        duration: 0.5,
      });
      return;
    }

    // 현재 위치와 다음 위치 간 거리 계산
    const distance = calculateDistance(
      currentPosition[0],
      currentPosition[1],
      nextPosition[0],
      nextPosition[1]
    );

    // 거리 비율에 따라 줌 레벨 결정
    let targetZoom;
    if (distance < 0.1) {
      // 100m 미만: 많이 확대
      targetZoom = 18;
    } else if (distance < 0.5) {
      targetZoom = 17;
    } else if (distance < 1) {
      targetZoom = 16;
    } else if (distance < 5) {
      targetZoom = 15;
    } else {
      // 5km 이상: 더 넓게
      targetZoom = 14;
    }

    // 현재 자동차 위치를 중심으로 이동
    map.setView(currentPosition, targetZoom, {
      animate: true,
      duration: 0.5,
    });
  }, [currentPosition, nextPosition, enabled, map]);

  return null;
};

