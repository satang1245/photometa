// 역지오코딩 캐시 키
const GEOCODE_CACHE_KEY = 'photo-metadata-geocode-cache';

// localStorage에서 캐시 로드
const loadCacheFromStorage = () => {
  try {
    const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (cached) {
      return new Map(JSON.parse(cached));
    }
  } catch {
    // 캐시 로드 실패 시 무시
  }
  return new Map();
};

// localStorage에 캐시 저장
const saveCacheToStorage = (cache) => {
  try {
    // 캐시 크기 제한 (최대 500개)
    const entries = Array.from(cache.entries());
    if (entries.length > 500) {
      // 오래된 항목 제거 (앞에서부터)
      const trimmed = entries.slice(-500);
      cache.clear();
      trimmed.forEach(([key, value]) => cache.set(key, value));
    }
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(Array.from(cache.entries())));
  } catch {
    // 저장 실패 시 무시 (localStorage 용량 초과 등)
  }
};

// 역지오코딩 캐시 (메모리 + localStorage)
const geocodeCache = loadCacheFromStorage();

/**
 * 위도/경도를 주소로 변환 (역지오코딩)
 * OpenStreetMap Nominatim API 사용
 */
export const reverseGeocode = async (lat, lon) => {
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  
  // 캐시 확인
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'ko',
          'User-Agent': 'PhotoMetadataViewer/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    // 주소 포맷팅
    let address = '';
    
    if (data.address) {
      const addr = data.address;
      const parts = [];
      
      // 한국 주소 형식으로 구성
      if (addr.country === '대한민국' || addr.country === 'South Korea') {
        // 한국 주소: 시/도 > 시/군/구 > 읍/면/동 > 상세
        if (addr.province || addr.state) parts.push(addr.province || addr.state);
        if (addr.city) parts.push(addr.city);
        if (addr.county) parts.push(addr.county);
        if (addr.suburb || addr.town || addr.village) {
          parts.push(addr.suburb || addr.town || addr.village);
        }
        if (addr.neighbourhood) parts.push(addr.neighbourhood);
        if (addr.road) parts.push(addr.road);
      } else {
        // 해외 주소: 일반적인 형식
        if (addr.road) parts.push(addr.road);
        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.state || addr.province) parts.push(addr.state || addr.province);
        if (addr.country) parts.push(addr.country);
      }
      
      address = parts.join(' ');
    }
    
    // display_name 사용 (fallback)
    if (!address && data.display_name) {
      address = data.display_name;
    }
    
    // 캐시에 저장 (메모리 + localStorage)
    geocodeCache.set(cacheKey, address);
    saveCacheToStorage(geocodeCache);
    
    return address;
  } catch {
    return null;
  }
};

/**
 * 캐시된 주소 가져오기 (API 호출 없이)
 */
export const getCachedAddress = (lat, lon) => {
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  return geocodeCache.get(cacheKey) || null;
};

/**
 * 캐시 초기화
 */
export const clearGeocodeCache = () => {
  geocodeCache.clear();
  try {
    localStorage.removeItem(GEOCODE_CACHE_KEY);
  } catch {
    // 무시
  }
};
