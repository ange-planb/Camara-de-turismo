import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Plus, 
  FileUp, 
  PenTool, 
  Calendar, 
  CheckCircle2, 
  FileText, 
  Download, 
  Edit3, 
  Trash2,
  X,
  Loader2,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc,
  Timestamp 
} from 'firebase/firestore';

interface Minute {
  id: string;
  title: string;
  date: string;
  description: string;
  fileUrl: string;
  type: string;
  status: string;
}

export default function Minutes() {
  const { isBoard } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [minuteToDelete, setMinuteToDelete] = useState<string | null>(null);

  // New Minute Form
  const [newMinute, setNewMinute] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    description: "",
    fileUrl: "",
    type: "asamblea",
    status: "PUBLICADA"
  });

  useEffect(() => {
    const q = query(collection(db, 'minutes'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Minute[];
      setMinutes(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching minutes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddMinute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMinute.title || !newMinute.fileUrl) return;

    setIsUploading(true);
    try {
      await addDoc(collection(db, 'minutes'), {
        ...newMinute,
        createdAt: Timestamp.now()
      });
      setShowAddModal(false);
      setNewMinute({
        title: "",
        date: new Date().toISOString().split('T')[0],
        description: "",
        fileUrl: "",
        type: "asamblea",
        status: "PUBLICADA"
      });
    } catch (error) {
      console.error("Error adding minute:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMinute = async () => {
    if (!minuteToDelete) return;
    try {
      await deleteDoc(doc(db, 'minutes', minuteToDelete));
      setMinuteToDelete(null);
    } catch (error) {
      console.error("Error deleting minute:", error);
    }
  };

  const filteredMinutes = minutes.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col min-w-0 overflow-hidden text-coffee">
      <main className="px-6 py-8 space-y-8">
          <header className="flex justify-between items-end">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-coffee tracking-tight">Registro de Actas</h2>
              <p className="text-sm text-light-coffee font-medium">Gestión administrativa de directorios y resoluciones.</p>
            </div>
          {isBoard && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg hover:brightness-105 active:scale-95 transition-all text-xs font-black tracking-widest leading-none"
            >
              <Plus size={18} />
              NUEVA ACTA
            </button>
          )}
        </header>

        <section className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110" size={20} />
          <input 
            className="w-full pl-12 pr-4 py-4 bg-white border border-outline-variant/30 rounded-2xl shadow-soft font-medium text-coffee outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Buscar por fecha, tema o descripción..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </section>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : (
          <section className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xl font-bold text-coffee">Actas Disponibles</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-black uppercase tracking-widest">
                {filteredMinutes.length} Documentos
              </span>
            </div>
            
            <div className="space-y-3">
              {filteredMinutes.map((item, i) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white border border-outline-variant/30 p-5 flex justify-between items-center rounded-2xl shadow-soft group hover:border-primary transition-all"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-bold text-coffee leading-tight group-hover:text-primary transition-colors">{item.title}</span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded border border-primary bg-primary/5 text-primary flex items-center gap-1 uppercase">
                        <FileText size={10} />
                        {item.type}
                      </span>
                    </div>
                    {item.description && <p className="text-xs text-light-coffee line-clamp-1">{item.description}</p>}
                    <p className="text-xs font-medium text-light-coffee flex items-center gap-2">
                      <Calendar size={14} className="text-primary/60" />
                      {new Date(item.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                    <div className="flex gap-2">
                      <a 
                        href={item.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 text-primary hover:bg-primary/10 rounded-xl transition-all"
                        title="Ver Acta"
                      >
                        <Download size={24} />
                      </a>
                      {isBoard && (
                        <button 
                          onClick={() => setMinuteToDelete(item.id)}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={24} />
                        </button>
                      )}
                    </div>
                </motion.div>
              ))}

              {filteredMinutes.length === 0 && (
                <div className="p-20 text-center border-2 border-dashed border-outline-variant rounded-3xl opacity-50">
                  <FileText className="mx-auto mb-4 text-outline" size={48} />
                  <p className="font-bold">No se encontraron actas</p>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="w-full h-40 rounded-3xl overflow-hidden relative shadow-xl group border border-outline-variant/20">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuATBPhD7dfDe89auWxUGknUTr0ukXGUnRUu9e-EGyMq2aEcMFlLiN4h9yNr_4FrbSGnTaSinnsqi25caQ58i2lg0HwLl7wAigxlX4dZYB9CC_he6kg4_0hhAJyN5U0hQ6gvBPoxwwRskFXEO9wqemBVlweGEmF-NVXemDdeNQ4LY2tdiYzln-gOUAgf0F4zp2pyxeMDZ5Jgo8ekOKCwprvymqNjzRyzm6dYWx2EKswgWF8HNLWUdYucuxHytMLC8jyVFgGiLlKyaTab" 
            alt="Nature"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-coffee/90 via-coffee/40 to-transparent flex items-end p-8">
            <div className="space-y-1">
              <h5 className="text-white text-lg font-bold">Cámara de Turismo de Chile</h5>
              <p className="text-white/80 text-xs font-medium italic">"Promoviendo el turismo responsable"</p>
            </div>
          </div>
        </div>
      </main>

      {/* Add Minute Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isUploading && setShowAddModal(false)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <FileUp size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-coffee">Nueva Acta</h3>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-surface rounded-xl transition-colors"
                >
                  <X />
                </button>
              </div>

              <form onSubmit={handleAddMinute} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Título de la Reunión</label>
                  <input 
                    required
                    className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                    value={newMinute.title}
                    onChange={(e) => setNewMinute({...newMinute, title: e.target.value})}
                    placeholder="Ej: Asamblea Ordinaria Mayo 2024"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Fecha</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                      value={newMinute.date}
                      onChange={(e) => setNewMinute({...newMinute, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Tipo</label>
                    <select 
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold appearance-none"
                      value={newMinute.type}
                      onChange={(e) => setNewMinute({...newMinute, type: e.target.value})}
                    >
                      <option value="asamblea">Asamblea</option>
                      <option value="directorio">Directorio</option>
                      <option value="comite">Comité</option>
                      <option value="extraordinaria">Extraordinaria</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Descripción corta</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm min-h-[100px]"
                    value={newMinute.description}
                    onChange={(e) => setNewMinute({...newMinute, description: e.target.value})}
                    placeholder="Temas principales tratados..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Enlace del archivo (Drive/PDF)</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                    <input 
                      required
                      className="w-full pl-12 pr-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      value={newMinute.fileUrl}
                      onChange={(e) => setNewMinute({...newMinute, fileUrl: e.target.value})}
                      placeholder="https://drive.google.com/..."
                    />
                  </div>
                </div>

                <button 
                  disabled={isUploading}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black tracking-widest shadow-xl shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      GUARDANDO...
                    </>
                  ) : 'PROCESAR Y PUBLICAR ACTA'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {minuteToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setMinuteToDelete(null)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm p-8 rounded-[2rem] shadow-2xl relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-coffee mb-2">¿Eliminar acta?</h3>
              <p className="text-sm text-light-coffee mb-8">Esta acción eliminará el registro permanentemente.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setMinuteToDelete(null)}
                  className="flex-1 px-4 py-3 bg-surface text-coffee font-bold rounded-2xl hover:bg-outline-variant transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteMinute}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-red-600 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
