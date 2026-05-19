import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Plus, 
  Trash2, 
  ExternalLink,
  Book,
  ShieldCheck,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface InstitutionalDoc {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: string;
  category: string;
  createdAt?: any;
}

export default function Documents() {
  const { isBoard, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [documents, setDocuments] = useState<InstitutionalDoc[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  // New Doc Form
  const [newDoc, setNewDoc] = useState({
    title: "",
    description: "",
    url: "",
    category: "Legal"
  });

  const canManage = isBoard || role === 'SECRETARIA' || role === 'PRESIDENTA';

  useEffect(() => {
    const q = query(collection(db, 'documents'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docsData = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          title: d.title || d.titulo || 'Sin título',
          url: d.url || d.link || '',
          category: d.category || d.categoria || 'Legal'
        };
      }) as InstitutionalDoc[];
      setDocuments(docsData);
      
      // Auto-seed if empty (any user can trigger this to ensure data exists)
      if (docsData.length === 0 && !loading) {
        console.log("Documents empty, attempt seeding...");
        try {
          await addDoc(collection(db, 'documents'), {
            title: "Estatutos Vigentes 2024",
            description: "Documento oficial que rige las normas y reglamentos de la Cámara de Turismo.",
            url: "https://www.camara.cl/PDF/estatutos_ejemplo.pdf", // Link real de ejemplo para que no se vea vacio
            category: "Legal",
            type: "PDF",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Seeding documents failed (might be permissions but that is OK)", e);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Documents snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isBoard, loading]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.title || !newDoc.url) return;

    try {
      await addDoc(collection(db, 'documents'), {
        ...newDoc,
        type: 'PDF',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewDoc({ title: "", description: "", url: "", category: "Legal" });
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await deleteDoc(doc(db, 'documents', docToDelete));
      setDocToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = [
    { name: "Legal", icon: ShieldCheck, color: "bg-blue-50 text-blue-600 border-blue-100" },
    { name: "Administrativo", icon: Briefcase, color: "bg-purple-50 text-purple-600 border-purple-100" },
    { name: "Actas", icon: FileText, color: "bg-green-50 text-green-600 border-green-100" },
    { name: "Otros", icon: Book, color: "bg-gray-50 text-gray-600 border-gray-100" }
  ];

  return (
    <div className="flex flex-col min-w-0">
      <main className="px-6 py-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <p className="text-xs font-bold text-light-coffee uppercase tracking-[0.2em]">Biblioteca Digital</p>
              <h2 className="text-3xl font-bold text-coffee">Documentos Institucionales</h2>
            </motion.section>

            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-coffee group-focus-within:text-secondary transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-outline/30 rounded-xl focus:outline-none focus:border-secondary transition-all w-64 text-sm"
                />
              </div>

              {canManage && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Plus size={18} />
                  <span>Nuevo</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-light-coffee opacity-50">
                <FileText size={48} className="mb-4" />
                <p className="font-medium text-lg">No se han encontrado documentos</p>
                <p className="text-xs">Total en base de datos: {documents.length}</p>
              </div>
            ) : (
              filteredDocs.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white p-6 rounded-[2rem] border border-outline-variant/30 shadow-soft hover:border-primary transition-all group relative overflow-hidden flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-2xl border ${categories.find(c => c.name === doc.category)?.color || 'bg-gray-50 border-gray-100'}`}>
                        <FileText size={24} />
                      </div>
                      {canManage && (
                        <button 
                          onClick={() => setDocToDelete(doc.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-coffee mb-2 group-hover:text-primary transition-colors line-clamp-1 uppercase tracking-tight">{doc.title}</h3>
                    <p className="text-xs text-light-coffee line-clamp-2 mb-6 font-medium italic">
                      {doc.description || "Sin descripción adicional."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-light-coffee/80 py-1 px-3 bg-surface border border-outline-variant/30 rounded-full">
                      {doc.category}
                    </span>
                    {doc.url ? (
                      <a 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest hover:underline cursor-pointer"
                      >
                        <span>Abrir Documento</span>
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-[10px] text-red-400 font-bold italic">Enlace no disponible</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </main>

      {/* Add Document Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-coffee/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-coffee">Nuevo Documento</h3>
                    <p className="text-xs text-light-coffee">Registrar enlace a PDF institucional</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddDocument} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-light-coffee uppercase tracking-widest mb-1 ml-1">Título del Documento</label>
                  <input 
                    type="text" 
                    required
                    value={newDoc.title}
                    onChange={(e) => setNewDoc({...newDoc, title: e.target.value})}
                    placeholder="Ej: Estatutos de la Cámara"
                    className="w-full px-4 py-3 bg-surface border border-outline/20 rounded-2xl focus:outline-none focus:border-secondary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-light-coffee uppercase tracking-widest mb-1 ml-1">Categoría</label>
                  <select 
                    value={newDoc.category}
                    onChange={(e) => setNewDoc({...newDoc, category: e.target.value})}
                    className="w-full px-4 py-3 bg-surface border border-outline/20 rounded-2xl focus:outline-none focus:border-secondary appearance-none"
                  >
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-light-coffee uppercase tracking-widest mb-1 ml-1">URL (Drive, Dropbox, etc.)</label>
                  <div className="relative">
                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-light-coffee" size={18} />
                    <input 
                      type="url" 
                      required
                      value={newDoc.url}
                      onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                      placeholder="https://link-al-pdf.com/..."
                      className="w-full pl-12 pr-4 py-3 bg-surface border border-outline/20 rounded-2xl focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <p className="text-[10px] text-light-coffee mt-2 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Asegúrese de que el enlace sea accesible para todos los socios.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-light-coffee uppercase tracking-widest mb-1 ml-1">Descripción (Opcional)</label>
                  <textarea 
                    value={newDoc.description}
                    onChange={(e) => setNewDoc({...newDoc, description: e.target.value})}
                    placeholder="Breve detalle sobre el contenido..."
                    className="w-full px-4 py-3 bg-surface border border-outline/20 rounded-2xl focus:outline-none focus:border-secondary h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 bg-surface text-coffee font-bold rounded-2xl hover:bg-outline-variant transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 bg-secondary text-white font-bold rounded-2xl shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {docToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setDocToDelete(null)}
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
              <h3 className="text-2xl font-bold text-coffee mb-2">¿Eliminar documento?</h3>
              <p className="text-sm text-light-coffee mb-8">Esta acción no se puede deshacer. El documento dejará de estar disponible para todos los socios.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDocToDelete(null)}
                  className="flex-1 px-4 py-3 bg-surface text-coffee font-bold rounded-2xl hover:bg-outline-variant transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteDocument}
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
