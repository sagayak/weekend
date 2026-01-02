
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';
import { isDateSupport } from './utils';

const App: React.FC = () => {
  // Initialize state from Local Storage immediately to prevent "flicker" or data loss on reload
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('zenweekend_state_v4');
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
        saturday: true, // Internal default: always both if support is active for the week
        sunday: true, 
        interval: 1, 
        baseDate: new Date().toISOString().split('T')[0],
        customBg: undefined
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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

  // Persist to local storage whenever state changes, after initial loading
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('zenweekend_state_v4', JSON.stringify(state));
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

  const bgImage = state.recurringSupport.customBg || APP_CONFIG.BG_IMAGE;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-8 overflow-y-auto transition-all duration-1000"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.85)), url(${bgImage})` }}
    >
      <header className="w-full max-w-6xl mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10 pt-10">
        <div className="animate-in fade-in slide-in-from-top duration-700">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-2 drop-shadow-sm">
            ZenWeekend
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-slate-600 text-lg font-medium">Clear plans, calm mind.</p>
            {loading && (
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Syncing
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-6 rounded-[2.5rem] flex flex-wrap gap-6 items-center border border-white/80 shadow-2xl ring-1 ring-black/5">
          <div className="flex flex-col gap-1.5">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Frequency</span>
             <div className="flex items-center gap-2">
                <select 
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm min-w-[120px]"
                  value={state.recurringSupport.interval}
                  onChange={(e) => updateSupportSettings({ interval: parseInt(e.target.value) })}
                >
                   <option value="1">Every Week</option>
                   <option value="2">Every 2 Weeks</option>
                   <option value="3">Every 3 Weeks</option>
                   <option value="4">Every 4 Weeks</option>
                </select>
             </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Start From Week</span>
             <input 
              type="date"
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm"
              value={state.recurringSupport.baseDate.split('T')[0]}
              onChange={(e) => updateSupportSettings({ baseDate: e.target.value })}
             />
          </div>

          <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden lg:block"></div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm font-black text-[10px] uppercase tracking-widest"
            title="Upload Background"
          >
            <Icons.Image />
            <span>Theme</span>
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

      <main className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-40">
        {dateRange.map((date, idx) => {
          const id = date.toISOString().split('T')[0];
          const isSaturday = date.getDay() === 6;
          const dayType = isSaturday ? 'Saturday' : 'Sunday';
          const storedDay = state.weekendDays[id];
          const hasRecurringSupport = isDateSupport(date, state.recurringSupport);

          const dayData: WeekendDay = storedDay || {
            id, date, type: dayType, plan: '', isBusy: false, isSupport: false, recurring: 'none'
          };

          return (
            <div key={id} style={{ animationDelay: `${idx * 40}ms` }} className="animate-in fade-in zoom-in duration-500 fill-mode-both">
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
      
      <footer className="fixed bottom-8 z-30">
        <div className="bg-white/90 backdrop-blur-3xl px-10 py-5 rounded-full flex items-center gap-12 shadow-2xl border border-white ring-1 ring-black/5 animate-in slide-in-from-bottom duration-700">
          <div className="flex items-center gap-3 group">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-200 transition-transform group-hover:scale-125"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Open</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-500 to-red-700 shadow-lg shadow-red-200 transition-transform group-hover:scale-125"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Busy</span>
          </div>
          <div className="flex items-center gap-3 group">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-200 transition-transform group-hover:scale-125"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
