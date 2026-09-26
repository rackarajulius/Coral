import React, { useMemo } from 'react'

const Sparkline = ({ data, positive }:{ data: number[]; positive: boolean }) => {
    const points = useMemo(() => {
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        return data
          .map((v, i) => `${(i / (data.length - 1)) * 80},${28 - ((v - min) / range) * 28}`)
          .join(" ");
      }, [data]);
      
  return (
       <svg width={80} height={28} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
       stroke={positive ? "#059669" : "#b91c1c"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
