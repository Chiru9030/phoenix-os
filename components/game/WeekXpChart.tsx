'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function WeekXpChart({ xpByDay, todayIndex, height = 200 }: { xpByDay: number[]; todayIndex?: number; height?: number }) {
  const data = xpByDay.map((xp, i) => ({ day: DAYS[i], xp }));
  return (
    <div style={{ height }} role="img" aria-label={'XP earned per day: ' + data.map((d) => `${d.day} ${d.xp}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#332f47" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#a39ebd', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#7a7694', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(212,169,78,0.08)' }} contentStyle={{ background: '#242032', border: '1px solid #332f47', borderRadius: 8, color: '#ede9f6', fontSize: 12 }} formatter={(v) => [`${v} XP`, '']} labelStyle={{ color: '#a39ebd' }} />
          <Bar dataKey="xp" radius={[6, 6, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={i === todayIndex ? '#f0c869' : '#d4a94e'} fillOpacity={i === todayIndex ? 1 : 0.7} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
