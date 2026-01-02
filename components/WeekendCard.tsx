
import React from 'react';
import { WeekendDay } from '../types';
import { APP_CONFIG } from '../constants';

interface Props {
  day: WeekendDay;
  activeSupport: boolean;
  onEdit: () => void;
}

const WeekendCard: React.FC<Props> = ({ day, activeSupport, onEdit }) => {
  const dateNum = day.date.getDate();
  const monthStr = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(day.date);
  const dayAbbr = day.type === 'Saturday' ? 'SAT' : 'SUN';
  
  const statusColors = day.isBusy ? APP_CONFIG.COLORS.BUSY : APP_CONFIG.COLORS.OPEN;
  const isToday = new Date().toISOString().split('T')[0] === day.id;

  return (
    <div 
      className={`card-zoom group relative rounded-2xl h-16 flex items-center px-4 cursor-pointer overflow-hidden transition-all shadow-sm hover:shadow-lg active:scale-95 border border-white/10 ${
        isToday ? 'ring-2 ring-slate-900 ring-offset-1' : ''
      }`}
      onClick={onEdit}
    >
      {/* High-visibility background status */}
      <div className={`absolute inset-0 bg-gradient-to-br ${statusColors} transition-all duration-500`} />
      
      {/* Subtle support pattern */}
      {activeSupport && (
        <div className="absolute inset-0 opacity-15 pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)' }} />
      )}

      {/* Card Content Layout */}
      <div className="relative z-10 w-full flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white drop-shadow-sm leading-none">
            {dateNum}
          </span>
          <span className="text-[10px] font-black text-white/80 uppercase tracking-tighter leading-none">
            {monthStr}
          </span>
          <span className="text-[10px] font-medium text-white/60 ml-1 border-l border-white/20 pl-2 leading-none">
            {dayAbbr}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {activeSupport && (
            <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg border border-white/20 flex items-center gap-1 animate-pulse">
              <span className="w-1 h-1 bg-white rounded-full"></span>
              Support
            </span>
          )}
          {day.plan && (
             <div className="bg-white/20 p-1 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeekendCard;
