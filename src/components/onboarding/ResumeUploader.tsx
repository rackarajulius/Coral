import { useState } from 'react';
import { UploadCloud, FileCheck2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { FormData } from '../../data/onboarding/types';
import { parseResume, type ParsedResume } from '@/lib/api/jobSeekerProfile';

const ResumeUploader = ({
  resume,
  onChange,
  onParsed,
}: {
  resume: FormData['resume'];
  onChange: (r: FormData['resume']) => void;
  onParsed: (parsed: ParsedResume) => void;
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Resume must be under 10MB');
      return;
    }
    setUploading(true);
    try {
      const parsed = await parseResume(file);
      onChange({ name: file.name, size: file.size, uploadedAt: new Date() });
      onParsed(parsed);
      toast.success("Resume parsed — we've filled in what we found.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setUploading(false);
    }
  };

  if (resume) {
    return (
      <div className="flex items-center gap-4 rounded-[14px] border bg-white p-4">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-gray-100">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold truncate">{resume.name}</div>
          <div className="text-[12.5px] text-gray-500">
            {(resume.size / 1024).toFixed(1)} KB · Uploaded {resume.uploadedAt.toLocaleDateString()}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold bg-green-100 text-green-700">
          <Check className="h-3 w-3" strokeWidth={3} /> Parsed
        </span>
        <button
          onClick={() => {
            onChange(null);
          }}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100"
          aria-label="Remove resume"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed cursor-pointer transition-all duration-200 py-12 px-6 text-center',
        dragOver ? 'bg-gray-50 border-orange-400' : 'bg-white hover:bg-gray-50',
        uploading && 'pointer-events-none opacity-80',
      )}
    >
      <div className="h-12 w-12 rounded-2xl flex items-center justify-center">
        {uploading ? (
          <div className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        ) : (
          <UploadCloud className="h-6 w-6 text-gray-500" />
        )}
      </div>
      <div>
        <div className="text-[15px] font-semibold">
          {uploading ? 'Reading your resume…' : 'Drag and drop your resume'}
        </div>
        <div className="text-[13px] mt-1 text-gray-500">
          or <span className="font-medium text-orange-600">browse files</span> — PDF, DOC, DOCX up to 10MB
        </div>
      </div>
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) handleFile(f);
        }}
      />
    </label>
  );
};

export default ResumeUploader;
