// Soft, readable tints (green excluded to stay on-theme). One is picked
// deterministically from the company name so a company always gets the same color.
const AVATAR_TONES = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
  "bg-slate-100 text-slate-700",
];

function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const CompanyMark = ({ letter, seed }: { letter: string; seed?: string }) => (
  <div
    className={`w-12 h-12 rounded-xl border border-black/5 flex items-center justify-center font-bold ${toneFor(seed ?? letter)}`}
  >
    {letter}
  </div>
);

export default CompanyMark;
