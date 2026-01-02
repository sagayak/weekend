
import React from 'react';
import { WeekendDay } from '../types';
import { Icons, APP_CONFIG } from '../constants';

interface Props {
  day: WeekendDay;
  activeSupport: boolean;
  onEdit: () => void;
}

const WeekendCard: React.FC<Props> = ({ day, activeSupport, onEdit }) => {
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(day.date);
  
  const statusColors = day.isBusy ? APP_CONFIG.COLORS.BUSY : APP_CONFIG.COLORS.OPEN;
  const isToday = new Date().toISOString().split('T')[0] === day.id;

  return (
    <div 
      className={`card-zoom group relative rounded-[2.5rem] p-8 h-80 flex flex-col cursor-pointer overflow-hidden transition-all shadow-xl hover:shadow-2xl active:scale-95 ${
        isToday ? 'ring-4 ring-slate-900 ring-offset-4' : ''
      }`}
      onClick={onEdit}
    >
      {/* Background Fill Layer - This fills the entire card with the status color */}
      <div className={`absolute inset-0 bg-gradient-to-br ${statusColors} opacity-100 transition-all duration-500`} />
      
      {/* Dynamic Glow Effect */}
      <div className="absolute -inset-2 bg-white/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Date Header */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="text-3xl font-black tracking-tighter text-white drop-shadow-md">{day.type}</h3>
          <p className="text-white/80 font-bold uppercase tracking-widest text-[10px] mt-1">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
          {day.recurring !== 'none' && (
            <div className="p-2 bg-white/20 border border-white/30 rounded-xl text-white shadow-lg backdrop-blur-sm" title={`Recurring: ${day.recurring}`}>
              <Icons.Repeat />
            </div>
          )}
          {activeSupport && (
            <div className="p-2 bg-orange-400 border border-white/30 rounded-xl text-white shadow-lg animate-pulse backdrop-blur-sm" title="Support Day">
              <Icons.Calendar />
            </div>
          )}
        </div>
      </div>

      {/* Plan Area */}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        {day.plan ? (
          <p className="text-white text-2xl font-black leading-tight drop-shadow-lg group-hover:scale-[1.02] transition-transform">
            {day.plan}
          </p>
        ) : (
          <p className="text-white/40 font-bold italic text-sm">Open to possibilities...</p>
        )}
      </div>

      {/* Badges / Footer */}
      <div className="mt-6 flex items-center justify-between relative z-10">
        <div className="flex gap-2">
          {activeSupport && (
            <span className="bg-orange-500 text-white border border-white/40 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
              Support
            </span>
          )}
          <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border bg-white/20 text-white border-white/40 backdrop-blur-md`}>
            {day.isBusy ? 'Busy' : 'Open'}
          </span>
        </div>
        
        <div className="p-3 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 border border-white/30 text-white">
          <Icons.Edit />
        </div>
      </div>

      {/* Support Visual Overlay Corner Ribbon */}
      {activeSupport && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none overflow-hidden">
           <div className="absolute top-0 right-0 w-[150%] h-12 bg-orange-400 rotate-45 translate-x-12 -translate-y-4 shadow-2xl border-b border-white/40 flex items-center justify-center">
              <span className="text-[8px] font-black text-white uppercase tracking-[0.2em] mt-4">Support</span>
           </div>
        </div>
      )}
    </div>
  );
};

export default WeekendCard;
