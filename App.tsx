
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, MapPin, Loader2, Database,
  ChevronLeft, ChevronRight, Layers, LayoutDashboard,
  Menu, X, RefreshCw, Box, Filter, ArrowUpDown,
  FilterX, Clock
} from 'lucide-react';

// --- CONFIGURACIÓN DE CONEXIÓN ---
// Credenciales para la sincronización con la base de datos de Google Sheets.
const SPREADSHEET_ID = '1xycsCObrwx_m2nvwLpFMA6g5KhldWPUTJ4FrCdIKoBA';
const SHEET_NAME = 'Hoja 1';

const App: React.FC = () => {
  // --- ESTADOS DE NAVEGACIÓN Y DATOS ---
  // Controlan la pestaña activa, el menú lateral y la integridad de los datos descargados.
  const [activeTab, setActiveTab] = useState<'dashboard' | 'aecoc'>('aecoc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- ESTADOS DE BÚSQUEDA PARA SOCIOS ---
  // Filtros optimizados para la consulta rápida de ubicaciones y estados comerciales.
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterPasillo, setFilterPasillo] = useState('');
  const [filterLado, setFilterLado] = useState('');
  
  // --- GESTIÓN DE PÁGINAS ---
  // Se muestran 50 registros por página para optimizar la velocidad de carga.
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // --- REINICIO DE CONSULTA ---
  // Limpia todos los criterios de búsqueda para volver a la vista general.
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterEstado('');
    setFilterTipo('');
    setFilterPasillo('');
    setFilterLado('');
  };

  // --- NORMALIZACIÓN DE TEXTO ---
  // Asegura que la búsqueda funcione correctamente ignorando tildes y mayúsculas.
  const normalizeText = (text: string | number): string => {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  // --- ABREVIACIÓN DE ESTADOS PARA SOCIOS ---
  // Simplifica los estados del producto para una lectura rápida en terminales móviles.
  const getAbbreviatedStatus = (status: any): string => {
    if (!status) return 'NORMAL';
    const s = normalizeText(status);
    if (s.includes('articulo en alta comercial')) return 'ALTA COMERC.';
    if (s.includes('detenido comercialmente')) return 'DETENIDO';
    if (s.includes('proceso de baja')) return 'BAJA';
    if (s.includes('obsoleto')) return 'OBSOLETO';
    return String(status).toUpperCase();
  };

  // --- FORMATEO DE FECHA ---
  // Convierte la fecha del servidor a un formato legible por humanos.
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    try {
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return String(dateValue);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateValue);
    }
  };

  // --- COLORES POR ESTADO ---
  // Define el color del borde y fondo según el estado del producto (semáforo).
  const getStatusStyles = (status: any) => {
    const s = normalizeText(status);
    if (s.includes('detenido comercialmente')) return 'bg-amber-950/70 text-amber-300 border-amber-600/50'; 
    if (s.includes('proceso de baja') || s.includes('obsoleto')) return 'bg-red-950/70 text-red-300 border-red-600/50'; 
    return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50'; 
  };

  // --- CARGA DE DATOS DESDE GOOGLE SHEETS ---
  // Conecta con la API de Google para descargar el inventario actualizado.
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const urlData = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx:out:json&sheet=${encodeURIComponent(SHEET_NAME)}&range=A5:S&headers=1`;
    const urlMeta = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx:out:json&sheet=${encodeURIComponent(SHEET_NAME)}&range=A1:A1&headers=0`;

    try {
      const metaRes = await fetch(urlMeta);
      const metaText = await metaRes.text();
      const metaJson = JSON.parse(metaText.substring(metaText.indexOf('{'), metaText.lastIndexOf('}') + 1));
      if (metaJson.table.rows.length > 0 && metaJson.table.rows[0].c[0]) {
        const rawDate = metaJson.table.rows[0].c[0].f || metaJson.table.rows[0].c[0].v;
        setLastUpdate(formatDate(rawDate));
      }

      const response = await fetch(urlData);
      const text = await response.text();
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const json = JSON.parse(jsonStr);
      
      if (!json.table || !json.table.rows) throw new Error("Datos no disponibles.");

      const cols = json.table.cols.map((c: any, i: number) => (c.label || `Columna ${i + 1}`).trim());
      
      const mappedData = json.table.rows.map((row: any) => {
        const item: any = {};
        row.c.forEach((cell: any, i: number) => {
          const colLabel = cols[i];
          item[colLabel] = cell ? (cell.f !== undefined ? cell.f : cell.v) : '';
        });
        return item;
      });

      const cleanedData = mappedData.filter((item: any) => item["Artículo"] || item["Descripción"]);

      const sorted = cleanedData.sort((a: any, b: any) => {
        const locA = String(a["Ubicación de picking"] || "");
        const locB = String(b["Ubicación de picking"] || "");
        return locA.localeCompare(locB, undefined, { numeric: true });
      });

      setData(sorted);
      setHasLoaded(true);
    } catch (err: any) {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'aecoc' && !hasLoaded) loadData();
  }, [activeTab, hasLoaded, loadData]);

  // --- FILTROS DISPONIBLES ---
  // Genera las opciones únicas para los menús desplegables de filtrado.
  const filterOptions = useMemo(() => {
    const estados = new Set<string>();
    const tipos = new Set<string>();
    const pasillos = new Set<string>();

    data.forEach(item => {
      if (item["Estado del producto"]) estados.add(String(item["Estado del producto"]));
      if (item["Tipo"]) tipos.add(String(item["Tipo"]));
      const loc = String(item["Ubicación de picking"] || "");
      if (loc.length >= 3) pasillos.add(loc.substring(0, 3));
    });

    return {
      estados: Array.from(estados).sort(),
      tipos: Array.from(tipos).sort(),
      pasillos: Array.from(pasillos).sort()
    };
  }, [data]);

  // --- FILTRADO DE CONSULTA ---
  // Aplica la lógica de búsqueda y filtros secundarios sobre los datos.
  const filteredData = useMemo(() => {
    const searchTokens = searchTerm.trim().split(/\s+/).filter(t => t.length > 0).map(t => normalizeText(t));

    return data.filter(item => {
      const itemArt = normalizeText(item["Artículo"]);
      const itemDesc = normalizeText(item["Descripción"]);

      const matchesSearch = searchTokens.length === 0 || searchTokens.every(token => 
        itemArt.includes(token) || itemDesc.includes(token)
      );

      const matchesEstado = !filterEstado || item["Estado del producto"] === filterEstado;
      const matchesTipo = !filterTipo || item["Tipo"] === filterTipo;
      const loc = String(item["Ubicación de picking"] || "");
      const matchesPasillo = !filterPasillo || loc.substring(0, 3) === filterPasillo;
      const itemLado = loc.includes('D') ? 'D' : loc.includes('I') ? 'I' : '';
      const matchesLado = !filterLado || itemLado === filterLado;

      return matchesSearch && matchesEstado && matchesTipo && matchesPasillo && matchesLado;
    });
  }, [data, searchTerm, filterEstado, filterTipo, filterPasillo, filterLado]);

  // --- SEGMENTACIÓN PARA VISTA ---
  // Divide los datos filtrados en páginas para una navegación fluida.
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage]);

  useEffect(() => setCurrentPage(1), [searchTerm, filterEstado, filterTipo, filterPasillo, filterLado]);

  return (
    <div className="min-h-screen bg-[#020617] flex font-sans antialiased text-slate-100">
      
      {/* --- MENÚ LATERAL --- */}
      <aside className={`fixed inset-y-0 left-0 bg-[#0f172a] border-r border-slate-800 transition-all duration-300 z-[60] flex flex-col shadow-2xl lg:sticky ${isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 w-20'}`}>
        <div className="p-6 mb-2 flex items-center justify-center">
          <div className="bg-emerald-500 p-3 rounded-2xl text-slate-950 shadow-lg shrink-0">
            <Database size={24}/>
          </div>
          {isSidebarOpen && <span className="ml-3 font-black text-white uppercase text-lg leading-none tracking-tight">SOCIOS AECOC</span>}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          <button onClick={() => {setActiveTab('aecoc'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'aecoc' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-200 hover:bg-slate-800/50 hover:text-white'}`}>
            <Layers size={20} className="shrink-0"/> {isSidebarOpen && <span>Consulta</span>}
          </button>
          <button onClick={() => {setActiveTab('dashboard'); setIsSidebarOpen(false);}} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-200 hover:bg-slate-800/50 hover:text-white'}`}>
            <LayoutDashboard size={20} className="shrink-0"/> {isSidebarOpen && <span>Inicio</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex items-center justify-center p-3 bg-slate-800/50 rounded-xl text-slate-300 hover:text-emerald-400 transition-all">
            {isSidebarOpen ? <X size={18} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* --- CABECERA DE ESTADO --- */}
        <header className="h-14 bg-[#0f172a] border-b border-slate-800 flex items-center px-4 md:px-8 justify-between sticky top-0 z-[55]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-300 hover:text-white"><Menu size={20}/></button>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></span>
                <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest">{isLoading ? 'Sincronizando...' : 'Online'}</span>
              </div>
              {lastUpdate && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700">
                  <Clock size={11} className="text-emerald-400" />
                  <span className="text-[9px] font-black text-white uppercase">{lastUpdate}</span>
                </div>
              )}
            </div>
          </div>
          <span className="text-[9px] font-black text-slate-500 uppercase hidden sm:block tracking-[0.2em]">PORTAL SOCIOS v4.2</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {activeTab === 'aecoc' ? (
            <>
              {/* --- PANEL ANCLADO: BUSCADOR PARA SOCIOS --- */}
              <div className="sticky top-0 z-50 -mt-4 -mx-4 md:-mx-8 p-4 md:px-8 bg-[#020617]/95 backdrop-blur-xl border-b border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="bg-[#0f172a] p-3 md:p-4 rounded-3xl border border-slate-800/80 shadow-2xl flex flex-col md:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500" />
                    {/* Buscador de alta visibilidad para socios */}
                    <input
                      type="text"
                      className="block w-full pl-11 pr-12 py-3 bg-slate-200 border border-slate-400 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/30 outline-none transition-all font-bold text-slate-950 placeholder:text-slate-600 shadow-inner"
                      placeholder="Buscar descripción o artículo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-600"><X size={18}/></button>}
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={clearAllFilters} className="flex-1 md:flex-none px-5 py-3.5 bg-red-900/30 text-red-100 border border-red-700/40 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-800 transition-all flex justify-center items-center gap-2">
                      <FilterX className="w-4 h-4" /> Reset
                    </button>
                    <button onClick={loadData} disabled={isLoading} className="flex-1 md:flex-none px-6 py-3.5 bg-emerald-500 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-400 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Sinc
                    </button>
                  </div>
                </div>
              </div>

              {/* --- FILTROS SECUNDARIOS SIMPLIFICADOS --- */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Pasillo', icon: MapPin, val: filterPasillo, set: setFilterPasillo, opts: filterOptions.pasillos, pre: 'P.' },
                  { label: 'Lado', icon: ArrowUpDown, val: filterLado, set: setFilterLado, opts: ['D', 'I'] },
                  { label: 'Estado', icon: Filter, val: filterEstado, set: setFilterEstado, opts: filterOptions.estados },
                  { label: 'Tipo', icon: Layers, val: filterTipo, set: setFilterTipo, opts: filterOptions.tipos },
                ].map((f, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5 px-1">
                      <f.icon size={11} className="text-emerald-500/80"/> {f.label}
                    </label>
                    <select 
                      value={f.val} 
                      onChange={(e) => f.set(e.target.value)} 
                      className="w-full bg-slate-800/50 border border-slate-700/80 rounded-xl px-2 py-3 text-[11px] font-black text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer"
                    >
                      <option value="">TODO</option>
                      {f.opts.map(o => <option key={o} value={o}>{ (f.pre || '') + o }</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* --- VISTA DE DATOS --- */}
              <div className="space-y-4">
                {isLoading && data.length === 0 ? (
                  <div className="py-32 flex flex-col items-center justify-center gap-6 text-center">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    <p className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Cargando Inventario de Socios...</p>
                  </div>
                ) : (
                  <>
                    {/* TABLA DE ESCRITORIO (REDUCCIÓN DE COLUMNAS) */}
                    <div className="hidden lg:block bg-[#0f172a] rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-800 table-fixed">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th className="w-[140px] px-6 py-6 text-left text-[10px] font-black text-slate-300 uppercase">Ubicación</th>
                            <th className="w-[120px] px-6 py-6 text-left text-[10px] font-black text-emerald-400 uppercase">Artículo</th>
                            <th className="px-6 py-6 text-left text-[10px] font-black text-slate-300 uppercase">Descripción</th>
                            <th className="w-[100px] px-4 py-6 text-center text-[10px] font-black text-slate-300 uppercase">Un/Caja</th>
                            <th className="w-[100px] px-4 py-6 text-center text-[10px] font-black text-emerald-300 uppercase">Un/Pallet</th>
                            <th className="w-[100px] px-4 py-6 text-center text-[10px] font-black text-slate-300 uppercase">Aecoc</th>
                            <th className="w-[160px] px-6 py-6 text-center text-[10px] font-black text-slate-300 uppercase">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {paginatedData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                              <td className="px-6 py-5">
                                <span className="text-[14px] font-black text-white bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 shadow-inner block text-center">
                                  {item["Ubicación de picking"] || '---'}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-[12px] font-black text-emerald-400 tracking-tight">{item["Artículo"]}</td>
                              <td className="px-6 py-5 text-[13px] text-white truncate font-bold group-hover:text-emerald-50 transition-colors">{item["Descripción"]}</td>
                              <td className="px-4 py-5 text-center text-xs font-black text-white">{item["Un/Caja"]}</td>
                              <td className="px-4 py-5 text-center text-xs font-black text-emerald-300">{item["Un/Pallet"] || '0'}</td>
                              <td className="px-4 py-5 text-center text-[10px] font-black text-white uppercase">{item["Aecoc"]}</td>
                              <td className="px-6 py-5 text-center">
                                <span className={`inline-block px-3 py-2 rounded-full text-[9px] font-black uppercase border ${getStatusStyles(item["Estado del producto"])}`}>
                                  {getAbbreviatedStatus(item["Estado del producto"])}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* VISTA MÓVIL (CAJETINES COMPACTOS CON BORDE BLANCO) */}
                    <div className="lg:hidden grid grid-cols-1 gap-3 pb-24">
                      {paginatedData.map((item, idx) => (
                        <div key={idx} className="bg-[#0f172a] p-3 rounded-2xl border border-white shadow-[0_8px_25px_rgba(0,0,0,0.4)] flex flex-col gap-1 transition-transform active:scale-95">
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-emerald-400"/>
                              <span className="text-[16px] font-black text-white tracking-tighter">
                                {item["Ubicación de picking"] || '---'}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${getStatusStyles(item["Estado del producto"])}`}>
                              {getAbbreviatedStatus(item["Estado del producto"])}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 overflow-hidden py-0.5">
                            <span className="text-[14px] font-black text-emerald-400 shrink-0">{item["Artículo"]}</span>
                            <span className="text-[13px] text-white font-bold truncate flex-1">{item["Descripción"]}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-slate-800/50">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-500 uppercase">UN/CAJA</span>
                              <span className="text-[13px] font-black text-white">{item["Un/Caja"] || '0'}</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-black text-emerald-500/60 uppercase text-center leading-none mb-0.5">UN/PALLET</span>
                              <span className="text-[13px] font-black text-emerald-300">{item["Un/Pallet"] || '0'}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] font-black text-slate-500 uppercase">AECOC</span>
                              <span className="text-[13px] font-black text-white uppercase">{item["Aecoc"] || '-'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* --- PAGINACIÓN --- */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 pb-20">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 border border-slate-700 rounded-2xl bg-slate-800 text-white disabled:opacity-30">
                    <ChevronLeft size={24} />
                  </button>
                  <span className="text-[12px] font-black text-white uppercase tracking-[0.3em]">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-4 border border-slate-700 rounded-2xl bg-slate-800 text-white disabled:opacity-30">
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* --- INICIO PARA SOCIOS --- */
            <div className="flex flex-col items-center justify-center h-[75vh] text-center p-8">
              <div className="relative mb-10">
                <div className="w-32 h-32 bg-emerald-500 rounded-[3.5rem] shadow-2xl flex items-center justify-center border border-emerald-400/50">
                  <Database size={56} className="text-slate-950" />
                </div>
              </div>
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-5">Portal de Socios AECOC</h3>
              <p className="text-slate-400 text-[14px] max-w-sm mb-12 font-bold leading-relaxed uppercase">Consulta de stock, ubicaciones y disponibilidad sincronizada en tiempo real.</p>
              <button onClick={() => setActiveTab('aecoc')} className="w-full max-w-md bg-emerald-500 text-slate-950 py-6 rounded-3xl font-black uppercase text-[13px] tracking-[0.25em] shadow-2xl hover:bg-emerald-400 transition-all">Iniciar Consulta</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
