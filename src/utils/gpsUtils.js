// GPS 좌표 파싱 함수
export const parseGPS = (metadata) => {
  try {
    let lat = null;
    let lon = null;

    // GPSLatitude와 GPSLongitude가 배열인 경우
    if (metadata.GPSLatitude && Array.isArray(metadata.GPSLatitude.value)) {
      const latArray = metadata.GPSLatitude.value;
      const latRef = metadata.GPSLatitudeRef?.value?.[0] || 'N';
      
      // 도/분/초 형식을 십진수로 변환
      if (latArray.length >= 3) {
        lat = latArray[0] + latArray[1] / 60 + latArray[2] / 3600;
        if (latRef === 'S' && lat !== null) lat = -lat;
      } else if (latArray.length === 1) {
        lat = latArray[0];
        if (latRef === 'S' && lat !== null) lat = -lat;
      }
    } else if (metadata.GPSLatitude?.value) {
      // 단일 값인 경우
      const latValue = Array.isArray(metadata.GPSLatitude.value) 
        ? metadata.GPSLatitude.value[0] 
        : metadata.GPSLatitude.value;
      const latRef = metadata.GPSLatitudeRef?.value?.[0] || metadata.GPSLatitudeRef?.description || 'N';
      lat = typeof latValue === 'number' ? latValue : parseFloat(latValue);
      if (latRef === 'S') lat = -lat;
    }

    if (metadata.GPSLongitude && Array.isArray(metadata.GPSLongitude.value)) {
      const lonArray = metadata.GPSLongitude.value;
      const lonRef = metadata.GPSLongitudeRef?.value?.[0] || 'E';
      
      if (lonArray.length >= 3) {
        lon = lonArray[0] + lonArray[1] / 60 + lonArray[2] / 3600;
        if (lonRef === 'W' && lon !== null) lon = -lon;
      } else if (lonArray.length === 1) {
        lon = lonArray[0];
        if (lonRef === 'W' && lon !== null) lon = -lon;
      }
    } else if (metadata.GPSLongitude?.value) {
      const lonValue = Array.isArray(metadata.GPSLongitude.value)
        ? metadata.GPSLongitude.value[0]
        : metadata.GPSLongitude.value;
      const lonRef = metadata.GPSLongitudeRef?.value?.[0] || metadata.GPSLongitudeRef?.description || 'E';
      lon = typeof lonValue === 'number' ? lonValue : parseFloat(lonValue);
      if (lonRef === 'W') lon = -lon;
    }

    // description에서 직접 파싱 시도
    if (!lat && metadata.GPSLatitude?.description) {
      const latDesc = typeof metadata.GPSLatitude.description === 'string'
        ? metadata.GPSLatitude.description
        : String(metadata.GPSLatitude.description || '');
      const latMatch = latDesc.match(/(\d+\.\d+|\d+)/);
      if (latMatch) {
        lat = parseFloat(latMatch[1]);
        const latDescLower = latDesc.toLowerCase();
        const isSouth = latDescLower.includes('south') || 
                       metadata.GPSLatitudeRef?.description?.toLowerCase() === 's' ||
                       metadata.GPSLatitudeRef?.value?.[0]?.toLowerCase() === 's';
        if (isSouth) lat = -lat;
      }
    }

    if (!lon && metadata.GPSLongitude?.description) {
      const lonDesc = typeof metadata.GPSLongitude.description === 'string'
        ? metadata.GPSLongitude.description
        : String(metadata.GPSLongitude.description || '');
      const lonMatch = lonDesc.match(/(\d+\.\d+|\d+)/);
      if (lonMatch) {
        lon = parseFloat(lonMatch[1]);
        const lonDescLower = lonDesc.toLowerCase();
        const isWest = lonDescLower.includes('west') || 
                      metadata.GPSLongitudeRef?.description?.toLowerCase() === 'w' ||
                      metadata.GPSLongitudeRef?.value?.[0]?.toLowerCase() === 'w';
        if (isWest) lon = -lon;
      }
    }

    // 두 description이 하나의 문자열로 합쳐진 경우 파싱
    if ((!lat || !lon) && metadata.GPSLatitude && metadata.GPSLongitude) {
      const latDesc = typeof metadata.GPSLatitude.description === 'string'
        ? metadata.GPSLatitude.description
        : String(metadata.GPSLatitude.description || '');
      const lonDesc = typeof metadata.GPSLongitude.description === 'string'
        ? metadata.GPSLongitude.description
        : String(metadata.GPSLongitude.description || '');
      
      const combinedDesc = `${latDesc} ${lonDesc}`;
      const allNumbers = combinedDesc.match(/(\d+\.\d+|\d+)/g);
      if (allNumbers && allNumbers.length >= 2) {
        if (!lat) {
          lat = parseFloat(allNumbers[0]);
          const combinedLower = combinedDesc.toLowerCase();
          const isSouth = combinedLower.includes('south') || 
                        metadata.GPSLatitudeRef?.description?.toLowerCase() === 's' ||
                        metadata.GPSLatitudeRef?.value?.[0]?.toLowerCase() === 's';
          if (isSouth) lat = -lat;
        }
        if (!lon) {
          lon = parseFloat(allNumbers[1]);
          const combinedLower = combinedDesc.toLowerCase();
          const isWest = combinedLower.includes('west') || 
                        metadata.GPSLongitudeRef?.description?.toLowerCase() === 'w' ||
                        metadata.GPSLongitudeRef?.value?.[0]?.toLowerCase() === 'w';
          if (isWest) lon = -lon;
        }
      }
    }

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  } catch (error) {
    console.error('GPS 파싱 오류:', error);
  }
  return null;
};


