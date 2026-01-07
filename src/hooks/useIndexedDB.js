import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'PhotoMetadataDB';
const DB_VERSION = 1;
const IMAGES_STORE = 'images';
const STATE_STORE = 'appState';

/**
 * IndexedDB 데이터베이스 열기
 */
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 이미지 저장소 생성
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const imageStore = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        imageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 앱 상태 저장소 생성
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Blob을 Base64로 변환
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Base64를 Blob으로 변환
 */
const base64ToBlob = async (base64) => {
  const response = await fetch(base64);
  return response.blob();
};

/**
 * 이미지 데이터를 저장 가능한 형태로 변환
 */
const serializeImage = async (image) => {
  try {
    // URL에서 Blob 가져오기
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`이미지 fetch 실패: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    
    const thumbnailResponse = await fetch(image.thumbnailUrl);
    if (!thumbnailResponse.ok) {
      throw new Error(`썸네일 fetch 실패: ${thumbnailResponse.status}`);
    }
    const thumbnailBlob = await thumbnailResponse.blob();
    
    // Blob을 Base64로 변환
    const imageBase64 = await blobToBase64(imageBlob);
    const thumbnailBase64 = await blobToBase64(thumbnailBlob);
    
    return {
      id: image.id,
      imageData: imageBase64,
      thumbnailData: thumbnailBase64,
      metadata: image.metadata,
      fileName: image.file?.name || 'unknown',
      fileType: image.file?.type || 'image/jpeg',
      fileLastModified: image.file?.lastModified || Date.now(),
      loading: false,
      timestamp: Date.now()
    };
  } catch {
    return null;
  }
};

/**
 * 저장된 데이터를 이미지 객체로 복원
 */
const deserializeImage = async (data) => {
  try {
    // Base64를 Blob으로 변환
    const imageBlob = await base64ToBlob(data.imageData);
    const thumbnailBlob = await base64ToBlob(data.thumbnailData);
    
    // Blob URL 생성
    const url = URL.createObjectURL(imageBlob);
    const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
    
    // File 객체 재생성
    const file = new File([imageBlob], data.fileName, {
      type: data.fileType,
      lastModified: data.fileLastModified
    });
    
    return {
      id: data.id,
      url,
      thumbnailUrl,
      metadata: data.metadata || {},
      file,
      loading: false
    };
  } catch {
    return null;
  }
};

/**
 * IndexedDB를 사용하여 이미지와 앱 상태를 저장/복원하는 커스텀 훅
 */
export const useIndexedDB = () => {
  const [isDBReady, setIsDBReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [db, setDb] = useState(null);

  // DB 초기화
  useEffect(() => {
    const initDB = async () => {
      try {
        const database = await openDB();
        setDb(database);
        setIsDBReady(true);
      } catch {
        // DB 초기화 실패 시 무시
      } finally {
        setIsLoading(false);
      }
    };
    
    initDB();
    
    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  /**
   * 이미지 저장
   */
  const saveImage = useCallback(async (image) => {
    if (!db) return false;
    
    try {
      const serialized = await serializeImage(image);
      if (!serialized) return false;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.put(serialized);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }, [db]);

  /**
   * 모든 이미지 저장
   */
  const saveAllImages = useCallback(async (images) => {
    if (!db) return;
    
    // 이미지가 없으면 저장소 비우기
    if (images.length === 0) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve(true);
        clearRequest.onerror = () => reject(clearRequest.error);
      });
    }
    
    try {
      // 먼저 모든 이미지를 직렬화
      const serializedImages = [];
      for (const image of images) {
        try {
          const serialized = await serializeImage(image);
          if (serialized) {
            serializedImages.push(serialized);
          }
        } catch {
          // 개별 이미지 직렬화 실패 무시
        }
      }
      
      if (serializedImages.length === 0) {
        return;
      }
      
      // 트랜잭션 생성 및 저장 (직렬화 완료 후)
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        
        // 기존 데이터 모두 삭제
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          // 새 데이터 저장
          for (const serialized of serializedImages) {
            store.put(serialized);
          }
        };
        
        clearRequest.onerror = () => reject(clearRequest.error);
        
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      // 저장 오류 무시
    }
  }, [db]);

  /**
   * 모든 이미지 불러오기
   */
  const loadAllImages = useCallback(async () => {
    if (!db) return [];
    
    try {
      // 먼저 저장된 데이터 가져오기
      const data = await new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readonly');
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      // 데이터 역직렬화
      const images = [];
      for (const item of data) {
        const image = await deserializeImage(item);
        if (image) {
          images.push(image);
        }
      }
      
      return images;
    } catch {
      return [];
    }
  }, [db]);

  /**
   * 이미지 삭제
   */
  const deleteImage = useCallback(async (imageId) => {
    if (!db) return false;
    
    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.delete(imageId);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }, [db]);

  /**
   * 모든 이미지 삭제
   */
  const clearAllImages = useCallback(async () => {
    if (!db) return false;
    
    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([IMAGES_STORE], 'readwrite');
        const store = transaction.objectStore(IMAGES_STORE);
        const request = store.clear();
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }, [db]);

  /**
   * 앱 상태 저장
   */
  const saveState = useCallback(async (key, value) => {
    if (!db) return false;
    
    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE], 'readwrite');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.put({ key, value });
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }, [db]);

  /**
   * 앱 상태 불러오기
   */
  const loadState = useCallback(async (key) => {
    if (!db) return null;
    
    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE], 'readonly');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.get(key);
        
        request.onsuccess = () => {
          resolve(request.result?.value ?? null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }, [db]);

  /**
   * 모든 상태 삭제
   */
  const clearAllState = useCallback(async () => {
    if (!db) return false;
    
    try {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE], 'readwrite');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.clear();
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }, [db]);

  return {
    isDBReady,
    isLoading,
    saveImage,
    saveAllImages,
    loadAllImages,
    deleteImage,
    clearAllImages,
    saveState,
    loadState,
    clearAllState
  };
};
