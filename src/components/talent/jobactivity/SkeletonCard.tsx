function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#F1F3F5] rounded-md ${className}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 animate-[shimmer_1.4s_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
        }}
      />
    </div>
  );
}

const SkeletonCard = () => {
  return (
     <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-6">
      <div className="flex items-start gap-4">
        <Shimmer className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-between gap-3">
            <Shimmer className="h-4 w-1/2" />
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
          <Shimmer className="h-3 w-1/3" />
          <div className="flex gap-3 pt-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-3 w-16" />
          </div>
          <div className="flex items-center justify-between pt-3">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-9 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
