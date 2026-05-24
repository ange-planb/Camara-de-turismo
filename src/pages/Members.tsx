import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  UserPlus, 
  Store, 
  Tag, 
  UserCheck, 
  AlertTriangle, 
  Truck, 
  ChefHat, 
  Wallet,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Mail,
  Phone,
  Check,
  Loader2,
  Building2,
  Database,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, updateDoc, doc, onSnapshot, setDoc, writeBatch, orderBy, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import CSVImporter from '../components/CSVImporter';
import { UserRole } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { getMemberCalculatedData } from '../utils/paymentCalculator';

const getCategoryIcon = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('alojamiento')) return Store;
  if (c.includes('gastronomía')) return ChefHat;
  if (c.includes('transporte')) return Truck;
  return Building2;
};

export default function Members() {
  const { role, isBoard } = useAuth();
  const isTreasurer = role === 'TESORERA' || role === 'PRESIDENTA';
  const isPresidenta = role === 'PRESIDENTA';
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    rut: '',
    business: '',
    phone: '',
    category: 'COMERCIO',
    role: 'MEMBER' as UserRole
  });

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.email || !newMember.name) {
      toast.error("Nombre y Email son obligatorios");
      return;
    }

    try {
      const emailClean = newMember.email.trim().toLowerCase();
      // ALWAYS use standardized email-based ID for pre-registration to avoid duplicates
      // This matches what AuthContext looks for
      const id = editingMember ? editingMember.id : 'user_' + emailClean.replace(/[^a-zA-Z0-9]/g, '');
      
      const payload = {
        ...newMember,
        email: emailClean,
        name: newMember.name.trim(),
        rut: newMember.rut.trim(),
        business: newMember.business.trim(),
        // Dual fields for compatibility (vitiated data protection)
        nombre: newMember.name.trim(),
        correo: emailClean,
        RUT: newMember.rut.trim(),
        emprendimiento: newMember.business.trim(),
        telefono: newMember.phone.trim(),
        categoria: newMember.category,
        role: newMember.role,
        rol: newMember.role,
        updatedAt: new Date().toISOString()
      };

      if (!editingMember) {
        Object.assign(payload, {
          uid: 'placeholder_' + Math.random().toString(36).substring(2, 8),
          status: 'ACTIVO',
          estado: 'ACTIVO',
          debt: 0,
          attendance: 0,
          createdAt: new Date().toISOString()
        });
      }

      await setDoc(doc(db, 'socios', id), payload, { merge: true });
      toast.success(editingMember ? "Socio actualizado" : "Socio agregado exitosamente");
      setShowAddModal(false);
      setEditingMember(null);
      setNewMember({ name: '', email: '', rut: '', business: '', phone: '', category: 'COMERCIO', role: 'MEMBER' });
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar socio");
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar a este socio? Esta acción no se puede deshacer.")) return;
    
    try {
      await deleteDoc(doc(db, 'socios', id));
      toast.success("Socio eliminado");
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const [recordingPayment, setRecordingPayment] = useState<string | null>(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState<string | null>(null);
  const [showMemberMenu, setShowMemberMenu] = useState<string | null>(null);

  const handleCSVData = async (rawData: any[]) => {
    if (!rawData || rawData.length === 0) return;
    setSyncing(true);
    const toastId = toast.loading("Procesando lista de socios...");

    let nameIdx = -1;
    let emailIdx = -1;
    let rutIdx = -1;
    let businessIdx = -1;
    let roleIdx = -1;
    let headerRowIdx = -1;

    // Try to find header row in the first 5 rows
    for (let i = 0; i < Math.min(rawData.length, 5); i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      
      const emailColIdx = row.findIndex(c => {
        const s = String(c).toLowerCase();
        return (s.includes('email') || s.includes('correo') || s.includes('mail')) && !s.includes('contacto');
      });
      
      if (emailColIdx !== -1) {
        emailIdx = emailColIdx;
        
        // Priority for name: look for specific keywords, avoid columns with only numbers
        const nameKeywords = ['nombre', 'razón social', 'cliente', 'persona', 'socio'];
        let bestNameIdx = -1;
        let priority = -1;

        row.forEach((col, idx) => {
          const s = String(col).toLowerCase();
          nameKeywords.forEach((key, p) => {
            if (s.includes(key) && (priority === -1 || p < priority)) {
              // Check if actual data in this column (in next row) is numeric
              const sampleVal = rawData[i+1] ? String(rawData[i+1][idx]) : '';
              if (!/^\d+$/.test(sampleVal.trim())) {
                bestNameIdx = idx;
                priority = p;
              }
            }
          });
        });

        nameIdx = bestNameIdx;
        rutIdx = row.findIndex(c => {
          const s = String(c).toLowerCase();
          return s.includes('rut') || s.includes('identificación') || s.includes('dni');
        });
        businessIdx = row.findIndex(c => {
          const s = String(c).toLowerCase();
          return s.includes('empresa') || s.includes('comercio') || s.includes('negocio') || s.includes('establecimiento');
        });
        roleIdx = row.findIndex(c => String(c).toLowerCase().includes('cargo') || String(c).toLowerCase().includes('rol'));
        headerRowIdx = i;
        break;
      }
    }

    // If no headers found, try to find a row with an email and guess mapping
    if (emailIdx === -1) {
      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        const eIdx = row.findIndex(c => String(c).includes('@'));
        if (eIdx !== -1) {
          emailIdx = eIdx;
          // Guess name is a column that looks like text and is not the email
          const guessNameIdx = row.findIndex((c, idx) => idx !== eIdx && String(c).length > 3 && !/^\d+$/.test(String(c).trim()));
          nameIdx = guessNameIdx !== -1 ? guessNameIdx : (eIdx === 0 ? 1 : 0);
          headerRowIdx = i - 1; 
          break;
        }
      }
    }

    const startIdx = headerRowIdx + 1;
    const rows = rawData.slice(startIdx);
    let importedCount = 0;
    
    try {
      // Get existing users to avoid duplicates
      const existingEmails = new Set(members.map(m => (m.email || '').toLowerCase().trim()));
      
      const batchSize = 400;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatchRows = rows.slice(i, i + batchSize);

        for (const row of currentBatchRows) {
          if (!Array.isArray(row) || row.length === 0) continue;
          
          let currentRow = [...row];
          // Auto-detect semicolon or tab if Papa failed
          if (currentRow.length === 1) {
            if (String(currentRow[0]).includes(';')) currentRow = String(currentRow[0]).split(';');
            else if (String(currentRow[0]).includes('\t')) currentRow = String(currentRow[0]).split('\t');
          }

          let email = emailIdx !== -1 && emailIdx < currentRow.length ? currentRow[emailIdx] : null;
          let name = nameIdx !== -1 && nameIdx < currentRow.length ? currentRow[nameIdx] : null;
          let rut = rutIdx !== -1 && rutIdx < currentRow.length ? currentRow[rutIdx] : null;
          let business = businessIdx !== -1 && businessIdx < currentRow.length ? currentRow[businessIdx] : null;
          let roleStr = roleIdx !== -1 && roleIdx < currentRow.length ? currentRow[roleIdx] : null;

          // If mapping failed or column empty, search entire row for an email
          if (!email || !String(email).includes('@')) {
            const foundEmailIdx = currentRow.findIndex(c => String(c).includes('@'));
            if (foundEmailIdx !== -1) {
              email = currentRow[foundEmailIdx];
            }
          }

          if (!email || !String(email).includes('@')) continue;

          const emailClean = String(email).trim().toLowerCase();
          
          // SKIP if already exists
          if (existingEmails.has(emailClean)) continue;

        // Improved fallback name guess: find first non-numeric cell that isn't the email and looks like a person's name
        if (!name || /^\d+$/.test(String(name).trim())) {
          const betterNameIdx = currentRow.findIndex((c, idx) => {
            const val = String(c).trim();
            // Name should be at least 3 chars, not just numbers, not email, not RUT-like
            return idx !== emailIdx && val.length > 2 && !/^\d+$/.test(val) && !val.includes('@') && !/^\d{1,2}\.?\d{3}\.?\d{3}[-][0-9kK]$/.test(val);
          });
          if (betterNameIdx !== -1) name = currentRow[betterNameIdx];
        }

          const id = 'user_' + emailClean.replace(/[^a-zA-Z0-9]/g, '');
          const userRef = doc(db, 'socios', id);
          
          batch.set(userRef, {
            uid: 'pending_' + Math.random().toString(36).substring(2, 8),
            name: name ? String(name).trim() : 'Socio sin nombre',
            email: emailClean,
            rut: rut ? String(rut).trim() : 'Pte.',
            business: business ? String(business).trim() : 'Independiente',
            role: (roleStr ? String(roleStr).toUpperCase() : 'MEMBER') as UserRole,
            status: 'ACTIVO',
            debt: 0,
            attendance: 0,
            createdAt: new Date().toISOString()
          }, { merge: true });
          importedCount++;
          existingEmails.add(emailClean);
        }
        await batch.commit();
      }
      toast.success(`¡Éxito! Se han cargado ${importedCount} socios.`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la carga masiva.", { id: toastId });
    } finally {
      setSyncing(false);
      // Ensure the processing toast is GONE
      toast.dismiss(toastId);
    }
  };

  const exportToCSV = () => {
    try {
      if (members.length === 0) {
        toast.error("No hay socios para exportar");
        return;
      }

      const headers = ["Nombre", "Email", "RUT", "Empresa", "Teléfono", "Categoría", "Estado", "Deuda"];
      const rows = members.map(m => [
        m.name || '',
        m.email || '',
        m.rut || '',
        m.business || '',
        m.phone || '',
        m.category || '',
        m.status || '',
        m.debt || 0
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `socios_camara_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Archivo descargado exitosamente");
    } catch (error) {
      console.error("Export error", error);
      toast.error("Error al exportar los datos");
    }
  };

  useEffect(() => {
    // Listen directly to the 'socios' collection (fully resolved custom database)
    const q = query(collection(db, 'socios'));
    const unsubscribeSocios = onSnapshot(q, (snapshot) => {
      let usersData = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          name: d.name || d.nombre || 'Sin nombre',
          email: d.email || d.correo || '',
          rut: d.rut || d.RUT || '',
          business: d.business || d.emprendimiento || '',
          phone: d.phone || d.telefono || '',
          category: d.category || d.categoria || '',
          status: d.status || d.estado || 'ACTIVO',
          role: d.role || d.rol || 'MEMBER',
          paymentModality: d.paymentModality || d.paymentModality || 'MENSUAL',
          lastPaymentMonth: d.lastPaymentMonth || ''
        };
      });
      
      setMembers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore users error:", error);
      setLoading(false);
    });

    const qPayments = query(collection(db, 'payments'));
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPayments(paymentsData);
    });

    return () => {
      unsubscribeSocios();
      unsubscribePayments();
    };
  }, []);

  const computedMembers = React.useMemo(() => {
    return members.map(m => {
      const calc = getMemberCalculatedData(m, payments);
      return {
        ...m,
        status: calc.status,
        debt: calc.debt,
        lastPaymentMonth: calc.lastPaymentMonth || m.lastPaymentMonth
      };
    });
  }, [members, payments]);

  const filteredMembers = React.useMemo(() => {
    return computedMembers.filter(member => 
      (member.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.business || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.rut || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, computedMembers]);

  const handleRecordPayment = async (memberId: string, type: 'MENSUAL' | 'ANUAL') => {
    setRecordingPayment(memberId);
    setShowPaymentOptions(null);
    const member = members.find(m => m.id === memberId);
    const amount = type === 'ANUAL' ? 30000 : 3000;
    
    try {
      const batch = writeBatch(db);
      
      // 1. Update user
      const userRef = doc(db, 'socios', memberId);
      batch.update(userRef, {
        debt: 0,
        status: 'ACTIVO',
        paymentModality: type,
        lastPaymentDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 2. Record generic transaction for summary
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        type: 'INCOME',
        category: 'CUOTAS',
        amount: amount,
        description: `Pago ${type.toLowerCase()} - ${member?.name || 'Socio'}`,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: memberId
      });

      // 3. Record specific payment record (legacy/audit)
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        userId: memberId,
        userName: member?.name || 'Socio',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        period: new Date().toISOString().slice(0, 7),
        type: type,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success("Pago registrado exitosamente");
      setTimeout(() => setRecordingPayment(null), 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${memberId}`);
      toast.error("Error al registrar pago");
      setRecordingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-w-0">
        <main className="px-4 py-6 md:px-6 md:py-8">
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}><Skeleton className="h-64 w-full rounded-2xl" /></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      <main className="px-4 py-6 md:px-6 md:py-8">
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-coffee tracking-tight">Directorio de Socios</h2>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-[10px] font-bold text-green-600">
                    <Database size={10} />
                    {members.length} SOCIOS EN SISTEMA
                  </div>
                  <button 
                    onClick={() => {
                        window.location.reload();
                    }}
                    className="p-1 hover:bg-surface rounded-full text-light-coffee transition-colors"
                    title="Recargar página"
                  >
                    <Loader2 size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
                <p className="text-sm text-light-coffee flex items-center gap-1.5">
                  Gestiona y visualiza su base de datos segura en la nube (SV). 
                  <span className="inline-block w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                {isBoard && (
                  <button 
                    onClick={() => {
                      setEditingMember(null);
                      setNewMember({
                        name: '',
                        email: '',
                        rut: '',
                        business: '',
                        phone: '',
                        category: 'COMERCIO',
                        role: 'MEMBER'
                      });
                      setShowAddModal(true);
                    }}
                    className="whitespace-nowrap px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2 hover:bg-primary-dark transition-all"
                  >
                    <UserPlus size={14} /> NUEVO SOCIO
                  </button>
                )}
                {isBoard && (
                  <CSVImporter 
                    label="IMPORTAR"
                    className="whitespace-nowrap px-4 py-2 bg-surface text-coffee border border-outline-variant/30 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-surface-container transition-all"
                    onDataLoaded={handleCSVData} 
                  />
                )}
                <button 
                  onClick={exportToCSV}
                  className="whitespace-nowrap px-4 py-2 bg-surface text-coffee border border-outline-variant/30 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-surface-container transition-all"
                  title="Exportar a CSV"
                >
                  <Download size={14} /> DESCARGAR
                </button>
                <div className="flex bg-white border border-outline-variant/30 rounded-xl p-1 shadow-sm">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-light-coffee hover:bg-surface'}`}
                  >
                    <LayoutGrid size={20} />
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-primary text-white' : 'text-light-coffee hover:bg-surface'}`}
                  >
                    <ListIcon size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar socios por nombre, email, RUT o empresa..." 
                  className="w-full bg-white border border-outline-variant/30 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                />
              </div>
              <button className="bg-white border border-outline-variant/30 rounded-2xl px-5 flex items-center justify-center hover:bg-surface-container transition-colors shadow-sm text-coffee">
                <Filter size={20} />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div 
                key="grid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {filteredMembers.length > 0 ? filteredMembers.map((member, i) => {
                  const Icon = getCategoryIcon(member.category || member.categoria || "");
                  const isMoroso = member.debt > 0 || member.status === 'MOROSO' || member.estado === 'MOROSO';
                  
                  return (
                    <motion.article 
                      key={member.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-white border ${isMoroso ? 'border-l-8 border-l-red-500' : 'border-outline-variant/30 text-green-500'} rounded-2xl p-6 shadow-sm relative group`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-coffee shadow-inner">
                            <Icon size={28} />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-coffee leading-tight">{member.name || member.nombre}</h2>
                            <p className="text-xs font-medium text-light-coffee">RUT: {member.rut || member.RUT || 'No reg.'}</p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isMoroso ? 'text-red-500 bg-red-50' : 'text-green-500 bg-green-50'}`}>
                          {isMoroso ? <AlertTriangle size={14} /> : <UserCheck size={14} />}
                          {isMoroso ? 'Moroso' : 'Al día'}
                        </div>
                      </div>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-on-surface-variant font-medium">
                          <Tag size={18} className="text-primary" />
                          <span className="text-sm">{member.business || member.emprendimiento || 'Sin empresa'}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pl-8">
                          <div className="flex items-center gap-2 text-xs text-light-coffee">
                            <Mail size={14} />
                            <span className="font-mono">{member.email || member.correo}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-outline opacity-50 font-mono">
                            <Database size={10} />
                            ID: {member.id}
                          </div>
                          {(member.phone || member.telefono) && (
                            <div className="flex items-center gap-2 text-xs text-light-coffee">
                              <Phone size={14} />
                              {member.phone || member.telefono}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-6 border-t border-surface-container">
                        <button 
                          onClick={() => {
                            if (member.phone) {
                              const cleanPhone = member.phone.replace(/\D/g, '');
                              window.open(`https://wa.me/${cleanPhone.startsWith('56') ? cleanPhone : '56' + cleanPhone}`, '_blank');
                            } else {
                              toast.error("Este socio no tiene teléfono registrado");
                            }
                          }}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-surface-container transition-all text-coffee"
                        >
                          <MessageCircle size={20} className="text-primary" />
                          <span className="text-[9px] font-bold uppercase tracking-tighter">WhatsApp</span>
                        </button>
                        
                        <div className="relative group/options">
                          <button 
                            onClick={() => {
                              if (!isBoard) {
                                toast.error("Solo la directiva puede realizar cambios");
                                return;
                              }
                              setShowMemberMenu(showMemberMenu === member.id ? null : member.id);
                            }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-surface-container transition-all text-coffee w-full ${!isBoard && 'opacity-20 translate-y-1 scale-95 hover:bg-transparent cursor-not-allowed'}`}
                          >
                            <MoreVertical size={20} className="text-primary" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Opciones</span>
                          </button>
                          
                          <AnimatePresence>
                            {isBoard && showMemberMenu === member.id && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-xl shadow-xl border border-outline-variant/30 p-1 z-50"
                              >
                                <button 
                                  onClick={() => {
                                    setEditingMember(member);
                                    setNewMember({
                                      name: member.name || '',
                                      email: member.email || '',
                                      rut: member.rut || '',
                                      business: member.business || '',
                                      phone: member.phone || '',
                                      category: member.category || 'COMERCIO',
                                      role: member.role || member.rol || 'MEMBER'
                                    });
                                    setShowAddModal(true);
                                    setShowMemberMenu(null);
                                  }}
                                  className="w-full text-left p-2 hover:bg-surface rounded-lg text-xs font-bold text-coffee flex items-center gap-2"
                                >
                                  <Check size={14} className="text-primary" /> Editar Datos
                                </button>
                                <button 
                                  onClick={() => {
                                    handleDeleteMember(member.id);
                                    setShowMemberMenu(null);
                                  }}
                                  className="w-full text-left p-2 hover:bg-red-50 rounded-lg text-xs font-bold text-red-500 flex items-center gap-2"
                                >
                                  <AlertTriangle size={14} /> Eliminar
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.article>
                  );
                }) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto text-light-coffee">
                      <Search size={40} />
                    </div>
                    <p className="text-xl font-bold text-coffee">No se encontraron socios</p>
                    <p className="text-sm text-light-coffee">
                      Total en base de datos: {members.length}. 
                      Intenta con otros términos de búsqueda.
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface font-bold text-xs text-light-coffee uppercase tracking-widest border-b border-outline-variant/30">
                      <tr>
                        <th className="px-6 py-4">Socio</th>
                        <th className="px-6 py-4">RUT</th>
                        <th className="px-6 py-4">Empresa</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {filteredMembers.map((member) => {
                        const Icon = getCategoryIcon(member.category || member.categoria || "");
                        const isMoroso = member.debt > 0 || member.status === 'MOROSO' || member.estado === 'MOROSO';
                        
                        return (
                          <tr key={member.id} className="hover:bg-surface transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-bold text-coffee text-sm">{member.name || member.nombre}</span>
                                <span className="text-[10px] text-light-coffee font-mono">{member.email || member.correo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-light-coffee">{member.rut || member.RUT}</td>
                            <td className="px-6 py-4 text-sm font-medium text-coffee">{member.business || member.emprendimiento}</td>
                            <td className="px-6 py-4 text-sm text-light-coffee">{member.category || member.categoria}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isMoroso ? 'text-red-500 bg-red-50' : 'text-green-500 bg-green-50'}`}>
                                {isMoroso ? 'Moroso' : 'Al día'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {isBoard ? (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingMember(member);
                                      setNewMember({
                                        name: member.name || '',
                                        email: member.email || '',
                                        rut: member.rut || '',
                                        business: member.business || '',
                                        phone: member.phone || '',
                                        category: member.category || 'COMERCIO',
                                        role: member.role || member.rol || 'MEMBER'
                                      });
                                      setShowAddModal(true);
                                    }}
                                    className="text-primary hover:bg-primary-container/20 p-2 rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteMember(member.id)}
                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"
                                    title="Eliminar"
                                  >
                                    <AlertTriangle size={18} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-light-coffee font-medium italic">Solo Lectura</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAddModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddModal(false)}
                  className="absolute inset-0 bg-coffee/40 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-outline-variant/30"
                >
                  <h3 className="text-2xl font-black text-coffee mb-6">
                    {editingMember ? 'Editar Datos del Socio' : 'Agregar Nuevo Socio'}
                  </h3>
                  <form onSubmit={handleAddMember} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Nombre Completo</label>
                        <input 
                          required
                          type="text"
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.name}
                          onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Correo Electrónico</label>
                        <input 
                          required
                          type="email"
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.email}
                          onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">RUT</label>
                        <input 
                          type="text"
                          placeholder="12.345.678-9"
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.rut}
                          onChange={(e) => setNewMember({...newMember, rut: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Empresa / Emprendimiento</label>
                        <input 
                          type="text"
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.business}
                          onChange={(e) => setNewMember({...newMember, business: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Teléfono (WhatsApp)</label>
                        <input 
                          type="tel"
                          placeholder="+569..."
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.phone}
                          onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Categoría</label>
                        <select 
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.category}
                          onChange={(e) => setNewMember({...newMember, category: e.target.value})}
                        >
                          <option value="COMERCIO">Comercio</option>
                          <option value="ALOJAMIENTO">Alojamiento</option>
                          <option value="GASTRONOMÍA">Gastronomía</option>
                          <option value="TRANSPORTE">Transporte</option>
                          <option value="ARTESANÍA">Artesanía</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Cargo en Directiva (Rol)</label>
                        <select 
                          className="w-full bg-surface border border-outline-variant/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          value={newMember.role}
                          onChange={(e) => setNewMember({...newMember, role: e.target.value as UserRole})}
                        >
                          <option value="MEMBER">Socio Gremial General (Sin cargo)</option>
                          <option value="PRESIDENTA">Presidenta</option>
                          <option value="VICE_PRESIDENTA">Vicepresidenta</option>
                          <option value="TESORERA">Tesorera</option>
                          <option value="SECRETARIA">Secretaria/o</option>
                          <option value="DIRECTOR_1">Director 1</option>
                          <option value="DIRECTOR_2">Director 2</option>
                          <option value="DIRECTOR_3">Director 3</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-6">
                      <button 
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 px-6 py-4 rounded-2xl bg-surface text-coffee font-bold text-sm hover:bg-surface-container transition-all"
                      >
                        CANCELAR
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-black text-sm tracking-widest shadow-lg hover:bg-primary-dark transition-all"
                      >
                        GUARDAR SOCIO
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
}
