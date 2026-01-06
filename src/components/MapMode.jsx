import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import { MapUpdater } from './MapUpdater.jsx';
import { MapBoundsUpdater } from './MapBoundsUpdater.jsx';
import { MapWheelHandler } from './MapWheelHandler.jsx';
import { AnimatedCarMarker, createCarIcon, resetCarMarker } from './AnimatedCarMarker.jsx';

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
  onAutoZoomDisabled
}) => {
  return (
    <div className="h-full w-full relative">
      {/* 동선 버튼 */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button
          onClick={onRouteAnimation}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
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
        <MapWheelHandler onAutoZoomDisabled={onAutoZoomDisabled} />
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
            {/* 동선 애니메이션 중일 때는 bounds로 조정, 아닐 때는 중심점만 업데이트 */}
            {isRoutePlaying ? (
              <MapBoundsUpdater 
                currentPosition={[currentRoutePosition.lat, currentRoutePosition.lon]}
                nextPosition={currentRouteIndex < routePath.length - 1 
                  ? routePath[currentRouteIndex + 1] 
                  : null}
                enabled={autoZoomEnabled}
              />
            ) : (
              <MapUpdater center={[currentRoutePosition.lat, currentRoutePosition.lon]} />
            )}
            <AnimatedCarMarker 
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
        {gpsLocations.map((location, index) => (
          <Marker 
            key={`${location.image.id}-${index}`}
            position={[location.coords.lat, location.coords.lon]}
            eventHandlers={{
              click: () => {
                const imageIndex = images.findIndex(img => img.id === location.image.id);
                if (imageIndex !== -1) {
                  onThumbnailClick(location.image.id, imageIndex);
                  onCloseMapMode();
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
                      onThumbnailClick(location.image.id, imageIndex);
                      onCloseMapMode();
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
      
      {/* 동선 진행 프로그래스바 */}
      {isRoutePlaying && sortedRoute.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-black/90 backdrop-blur-sm border-t border-gray-800">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">
                동선 진행 중... ({currentRouteIndex + 1} / {sortedRoute.length})
              </span>
              <span className="text-sm text-gray-400">
                {Math.round(((currentRouteIndex + 1) / sortedRoute.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-green-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${((currentRouteIndex + 1) / sortedRoute.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

