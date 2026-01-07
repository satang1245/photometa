import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapUpdater } from './MapUpdater.jsx';
import { MapBoundsUpdater } from './MapBoundsUpdater.jsx';
import { MapWheelHandler } from './MapWheelHandler.jsx';
import { AnimatedCarMarker, createCarIcon, resetCarMarker } from './AnimatedCarMarker.jsx';
import { MapTimeline } from './MapTimeline.jsx';
import { AnimatedPolyline, resetPolylines } from './AnimatedPolyline.jsx';
import { ThumbnailMarkers } from './ThumbnailMarkers.jsx';
import L from 'leaflet';

export const MapMode = ({ 
  mapBounds, 
  routePath, 
  isRoutePlaying, 
  currentRouteIndex, 
  currentRoutePosition, 
  sortedRoute,
  gpsLocations,
  images,
  onRouteAnimation,
  onThumbnailClick,
  onCloseMapMode,
  autoZoomEnabled,
  onAutoZoomToggle,
  onAutoZoomDisabled,
  onRouteIndexChange
}) => {
  const mapContainerRef = useRef(null);

  // 타임라인 아이템 클릭 핸들러
  const handleTimelineItemClick = (item, index) => {
    if (onRouteIndexChange) {
      onRouteIndexChange(index);
    }
  };

  // 지도 다운로드 함수
  const handleMapDownload = async () => {
    if (!mapContainerRef.current) return;
    
    try {
      // 타일 이미지가 완전히 로드될 때까지 대기
      const mapContainer = mapContainerRef.current;
      if (mapContainer) {
        const images = mapContainer.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
          if (img.complete) {
            return Promise.resolve();
          }
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // 에러가 나도 계속 진행
            setTimeout(resolve, 3000); // 최대 3초 대기
          });
        });
        await Promise.all(imagePromises);
        // 추가 대기 시간
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 지도 컨테이너만 캡처 (상단 헤더와 왼쪽 사이드바 제외)
      // oklab 문제를 우회하기 위해 ignoreElements 사용
      const canvas = await html2canvas(mapContainerRef.current, {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        scale: 1,
        logging: false,
        foreignObjectRendering: false,
        removeContainer: false,
        imageTimeout: 20000,
        ignoreElements: (element) => {
          // oklab 색상을 사용하는 요소는 건너뛰기
          try {
            const style = window.getComputedStyle(element);
            const colorProps = ['color', 'backgroundColor', 'borderColor'];
            for (const prop of colorProps) {
              const value = style[prop];
              if (value && (value.includes('oklab') || value.includes('oklch'))) {
                return true;
              }
            }
          } catch (e) {
            // 무시
          }
          return false;
        },
        onclone: (clonedDoc, element) => {
          // 클론된 문서에서 Leaflet 컨트롤 숨기기
          const leafletControls = clonedDoc.querySelectorAll('.leaflet-control');
          leafletControls.forEach(control => {
            if (control && control.style) {
              control.style.display = 'none';
            }
          });
          
          // 원본 문서의 요소와 매칭하여 computed style을 인라인으로 변환
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(clonedElement => {
            try {
              // 원본 요소 찾기 (data 속성이나 다른 방법으로)
              // 클론된 요소의 경로를 사용하여 원본 찾기
              let originalElement = null;
              const path = [];
              let current = clonedElement;
              while (current && current !== clonedDoc.body) {
                const parent = current.parentElement;
                if (parent) {
                  const index = Array.from(parent.children).indexOf(current);
                  path.unshift(index);
                  current = parent;
                } else {
                  break;
                }
              }
              
              // 원본 문서에서 같은 경로의 요소 찾기
              current = mapContainerRef.current;
              for (const index of path) {
                if (current && current.children[index]) {
                  current = current.children[index];
                } else {
                  current = null;
                  break;
                }
              }
              originalElement = current;
              
              if (originalElement) {
                const computed = window.getComputedStyle(originalElement);
                
                // 색상 관련 속성들을 rgb로 변환하여 인라인 스타일로 설정
                const colorProps = [
                  'color', 'backgroundColor', 'borderColor',
                  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'
                ];
                
                colorProps.forEach(prop => {
                  const value = computed[prop];
                  if (value && value !== 'rgba(0, 0, 0, 0)' && !value.includes('oklab') && !value.includes('oklch')) {
                    clonedElement.style[prop] = value;
                  }
                });
              }
            } catch (e) {
              // 오류 무시
            }
          });
          
          // 스타일시트에서 oklab을 포함하는 규칙 제거
          try {
            const styleSheets = Array.from(clonedDoc.styleSheets || []);
            styleSheets.forEach(sheet => {
              try {
                if (sheet && sheet.cssRules) {
                  const rules = Array.from(sheet.cssRules);
                  rules.forEach((rule, index) => {
                    try {
                      if (rule.cssText && (rule.cssText.includes('oklab') || rule.cssText.includes('oklch'))) {
                        sheet.deleteRule(index);
                      }
                    } catch (e) {
                      // 규칙 삭제 실패 무시
                    }
                  });
                }
              } catch (e) {
                // CORS 등의 이유로 접근 불가능한 스타일시트는 무시
              }
            });
          } catch (e) {
            // 무시
          }
        }
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
      const errorMessage = error?.message || error?.toString() || '알 수 없는 오류';
      alert(`지도 다운로드 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  return (
    <div className="h-full w-full flex">
      {/* PC 모드 타임라인 사이드바 (왼쪽) */}
      <div className="hidden lg:block flex-shrink-0">
        <MapTimeline
          sortedRoute={sortedRoute}
          currentRouteIndex={currentRouteIndex}
          isRoutePlaying={isRoutePlaying}
          onItemClick={handleTimelineItemClick}
        />
      </div>

      {/* 지도 영역 */}
      <div ref={mapContainerRef} className="flex-1 h-full relative touch-auto">
        {/* 동선 버튼 및 다운로드 버튼 - 모바일에서는 상단에 안전하게 표시 (Leaflet z-index가 400대) */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[500] flex flex-col gap-2 pointer-events-auto safe-area-top">
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={handleMapDownload}
            className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2 bg-black/80 backdrop-blur-sm text-white hover:bg-black/90 shadow-lg border border-white/20"
            title="지도 다운로드"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">다운로드</span>
          </button>
          <button
            onClick={onRouteAnimation}
            className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2 shadow-lg ${
              isRoutePlaying
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRoutePlaying ? (
              <>
                <span>⏸</span>
                <span className="hidden sm:inline text-sm">동선 중지</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span className="hidden sm:inline text-sm">동선</span>
              </>
            )}
          </button>
        </div>
        {/* 자동 확대/축소 옵션 - 모바일에서는 더 간단하게 */}
        <label className="flex items-center gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-black/80 backdrop-blur-sm text-white shadow-lg border border-white/20 cursor-pointer hover:bg-black/90 transition-colors">
          <input
            type="checkbox"
            checked={autoZoomEnabled}
            onChange={onAutoZoomToggle}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <span className="text-xs sm:text-sm">자동 확대</span>
        </label>
      </div>
      <MapContainer
        center={mapBounds.center}
        zoom={mapBounds.zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapWheelHandler onAutoZoomDisabled={onAutoZoomDisabled} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* 경로 선 표시 - Leaflet 직접 제어로 깜빡임 방지 */}
        {routePath.length > 1 && (
          <AnimatedPolyline
            routePath={routePath}
            currentRouteIndex={currentRouteIndex}
            isRoutePlaying={isRoutePlaying}
          />
        )}
        {/* 자동차 마커 (현재 위치) - 동선 애니메이션 중일 때만 표시 */}
        {isRoutePlaying && currentRoutePosition && (
          <>
            <MapBoundsUpdater 
              currentPosition={[currentRoutePosition.lat, currentRoutePosition.lon]}
              nextPosition={currentRouteIndex < routePath.length - 1 
                ? routePath[currentRouteIndex + 1] 
                : null}
              enabled={autoZoomEnabled}
            />
            <AnimatedCarMarker 
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
        {/* 썸네일 마커들 - 별도 컴포넌트로 분리하여 깜빡임 방지 */}
        <ThumbnailMarkers
          gpsLocations={gpsLocations}
          images={images}
          onThumbnailClick={onThumbnailClick}
          onCloseMapMode={onCloseMapMode}
        />
      </MapContainer>
      
        {/* 동선 진행 프로그래스바 - 모바일/타블렛에서만 표시 (PC에서는 타임라인에 표시됨) */}
        {isRoutePlaying && sortedRoute.length > 0 && (
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-[1000] bg-black/90 backdrop-blur-sm border-t border-gray-800">
            <div className="px-4 py-2 sm:px-8 sm:py-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm text-gray-300">
                  동선 ({currentRouteIndex + 1} / {sortedRoute.length})
                </span>
                <span className="text-xs sm:text-sm text-gray-400">
                  {Math.round(((currentRouteIndex + 1) / sortedRoute.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 sm:h-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${((currentRouteIndex + 1) / sortedRoute.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

