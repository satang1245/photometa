import { Upload } from 'lucide-react';

export const ImageUploader = ({ isDragging, onDragEnter, onDragOver, onDragLeave, onDrop, onFileSelect }) => {
  return (
    <div className="h-full flex items-center justify-center">
      <label className="cursor-pointer group">
        <div className={`border-2 border-dashed rounded-lg p-16 transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-700 hover:border-gray-600'
        }`}>
          <Upload className={`w-16 h-16 mx-auto mb-4 transition-colors ${
            isDragging 
              ? 'text-blue-500' 
              : 'text-gray-600 group-hover:text-gray-500'
          }`} />
          <p className={`text-center transition-colors ${
            isDragging 
              ? 'text-blue-400' 
              : 'text-gray-500'
          }`}>
            {isDragging ? '여기에 사진을 놓으세요' : '사진을 업로드하세요'}
          </p>
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


