import { Upload, Camera } from 'lucide-react';

export const ImageUploader = ({ isDragging, onDragEnter, onDragOver, onDragLeave, onDrop, onFileSelect }) => {
  return (
    <div className="h-full flex items-center justify-center px-4">
      <label className="cursor-pointer group w-full max-w-md">
        <div className={`border-2 border-dashed rounded-xl p-8 sm:p-12 md:p-16 transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-700 hover:border-gray-600 active:border-gray-500'
        }`}>
          <div className="flex flex-col items-center">
            <Upload className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-4 transition-colors ${
              isDragging 
                ? 'text-blue-500' 
                : 'text-gray-600 group-hover:text-gray-500'
            }`} />
            <p className={`text-center transition-colors text-sm sm:text-base ${
              isDragging 
                ? 'text-blue-400' 
                : 'text-gray-500'
            }`}>
              {isDragging ? '여기에 사진을 놓으세요' : '사진을 업로드하세요'}
            </p>
            {/* 모바일 힌트 */}
            <p className="md:hidden text-xs text-gray-600 mt-3 flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              탭하여 사진 선택
            </p>
          </div>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept="image/*" 
          multiple 
          onChange={onFileSelect} 
        />
      </label>
    </div>
  );
};


