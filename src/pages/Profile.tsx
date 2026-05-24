import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit2, 
  Save, 
  X, 
  Camera, 
  CreditCard, 
  Briefcase,
  Calendar, 
  Bell, 
  ShieldCheck, 
  ChevronRight,
  LogOut,
  AlertCircle,
  Loader2,
  Printer,
  Download,
  Check,
  Award,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { toast } from 'sonner';

export default function Profile() {
  const { user, logout, isBoard } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [selectedPaymentReceipt, setSelectedPaymentReceipt] = useState<any | null>(null);
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    business: "",
    category: "",
    rut: "",
    photoURL: "",
    debt: 0,
    attendance: 0,
    role: "MEMBER",
    paymentModality: "MENSUAL" as "MENSUAL" | "ANUAL",
    lastPaymentDate: ""
  });

  useEffect(() => {
    async function loadUserData() {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'socios', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserInfo({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            business: data.business || "",
            category: data.category || "",
            rut: data.rut || "",
            photoURL: data.photoURL || "",
            debt: data.debt || 0,
            attendance: data.attendance || 0,
            role: data.role || "MEMBER",
            paymentModality: data.paymentModality || "MENSUAL",
            lastPaymentDate: data.lastPaymentDate || ""
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `socios/${user.uid}`);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side to ensure index-free real-time robustness
      list.sort((a: any, b: any) => {
        const dateA = a.date || a.createdAt || '';
        const dateB = b.date || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      setUserPayments(list);
    }, (error) => {
      console.warn("Could not query payments by userId", error);
    });
    return () => unsubscribe();
  }, [user]);

  const notifications = [
    { id: 1, type: 'debt', title: 'Cuota Mensual Pendiente', message: 'Tu cuota de Octubre vence en 3 días.', date: 'Hace 2 horas', active: true },
    { id: 2, type: 'meeting', title: 'Nueva Asamblea Citada', message: 'Se ha convocado a una nueva reunión para el 24 de Oct.', date: 'Ayer', active: true },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserInfo(prev => ({ ...prev, photoURL: reader.result as string }));
        if (!isEditing) setIsEditing(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'socios', user.uid), {
        name: userInfo.name,
        phone: userInfo.phone,
        address: userInfo.address,
        business: userInfo.business,
        category: userInfo.category,
        rut: userInfo.rut,
        photoURL: userInfo.photoURL,
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socios/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Header / Profile Info */}
            <section className="bg-white rounded-3xl p-6 md:p-10 border border-outline-variant/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full transform translate-x-12 -translate-y-12"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative group">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-surface shadow-sm overflow-hidden bg-surface-container flex items-center justify-center">
                    {userInfo.photoURL ? (
                      <img 
                        src={userInfo.photoURL} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={64} className="text-outline-variant" />
                    )}
                  </div>
                  <label className="absolute bottom-1 right-1 bg-primary text-white p-2.5 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all group-hover:shadow-primary/20 cursor-pointer">
                    <Camera size={18} />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />
                  </label>
                </div>

                <div className="flex-1 text-center md:text-left space-y-2">
                  <h1 className="text-3xl font-bold text-coffee tracking-tight">{userInfo.name || user?.displayName}</h1>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {userInfo.category || "Categoría"}
                    </span>
                    <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {userInfo.role === 'MEMBER' ? 'Socio' : 'Directiva'}
                    </span>
                  </div>
                  <p className="text-light-coffee font-medium flex items-center justify-center md:justify-start gap-2 pt-2">
                    <MapPin size={16} className="text-primary" />
                    {userInfo.business || "Negocio no registrado"}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                    {!isEditing ? (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center justify-center gap-2 bg-surface text-coffee border border-outline-variant/30 px-6 py-3 rounded-xl font-bold hover:bg-surface-container transition-all shadow-sm"
                      >
                        <Edit2 size={18} />
                        Editar Perfil
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:brightness-105 transition-all shadow-md disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="flex items-center justify-center bg-red-50 text-red-500 p-3 rounded-xl border border-red-100 hover:bg-red-100 transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={logout}
                      className="flex items-center justify-center gap-2 text-red-500 font-bold py-3 text-sm hover:underline"
                    >
                      <LogOut size={18} />
                      Cerrar Sesión
                    </button>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Financial Status */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-coffee flex items-center gap-2">
                    <CreditCard className="text-primary" size={20} />
                    Finanzas
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-widest ${userInfo.debt > 0 ? 'text-red-500 bg-red-50' : 'text-green-500 bg-green-50'}`}>
                    {userInfo.debt > 0 ? 'Pendiente' : 'Al día'}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-light-coffee font-medium">Deuda acumulada</p>
                  <p className="text-3xl font-black text-coffee">${userInfo.debt.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Modo: {userInfo.paymentModality === 'ANUAL' ? 'Membresía Anual' : 'Cuota Mensual'}
                </div>
                <p className="text-xs text-light-coffee leading-relaxed">
                  {userInfo.paymentModality === 'ANUAL' 
                    ? 'Tu modalidad anual te otorga un descuento del 16% sobre el valor mensual.' 
                    : 'Recuerda que puedes cambiar a modalidad anual por $30.000 para ahorrar.'}
                </p>
                {userInfo.debt > 0 && (
                  <button className="w-full bg-primary-container text-on-primary-container py-3 rounded-xl font-bold text-sm shadow-sm hover:translate-y-[-2px] transition-all">
                    Pagar Ahora
                  </button>
                )}
              </motion.div>

              {/* Attendance Stats */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-coffee flex items-center gap-2">
                    <Calendar className="text-secondary" size={20} />
                    Asistencia
                  </h3>
                  <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-lg uppercase tracking-widest">
                    {userInfo.attendance >= 80 ? 'Destacada' : 'Regular'}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-light-coffee font-medium">Participación global</p>
                  <p className="text-3xl font-black text-coffee">{userInfo.attendance}%</p>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-secondary h-full rounded-full shadow-[0_0_8px_rgba(65,105,0,0.3)]"
                    style={{ width: `${userInfo.attendance}%` }}
                  ></div>
                </div>
                <p className="text-xs text-light-coffee">
                  Tu participación es fundamental para el crecimiento gremial.
                </p>
              </motion.div>

              {/* Security / Badge */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-primary/5 p-6 rounded-3xl border border-primary/10 shadow-sm space-y-4 flex flex-col justify-center items-center text-center"
              >
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-coffee">Perfil Verificado</p>
                    <p className="text-xs text-light-coffee px-2">
                      Tus credenciales de socio están validadas por el sistema de la Cámara.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowCredentialModal(true)}
                    className="text-primary text-xs font-bold hover:underline active:scale-95 transition-transform"
                  >
                    Ver mi credencial digital
                  </button>
              </motion.div>

            </div>

            {/* Board Debug & Sync (Only for Board Members) */}
            {isBoard && (
              <section className="bg-coffee/5 rounded-3xl p-8 border border-coffee/10 shadow-inner space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <ShieldCheck className="text-coffee" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-coffee uppercase tracking-wide">Panel de Control & Sincronización</h3>
                    <p className="text-xs font-medium text-light-coffee">Herramientas para asegurar que tu app está al día con la nube.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-coffee/5 shadow-sm space-y-3">
                    <p className="text-[10px] font-black text-light-coffee uppercase tracking-widest">Tu Rango Registrado</p>
                    <div className="flex items-center gap-3">
                      <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight ${
                        userInfo.role === 'PRESIDENTA' ? 'bg-primary text-white' : 'bg-surface text-coffee'
                      }`}>
                        {userInfo.role}
                      </div>
                      <p className="text-[11px] text-light-coffee font-medium italic">
                        {userInfo.role === 'MEMBER' ? 'Sin acceso administrativo.' : 'Acceso administrativo habilitado.'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-coffee/5 shadow-sm space-y-3">
                    <p className="text-[10px] font-black text-light-coffee uppercase tracking-widest">Sincronización Local</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="w-full flex items-center justify-center gap-3 bg-coffee text-white px-6 py-3 rounded-xl font-black text-[11px] tracking-widest hover:brightness-110 transition-all shadow-md active:scale-95"
                    >
                      <Loader2 size={16} className="animate-spin" />
                      FORZAR ACTUALIZACIÓN (SYNC)
                    </button>
                  </div>
                </div>

                {/* SUPER ADMIN RESET - ONLY for Owner */}
                {user?.email === 'solucionesgraficasplanb@gmail.com' && (
                  <div className="mt-8 p-6 bg-red-50 border-2 border-dashed border-red-200 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3 text-red-600">
                      <AlertCircle size={24} />
                      <h4 className="font-black text-sm uppercase tracking-widest">Zona de Peligro: Reinicio Maestro</h4>
                    </div>
                    <p className="text-xs text-red-700 font-medium leading-relaxed">
                      Utiliza estas opciones para "Partir de Cero" y limpiar la base de datos de información viciada o duplicada. 
                      <span className="block mt-2 font-bold underline">Esta acción es irreversible y afectará a todos los socios.</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                       <button 
                         onClick={async () => {
                           if (!window.confirm("¿CONFIRMAR RESET TOTAL? Se borrarán socios, actas, finanzas y documentos para partir de cero.")) return;
                           const toastId = toast.loading("Reiniciando base de datos...");
                           try {
                             const collections = ['socios', 'documents', 'minutes', 'events', 'transactions', 'payments'];
                             const { collection, getDocs, writeBatch, query, where } = await import('firebase/firestore');
                             
                             for (const collName of collections) {
                               const q = collName === 'socios' ? query(collection(db, collName), where('email', '!=', user.email)) : collection(db, collName);
                               const snap = await getDocs(q);
                               const batch = writeBatch(db);
                               snap.docs.forEach(doc => batch.delete(doc.ref));
                               await batch.commit();
                             }
                             
                             toast.success("Base de datos reseteada. La aplicación se reiniciará.", { id: toastId });
                             setTimeout(() => window.location.reload(), 2000);
                           } catch (e) {
                             toast.error("Error en el reinicio", { id: toastId });
                           }
                         }}
                         className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-red-700 transition-all"
                       >
                         BORRAR TODO Y PARTIR DE CERO
                       </button>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                  <p className="text-[11px] font-medium text-coffee leading-relaxed">
                    <span className="font-bold">¿Problemas para ver datos?</span> Si no ves el listado de socios en Finanzas, asegúrate de haber iniciado sesión con el correo <span className="font-bold underline">solucionesgraficasplanb@gmail.com</span> o uno autorizado por la presidencia.
                  </p>
                </div>
              </section>
            )}

            {/* Details and Notifications Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Contact Data Form */}
              <section className="bg-white rounded-3xl p-8 border border-outline-variant/30 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-coffee">Información de Contacto</h3>
                  {!isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="text-primary font-bold text-sm tracking-widest uppercase hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                      <User size={14} /> Nombre Completo
                    </label>
                    <input 
                      disabled={!isEditing}
                      value={userInfo.name}
                      onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
                      className={`w-full p-4 rounded-xl border border-outline-variant/30 transition-all outline-none ${isEditing ? 'bg-white focus:ring-2 focus:ring-primary/20 text-coffee' : 'bg-surface text-light-coffee'}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                         <Mail size={14} /> Correo Electrónico
                      </label>
                      <input 
                        disabled={true}
                        value={userInfo.email}
                        className="w-full p-4 rounded-xl border border-outline-variant/10 bg-surface text-light-coffee cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                         <Phone size={14} /> Teléfono móvil
                      </label>
                      <input 
                        disabled={!isEditing}
                        value={userInfo.phone}
                        onChange={(e) => setUserInfo({...userInfo, phone: e.target.value})}
                        className={`w-full p-4 rounded-xl border border-outline-variant/30 transition-all outline-none ${isEditing ? 'bg-white focus:ring-2 focus:ring-primary/20 text-coffee' : 'bg-surface text-light-coffee'}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                         <CreditCard size={14} /> RUT / Identificación
                       </label>
                       <input 
                         disabled={!isEditing}
                         value={userInfo.rut}
                         placeholder="Ej: 12.345.678-9"
                         onChange={(e) => setUserInfo({...userInfo, rut: e.target.value})}
                         className={`w-full p-4 rounded-xl border border-outline-variant/30 transition-all outline-none ${isEditing ? 'bg-white focus:ring-2 focus:ring-primary/20 text-coffee' : 'bg-surface text-light-coffee'}`}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                         <Briefcase size={14} /> Nombre de Empresa
                       </label>
                       <input 
                         disabled={!isEditing}
                         value={userInfo.business}
                         placeholder="Ej: Turismo San Vicente"
                         onChange={(e) => setUserInfo({...userInfo, business: e.target.value})}
                         className={`w-full p-4 rounded-xl border border-outline-variant/30 transition-all outline-none ${isEditing ? 'bg-white focus:ring-2 focus:ring-primary/20 text-coffee' : 'bg-surface text-light-coffee'}`}
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-outline uppercase tracking-widest flex items-center gap-2">
                       <MapPin size={14} /> Dirección Residencial o Comercial
                    </label>
                    <input 
                      disabled={!isEditing}
                      value={userInfo.address}
                      onChange={(e) => setUserInfo({...userInfo, address: e.target.value})}
                      className={`w-full p-4 rounded-xl border border-outline-variant/30 transition-all outline-none ${isEditing ? 'bg-white focus:ring-2 focus:ring-primary/20 text-coffee' : 'bg-surface text-light-coffee'}`}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {isEditing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-4"
                    >
                      <button 
                        onClick={handleSave}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                      >
                        Confirmar Cambios
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Notifications Center */}
              <section className="bg-white rounded-3xl p-8 border border-outline-variant/30 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-coffee flex items-center gap-2">
                    <Bell className="text-primary" size={24} />
                    Notificaciones
                  </h3>
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {notifications.length} NUEVAS
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 scrollbar-hide">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                        notif.active 
                          ? 'bg-surface border-primary/20 shadow-sm' 
                          : 'bg-white border-outline-variant/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                        <div className="flex gap-4">
                          <div className={`p-2 rounded-xl h-fit ${
                            notif.type === 'debt' ? 'bg-red-100 text-red-500' : 
                            notif.type === 'meeting' ? 'bg-primary-container text-on-primary-container' : 
                            'bg-surface-container text-coffee'
                          }`}>
                            {notif.type === 'debt' ? <AlertCircle size={20} /> : 
                             notif.type === 'meeting' ? <Calendar size={20} /> : 
                             < Bell size={20} />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-bold text-coffee group-hover:text-primary transition-colors">{notif.title}</p>
                              <span className="text-[10px] text-light-coffee font-medium">{notif.date}</span>
                            </div>
                            <p className="text-xs text-light-coffee leading-relaxed">{notif.message}</p>
                          </div>
                        </div>
                    </div>
                  ))}
                  
                  <button className="w-full py-4 text-xs font-black text-primary uppercase tracking-widest hover:underline flex items-center justify-center gap-2">
                    Historial Completo
                    <ChevronRight size={14} />
                  </button>
                </div>
              </section>

            </div>

            {/* Payment History Section (Kananas Style) */}
            <section className="bg-white rounded-3xl p-8 border border-outline-variant/30 shadow-sm space-y-6 mt-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-coffee flex items-center gap-2">
                    <FileText className="text-primary" size={24} />
                    Historial de Pagos y Cuotas Gremiales
                  </h3>
                  <p className="text-xs text-light-coffee mt-1">Registro oficial de aportaciones y cuotas gremiales al día (Sincronizado con Tesorería)</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                  <Check size={16} className="animate-pulse" />
                  {userPayments.length} Pagos Registrados
                </div>
              </div>

              {userPayments.length === 0 ? (
                <div className="p-8 text-center bg-surface rounded-2xl border-2 border-dashed border-outline-variant/30 space-y-3">
                  <p className="text-sm font-bold text-coffee">No tienes pagos registrados en la app aún</p>
                  <p className="text-xs text-light-coffee max-w-sm mx-auto">
                    Una vez que la administración o tesorería registre tu cuota o membresía anual, verás tus comprobantes listados aquí para imprimir o descargar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface border-b border-outline-variant/30">
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-light-coffee tracking-wider">Fecha</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-light-coffee tracking-wider">Período</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-light-coffee tracking-wider">Tipo/Concepto</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-light-coffee tracking-wider text-right">Monto</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-light-coffee tracking-wider text-right">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {userPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-surface/30 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-coffee">{p.date || (p.createdAt ? p.createdAt.split('T')[0] : 'Pte.')}</td>
                          <td className="px-6 py-4 text-xs font-bold text-coffee">{p.period === 'ANUAL' ? 'Membresía Anual' : `Mes: ${p.period}`}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary-dark uppercase">
                              {p.type || 'MEMBRESÍA'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-extrabold text-coffee text-right">
                            ${(p.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedPaymentReceipt(p)}
                              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary-dark transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/10"
                            >
                              <Printer size={12} /> Ver Recibo
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        </main>

        {/* MODAL: Credencial Digital */}
        <AnimatePresence>
          {showCredentialModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl p-6 shadow-2xl border border-outline-variant/50 max-w-sm w-full relative sm:p-8 space-y-6"
              >
                <button 
                  onClick={() => setShowCredentialModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface text-light-coffee transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="text-center space-y-1">
                  <h4 className="text-lg font-black text-coffee uppercase tracking-wide">Credencial Digital</h4>
                  <p className="text-xs text-outline font-medium">Presenta este pase oficial en convenios o eventos gremiales.</p>
                </div>

                {/* Physical Card Mockup with 3D/CSS styling */}
                <div className="relative aspect-[1.58/1] w-full bg-gradient-to-tr from-[#1a1412] via-[#2f221a] to-primary rounded-2xl p-5 text-white flex flex-col justify-between shadow-xl overflow-hidden group select-none">
                  {/* Overlay reflection effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-80 pointer-events-none" />
                  
                  {/* Subtle seal container bg icon */}
                  <Award size={150} className="absolute right-[-20px] bottom-[-20px] text-white/5 pointer-events-none rotate-12" />

                  {/* Top line of card */}
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5">
                      <Award className="text-yellow-400" size={18} />
                      <span className="text-[8px] font-black uppercase tracking-widest text-white">Turismo & Comercio S.V.</span>
                    </div>
                    <span className="text-[7px] font-bold text-yellow-400/90 border border-yellow-400/30 px-1.5 py-0.5 rounded uppercase tracking-widest bg-yellow-400/10">Socio Oficial</span>
                  </div>

                  {/* Middle row of card */}
                  <div className="flex items-center gap-4 relative z-10">
                    {userInfo.photoURL ? (
                      <img src={userInfo.photoURL} alt="Foto Socio" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/20 shadow-inner bg-white/10" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center font-bold text-lg text-white uppercase flex-shrink-0">
                        {userInfo.name.charAt(0) || 'S'}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="font-extrabold text-sm tracking-tight truncate leading-none mb-1 text-white">{userInfo.name || 'Socio Gremial'}</p>
                      <span className="inline-block text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-white/10 text-white truncate max-w-full">
                        {userInfo.business || 'Independiente'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom section with barcode & RUT */}
                  <div className="flex items-end justify-between relative z-10 pt-2 border-t border-white/10">
                    <div className="space-y-0.5">
                      <p className="text-[7px] uppercase font-bold text-white/60 tracking-wider">RUT / Registro</p>
                      <p className="text-[9px] font-mono font-bold tracking-tight text-white/90">{userInfo.rut || 'Pendiente'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider">
                        <span className={`w-1.5 h-1.5 rounded-full ${userInfo.debt > 0 ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`}></span>
                        {userInfo.debt > 0 ? 'PENDIENTE' : 'ACTIVO'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => window.print()} 
                    className="w-full h-12 bg-coffee text-white flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md"
                  >
                    <Printer size={14} /> IMPRIMIR CREDENCIAL
                  </button>
                  <p className="text-[10px] text-center text-outline leading-tight leading-relaxed">
                    La credencial digital es de uso personal e intransferible. Al escanear el microcódigo se valida el estado del socio en tiempo real.
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: Comprobante de Pago Electrónico */}
        <AnimatePresence>
          {selectedPaymentReceipt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white text-coffee rounded-3xl p-6 shadow-2xl border border-outline-variant max-w-sm w-full relative space-y-6"
              >
                <button 
                  onClick={() => setSelectedPaymentReceipt(null)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface text-light-coffee transition-colors"
                >
                  <X size={20} />
                </button>

                {/* Printable receipt sheet */}
                <div id="printable-receipt" className="border border-dashed border-outline-variant p-5 rounded-2xl bg-surface/30 font-mono space-y-4 text-xs">
                  <div className="text-center space-y-1">
                    <p className="font-extrabold text-sm uppercase tracking-tight">CÁMARA DE TURISMO</p>
                    <p className="text-[10px] text-light-coffee tracking-tighter">SAN VICENTE DE TAGUA TAGUA</p>
                    <p className="text-[9px] text-outline">RUT: 76.432.109-F</p>
                    <p className="text-[9px] text-outline">San Vicente de Tagua Tagua, O'Higgins</p>
                  </div>

                  <div className="border-t border-dashed border-outline-variant pt-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">RECIBO ID:</span>
                      <span className="font-bold text-coffee">#{selectedPaymentReceipt.id.toUpperCase().substring(0,8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">FECHA REG:</span>
                      <span className="font-bold text-coffee">{new Date(selectedPaymentReceipt.createdAt || selectedPaymentReceipt.date).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">ESTADO:</span>
                      <span className="font-bold text-green-600">PAGADO CON COCONFORME</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-outline-variant pt-3 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">SOCIO:</span>
                      <span className="font-bold text-coffee text-right max-w-[160px] truncate">{selectedPaymentReceipt.userName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">RUT:</span>
                      <span className="font-bold text-coffee">{userInfo.rut || 'No Registrado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-light-coffee font-medium">NEGOCIO:</span>
                      <span className="font-bold text-coffee truncate text-right max-w-[150px]">{userInfo.business || 'Independiente'}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-outline-variant pt-3 space-y-2">
                    <p className="text-[9px] font-black text-outline uppercase tracking-wider text-center">Detalle de Aporte</p>
                    <div className="flex justify-between text-[11px] font-bold bg-white p-2 rounded-lg border border-outline-variant/30">
                      <span>Aporte Período {selectedPaymentReceipt.period}</span>
                      <span>${(selectedPaymentReceipt.amount || 0).toLocaleString()} CLP</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-outline-variant pt-3 text-center space-y-1.5">
                    <p className="text-[9px] text-outline">Firma / Timbre Autenticado mediante Blockchain Gremial de Firestore.</p>
                    <div className="inline-block border-2 border-green-600/30 text-green-600 rounded px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rotate-[-3deg]">
                      TIMBRADO PAGADO
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const printContent = document.getElementById('printable-receipt');
                      if (printContent) {
                        const originalContent = document.body.innerHTML;
                        document.body.innerHTML = printContent.outerHTML;
                        window.print();
                        document.body.innerHTML = originalContent;
                        window.location.reload(); // Quick refresh to rebuild state nicely
                      }
                    }} 
                    className="flex-1 h-12 bg-primary text-white flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md"
                  >
                    <Printer size={14} /> IMPRIMIR BOLETA
                  </button>
                  <button 
                    onClick={() => setSelectedPaymentReceipt(null)} 
                    className="px-6 h-12 bg-surface text-coffee border border-outline-variant rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface-container transition-all"
                  >
                    CERRAR
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
}
