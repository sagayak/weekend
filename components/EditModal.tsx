
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
  const [recurring, setRecurring] = useState<RecurringType>(day.recurring || 'none');
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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      
      <div className="bg-white w-full max-w-xl rounded-[3.5rem] overflow-hidden shadow-2xl relative z-10 border border-slate-200 animate-in zoom-in fade-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="p-10 md:p-14">
          <header className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{formattedDate}</h2>
              <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">{day.type}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-4 bg-slate-100 hover:bg-slate-200 rounded-3xl transition-all border border-slate-200 text-slate-900"
            >
              <Icons.X />
            </button>
          </header>

          <div className="space-y-10">
            {/* Status Selection */}
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => setIsBusy(false)}
                className={`flex flex-col items-center justify-center gap-4 p-8 rounded-[2.5rem] transition-all border-2 ${
                  !isBusy 
                    ? `bg-gradient-to-br ${APP_CONFIG.COLORS.OPEN} text-white border-white shadow-2xl shadow-green-200 scale-[1.05]` 
                    : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'
                }`}
              >
                <div className={`w-5 h-5 rounded-full ${!isBusy ? 'bg-white' : 'bg-green-500'}`} />
                <span className="font-black uppercase tracking-widest text-xs">Open Day</span>
              </button>
              <button
                onClick={() => setIsBusy(true)}
                className={`flex flex-col items-center justify-center gap-4 p-8 rounded-[2.5rem] transition-all border-2 ${
                  isBusy 
                    ? `bg-gradient-to-br ${APP_CONFIG.COLORS.BUSY} text-white border-white shadow-2xl shadow-red-200 scale-[1.05]` 
                    : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'
                }`}
              >
                <div className={`w-5 h-5 rounded-full ${isBusy ? 'bg-white' : 'bg-red-500'}`} />
                <span className="font-black uppercase tracking-widest text-xs">Plan Day</span>
              </button>
            </div>

            {/* Plan Input */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity Notes</label>
                <button 
                  onClick={handleMagicSuggestion}
                  disabled={loadingSuggestion}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl transition-all disabled:opacity-50 border border-emerald-100"
                >
                  <Icons.Magic />
                  {loadingSuggestion ? 'Generating...' : 'Smart Suggest'}
                </button>
              </div>
              <textarea 
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="What's the plan?"
                className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all min-h-[140px]"
              />
            </div>

            {/* Recurring Selection */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">Individual Frequency</label>
              <div className="flex gap-3">
                {(['none', 'weekly', 'monthly'] as RecurringType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setRecurring(type)}
                    className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                      recurring === type 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                        : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Toggle */}
            <div 
              className={`flex items-center justify-between p-7 rounded-[2.5rem] cursor-pointer transition-all border ${
                isSupport 
                  ? 'bg-orange-500 border-orange-400 text-white shadow-2xl shadow-orange-100' 
                  : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              }`}
              onClick={() => setIsSupport(!isSupport)}
            >
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${isSupport ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <Icons.Calendar />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-widest">Support Shift</p>
                  <p className="text-[10px] opacity-70 font-bold uppercase tracking-tight">Manual override for this day</p>
                </div>
              </div>
              <div className={`w-14 h-7 rounded-full relative transition-colors ${isSupport ? 'bg-white/30' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${isSupport ? 'left-8' : 'left-1'}`} />
              </div>
            </div>
          </div>

          <div className="mt-12 flex gap-5">
            <button 
              onClick={onClose}
              className="flex-1 py-5 px-8 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all border border-slate-200"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave({ ...day, plan, isBusy, isSupport, recurring })}
              className="flex-[2] py-5 px-8 rounded-[2rem] font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-black transition-all shadow-2xl"
            >
              Update Weekend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
