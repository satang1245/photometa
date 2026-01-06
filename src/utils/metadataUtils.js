import { parseGPS } from './gpsUtils.js';

// 메타데이터 포맷팅
export const formatMetadata = (metadata) => {
  const formatted = {};
  
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
    const latDesc = typeof metadata.GPSLatitude.description === 'string' 
      ? metadata.GPSLatitude.description 
      : String(metadata.GPSLatitude.description || '');
    const lonDesc = typeof metadata.GPSLongitude.description === 'string'
      ? metadata.GPSLongitude.description
      : String(metadata.GPSLongitude.description || '');
    
    const latMatch = latDesc.match(/(\d+\.\d+|\d+)/);
    const lonMatch = lonDesc.match(/(\d+\.\d+|\d+)/);
    
    if (latMatch && lonMatch) {
      let parsedLat = parseFloat(latMatch[1]);
      let parsedLon = parseFloat(lonMatch[1]);
      
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


