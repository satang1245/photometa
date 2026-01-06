// 썸네일 생성 함수
export const createThumbnail = (file, maxSize = 200) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context를 가져올 수 없습니다'));
      return;
    }

    img.onload = () => {
      // 비율 유지하면서 리사이즈
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 고품질 리사이징
      ctx.drawImage(img, 0, 0, width, height);
      
      // JPEG로 변환 (품질 0.85)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailUrl = URL.createObjectURL(blob);
            resolve(thumbnailUrl);
          } else {
            reject(new Error('썸네일 생성 실패'));
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = URL.createObjectURL(file);
  });
};

// 시간순으로 이미지 정렬
export const sortImagesByTime = (imageList) => {
  return [...imageList].sort((a, b) => {
    const getImageTime = (image) => {
      if (!image.metadata || Object.keys(image.metadata).length === 0) {
        return 0;
      }
      
      // DateTimeOriginal 우선, 없으면 DateTime, 없으면 파일 수정 시간
      const dateTimeOriginal = image.metadata.DateTimeOriginal?.description;
      const dateTime = image.metadata.DateTime?.description;
      const dateStr = dateTimeOriginal || dateTime;
      
      if (dateStr) {
        try {
          const date = new Date(dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
          return date.getTime();
        } catch (e) {
          return image.file.lastModified;
        }
      }
      
      return image.file.lastModified;
    };
    
    return getImageTime(a) - getImageTime(b);
  });
};


