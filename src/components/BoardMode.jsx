import { useRef, useEffect, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Move, Download } from 'lucide-react';
import { formatMetadata } from '../utils/metadataUtils.js';

export const BoardMode = ({ 
  images, 
  onClose, 
  onImageClick, 
  savedPhotoLayouts = [], 
  onPhotoLayoutsChange,
  savedViewState = { scale: 1, offset: null },
  onViewStateChange
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [loadedImages, setLoadedImages] = useState([]);
  const [scale, setScale] = useState(savedViewState.scale || 1);
  const [offset, setOffset] = useState(savedViewState.offset || { x: 0, y: 0 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState(-1);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [photoDragStart, setPhotoDragStart] = useState({ x: 0, y: 0 });
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  // 이미지 배치 정보 저장 (상위 컴포넌트에서 관리하는 위치 정보 사용)
  const [photoLayouts, setPhotoLayouts] = useState(savedPhotoLayouts);
  
  // 처음 진입 시 안내 메시지 표시
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  
  // 클릭 vs 드래그 구분을 위한 ref
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  
  // 관성 스크롤을 위한 ref
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(Date.now());
  const animationFrameRef = useRef(null);
  
  // 터치 핀치 줌을 위한 ref
  const lastTouchDistance = useRef(0);
  const isTouchZooming = useRef(false);
  const pinchCenter = useRef({ x: 0, y: 0 });
  const pinchStartScale = useRef(1);
  const pinchStartOffset = useRef({ x: 0, y: 0 });

  // 이미지 로드
  useEffect(() => {
    const loadImages = async () => {
      const loaded = await Promise.all(
        images.map((img, index) => {
          return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => {
              resolve({
                ...img,
                loadedImage: image,
                index
              });
            };
            image.onerror = () => {
              resolve(null);
            };
            image.src = img.url;
          });
        })
      );
      setLoadedImages(loaded.filter(Boolean));
    };
    
    loadImages();
  }, [images]);

  // 사진 레이아웃 계산 (화이트보드에 흩어진 형태)
  useEffect(() => {
    if (loadedImages.length === 0 || !containerRef.current) return;
    
    // 저장된 레이아웃이 있고 이미지 개수가 같으면 기존 위치 사용
    if (savedPhotoLayouts.length > 0 && savedPhotoLayouts.length === loadedImages.length) {
      // 이미지 ID로 매칭하여 기존 레이아웃 재사용
      // savedLayout.image?.id (이전 형식) 또는 savedLayout.imageId (새 형식) 모두 지원
      const matchedLayouts = loadedImages.map((img) => {
        const savedLayout = savedPhotoLayouts.find(layout => 
          (layout.imageId === img.id) || (layout.image?.id === img.id)
        );
        if (savedLayout) {
          // 기존 레이아웃을 사용하되, image 객체만 업데이트
          return {
            x: savedLayout.x,
            y: savedLayout.y,
            width: savedLayout.width,
            height: savedLayout.height,
            rotation: savedLayout.rotation,
            pinColor: savedLayout.pinColor,
            cameraInfo: savedLayout.cameraInfo,
            dateInfo: savedLayout.dateInfo,
            image: img
          };
        }
        return null;
      }).filter(Boolean);
      
      // 모든 이미지가 매칭되면 기존 레이아웃 사용
      if (matchedLayouts.length === loadedImages.length) {
        setPhotoLayouts(matchedLayouts);
        if (onPhotoLayoutsChange) {
          onPhotoLayoutsChange(matchedLayouts);
        }
        return;
      }
    }
    
    // 새로 레이아웃 생성
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // 보드 크기 (패딩 포함)
    const boardWidth = Math.max(containerWidth * 2, 2000);
    const boardHeight = Math.max(containerHeight * 2, 1500);
    
    const layouts = loadedImages.map((img, index) => {
      const maxPhotoSize = 280;
      const aspectRatio = img.loadedImage.width / img.loadedImage.height;
      
      let width, height;
      if (aspectRatio > 1) {
        width = maxPhotoSize;
        height = maxPhotoSize / aspectRatio;
      } else {
        height = maxPhotoSize;
        width = maxPhotoSize * aspectRatio;
      }
      
      // 그리드 기반 위치 계산 (겹침 방지)
      const cols = Math.ceil(Math.sqrt(loadedImages.length * 1.5));
      const rows = Math.ceil(loadedImages.length / cols);
      
      const cellWidth = boardWidth / cols;
      const cellHeight = boardHeight / rows;
      
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // 셀 내에서 랜덤 오프셋 (자연스러운 배치)
      const randomOffsetX = (Math.random() - 0.5) * (cellWidth - width - 60);
      const randomOffsetY = (Math.random() - 0.5) * (cellHeight - height - 60);
      
      const x = col * cellWidth + cellWidth / 2 - width / 2 + randomOffsetX;
      const y = row * cellHeight + cellHeight / 2 - height / 2 + randomOffsetY;
      
      // 랜덤 회전 (-15도 ~ 15도)
      const rotation = (Math.random() - 0.5) * 30;
      
      // 핀 색상 (다양한 색상)
      const pinColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
      const pinColor = pinColors[index % pinColors.length];
      
      // 메타데이터 정보 추출
      const metadata = img.metadata ? formatMetadata(img.metadata) : {};
      const cameraInfo = metadata.camera || '';
      const dateInfo = metadata.date || '';
      
      return {
        x: Math.max(40, Math.min(x, boardWidth - width - 40)),
        y: Math.max(40, Math.min(y, boardHeight - height - 40)),
        width,
        height,
        rotation,
        pinColor,
        image: img,
        cameraInfo,
        dateInfo
      };
    });
    
    setPhotoLayouts(layouts);
    if (onPhotoLayoutsChange) {
      onPhotoLayoutsChange(layouts);
    }
    
    // 초기 오프셋 설정 - 저장된 상태가 있으면 사용, 없으면 중앙에서 시작
    if (isInitialLoad && savedViewState.offset) {
      setOffset(savedViewState.offset);
      setScale(savedViewState.scale || 1);
      setIsInitialLoad(false);
    } else if (!savedViewState.offset) {
      setOffset({
        x: (containerWidth - boardWidth) / 2,
        y: (containerHeight - boardHeight) / 2
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImages]);

  // 캔버스 그리기
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || photoLayouts.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    if (!container) return;
    
    // 캔버스 크기 설정
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.scale(dpr, dpr);
    
    // 배경색 (#f4f4f1)
    ctx.fillStyle = '#f4f4f1';
    ctx.fillRect(0, 0, container.clientWidth, container.clientHeight);
    
    // 미세한 그리드 패턴 (화이트보드 느낌)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < container.clientWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, container.clientHeight);
      ctx.stroke();
    }
    for (let y = 0; y < container.clientHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(container.clientWidth, y);
      ctx.stroke();
    }
    
    // 변환 적용
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    
    // 각 사진 그리기
    photoLayouts.forEach((layout, index) => {
      ctx.save();
      
      // 중심점으로 이동 후 회전
      const centerX = layout.x + layout.width / 2;
      const centerY = layout.y + layout.height / 2;
      
      ctx.translate(centerX, centerY);
      ctx.rotate((layout.rotation * Math.PI) / 180);
      ctx.translate(-layout.width / 2, -layout.height / 2);
      
      // 그림자
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 8;
      
      // 폴라로이드 프레임 (흰색 테두리)
      const padding = 12;
      const bottomPadding = 50; // 텍스트 공간을 위해 증가
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-padding, -padding, layout.width + padding * 2, layout.height + padding + bottomPadding);
      
      // 그림자 초기화
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // 이미지
      ctx.drawImage(
        layout.image.loadedImage,
        0, 0,
        layout.width,
        layout.height
      );
      
      // 하단에 메타데이터 텍스트 표시
      const textY = layout.height + 8;
      const maxTextWidth = layout.width;
      
      // 카메라 정보 (상단)
      if (layout.cameraInfo) {
        ctx.fillStyle = '#374151';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        
        // 텍스트 자르기 (너무 길면 말줄임표)
        let cameraText = layout.cameraInfo;
        while (ctx.measureText(cameraText).width > maxTextWidth && cameraText.length > 0) {
          cameraText = cameraText.slice(0, -1);
        }
        if (cameraText !== layout.cameraInfo) {
          cameraText = cameraText.slice(0, -2) + '...';
        }
        
        ctx.fillText(cameraText, 0, textY + 12);
      }
      
      // 날짜 정보 (하단)
      if (layout.dateInfo) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        
        let dateText = layout.dateInfo;
        while (ctx.measureText(dateText).width > maxTextWidth && dateText.length > 0) {
          dateText = dateText.slice(0, -1);
        }
        if (dateText !== layout.dateInfo) {
          dateText = dateText.slice(0, -2) + '...';
        }
        
        ctx.fillText(dateText, 0, textY + 26);
      }
      
      // 호버 효과 또는 드래그 중인 사진 표시
      if (hoveredIndex === index || draggingPhotoIndex === index) {
        ctx.strokeStyle = draggingPhotoIndex === index ? '#22c55e' : '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(-padding - 2, -padding - 2, layout.width + padding * 2 + 4, layout.height + bottomPadding + padding + 4);
      }
      
      // 핀 (압정)
      const pinX = layout.width / 2;
      const pinY = -padding + 5;
      
      // 핀 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(pinX + 2, pinY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // 핀 본체
      ctx.fillStyle = layout.pinColor;
      ctx.beginPath();
      ctx.arc(pinX, pinY, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // 핀 하이라이트
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(pinX - 2, pinY - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    ctx.restore();
  }, [photoLayouts, scale, offset, hoveredIndex, draggingPhotoIndex]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 뷰 상태 변경 시 상위 컴포넌트에 알림
  useEffect(() => {
    if (onViewStateChange && offset.x !== 0 && offset.y !== 0) {
      onViewStateChange({ scale, offset });
    }
  }, [scale, offset, onViewStateChange]);

  // 윈도우 리사이즈 핸들러
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 처음 진입 시 안내 메시지 3초 후 자동으로 사라지기
  useEffect(() => {
    if (showWelcomeMessage) {
      const timer = setTimeout(() => {
        setShowWelcomeMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcomeMessage]);

  // 사진 위에 마우스가 있는지 확인하는 함수
  const getPhotoAtPosition = useCallback((mouseX, mouseY) => {
    const transformedX = (mouseX - offset.x) / scale;
    const transformedY = (mouseY - offset.y) / scale;
    
    // 역순으로 검사 (위에 있는 것 우선)
    for (let i = photoLayouts.length - 1; i >= 0; i--) {
      const layout = photoLayouts[i];
      const padding = 12;
      const bottomPadding = 50;
      
      if (
        transformedX >= layout.x - padding &&
        transformedX <= layout.x + layout.width + padding &&
        transformedY >= layout.y - padding &&
        transformedY <= layout.y + layout.height + bottomPadding
      ) {
        return i;
      }
    }
    return -1;
  }, [photoLayouts, offset, scale]);

  // 마우스 이벤트 핸들러
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 클릭 위치 저장
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    wasDragged.current = false;
    
    // 사진 위에서 클릭했는지 확인
    const photoIndex = getPhotoAtPosition(mouseX, mouseY);
    
    if (photoIndex >= 0) {
      // 사진 드래그 시작
      setIsDraggingPhoto(true);
      setDraggingPhotoIndex(photoIndex);
      
      const layout = photoLayouts[photoIndex];
      const transformedX = (mouseX - offset.x) / scale;
      const transformedY = (mouseY - offset.y) / scale;
      
      setPhotoDragStart({
        x: transformedX - layout.x,
        y: transformedY - layout.y
      });
    } else {
      // 보드 드래그 시작
      // 관성 애니메이션 중이면 중단
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      setIsDraggingBoard(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      
      // 속도 추적 초기화
      velocityRef.current = { x: 0, y: 0 };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      lastMoveTime.current = Date.now();
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 드래그 여부 확인 (5px 이상 이동)
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      wasDragged.current = true;
    }
    
    if (isDraggingPhoto && draggingPhotoIndex >= 0) {
      // 사진 드래그 중
      const transformedX = (mouseX - offset.x) / scale;
      const transformedY = (mouseY - offset.y) / scale;
      
      const newX = transformedX - photoDragStart.x;
      const newY = transformedY - photoDragStart.y;
      
      setPhotoLayouts(prev => {
        const updated = [...prev];
        updated[draggingPhotoIndex] = {
          ...updated[draggingPhotoIndex],
          x: newX,
          y: newY
        };
        // 상위 컴포넌트에 변경 사항 알림
        if (onPhotoLayoutsChange) {
          onPhotoLayoutsChange(updated);
        }
        return updated;
      });
      
      canvas.style.cursor = 'grabbing';
    } else if (isDraggingBoard) {
      // 보드 드래그 중
      const now = Date.now();
      const dt = now - lastMoveTime.current;
      
      if (dt > 0) {
        // 속도 계산 (지수 이동 평균으로 부드럽게)
        const vx = (e.clientX - lastMousePos.current.x) / dt * 16; // 60fps 기준으로 정규화
        const vy = (e.clientY - lastMousePos.current.y) / dt * 16;
        
        velocityRef.current = {
          x: velocityRef.current.x * 0.5 + vx * 0.5,
          y: velocityRef.current.y * 0.5 + vy * 0.5
        };
      }
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      lastMoveTime.current = now;
      
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      canvas.style.cursor = 'grabbing';
    } else {
      // 호버 감지
      const photoIndex = getPhotoAtPosition(mouseX, mouseY);
      
      if (photoIndex !== hoveredIndex) {
        setHoveredIndex(photoIndex);
        canvas.style.cursor = photoIndex >= 0 ? 'move' : 'grab';
      }
    }
  };

  const handleMouseUp = (e) => {
    const wasPhotoClick = isDraggingPhoto && !wasDragged.current;
    const clickedPhotoIndex = draggingPhotoIndex;
    const wasBoardDrag = isDraggingBoard;
    
    setIsDraggingBoard(false);
    setIsDraggingPhoto(false);
    setDraggingPhotoIndex(-1);
    
    // 사진을 클릭했는데 드래그하지 않았으면 상세 보기 모달 열기
    if (wasPhotoClick && clickedPhotoIndex >= 0) {
      const layout = photoLayouts[clickedPhotoIndex];
      if (layout) {
        setSelectedPhoto(layout);
      }
    }
    
    // 보드 드래그 후 관성 스크롤 시작
    if (wasBoardDrag && wasDragged.current) {
      const velocity = velocityRef.current;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      // 최소 속도 이상일 때만 관성 적용
      if (speed > 0.5) {
        startInertiaAnimation();
      }
    }
  };
  
  // 관성 애니메이션
  const startInertiaAnimation = () => {
    const friction = 0.92; // 마찰 계수 (0.9 ~ 0.98, 높을수록 오래 미끄러짐)
    const minVelocity = 0.1;
    
    const animate = () => {
      const velocity = velocityRef.current;
      
      // 속도가 충분히 작으면 멈춤
      if (Math.abs(velocity.x) < minVelocity && Math.abs(velocity.y) < minVelocity) {
        velocityRef.current = { x: 0, y: 0 };
        animationFrameRef.current = null;
        return;
      }
      
      // 오프셋 업데이트
      setOffset(prev => ({
        x: prev.x + velocity.x,
        y: prev.y + velocity.y
      }));
      
      // 속도에 마찰 적용
      velocityRef.current = {
        x: velocity.x * friction,
        y: velocity.y * friction
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleMouseLeave = () => {
    const wasBoardDrag = isDraggingBoard;
    
    setIsDraggingBoard(false);
    setIsDraggingPhoto(false);
    setDraggingPhotoIndex(-1);
    
    // 보드 드래그 중 마우스가 나가면 관성 스크롤 시작
    if (wasBoardDrag) {
      const velocity = velocityRef.current;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      if (speed > 0.5) {
        startInertiaAnimation();
      }
    }
  };

  // 터치 이벤트 핸들러
  const getTouchCenter = (touches) => {
    const touch1 = touches[0];
    const touch2 = touches[1] || touches[0];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches.length === 2) {
      // 핀치 줌 시작 - 드래그 상태 해제
      e.preventDefault();
      setIsDraggingBoard(false);
      setIsDraggingPhoto(false);
      setDraggingPhotoIndex(-1);
      
      isTouchZooming.current = true;
      lastTouchDistance.current = getTouchDistance(e.touches);
      
      // 핀치 시작 시점의 중심점과 상태 저장
      const center = getTouchCenter(e.touches);
      pinchCenter.current = { 
        x: center.x - rect.left, 
        y: center.y - rect.top 
      };
      pinchStartScale.current = scale;
      pinchStartOffset.current = { ...offset };
      return;
    }
    
    // 핀치 줌 중이면 단일 터치 무시
    if (isTouchZooming.current) return;
    
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // 클릭 위치 저장
    mouseDownPos.current = { x: touch.clientX, y: touch.clientY };
    wasDragged.current = false;
    
    // 사진 위에서 터치했는지 확인
    const photoIndex = getPhotoAtPosition(touchX, touchY);
    
    if (photoIndex >= 0) {
      // 사진 드래그 시작
      setIsDraggingPhoto(true);
      setDraggingPhotoIndex(photoIndex);
      
      const layout = photoLayouts[photoIndex];
      const transformedX = (touchX - offset.x) / scale;
      const transformedY = (touchY - offset.y) / scale;
      
      setPhotoDragStart({
        x: transformedX - layout.x,
        y: transformedY - layout.y
      });
    } else {
      // 보드 드래그 시작
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      setIsDraggingBoard(true);
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      
      velocityRef.current = { x: 0, y: 0 };
      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      lastMoveTime.current = Date.now();
    }
  };

  const handleTouchMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // 핀치 줌 처리
    if (e.touches.length === 2) {
      e.preventDefault();
      
      // 핀치 줌이 아직 시작되지 않았으면 시작
      if (!isTouchZooming.current) {
        isTouchZooming.current = true;
        lastTouchDistance.current = getTouchDistance(e.touches);
        
        const center = getTouchCenter(e.touches);
        pinchCenter.current = { 
          x: center.x - rect.left, 
          y: center.y - rect.top 
        };
        pinchStartScale.current = scale;
        pinchStartOffset.current = { ...offset };
        
        // 드래그 상태 해제
        setIsDraggingBoard(false);
        setIsDraggingPhoto(false);
        setDraggingPhotoIndex(-1);
        return;
      }
      
      const currentDistance = getTouchDistance(e.touches);
      
      if (lastTouchDistance.current > 0 && currentDistance > 0) {
        // 시작점 기준 스케일 비율 계산
        const scaleRatio = currentDistance / lastTouchDistance.current;
        
        // 스케일 변화량 제한 (한 프레임당 최대 5% 변화)
        const clampedRatio = Math.max(0.95, Math.min(1.05, scaleRatio));
        const newScale = Math.max(0.2, Math.min(3, scale * clampedRatio));
        
        // 핀치 중심점을 기준으로 줌
        const centerX = pinchCenter.current.x;
        const centerY = pinchCenter.current.y;
        
        const newOffset = {
          x: centerX - (centerX - offset.x) * (newScale / scale),
          y: centerY - (centerY - offset.y) * (newScale / scale)
        };
        
        setScale(newScale);
        setOffset(newOffset);
        lastTouchDistance.current = currentDistance;
      }
      return;
    }
    
    // 핀치 줌 중이면 단일 터치 이동 무시
    if (isTouchZooming.current) return;
    
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // 드래그 여부 확인 (10px 이상 이동 - 터치에서 더 관대하게)
    const dx = touch.clientX - mouseDownPos.current.x;
    const dy = touch.clientY - mouseDownPos.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      wasDragged.current = true;
    }
    
    if (isDraggingPhoto && draggingPhotoIndex >= 0) {
      e.preventDefault();
      // 사진 드래그 중
      const transformedX = (touchX - offset.x) / scale;
      const transformedY = (touchY - offset.y) / scale;
      
      const newX = transformedX - photoDragStart.x;
      const newY = transformedY - photoDragStart.y;
      
      setPhotoLayouts(prev => {
        const updated = [...prev];
        updated[draggingPhotoIndex] = {
          ...updated[draggingPhotoIndex],
          x: newX,
          y: newY
        };
        if (onPhotoLayoutsChange) {
          onPhotoLayoutsChange(updated);
        }
        return updated;
      });
    } else if (isDraggingBoard) {
      // 보드 드래그 중
      const now = Date.now();
      const dt = now - lastMoveTime.current;
      
      if (dt > 0) {
        const vx = (touch.clientX - lastMousePos.current.x) / dt * 16;
        const vy = (touch.clientY - lastMousePos.current.y) / dt * 16;
        
        velocityRef.current = {
          x: velocityRef.current.x * 0.5 + vx * 0.5,
          y: velocityRef.current.y * 0.5 + vy * 0.5
        };
      }
      
      lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      lastMoveTime.current = now;
      
      setOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = (e) => {
    // 핀치 줌 종료 처리
    if (e.touches.length < 2 && isTouchZooming.current) {
      isTouchZooming.current = false;
      lastTouchDistance.current = 0;
      
      // 한 손가락이 남아있으면 패닝으로 전환
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        setIsDraggingBoard(true);
        setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
        velocityRef.current = { x: 0, y: 0 };
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
        lastMoveTime.current = Date.now();
        return;
      }
    }
    
    if (e.touches.length > 0) return; // 아직 터치 중
    
    const wasPhotoClick = isDraggingPhoto && !wasDragged.current;
    const clickedPhotoIndex = draggingPhotoIndex;
    const wasBoardDrag = isDraggingBoard;
    
    setIsDraggingBoard(false);
    setIsDraggingPhoto(false);
    setDraggingPhotoIndex(-1);
    
    // 사진을 탭했으면 상세 보기 모달 열기
    if (wasPhotoClick && clickedPhotoIndex >= 0) {
      const layout = photoLayouts[clickedPhotoIndex];
      if (layout) {
        setSelectedPhoto(layout);
      }
    }
    
    // 보드 드래그 후 관성 스크롤 시작
    if (wasBoardDrag && wasDragged.current) {
      const velocity = velocityRef.current;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      if (speed > 0.5) {
        startInertiaAnimation();
      }
    }
  };

  // 휠 줌 - useEffect에서 non-passive 이벤트로 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      
      setScale(prevScale => {
        const newScale = Math.max(0.2, Math.min(3, prevScale * delta));
        
        // 마우스 위치를 중심으로 줌
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return prevScale;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        setOffset(prevOffset => ({
          x: mouseX - (mouseX - prevOffset.x) * (newScale / prevScale),
          y: mouseY - (mouseY - prevOffset.y) * (newScale / prevScale)
        }));
        
        return newScale;
      });
    };
    
    // passive: false로 설정하여 preventDefault() 사용 가능
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 리셋
  const handleReset = () => {
    setScale(1);
    const container = containerRef.current;
    if (container && photoLayouts.length > 0) {
      const boardWidth = Math.max(container.clientWidth * 2, 2000);
      const boardHeight = Math.max(container.clientHeight * 2, 1500);
      setOffset({
        x: (container.clientWidth - boardWidth) / 2,
        y: (container.clientHeight - boardHeight) / 2
      });
    }
  };

  // 다운로드용 제목 상태
  const [downloadTitle, setDownloadTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);

  // 다운로드 버튼 클릭 시 제목 입력 모달 표시
  const handleDownloadClick = () => {
    setDownloadTitle('');
    setShowTitleInput(true);
  };

  // 다운로드 실행 함수
  const handleDownload = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // 제목이 있으면 캔버스에 제목 그리기 (현재 보이는 화면 기준 상단)
    if (downloadTitle.trim()) {
      ctx.save();
      
      // dpr 스케일 리셋 (픽셀 단위로 직접 그리기)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // 화면 크기 (CSS 픽셀 기준)
      const screenWidth = container.clientWidth;
      
      // 헤더 UI 아래에 위치하도록 상단 여백 추가
      const topOffset = 70 * dpr;
      const titleHeight = 50 * dpr;
      const titlePadding = 24 * dpr;
      
      // 제목 텍스트 설정 및 측정
      ctx.font = `bold ${24 * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textWidth = ctx.measureText(downloadTitle.trim()).width;
      const bgWidth = textWidth + titlePadding * 2;
      const bgX = (screenWidth * dpr - bgWidth) / 2;
      
      // 둥근 모서리 배경
      const radius = 12 * dpr;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.roundRect(bgX, topOffset, bgWidth, titleHeight, radius);
      ctx.fill();
      
      // 제목 텍스트
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(downloadTitle.trim(), (screenWidth * dpr) / 2, topOffset + titleHeight / 2);
      
      ctx.restore();
    }
    
    // 캔버스를 이미지로 변환
    const dataUrl = canvas.toDataURL('image/png');
    
    // 다운로드 링크 생성
    const link = document.createElement('a');
    const fileName = downloadTitle.trim() 
      ? `${downloadTitle.trim().replace(/[^a-zA-Z0-9가-힣\s]/g, '')}-${new Date().toISOString().slice(0, 10)}.png`
      : `photo-board-${new Date().toISOString().slice(0, 10)}.png`;
    link.download = fileName;
    link.href = dataUrl;
    
    // 다운로드 실행
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 제목 입력 모달 닫기
    setShowTitleInput(false);
    setDownloadTitle('');
    
    // 캔버스 다시 그리기 (제목 제거)
    requestAnimationFrame(() => {
      drawCanvas();
    });
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black">
      {/* 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-[10] bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500"></div>
            <span className="text-white text-xs sm:text-sm font-light tracking-wide">photo board</span>
            <span className="text-gray-400 text-xs hidden sm:inline">• {images.length}장의 사진</span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-4 h-4" />
            <span className="text-xs sm:text-sm">닫기</span>
          </button>
        </div>
      </div>

      {/* 컨트롤 패널 - 모바일에서 더 간단하게 */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-sm rounded-full px-2 sm:px-4 py-1.5 sm:py-2">
        <button
          onClick={() => setScale(prev => Math.min(3, prev * 1.2))}
          className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white"
          title="확대"
        >
          <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="text-white text-xs sm:text-sm px-2 sm:px-3 min-w-[45px] sm:min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={() => setScale(prev => Math.max(0.2, prev / 1.2))}
          className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white"
          title="축소"
        >
          <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="w-px h-4 sm:h-6 bg-white/30 mx-1 sm:mx-2" />
        <button
          onClick={handleReset}
          className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white"
          title="초기화"
        >
          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="w-px h-4 sm:h-6 bg-white/30 mx-1 sm:mx-2" />
        <button
          onClick={handleDownloadClick}
          className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white"
          title="다운로드"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        {/* 모바일에서 힌트 숨김 */}
        <div className="hidden sm:flex items-center">
          <div className="w-px h-6 bg-white/30 mx-2" />
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Move className="w-4 h-4" />
            <span>사진 드래그로 이동</span>
          </div>
        </div>
      </div>

      {/* 캔버스 */}
      <div
        ref={containerRef}
        className="w-full h-full touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: isDraggingBoard || isDraggingPhoto ? 'grabbing' : 'grab' }}
        />
      </div>

      {/* 사진 상세 모달 */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-20 bg-black/80 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[80vh] bg-white p-4 rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={selectedPhoto.image.url}
              alt="Selected photo"
              className="max-w-full max-h-[75vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* 제목 입력 모달 */}
      {showTitleInput && (
        <div
          className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowTitleInput(false)}
        >
          <div
            className="bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white text-base sm:text-lg font-medium mb-3 sm:mb-4">보드판 제목 입력</h3>
            <input
              type="text"
              value={downloadTitle}
              onChange={(e) => setDownloadTitle(e.target.value)}
              placeholder="제목을 입력하세요 (선택사항)"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm sm:text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDownload();
                } else if (e.key === 'Escape') {
                  setShowTitleInput(false);
                }
              }}
            />
            <p className="text-gray-400 text-xs mt-2 mb-3 sm:mb-4">
              제목은 이미지 상단 중앙에 표시됩니다.
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowTitleInput(false)}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg transition-colors text-sm sm:text-base"
              >
                취소
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 처음 진입 시 안내 메시지 */}
      {showWelcomeMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-8 py-4 sm:py-6 shadow-2xl">
            <p className="text-white text-sm sm:text-lg text-center">
              사진을 움직여 보드판을 완성 후<br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>하단 다운로드 해보세요
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

