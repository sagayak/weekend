
import React, { useState } from 'react';
import { WeekendDay, RecurringType } from '../types';
import { Icons, APP_CONFIG } from '../constants';
import { getSmartWeekendSuggestion } from '../geminiService';

interface Props {
  day: WeekendDay;
  onClose: () => void;
  onSave: (day: WeekendDay) => void;
}

const EditModal: React.FC<Props> = ({ day, onClose, onSave }) => {
  const [plan, setPlan] = useState(day.plan);
  const [isBusy, setIsBusy] = useState(day.isBusy);
  const [isSupport, setIsSupport] = useState(day.isSupport);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(day.date);

  const handleMagicSuggestion = async () => {
    setLoadingSuggestion(true);
    const suggestion = await getSmartWeekendSuggestion(isBusy);
    setPlan(suggestion);
    setLoadingSuggestion(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl transition-all duration-500" onClick={onClose} />
      
      <div className="bg-white w-full max-w-xl rounded-[4rem] overflow-hidden shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] relative z-10 border border-white animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="p-12 md:p-16">
          <header className="flex justify-between items-start mb-12">
            <div>
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">{formattedDate}</h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">{day.type}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-5 bg-slate-100 hover:bg-slate-200 rounded-[2rem] transition-all border border-slate-200 text-slate-900 shadow-sm"
            >
              <Icons.X />
            </button>
          </header>

          <div className="space-y-12">
            {/* Status Selection */}
            <div className="grid grid-cols-2 gap-8">
              <button
                onClick={() => setIsBusy(false)}
                className={`flex flex-col items-center justify-center gap-4 p-10 rounded-[3rem] transition-all border-2 ${
                  !isBusy 
                    ? `bg-gradient-to-br ${APP_CONFIG.COLORS.OPEN} text-white border-white shadow-2xl shadow-green-100 scale-[1.05]` 
                    : 'bg-slate-50 text-slate-300 border-transparent hover:bg-slate-100'
                }`}
              >
                <div className={`w-6 h-6 rounded-full ${!isBusy ? 'bg-white shadow-inner' : 'bg-green-500/20'}`} />
                <span className="font-black uppercase tracking-[0.2em] text-[10px]">Open Day</span>
              </button>
              <button
                onClick={() => setIsBusy(true)}
                className={`flex flex-col items-center justify-center gap-4 p-10 rounded-[3rem] transition-all border-2 ${
                  isBusy 
                    ? `bg-gradient-to-br ${APP_CONFIG.COLORS.BUSY} text-white border-white shadow-2xl shadow-red-100 scale-[1.05]` 
                    : 'bg-slate-50 text-slate-300 border-transparent hover:bg-slate-100'
                }`}
              >
                <div className={`w-6 h-6 rounded-full ${isBusy ? 'bg-white shadow-inner' : 'bg-red-500/20'}`} />
                <span className="font-black uppercase tracking-[0.2em] text-[10px]">Plan Day</span>
              </button>
            </div>

            {/* Plan Input */}
            <div className="space-y-5">
              <div className="flex justify-between items-center px-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Activity Plan</label>
                <button 
                  onClick={handleMagicSuggestion}
                  disabled={loadingSuggestion}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-2 bg-emerald-50 px-5 py-2.5 rounded-2xl transition-all disabled:opacity-50 border border-emerald-100 shadow-sm"
                >
                  <Icons.Magic />
                  {loadingSuggestion ? 'Generating...' : 'Smart Idea'}
                </button>
              </div>
              <textarea 
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Write your adventure here..."
                className="w-full bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 text-2xl text-slate-900 placeholder-slate-200 focus:outline-none focus:ring-8 focus:ring-slate-100 transition-all min-h-[160px] leading-relaxed"
              />
            </div>

            {/* Support Toggle */}
            <div 
              className={`flex items-center justify-between p-8 rounded-[3rem] cursor-pointer transition-all border-2 ${
                isSupport 
                  ? 'bg-orange-500 border-orange-400 text-white shadow-2xl shadow-orange-100 scale-[1.02]' 
                  : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              }`}
              onClick={() => setIsSupport(!isSupport)}
            >
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-[1.5rem] transition-colors ${isSupport ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                  <Icons.Calendar />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-widest">Support Duty</p>
                  <p className={`text-[10px] font-bold uppercase tracking-tight ${isSupport ? 'text-white/80' : 'text-slate-400'}`}>Override global schedule</p>
                </div>
              </div>
              <div className={`w-16 h-8 rounded-full relative transition-all shadow-inner ${isSupport ? 'bg-white/30' : 'bg-slate-200'}`}>
                <div className={`absolute top-1.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isSupport ? 'left-9' : 'left-1.5'}`} />
              </div>
            </div>
          </div>

          <div className="mt-16 flex gap-6">
            <button 
              onClick={onClose}
              className="flex-1 py-6 px-10 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all border border-slate-200"
            >
              Discard
            </button>
            <button 
              onClick={() => onSave({ ...day, plan, isBusy, isSupport, recurring: 'none' })}
              className="flex-[2] py-6 px-10 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-black transition-all shadow-2xl shadow-slate-200"
            >
              Confirm Weekend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
