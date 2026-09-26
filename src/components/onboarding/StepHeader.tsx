const StepHeader = ({ step, title, description }: { step: number; title: string; description: string }) => {
  return (
    <div className="mb-8">
      <div className="text-[12px] font-bold uppercase mb-3 text-orange-500" style={{ letterSpacing: '0.1em' }}>
        Step {step} of 4
      </div>
      <h1 className="text-[32px] sm:text-[40px] font-bold leading-[1.1] text-gray-900" style={{ letterSpacing: '-0.03em' }}>
        {title}
      </h1>
      <p className="mt-3 text-[16px] max-w-[620px] text-gray-600" style={{ lineHeight: 1.7 }}>
        {description}
      </p>
    </div>
  );
};

export default StepHeader;
