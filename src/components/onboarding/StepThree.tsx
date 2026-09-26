import type { FormData } from '../../data/onboarding/types';
import FieldLabel from './FieldLabel';
import ResumeUploader from './ResumeUploader';

const StepThree = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <FieldLabel>Resume</FieldLabel>
        <ResumeUploader
          resume={data.resume}
          onChange={(r) => set({ resume: r })}
          onParsed={(p) =>
            set({
              parsed: p,
              fullName: data.fullName || p.name,
              headline: data.headline || p.headline,
              skills: p.skills,
            })
          }
        />
        <p className="text-[13px] text-gray-500">
          We'll extract your experience, education and skills from your resume — you can edit everything on your profile afterward.
        </p>
      </div>
    </div>
  );
};

export default StepThree;
