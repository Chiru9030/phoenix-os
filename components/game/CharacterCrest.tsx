import { GameIcon, CLASS_ICON } from './icons';
import { crestTier } from '@/lib/game/xp';
import { cn } from '@/lib/utils';

const C = 100;
const hex = (r: number, rot = -90) => Array.from({ length: 6 }, (_, i) => { const a = ((rot + i * 60) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] as const; });
const pts = (p: readonly (readonly [number, number])[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const R_RING = 90, CIRC = 2 * Math.PI * R_RING;

/**
 * The signature element: a hexagonal seal that visibly *earns* detail as you level.
 * Tier 1 (L1–9) plain bronze · Tier 2 (L10–24) runic silver inlay · Tier 3 (L25+) gilded with gems and a slow glow.
 * The ring is an astrolabe-style tick dial whose gold sweep is your progress to the next level.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;

export function CharacterCrest({ level, progress, characterClass, size = 168, className }: { level: number; progress: number; characterClass: string; size?: number; className?: string }) {
  const tier = crestTier(level);
  const outer = hex(64), inner = hex(52), gems = hex(64);
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 * Math.PI) / 180, long = i % 5 === 0;
    const r1 = R_RING - (long ? 9 : 5), r2 = R_RING - 1.5;
    return [round2(C + r1 * Math.sin(a)), round2(C - r1 * Math.cos(a)), round2(C + r2 * Math.sin(a)), round2(C - r2 * Math.cos(a)), long] as const;
  });
  const pal = tier === 3 ? { a: '#8a6f35', b: '#f0c869', edge: '#fff0c2' } : tier === 2 ? { a: '#4c4a60', b: '#b9b6cf', edge: '#e8e6f5' } : { a: '#5b3d22', b: '#a87b45', edge: '#d9a96a' };
  const gemColors = ['#7c6fe8', '#c9503f', '#6fa287', '#7c6fe8', '#c9503f', '#6fa287'];
  return (
    <div className={cn('relative shrink-0', tier === 3 && 'animate-crest-pulse', className)} style={{ width: size, height: size }} role="img" aria-label={`Level ${level} ${characterClass}, ${Math.round(progress)}% to the next level`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="crest-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={pal.b} /><stop offset="1" stopColor={pal.a} /></linearGradient>
          <linearGradient id="crest-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a6f35" /><stop offset=".6" stopColor="#f0c869" /><stop offset="1" stopColor="#fff3cf" /></linearGradient>
        </defs>
        {ticks.map(([x1, y1, x2, y2, long], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={long ? '#6e6a87' : '#332f47'} strokeWidth={long ? 1.6 : 1} strokeLinecap="round" />)}
        <circle cx={C} cy={C} r={R_RING - 12} fill="none" stroke="#332f47" strokeWidth="1" />
        <circle cx={C} cy={C} r={R_RING - 12} fill="none" stroke="url(#crest-ring)" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * (R_RING - 12)} strokeDashoffset={2 * Math.PI * (R_RING - 12) * (1 - Math.max(0, Math.min(100, progress)) / 100)} transform={`rotate(-90 ${C} ${C})`} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
        <polygon points={pts(outer)} fill="url(#crest-body)" stroke={pal.edge} strokeWidth="3" strokeLinejoin="round" />
        <polygon points={pts(inner)} fill="#14111d" fillOpacity={tier === 1 ? 0.72 : 0.84} stroke={pal.edge} strokeOpacity={tier === 1 ? 0.35 : 0.8} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray={tier >= 2 ? '2 4' : undefined} />
        {tier >= 2 && inner.map(([x, y], i) => <path key={i} d={`M${C + (x - C) * 0.72} ${C + (y - C) * 0.72} L${C + (x - C) * 0.92} ${C + (y - C) * 0.92}`} stroke={pal.edge} strokeWidth="2" strokeLinecap="round" />)}
        {tier === 3 && gems.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5.5" fill={gemColors[i]} stroke="#fff3cf" strokeWidth="1.2" /><circle cx={x - 1.5} cy={y - 1.5} r="1.4" fill="#fff" fillOpacity=".8" /></g>)}
        <g transform={`translate(${C} ${C + 80})`}><rect x="-20" y="-11" width="40" height="22" rx="11" fill="#100f17" stroke={pal.edge} strokeWidth="1.5" /><text textAnchor="middle" dominantBaseline="central" y="1" fontFamily="'IBM Plex Mono', monospace" fontWeight="600" fontSize="13" fill="#f0c869">{level}</text></g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-1"><GameIcon name={CLASS_ICON[characterClass] ?? 'compass'} className="h-[26%] w-[26%] text-parchment" /></div>
    </div>
  );
}
