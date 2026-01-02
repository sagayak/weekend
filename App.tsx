
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WeekendDay, AppState, RecurringSupportSettings } from './types';
import { APP_CONFIG, Icons } from './constants';
import WeekendCard from './components/WeekendCard';
import EditModal from './components/EditModal';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const STORAGE_KEY = 'zenweekend_v8_final';

  // 1. Initial Load from Local Storage (Instant UI)
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        Object.values(parsed.weekendDays).forEach(day => {
          day.date = new Date(day.date);
        });
        return parsed;
      } catch (e) {
        console.error("Local storage restoration failed:", e);
      }
    }
    return {
      weekendDays: {},
      recurringSupport: { 
        saturday: true, 
        sunday: true, 
        interval: 1, 
        baseDate: new Date().toISOString().split('T')[0],
        customBg: undefined
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingDay, setEditingDay] = useState<WeekendDay | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Sync from Supabase (Merge with local)
  useEffect(() => {
    const syncWithCloud = async () => {
      setLoading(true);
      try {
        console.log("🔄 Syncing with Cloud...");
        const [plansRes, settingsRes] = await Promise.all([
          supabase.from('weekend_plans').select('*'),
          supabase.from('weekend_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (plansRes.error) {
          console.error("❌ Plans fetch error:", plansRes.error);
        }
        
        const cloudPlans: Record<string, WeekendDay> = {};
        if (plansRes.data) {
          plansRes.data.forEach(p => {
            cloudPlans[p.id] = {
              id: p.id,
              date: new Date(p.date),
              type: p.type as any,
              plan: p.plan,
              isBusy: p.is_busy,
              isSupport: p.is_support,
              recurring: 'none' // Default since column is missing in DB
            };
          });
        }

        const cloudSettings = settingsRes.data?.recurring_support;

        setState(prev => {
          // Merge logic: Prioritize Cloud for actual plan content
          const mergedDays = { ...prev.weekendDays, ...cloudPlans };
          const mergedSettings = cloudSettings ? { ...prev.recurringSupport, ...cloudSettings } : prev.recurringSupport;
          
          return {
            weekendDays: mergedDays,
            recurringSupport: mergedSettings
          };
        });
        
        console.log("✅ Cloud Sync Complete");
      } catch (err) {
        console.warn("⚠️ Sync partially failed. Check if Supabase tables are ready.", err);
      } finally {
        setLoading(false);
      }
    };
    syncWithCloud();
  }, []);

  // 3. Persist to Local Storage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loading]);

  const groupedWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    const today = new Date();
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - (7 * APP_CONFIG.WEEKS_BEFORE));
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()) + (7 * APP_CONFIG.WEEKS_AFTER));

    const current = new Date(startDate);
    let currentWeek: Date[] = [];

    while (current <= endDate) {
      const day = current.getDay();
      if (day === 6 || day === 0) {
        currentWeek.push(new Date(current));
        if (day === 0) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, []);

  const handleUpdateDay = async (updatedDay: WeekendDay) => {
    setSyncing(true);
    // Optimistic Update
    setState(prev => ({
      ...prev,
      weekendDays: { ...prev.weekendDays, [updatedDay.id]: updatedDay }
    }));
    setEditingDay(null);

    try {
      console.log(`📤 Saving to DB: ${updatedDay.id}...`);
      // OMITTING 'recurring' column to prevent DB error
      const { error } = await supabase.from('weekend_plans').upsert({
        id: updatedDay.id,
        date: updatedDay.date.toISOString(),
        type: updatedDay.type,
        plan: updatedDay.plan,
        is_busy: updatedDay.isBusy,
        is_support: updatedDay.isSupport
      }, { onConflict: 'id' });
      
      if (error) throw error;
      console.log(`✅ Success: ${updatedDay.id}`);
    } catch (e) {
      console.error("❌ Database Save Failed. Ensure tables exist.", e);
    } finally {
      setSyncing(false);
    }
  };

  const updateSupportSettings = async (updates: Partial<RecurringSupportSettings>) => {
    setSyncing(true);
    const newSettings = { ...state.recurringSupport, ...updates };
    setState(prev => ({ ...prev, recurringSupport: newSettings }));
    
    try {
      const { error } = await supabase.from('weekend_settings').upsert({ 
        id: 1, 
        recurring_support: newSettings 
      }, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (e) { 
      console.error("❌ Settings Save Failed:", e); 
    } finally {
      setSyncing(false);
    }
  };

  const isDateSupport = (targetDate: Date) => {
    const { interval, baseDate } = state.recurringSupport;
    const getWeekMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };
    const startMonday = getWeekMonday(new Date(baseDate));
    const targetMonday = getWeekMonday(targetDate);
    const diffWeeks = Math.round((targetMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.abs(diffWeeks) % (interval || 1) === 0;
  };

  const getWeekLabel = (dates: Date[]) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const weekSun = new Date(dates[dates.length - 1]);
    weekSun.setHours(0,0,0,0);
    
    const diffTime = weekSun.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= 6) return "This Weekend";
    if (diffDays < 0 && diffDays >= -7) return "Last Weekend";
    if (diffDays > 6 && diffDays <= 13) return "Next Weekend";
    
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks > 0 ? `In ${diffWeeks} Weeks` : `Past Record`;
  };

  const bgImage = state.recurringSupport.customBg || APP_CONFIG.BG_IMAGE;

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center p-4 md:p-8 overflow-y-auto transition-all duration-1000 no-scrollbar"
      style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.8)), url(${bgImage})` }}
    >
      <header className="w-full max-w-6xl mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8 z-10 pt-10">
        <div className="animate-in fade-in slide-in-from-top duration-1000">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 mb-2 drop-shadow-sm flex items-center gap-4">
            ZenWeekend
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-slate-500 text-xl font-medium tracking-tight">Syncing across all devices.</p>
            {(loading || syncing) && (
              <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest bg-slate-900 px-4 py-1.5 rounded-full shadow-lg animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {loading ? 'Fetching' : 'Saving'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-3xl p-8 rounded-[3rem] flex flex-wrap gap-8 items-center border border-white/50 shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-right duration-700">
          <div className="flex flex-col gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Support Interval</span>
             <select 
                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm min-w-[160px]"
                value={state.recurringSupport.interval}
                onChange={(e) => updateSupportSettings({ interval: parseInt(e.target.value) })}
              >
                 <option value="1">Every Week</option>
                 <option value="2">Every 2 Weeks</option>
                 <option value="3">Every 3 Weeks</option>
                 <option value="4">Every 4 Weeks</option>
              </select>
          </div>
          
          <div className="flex flex-col gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Base Week</span>
             <input 
              type="date"
              className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 outline-none hover:border-slate-400 transition-all cursor-pointer shadow-sm"
              value={state.recurringSupport.baseDate.split('T')[0]}
              onChange={(e) => updateSupportSettings({ baseDate: e.target.value })}
             />
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-xl font-black text-xs uppercase tracking-widest self-end"
          >
            <Icons.Image />
            <span>Theme</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => updateSupportSettings({ customBg: reader.result as string });
              reader.readAsDataURL(file);
            }
          }} accept="image/*" className="hidden" />
        </div>
      </header>

      <main className="w-full max-w-6xl pb-48 space-y-32">
        {groupedWeeks.map((weekDates, wIdx) => {
          const weekLabel = getWeekLabel(weekDates);
          const isTodayWeek = weekLabel === "This Weekend";

          return (
            <section key={`week-${wIdx}`} className="space-y-12 relative group/week">
              {/* Timeline Style Placeholder */}
              <div className="flex flex-col items-center gap-4 sticky top-10 z-20">
                <div className={`px-10 py-4 rounded-full border text-xs font-black uppercase tracking-[0.4em] shadow-2xl backdrop-blur-3xl transition-all duration-700 transform ${
                  isTodayWeek 
                    ? 'bg-slate-900 text-white border-slate-900 scale-110 shadow-slate-300' 
                    : 'bg-white/95 text-slate-400 border-white/50 group-hover/week:scale-105'
                }`}>
                  {weekLabel}
                </div>
                <div className={`w-px h-12 transition-all duration-700 ${isTodayWeek ? 'bg-slate-900/40' : 'bg-slate-400/20'}`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 max-w-5xl mx-auto px-4">
                {weekDates.map((date, dIdx) => {
                  const id = date.toISOString().split('T')[0];
                  const storedDay = state.weekendDays[id];
                  const hasRecurringSupport = isDateSupport(date);

                  const dayData: WeekendDay = storedDay || {
                    id, date, type: date.getDay() === 6 ? 'Saturday' : 'Sunday', 
                    plan: '', isBusy: false, isSupport: false, recurring: 'none'
                  };

                  return (
                    <div 
                      key={id} 
                      className="animate-in fade-in zoom-in duration-700 fill-mode-both"
                      style={{ animationDelay: `${dIdx * 150}ms` }}
                    >
                      <WeekendCard 
                        day={dayData}
                        activeSupport={dayData.isSupport || hasRecurringSupport}
                        onEdit={() => setEditingDay(dayData)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {editingDay && (
        <EditModal 
          day={editingDay} 
          onClose={() => setEditingDay(null)} 
          onSave={handleUpdateDay} 
        />
      )}
      
      <footer className="fixed bottom-12 z-30 pointer-events-none w-full flex justify-center">
        <div className="bg-white/95 backdrop-blur-3xl px-14 py-8 rounded-full flex items-center gap-20 shadow-2xl border border-white/50 ring-1 ring-black/5 animate-in slide-in-from-bottom duration-1000 pointer-events-auto">
          <div className="flex items-center gap-5 group">
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${APP_CONFIG.COLORS.OPEN} shadow-xl shadow-green-100 transition-all group-hover:scale-125`}></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Open</span>
              <span className="text-[8px] font-bold uppercase text-slate-400">Available</span>
            </div>
          </div>
          <div className="flex items-center gap-5 group">
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${APP_CONFIG.COLORS.BUSY} shadow-xl shadow-red-100 transition-all group-hover:scale-125`}></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Busy</span>
              <span className="text-[8px] font-bold uppercase text-slate-400">Planned</span>
            </div>
          </div>
          <div className="flex items-center gap-5 group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-xl shadow-orange-100 transition-all group-hover:scale-125"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Support</span>
              <span className="text-[8px] font-bold uppercase text-slate-400">On Call</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
