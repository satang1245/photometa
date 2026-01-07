import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Clock, MapPin, Navigation } from 'lucide-react';
import { reverseGeocode, getCachedAddress } from '../utils/geocodingUtils.js';

export const MapTimeline = ({
  sortedRoute,
  currentRouteIndex,
  isRoutePlaying,
  onItemClick
}) => {
  const timelineRef = useRef(null);
  const itemRefs = useRef({});
  const [addresses, setAddresses] = useState({});
  const [loadingAddresses, setLoadingAddresses] = useState({});
  const loadedKeysRef = useRef(new Set());

  // 캐시된 주소 먼저 로드
  const cachedAddresses = useMemo(() => {
    const cached = {};
    sortedRoute.forEach(item => {
      const cacheKey = `${item.coords.lat.toFixed(6)},${item.coords.lon.toFixed(6)}`;
      const cachedAddr = getCachedAddress(item.coords.lat, item.coords.lon);
      if (cachedAddr) {
        cached[cacheKey] = cachedAddr;
      }
    });
    return cached;
  }, [sortedRoute]);

  // 주소 정보 로드 (캐시되지 않은 것만)
  useEffect(() => {
    const loadAddresses = async () => {
      for (const item of sortedRoute) {
        const cacheKey = `${item.coords.lat.toFixed(6)},${item.coords.lon.toFixed(6)}`;
        
        // 이미 로드했거나 캐시에 있으면 스킵
        if (loadedKeysRef.current.has(cacheKey) || cachedAddresses[cacheKey]) {
          continue;
        }
        
        // 현재 로딩 중이면 스킵
        if (loadingAddresses[cacheKey]) {
          continue;
        }

        loadedKeysRef.current.add(cacheKey);
        setLoadingAddresses(prev => ({ ...prev, [cacheKey]: true }));
        
        try {
          const address = await reverseGeocode(item.coords.lat, item.coords.lon);
          setAddresses(prev => ({ ...prev, [cacheKey]: address || '주소 정보 없음' }));
        } catch {
          setAddresses(prev => ({ ...prev, [cacheKey]: '주소 정보 없음' }));
        } finally {
          setLoadingAddresses(prev => ({ ...prev, [cacheKey]: false }));
        }
        
        // API 요청 간 딜레이 (Rate limit 방지)
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    if (sortedRoute.length > 0) {
      loadAddresses();
    }
  }, [sortedRoute, cachedAddresses]);

  // 동선 애니메이션 시 현재 아이템으로 스크롤
  useEffect(() => {
    if (isRoutePlaying && itemRefs.current[currentRouteIndex]) {
      itemRefs.current[currentRouteIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentRouteIndex, isRoutePlaying]);

  // 시간 포맷팅 함수
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  // 날짜 그룹핑
  const getDateKey = (timestamp) => {
    if (!timestamp) return 'unknown';
    const date = new Date(timestamp);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  // 날짜별로 그룹화
  const groupedByDate = sortedRoute.reduce((acc, item, index) => {
    const dateKey = getDateKey(item.timestamp);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push({ ...item, originalIndex: index });
    return acc;
  }, {});

  return (
    <div className="h-full w-80 bg-gray-950/95 backdrop-blur-sm border-r border-gray-800 flex flex-col">
      {/* 헤더 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-2 text-white">
          <Navigation className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold">이동 경로</h2>
          <span className="ml-auto text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
            {sortedRoute.length}개 지점
          </span>
        </div>
      </div>

      {/* 타임라인 목록 */}
      <div 
        ref={timelineRef}
        className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {Object.entries(groupedByDate).map(([dateKey, items]) => (
          <div key={dateKey} className="mb-6">
            {/* 날짜 헤더 */}
            <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm py-2 mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{dateKey}</span>
              </div>
            </div>

            {/* 타임라인 아이템들 */}
            <div className="relative">
              {/* 타임라인 선 */}
              <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-500/50 via-blue-500/30 to-transparent"></div>

              {items.map((item, idx) => {
                const isActive = item.originalIndex === currentRouteIndex;
                const isPast = item.originalIndex < currentRouteIndex;
                const cacheKey = `${item.coords.lat.toFixed(6)},${item.coords.lon.toFixed(6)}`;
                // 캐시된 주소 우선 사용
                const address = cachedAddresses[cacheKey] || addresses[cacheKey];
                const isLoading = !address && loadingAddresses[cacheKey];

                // EXIF에서 시간 정보 추출
                const timeStr = formatTime(item.timestamp);
                const timeOnly = timeStr.split(' ')[1] || '';

                return (
                  <div
                    key={item.originalIndex}
                    ref={el => itemRefs.current[item.originalIndex] = el}
                    onClick={() => onItemClick && onItemClick(item, item.originalIndex)}
                    className={`relative flex gap-3 p-3 mb-2 rounded-xl cursor-pointer transition-all duration-300 group
                      ${isActive 
                        ? 'bg-blue-600/20 border border-blue-500/50 shadow-lg shadow-blue-500/10' 
                        : isPast && isRoutePlaying
                        ? 'bg-green-600/10 border border-green-500/30'
                        : 'hover:bg-gray-800/50 border border-transparent'
                      }`}
                  >
                    {/* 타임라인 점 */}
                    <div className="flex-shrink-0 relative z-10">
                      <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300
                        ${isActive 
                          ? 'bg-blue-500 border-blue-400 shadow-lg shadow-blue-500/50 scale-125' 
                          : isPast && isRoutePlaying
                          ? 'bg-green-500 border-green-400'
                          : 'bg-gray-700 border-gray-600 group-hover:bg-gray-600'
                        }`}
                      ></div>
                    </div>

                    {/* 썸네일 */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-300
                      ${isActive 
                        ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                        : isPast && isRoutePlaying
                        ? 'border-green-500/50'
                        : 'border-gray-700 group-hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={item.image.thumbnailUrl}
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 시간 */}
                      <div className={`flex items-center gap-1 text-xs mb-1 transition-colors
                        ${isActive ? 'text-blue-400' : 'text-gray-500'}`}
                      >
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{timeOnly}</span>
                      </div>

                      {/* 주소 */}
                      <div className="flex items-start gap-1 text-sm">
                        <MapPin className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-colors
                          ${isActive ? 'text-blue-400' : 'text-gray-500'}`} 
                        />
                        <span className={`line-clamp-2 transition-colors
                          ${isActive ? 'text-white' : 'text-gray-300'}`}
                        >
                          {isLoading ? (
                            <span className="text-gray-500 animate-pulse">주소 불러오는 중...</span>
                          ) : (
                            address || '주소 정보 없음'
                          )}
                        </span>
                      </div>

                      {/* GPS 좌표 (작게 표시) */}
                      <div className="mt-1 text-[10px] text-gray-600 font-mono">
                        {item.coords.lat.toFixed(5)}, {item.coords.lon.toFixed(5)}
                      </div>
                    </div>

                    {/* 활성 상태 표시 애니메이션 */}
                    {isActive && isRoutePlaying && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 빈 상태 */}
        {sortedRoute.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MapPin className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">GPS 정보가 있는 사진이 없습니다</p>
          </div>
        )}
      </div>

      {/* 진행 상태 - 항상 렌더링하고 visibility로 제어하여 레이아웃 변화 방지 */}
      {sortedRoute.length > 0 && (
        <div className={`flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/50 transition-opacity duration-300 ${isRoutePlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>진행률</span>
            <span>{currentRouteIndex + 1} / {sortedRoute.length}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentRouteIndex + 1) / sortedRoute.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

