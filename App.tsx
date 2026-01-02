
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  // 1. Initialize state from Local Storage immediately to prevent "flicker" or data loss on reload
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('zenweekend_state_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        // Convert ISO strings back to Date objects
        Object.values(parsed.weekendDays).forEach(day => {
          day.date = new Date(day.date);
        });
        return parsed;
      } catch (e) {
        console.error("Initial local storage hydration failed", e);
      }
    }
    return {
      weekendDays: {},
      recurringSupport: { 
        saturday: false, 
        sunday: false, 
        interval: 1, 
        baseDate: new Date().toISOString().split('T')[0],
        customBg: undefined
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Sync from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch plans and settings in parallel
        const [plansResponse, settingsResponse] = await Promise.all([
          supabase.from('weekend_plans').select('*'),
          supabase.from('weekend_settings').select('*').single()
        ]);

        const plans = plansResponse.data;
        const settings = settingsResponse.data;

        const plansMap: Record<string, WeekendDay> = {};
        if (plans && plans.length > 0) {
          plans.forEach(p => {
            plansMap[p.id] = {
              id: p.id,
              date: new Date(p.date),
              type: p.type as any,
              plan: p.plan,
              isBusy: p.is_busy,
              isSupport: p.is_support,
              recurring: (p.recurring || 'none') as any
            };
          });
        }

        setState(prev => ({
          ...prev,
          // Only update weekendDays if we actually got something from Supabase, 
          // otherwise keep the local storage data we initialized with.
          weekendDays: plans && plans.length > 0 ? { ...prev.weekendDays, ...plansMap } : prev.weekendDays,
          recurringSupport: settings?.recurring_support ? { ...prev.recurringSupport, ...settings.recurring_support } : prev.recurringSupport
        }));
      } catch (err) {
        console.error("Supabase sync failed, relying on local storage", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 3. Persist to local storage whenever state changes, BUT ONLY after initial loading is done
  // to prevent wiping local data with an empty initial state.
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('zenweekend_state_v2', JSON.stringify(state));
    }
  }, [state, loading]);

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
    // Immediate UI update
    setState(prev => ({
      ...prev,
      weekendDays: { ...prev.weekendDays, [updatedDay.id]: updatedDay }
    }));
    setEditingDay(null);

    // Background sync to Supabase
    try {
      const { error } = await supabase.from('weekend_plans').upsert({
        id: updatedDay.id,
        date: updatedDay.date.toISOString(),
        type: updatedDay.type,
        plan: updatedDay.plan,
        is_busy: updatedDay.isBusy,
        is_support: updatedDay.isSupport,
        recurring: updatedDay.recurring
      });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to sync plan to Supabase", e);
    }
  };

  const updateSupportSettings = async (updates: Partial<RecurringSupportSettings>) => {
    const newSettings = { ...state.recurringSupport, ...updates };
    setState(prev => ({ ...prev, recurringSupport: newSettings }));
    try {
      const { error } = await supabase.from('weekend_settings').upsert({ id: 1, recurring_support: newSettings });
      if (error) throw error;
    } catch (e) { 
      console.error("Failed to sync settings to Supabase", e); 
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSupportSettings({ customBg: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const isDateSupport = (targetDate: Date) => {
    const isSaturday = targetDate.getDay() === 6;
    const isSunday = targetDate.getDay() === 0;
    const { saturday, sunday, interval, baseDate } = state.recurringSupport;
    
    if (!((isSaturday && saturday) || (isSunday && sunday))) return false;

    const start = new Date(baseDate);
    const startSunday = new Date(start);
    startSunday.setDate(start.getDate() - start.getDay());
    startSunday.setHours(0, 0, 0, 0);

    const targetSunday = new Date(targetDate);
    targetSunday.setDate(targetDate.getDate() - targetDate.getDay());
    targetSunday.setHours(0, 0, 0, 0);

    const diffWeeks = Math.round((targetSunday.getTime() - startSunday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.abs(diffWeeks) % (interval || 1) === 0;
  };

  const bgImage = state.recurringSupport.customBg || APP_CONFIG.BG_IMAGE;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-8 overflow-y-auto transition-all duration-1000"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.85)), url(${bgImage})` }}
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
          <div className="flex flex-col gap-1 mr-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Support Frequency</span>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Every</span>
                <select 
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none hover:border-slate-400 transition-colors"
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
          
          <div className="flex flex-col gap-1 mr-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Starting From</span>
             <input 
              type="date"
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none hover:border-slate-400 transition-colors"
              value={state.recurringSupport.baseDate.split('T')[0]}
              onChange={(e) => updateSupportSettings({ baseDate: new Date(e.target.value).toISOString() })}
             />
          </div>

          <div className="flex gap-2">
            <button onClick={() => updateSupportSettings({ saturday: !state.recurringSupport.saturday })} className={`px-5 py-3 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 border ${state.recurringSupport.saturday ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {state.recurringSupport.saturday && <Icons.Check />} Sat
            </button>
            <button onClick={() => updateSupportSettings({ sunday: !state.recurringSupport.sunday })} className={`px-5 py-3 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-3 border ${state.recurringSupport.sunday ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {state.recurringSupport.sunday && <Icons.Check />} Sun
            </button>
          </div>
          
          <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden lg:block"></div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-white text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
            title="Change Background"
          >
            <Icons.Image />
            <span className="text-xs font-bold hidden xl:inline">Set Background</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBgUpload} 
            accept="image/*" 
            className="hidden" 
          />
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
