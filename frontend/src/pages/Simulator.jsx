import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

const Simulator = () => {
  const [importance, setImportance] = useState(7);
  const [days, setDays] = useState(40);
  const [occupancy, setOccupancy] = useState(62);
  const [time, setTime] = useState(80);
  const [isDerby, setIsDerby] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [competition, setCompetition] = useState("LaLiga");
  const [phase, setPhase] = useState("Regular Season");
  
  const [configData, setConfigData] = useState({ areas: {}, competitions: {} });
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedComp, setSelectedComp] = useState("");
  const [selectedPhase, setSelectedPhase] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    // Fetch real config from the backend database
    const fetchConfig = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/config');
        setConfigData(response.data);
        
        const areas = Object.keys(response.data.areas || {});
        if (areas.length > 0) {
          setSelectedArea(areas[0]);
          setSelectedLevel(response.data.areas[areas[0]][0]);
        }

        const comps = Object.keys(response.data.competitions || {});
        if (comps.length > 0) {
          setSelectedComp(comps[0]);
          setSelectedPhase(response.data.competitions[comps[0]][0]);
        }
      } catch (err) {
        console.error("Error fetching config", err);
      }
    };
    fetchConfig();
  }, []);

  const handleAreaChange = (e) => {
    const area = e.target.value;
    setSelectedArea(area);
    if (configData.areas[area] && configData.areas[area].length > 0) {
      setSelectedLevel(configData.areas[area][0]);
    }
  };

  const handleCompChange = (e) => {
    const comp = e.target.value;
    setSelectedComp(comp);
    if (configData.competitions[comp] && configData.competitions[comp].length > 0) {
      setSelectedPhase(configData.competitions[comp][0]);
    }
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/predict-price', {
        item_area: selectedArea,
        item_level: selectedLevel,
        days_to_match: parseInt(days),
        occupancy_rate: occupancy / 100,
        match_importance: parseInt(importance, 10),
        competition_type: selectedComp,
        competition_phase: selectedPhase,
        is_derby: isDerby,
        is_holiday_period: isHoliday
      });
      setResults(response.data);
    } catch (error) {
      console.error("Error executing simulation", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ml-[260px] flex-1 min-h-screen bg-transparent p-8">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Simulador de Matchday</h2>
          <p className="font-body-md text-label-md text-on-surface-variant">Motor predictivo de demanda y ticketing para estadios.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={runSimulation}
            disabled={loading}
            className={`px-6 py-2 bg-secondary-container text-white rounded-lg font-label-md shadow-lg neon-glow-pink hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ${loading ? 'animate-pulse' : ''}`}>
            {loading && <span className="material-symbols-outlined animate-spin text-sm" style={{ fontVariationSettings: "'wght' 600" }}>sync</span>}
            {loading ? 'Calculando Escenarios...' : 'Ejecutar Simulación'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-5 space-y-6 animate-fade-in-up opacity-0">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6 text-primary-fixed">
              <span className="material-symbols-outlined">settings_input_component</span>
              <h3 className="font-headline-md text-label-md uppercase tracking-widest">Parámetros de Entrada</h3>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant uppercase font-bold">Zona</label>
                  <select 
                    className="w-full bg-surface-container border border-white/10 rounded-lg py-2 px-3 text-on-surface focus:ring-primary focus:border-primary"
                    value={selectedArea}
                    onChange={handleAreaChange}
                  >
                    {Object.keys(configData.areas || {}).length === 0 && <option>Cargando Zonas...</option>}
                    {Object.keys(configData.areas || {}).map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant uppercase font-bold">Nivel</label>
                  <select 
                    className="w-full bg-surface-container border border-white/10 rounded-lg py-2 px-3 text-on-surface focus:ring-primary focus:border-primary"
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                  >
                    {!(configData.areas && configData.areas[selectedArea]) && <option>Cargando Niveles...</option>}
                    {configData.areas?.[selectedArea]?.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant uppercase font-bold">Competición</label>
                  <select 
                    className="w-full bg-surface-container border border-white/10 rounded-lg py-2 px-3 text-on-surface focus:ring-primary focus:border-primary"
                    value={selectedComp}
                    onChange={handleCompChange}
                  >
                    {Object.keys(configData.competitions || {}).length === 0 && <option>Cargando...</option>}
                    {Object.keys(configData.competitions || {}).map(comp => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant uppercase font-bold">Fase</label>
                  <select 
                    className="w-full bg-surface-container border border-white/10 rounded-lg py-2 px-3 text-on-surface focus:ring-primary focus:border-primary"
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                  >
                    {!(configData.competitions && configData.competitions[selectedComp]) && <option>Cargando...</option>}
                    {configData.competitions?.[selectedComp]?.map(phase => (
                      <option key={phase} value={phase}>{phase}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold">Importancia del Partido</label>
                    <span className={`text-label-sm ${importance > 8 ? 'text-secondary' : 'text-primary'}`}>{importance}/10</span>
                  </div>
                  <input className="w-full" type="range" min="1" max="10" step="1" value={importance} onChange={(e) => setImportance(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold">Días para el evento</label>
                    <span className="text-primary text-label-sm">{days} Días</span>
                  </div>
                  <input className="w-full" type="range" max="150" value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold">Ocupación Proyectada</label>
                    <span className={`text-label-sm ${occupancy > 80 ? 'text-secondary' : 'text-primary'}`}>{occupancy}%</span>
                  </div>
                  <input className="w-full" type="range" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold">Hora de Inicio</label>
                    <span className="text-primary text-label-sm">{Math.floor(12 + (time / 100) * 11)}:00</span>
                  </div>
                  <input className="w-full" type="range" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-6 py-4 border-t border-white/5">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input className="sr-only peer" type="checkbox" checked={isDerby} onChange={(e) => setIsDerby(e.target.checked)} />
                    <div className="w-10 h-5 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                  </div>
                  <span className="text-label-sm font-label-sm text-on-surface-variant group-hover:text-on-surface">Derbi Local</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input className="sr-only peer" type="checkbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} />
                    <div className="w-10 h-5 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
                  </div>
                  <span className="text-label-sm font-label-sm text-on-surface-variant group-hover:text-on-surface">Festivo</span>
                </label>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl h-48 group">
            <img alt="Simulation Preview" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9I3vHXbiTeWO7ThA2Td9LOSuK4XpH3gtn2PGD-G3SaczAeJwcw2rMkC8yGP0xi_W8EcGPzOsbuZqOLXlWXcCRVQ5HeHRWOqMYtNbdk-6tn1yEQdJUqlaEfTbbhVmbE2Na7kPO2RU0YHVc7QrbrnghTBIa5Mnh6A2ziwY6M_JlTpxt0jU5QE2loDtSUY3OUhh7ICWRGv0RavoPp-ESnYIE-ghTR0JTIjdZXm9YMQAtn1v7E1QIQ_5CYTti2VluypGjyUajF0lDsok" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-dim to-transparent flex flex-col justify-end p-6">
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Visualización de Base</span>
              <h4 className="font-headline-md text-label-md">Vista Previa del Estadio Histórica</h4>
            </div>
          </div>
        </section>

        {/* Right Column: AI Recommendations & Metrics */}
        <section className={`col-span-7 space-y-6 animate-fade-in-up opacity-0 stagger-1 transition-opacity duration-300 ${loading ? 'opacity-50 animate-pulse pointer-events-none' : ''}`}>
          <div className="glass-panel p-8 rounded-2xl border-l-4 border-primary-container relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-[120px]">bolt</span>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative z-10">
              <div>
                <span className="text-[10px] text-primary-fixed font-bold uppercase tracking-[0.2em]">Precio Óptimo Recomendado</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="font-numeric-xl text-[64px] text-primary leading-none">
                    €{results ? results.suggested_optimal_price : '---'}
                  </span>
                  <span className={`text-label-sm font-bold flex items-center ${results?.optimal_revenue_increase_percent >= 0 ? 'text-secondary' : 'text-error'}`}>
                    <span className="material-symbols-outlined text-sm">
                      {results?.optimal_revenue_increase_percent >= 0 ? 'trending_up' : 'trending_down'}
                    </span>
                    {results ? `${results.optimal_revenue_increase_percent}%` : '+0.0%'}
                  </span>
                </div>
                <p className="text-on-surface-variant text-label-sm mt-2 max-w-sm">Basado en la elasticidad actual y la demanda proyectada para los parámetros introducidos.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-on-surface-variant uppercase block mb-1">Variación vs Base</span>
                <span className={`text-label-md font-bold mt-3 block ${!results ? 'text-on-surface' : results.suggested_optimal_price >= results.base_price ? 'text-secondary' : 'text-error'}`}>
                  {results ? `${results.suggested_optimal_price >= results.base_price ? '+' : ''}${(results.suggested_optimal_price - results.base_price).toFixed(2)}€ (${results.base_price > 0 ? (((results.suggested_optimal_price - results.base_price) / results.base_price) * 100).toFixed(1) : '0.0'}%)` : '--'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">show_chart</span>
                <h3 className="font-headline-md text-label-md uppercase tracking-widest">Curva de Maximización de Ingresos</h3>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold">DEMANDA</span>
                <span className="px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[10px] font-bold">INGRESOS</span>
              </div>
            </div>
            
            <div className="h-64 flex items-end justify-between gap-2 relative mt-6">
              {results && results.sweep_data ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={results.sweep_data}
                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffed00" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ffed00" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="Precio" 
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      tickFormatter={(value) => `€${Math.round(value)}`}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <YAxis 
                      hide={true} 
                      domain={['dataMin - 1000', 'dataMax + 2000']} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,237,0,0.3)', borderRadius: '8px' }}
                      itemStyle={{ color: '#ffed00' }}
                      labelStyle={{ color: 'white' }}
                      formatter={(value) => [`€${Math.round(value).toLocaleString()}`, 'Ingresos Estimados']}
                      labelFormatter={(label) => `Precio: €${Number(label).toFixed(2)}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Ingresos" 
                      stroke="#ffed00" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorIngresos)" 
                    />
                    <ReferenceLine 
                      x={results.suggested_optimal_price} 
                      stroke="#00ff00" 
                      strokeDasharray="3 3"
                      label={{ position: 'top', value: `ÓPTIMO: €${results.suggested_optimal_price}`, fill: '#00ff00', fontSize: 12, fontWeight: 'bold' }} 
                    />
                    <ReferenceLine 
                      x={results.base_price} 
                      stroke="rgba(255,255,255,0.5)" 
                      strokeDasharray="1 1"
                      label={{ position: 'insideBottomLeft', value: 'BASE', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} 
                    />
                    {/* Punto exacto en la curva */}
                    <ReferenceDot 
                      x={results.suggested_optimal_price} 
                      y={results.expected_revenue} 
                      r={6} 
                      fill="#00ff00" 
                      stroke="none" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
                  <div className="border-b border-white"></div>
                  <div className="border-b border-white"></div>
                  <div className="border-b border-white"></div>
                  <div className="border-b border-white"></div>
                  <div className="w-full h-full flex items-center justify-center text-white/50 font-bold uppercase mt-8">
                    Ejecuta la simulación para ver la curva
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-secondary flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Elasticidad Estimada</span>
                <span className="material-symbols-outlined text-secondary">analytics</span>
              </div>
              <div className="mt-4">
                <span className="font-numeric-xl text-headline-lg text-secondary">
                  {results ? `-${results.elasticity}` : '---'}
                </span>
                <p className="text-label-sm text-on-surface-variant mt-1">Sensibilidad Inelástica Moderada</p>
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-primary flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">RevPAR Proyectado</span>
                <span className="material-symbols-outlined text-primary">euro</span>
              </div>
              <div className="mt-4">
                <span className="font-numeric-xl text-headline-lg text-primary">
                  €{results ? results.revpar : '---'}
                </span>
                <p className="text-label-sm text-on-surface-variant mt-1">Eficiencia por asiento disponible</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Simulator;
