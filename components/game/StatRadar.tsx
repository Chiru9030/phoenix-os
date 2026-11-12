'use client';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { STAT_LABELS, STAT_NAMES, type CharacterStats } from '@/lib/types';

export function StatRadar({ stats, height = 280 }: { stats: CharacterStats; height?: number }) {
  const data = STAT_NAMES.map((s) => ({ stat: STAT_LABELS[s].replace('Communication', 'Comms').replace('Intelligence', 'Intellect').replace('Coding Skill', 'Coding'), value: Math.round(stats[s] * 10) / 10 }));
  const max = Math.max(10, Math.ceil(Math.max(...data.map((d) => d.value)) * 1.25 / 5) * 5);
  return (
    <div style={{ height }} role="img" aria-label={'Stat radar: ' + data.map((d) => `${d.stat} ${d.value}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#332f47" />
          <PolarAngleAxis dataKey="stat" tick={{ fill: '#a39ebd', fontSize: 11, fontFamily: 'var(--font-body, inherit)' }} />
          <PolarRadiusAxis angle={90} domain={[0, max]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="#d4a94e" strokeWidth={2} fill="#d4a94e" fillOpacity={0.22} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
