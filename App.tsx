
import React, { useState, useEffect, useMemo } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    weekendDays: {},
    recurringSupport: { 
      saturday: false, 
      sunday: false, 
      interval: 1, 
      baseDate: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toISOString() 
    }
  });
  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: plans } = await supabase.from('weekend_plans').select('*');
        const { data: settings } = await supabase.from('weekend_settings').select('*').single();

        if (plans) {
          const plansMap: Record<string, WeekendDay> = {};
          plans.forEach(p => {
            plansMap[p.id] = {
              id: p.id,
              date: new Date(p.date),
              type: p.type,
              plan: p.plan,
              isBusy: p.is_busy,
              isSupport: p.is_support,
              recurring: p.recurring || 'none'
            };
          });
          
          setState(prev => ({
            ...prev,
            weekendDays: plansMap,
            recurringSupport: settings?.recurring_support || prev.recurringSupport
          }));
        }
      } catch (err) {
        console.error("Supabase sync failed", err);
        const saved = localStorage.getItem('zenweekend_state');
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as AppState;
            Object.values(parsed.weekendDays).forEach(day => {
              day.date = new Date(day.date);
            });
            setState(parsed);
          } catch (e) {
            console.error("Local storage hydration failed", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('zenweekend_state', JSON.stringify(state));
  }, [state]);

  const dateRange = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - (7 * APP_CONFIG.WEEKS_BEFORE));
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()) + (7 * APP_CONFIG.WEEKS_AFTER));

    const current = new Date(startDate);
    while (current <= endDate) {
      if (current.getDay() === 6 || current.getDay() === 0) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, []);

  const handleUpdateDay = async (updatedDay: WeekendDay) => {
    setState(prev => ({
      ...prev,
      weekendDays: { ...prev.weekendDays, [updatedDay.id]: updatedDay }
    }));
    setEditingDay(null);

    try {
      await supabase.from('weekend_plans').upsert({
        id: updatedDay.id,
        date: updatedDay.date.toISOString(),
        type: updatedDay.type,
        plan: updatedDay.plan,
        is_busy: updatedDay.isBusy,
        is_support: updatedDay.isSupport,
        recurring: updatedDay.recurring
      });
    } catch (e) {
      console.error("Failed to sync plan to Supabase", e);
    }
  };

  const updateSupportSettings = async (updates: Partial<RecurringSupportSettings>) => {
    const newSettings = { ...state.recurringSupport, ...updates };
    setState(prev => ({ ...prev, recurringSupport: newSettings }));
    try {
      await supabase.from('weekend_settings').upsert({ id: 1, recurring_support: newSettings });
    } catch (e) { console.error(e); }
  };

  const isDateSupport = (date: Date) => {
    const isSaturday = date.getDay() === 6;
    const isSunday = date.getDay() === 0;
    const { saturday, sunday, interval, baseDate } = state.recurringSupport;
    
    if ((isSaturday && saturday) || (isSunday && sunday)) {
      const base = new Date(baseDate);
      const diffTime = Math.abs(date.getTime() - base.getTime());
      const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
      return diffWeeks % interval === 0;
    }
    return false;
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-8 overflow-y-auto transition-all duration-1000"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.85)), url(${APP_CONFIG.BG_IMAGE})` }}
    >
      <header className="w-full max-w-6xl mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10 pt-10">
        <div className="animate-in fade-in slide-in-from-top duration-700">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-2">
            ZenWeekend
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-slate-600 text-lg font-medium">Clear plans, calm mind.</p>
            {loading && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Syncing
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2.5rem] flex flex-wrap gap-4 items-center border border-white/80 shadow-xl">
          <div className="flex flex-col gap-1 mr-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Support Frequency</span>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Every</span>
                <select 
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 outline-none hover:border-slate-400 transition-colors"
                  value={state.recurringSupport.interval}
                  onChange={(e) => updateSupportSettings({ interval: parseInt(e.target.value) })}
                >
                   <option value="1">Week</option>
                   <option value="2">2 Weeks</option>
                   <option value="3">3 Weeks</option>
                   <option value="4">4 Weeks</option>
                </select>
             </div>
          </div>
          <button onClick={() => updateSupportSettings({ saturday: !state.recurringSupport.saturday })} className={`px-6 py-3 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 border ${state.recurringSupport.saturday ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            {state.recurringSupport.saturday && <Icons.Check />} Saturdays
          </button>
          <button onClick={() => updateSupportSettings({ sunday: !state.recurringSupport.sunday })} className={`px-6 py-3 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 border ${state.recurringSupport.sunday ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            {state.recurringSupport.sunday && <Icons.Check />} Sundays
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
        {dateRange.map((date, idx) => {
          const id = date.toISOString().split('T')[0];
          const isSaturday = date.getDay() === 6;
          const dayType = isSaturday ? 'Saturday' : 'Sunday';
          const storedDay = state.weekendDays[id];
          const hasRecurringSupport = isDateSupport(date);

          const dayData: WeekendDay = storedDay || {
            id, date, type: dayType, plan: '', isBusy: false, isSupport: false, recurring: 'none'
          };

          return (
            <div key={id} style={{ animationDelay: `${idx * 50}ms` }} className="animate-in fade-in zoom-in duration-500 fill-mode-both">
              <WeekendCard 
                day={dayData}
                activeSupport={dayData.isSupport || hasRecurringSupport}
                onEdit={() => setEditingDay(dayData)}
              />
            </div>
          );
        })}
      </main>

      {editingDay && <EditModal day={editingDay} onClose={() => setEditingDay(null)} onSave={handleUpdateDay} />}
      
      <footer className="fixed bottom-8 z-20">
        <div className="bg-white/80 backdrop-blur-2xl px-8 py-4 rounded-full flex items-center gap-10 shadow-2xl border border-white">
          <div className="flex items-center gap-3 group"><div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-200 group-hover:scale-125 transition-transform"></div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Open</span></div>
          <div className="flex items-center gap-3 group"><div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-500 to-red-700 shadow-lg shadow-red-200 group-hover:scale-125 transition-transform"></div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Busy</span></div>
          <div className="flex items-center gap-3 group"><div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-200 group-hover:scale-125 transition-transform"></div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Support</span></div>
        </div>
      </footer>
    </div>
  );
};

export default App;
