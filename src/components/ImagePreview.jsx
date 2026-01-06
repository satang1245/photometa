export const ImagePreview = ({ selectedImage, onImageClick }) => {
  if (!selectedImage) return null;

  return (
    <div className="mt-6 sm:mt-8 md:mt-12 flex items-center justify-center px-2 sm:px-4">
      <div 
        className="relative w-full max-w-4xl cursor-pointer group"
        onClick={onImageClick}
      >
        <img 
          src={selectedImage.url} 
          alt="Selected"
          className="w-full max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh] object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
          loading="eager"
        />
        {/* 호버/탭 시 확대 아이콘 표시 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 md:group-active:opacity-100 transition-opacity bg-black/20 rounded-lg">
          <div className="p-2 sm:p-3 bg-black/50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
        {/* 모바일 확대 힌트 */}
        <p className="md:hidden text-center text-xs text-gray-500 mt-2">탭하여 전체화면으로 보기</p>
        {selectedImage.loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
            <div className="text-white text-sm sm:text-base">메타데이터 로딩 중...</div>
          </div>
        )}
      </div>
    </div>
  );
};


