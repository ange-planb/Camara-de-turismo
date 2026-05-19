import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  X, 
  Loader2, 
  CheckCircle2, 
  ChevronRight,
  Info,
  CalendarCheck,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CSVImporter from '../components/CSVImporter';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDocs,
  arrayUnion, 
  arrayRemove,
  Timestamp 
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface MeetingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  agenda: string;
  type: 'ASAMBLEA' | 'DIRECTORIO' | 'TALLER' | 'SOCIAL';
  status: 'PROGRAMADA' | 'REALIZADA' | 'CANCELADA';
  rsvpYes?: string[]; 
  rsvpNo?: string[];
  attendanceRecord?: string[];
  manualAttendanceCount?: number;
  selfAttendanceEnabled?: boolean;
  createdAt: any;
}

export default function Events() {
  const { user, isBoard } = useAuth();
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState<string | null>(null);

  // New Event Form
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    agenda: "",
    type: "ASAMBLEA" as const,
    status: "PROGRAMADA" as const
  });

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MeetingEvent[];
      
      // If no events exist, let's pre-load the 2026 annual assembly if it's missing (one-time check)
      if (data.length === 0) {
        seedInitialEvent();
      }
      
      setEvents(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const seedInitialEvent = async () => {
    try {
      await addDoc(collection(db, 'events'), {
        title: "ASAMBLEA ORDINARIA ANUAL 2026",
        date: "2026-03-27",
        time: "20:00",
        location: "San Vicente de Tagua Tagua",
        agenda: "Balance anual, elecciones y planificación estival.",
        type: "ASAMBLEA",
        status: "REALIZADA",
        attendees: [],
        createdAt: Timestamp.now()
      });
    } catch (e) {
      console.error("Error seeding event:", e);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        attendees: [],
        createdAt: Timestamp.now()
      });
      setShowAddModal(false);
      setNewEvent({
        title: "",
        date: "",
        time: "",
        location: "",
        agenda: "",
        type: "ASAMBLEA",
        status: "PROGRAMADA"
      });
    } catch (error) {
      console.error("Error adding event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRSVP = async (eventId: string, response: 'YES' | 'NO') => {
    if (!user) return;
    const eventRef = doc(db, 'events', eventId);
    try {
      if (response === 'YES') {
        await updateDoc(eventRef, {
          rsvpYes: arrayUnion(user.uid),
          rsvpNo: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(eventRef, {
          rsvpNo: arrayUnion(user.uid),
          rsvpYes: arrayRemove(user.uid)
        });
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
    }
  };

  const handleMarkAttendance = async (eventId: string) => {
    if (!user) return;
    const eventRef = doc(db, 'events', eventId);
    try {
      await updateDoc(eventRef, {
        attendanceRecord: arrayUnion(user.uid)
      });
      alert("¡Asistencia registrada exitosamente!");
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const toggleSelfAttendance = async (eventId: string, currentValue: boolean) => {
    const eventRef = doc(db, 'events', eventId);
    try {
      await updateDoc(eventRef, {
        selfAttendanceEnabled: !currentValue
      });
    } catch (error) {
      console.error("Error toggling attendance:", error);
    }
  };
  
  const handleAttendanceCSV = async (eventId: string, rawData: any[][]) => {
    if (!rawData || rawData.length === 0) return;

    try {
      // 1. Fetch current users to match by email or RUT
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs
        .map(doc => ({
          uid: doc.id,
          name: doc.data().name || '',
          email: doc.data().email?.toLowerCase().trim() || '',
          rut: doc.data().rut?.replace(/\./g, '').replace(/-/g, '').toLowerCase().trim() || ''
        }))
        .filter(u => u.email.length > 3 || u.rut.length > 5);

      // 2. Process CSV data
      const headerKeywords = ['nombre', 'rut', 'correo', 'email', 'asistencia', 'lista', 'direccion', 'emprendimiento'];
      
      const matchedUidsSet = new Set<string>();
      const matchedNamesSet = new Set<string>();
      const unmatchedNames: string[] = [];

      rawData.forEach((row, index) => {
        if (!row || row.length < 2) return;

        // Skip header - only if it looks like one AND it's at the top
        const rowString = row.join(' ').toLowerCase();
        if (index < 2 && headerKeywords.some(k => rowString.includes(k))) return;

        // Extract identifiers (robust indices)
        // Expected: [0: name, 1: rut, 2: address, 3: venture, 4: email]
        const name = row[0]?.toString().trim();
        const rut = row[1]?.toString()?.replace(/\./g, '').replace(/-/g, '').toLowerCase().trim() || '';
        const email = (row[4] || row[row.length - 1])?.toString()?.toLowerCase().trim() || '';

        // Stricter skip for headers that might have slipped through
        if (name?.toLowerCase() === 'nombre' || rut === 'rut' || email === 'email' || email === 'correo') return;
        if (!name || name.length < 2) return;

        // Try to find user UID
        const foundUser = usersData.find(u => 
          (email && email.includes('@') && u.email === email) || 
          (rut && rut.length > 4 && u.rut === rut)
        );

        if (foundUser) {
          matchedUidsSet.add(foundUser.uid);
          matchedNamesSet.add(foundUser.name);
        } else {
          unmatchedNames.push(name);
        }
      });

      const matchedUids = Array.from(matchedUidsSet);

      if (matchedUids.length === 0 && unmatchedNames.length === 0) {
        toast.error("No se encontraron registros de asistentes en el archivo.");
        return;
      }

      // 3. Update Firestore - OVERWRITE to ensure result matches the CSV exactly
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        attendanceRecord: matchedUids
      });

      let message = `Carga completada de forma exclusiva:\n- Se han identificado ${matchedUids.length} socios.`;
      if (matchedNamesSet.size > 0) {
        message += `\n\nSocios vinculados (${matchedNamesSet.size}):\n${Array.from(matchedNamesSet).sort().join(', ')}`;
      }
      
      if (unmatchedNames.length > 0) {
        message += `\n\nNo encontrados en el sistema (${unmatchedNames.length}):\n${unmatchedNames.slice(0, 15).join(', ')}${unmatchedNames.length > 15 ? '...' : ''}`;
      }
      alert(message);

    } catch (error) {
      console.error("Error loading attendance CSV:", error);
      toast.error("Error al procesar el archivo. Verifique el formato.");
    }
  };

  const clearAttendance = async (eventId: string) => {
    if (!confirm("¿Deseas BORRAR TODA la lista de asistencia de esta reunión?")) return;
    const eventRef = doc(db, 'events', eventId);
    try {
      await updateDoc(eventRef, { attendanceRecord: [] });
      alert("Lista de asistencia reiniciada.");
    } catch (error) {
      console.error("Error clearing attendance:", error);
    }
  };

  const handleManualAttendanceUpdate = async (eventId: string, count: string) => {
    const eventRef = doc(db, 'events', eventId);
    const numCount = parseInt(count);
    try {
      await updateDoc(eventRef, {
        manualAttendanceCount: isNaN(numCount) ? null : numCount
      });
    } catch (error) {
      console.error("Error updating manual attendance:", error);
    }
  };

  const syncWithGoogleCalendar = async (event: MeetingEvent) => {
    if (!user) return;
    setCalendarSyncLoading(event.id);
    
    try {
      // 1. Get Access Token via re-authentication (necessary for Calendar scope)
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) throw new Error("No se pudo obtener el token de acceso");

      // 2. Prepare event data
      const startDateTime = `${event.date}T${event.time}:00`;
      // Assume 2 hours duration
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

      const gEvent = {
        summary: event.title,
        location: event.location,
        description: `Tipo: ${event.type}\nTabla: ${event.agenda}\n\nAgendado desde el Portal de Socios de la Cámara de Turismo.`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'America/Santiago',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'America/Santiago',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 24 * 60 },
          ],
        },
      };

      // 3. Create event in Google Calendar
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gEvent),
      });

      if (response.ok) {
        alert("¡Evento sincronizado exitosamente en tu Google Calendar!");
      } else {
        const errorData = await response.json();
        console.error("Calendar API Error:", errorData);
        alert("Error al sincronizar con el calendario. Por favor, intenta de nuevo.");
      }
    } catch (error) {
      console.error("Auth/Sync Error:", error);
      alert("Hubo un problema al conectar con Google. Por favor, asegúrate de permitir los permisos solicitados.");
    } finally {
      setCalendarSyncLoading(null);
    }
  };

  return (
    <div className="flex flex-col min-w-0 overflow-hidden text-coffee">
      <main className="px-6 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-coffee tracking-tight">Registro de Reuniones</h2>
            <p className="text-sm text-light-coffee font-medium">Mantente al tanto de asambleas y reuniones importantes.</p>
          </div>
          {isBoard && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-white px-6 py-4 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-105 active:scale-95 transition-all text-sm font-black tracking-widest leading-none"
            >
              <Plus size={20} />
              AGENDAR REUNIÓN
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4">
              {events.length === 0 ? (
                <div className="p-20 text-center border-2 border-dashed border-outline-variant rounded-3xl opacity-50">
                  <CalendarIcon className="mx-auto mb-4 text-outline" size={48} />
                  <p className="font-bold">No hay reuniones programadas</p>
                </div>
              ) : (
                events.map((event, i) => {
                  const eventDate = new Date(event.date + 'T00:00:00');
                  const rsvpYes = event.rsvpYes || [];
                  const rsvpNo = event.rsvpNo || [];
                  const attendanceRecord = event.attendanceRecord || [];
                  const isAttending = user ? rsvpYes.includes(user.uid) : false;
                  const declined = user ? rsvpNo.includes(user.uid) : false;
                  const markPresent = user ? attendanceRecord.includes(user.uid) : false;
                  
                  // Check if self-attendance is active (only on the day of meeting)
                  const today = new Date().toISOString().split('T')[0];
                  const isEventToday = event.date === today;
                  const canMarkSelfAttendance = isEventToday && event.selfAttendanceEnabled;

                  return (
                    <motion.div 
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`bg-white border p-6 rounded-[2rem] shadow-soft flex flex-col md:flex-row gap-6 group transition-all hover:shadow-xl ${
                        event.status === 'PROGRAMADA' ? 'border-primary/10' : 'border-outline-variant/30 opacity-80'
                      }`}
                    >
                      {/* Date Badge */}
                      <div className={`flex md:flex-col items-center justify-center rounded-3xl p-6 min-w-[120px] transition-colors ${
                        event.status === 'PROGRAMADA' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface text-coffee'
                      }`}>
                        <span className="text-xs font-black uppercase tracking-widest opacity-70">
                          {eventDate.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')}
                        </span>
                        <span className="text-4xl font-black">{eventDate.getDate()}</span>
                        <span className="text-[10px] font-bold mt-1 opacity-70">{eventDate.getFullYear()}</span>
                      </div>
                      
                      <div className="flex-grow space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${
                                event.status === 'PROGRAMADA' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-surface text-light-coffee border-outline-variant'
                              }`}>
                                {event.type}
                              </span>
                              {event.status === 'REALIZADA' && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                  <CheckCircle2 size={10} /> REALIZADA
                                </span>
                              )}
                              {(event.manualAttendanceCount !== undefined && event.manualAttendanceCount !== null) ? (
                                <span className="text-[9px] font-black text-white bg-coffee px-2 py-0.5 rounded border border-coffee/20">
                                  {event.manualAttendanceCount} ASISTENTES (TOTAL)
                                </span>
                              ) : attendanceRecord.length > 0 && (
                                <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
                                  {[...new Set(attendanceRecord)].length} ASISTENTES
                                </span>
                              )}
                            </div>
                            <h4 className="text-xl font-black text-coffee group-hover:text-primary transition-colors">{event.title}</h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-light-coffee text-sm font-bold">
                          <div className="flex items-center gap-3 bg-surface/50 p-3 rounded-2xl">
                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                              <Clock size={16} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-primary/60 uppercase font-black leading-none mb-1">HORARIO</span>
                              {event.time} hrs
                            </div>
                          </div>
                          <div className="flex items-center gap-3 bg-surface/50 p-3 rounded-2xl">
                            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                              <MapPin size={16} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-primary/60 uppercase font-black leading-none mb-1">UBICACIÓN</span>
                              <span className="line-clamp-1">{event.location}</span>
                            </div>
                          </div>
                        </div>

                        {event.agenda && (
                          <div className="bg-surface/30 p-4 rounded-2xl border border-dashed border-outline-variant/30">
                            <p className="text-xs text-light-coffee leading-relaxed italic"><span className="font-black not-italic text-coffee/60 mr-2 uppercase text-[10px]">TABLA:</span>{event.agenda}</p>
                          </div>
                        )}

                        <div className="space-y-4 pt-2">
                          {event.status === 'PROGRAMADA' && (
                            <div className="flex flex-col gap-3">
                              <p className="text-[10px] font-black text-coffee/60 uppercase tracking-widest px-1">¿Asistirás a la reunión?</p>
                              <div className="flex flex-wrap items-center gap-3">
                                <button 
                                  onClick={() => handleRSVP(event.id, 'YES')}
                                  className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${
                                    isAttending 
                                    ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                                    : 'bg-surface text-coffee hover:bg-outline-variant outline outline-1 outline-outline-variant/20'
                                  }`}
                                >
                                  <CheckCircle2 size={18} />
                                  SÍ, ASISTIRÉ
                                </button>
                                <button 
                                  onClick={() => handleRSVP(event.id, 'NO')}
                                  className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${
                                    declined 
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                                    : 'bg-surface text-coffee hover:bg-outline-variant outline outline-1 outline-outline-variant/20'
                                  }`}
                                >
                                  <X size={18} />
                                  NO PODRÉ
                                </button>
                                
                                {isAttending && (
                                  <button 
                                    onClick={() => syncWithGoogleCalendar(event)}
                                    disabled={calendarSyncLoading === event.id}
                                    className="flex-1 md:flex-none px-6 py-3 bg-white border border-primary/20 text-primary rounded-xl font-black text-xs tracking-widest hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                  >
                                    {calendarSyncLoading === event.id ? (
                                      <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                      <Share2 size={18} />
                                    )}
                                    SINCRONIZAR
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {canMarkSelfAttendance && !markPresent && (
                            <motion.button 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              onClick={() => handleMarkAttendance(event.id)}
                              className="w-full bg-primary text-white py-4 rounded-2xl font-black tracking-widest shadow-xl shadow-primary/30 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                              <CalendarCheck size={24} />
                              MARCAR MI ASISTENCIA AHORA
                            </motion.button>
                          )}

                          {markPresent && (
                            <div className="bg-green-50 text-green-600 p-4 rounded-2xl border border-green-200 flex items-center gap-3">
                              <CheckCircle2 className="shrink-0" size={20} />
                              <span className="text-xs font-black uppercase tracking-widest">Asistencia registrada para esta reunión</span>
                            </div>
                          )}

                          {isBoard && (
                            <div className="pt-4 mt-4 border-t border-outline-variant/30 flex flex-col gap-4">
                              <div className="flex flex-wrap items-center gap-4">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-black text-coffee/60 uppercase">Total Asistentes (Manual)</label>
                                  <input 
                                    type="number"
                                    placeholder="Total real..."
                                    className="px-3 py-1.5 bg-surface border border-outline-variant/50 rounded-lg text-xs font-bold w-32 focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={event.manualAttendanceCount ?? ''}
                                    onChange={(e) => handleManualAttendanceUpdate(event.id, e.target.value)}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2 mt-auto">
                                  <button 
                                    onClick={() => toggleSelfAttendance(event.id, event.selfAttendanceEnabled || false)}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                      event.selfAttendanceEnabled 
                                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                                    }`}
                                  >
                                    {event.selfAttendanceEnabled ? 'DESACTIVAR AUTO-ASISTENCIA' : 'ACTIVAR AUTO-ASISTENCIA'}
                                  </button>
                                  
                                  <CSVImporter 
                                    label="SUBIR LISTA CSV"
                                    className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                    onDataLoaded={(data) => handleAttendanceCSV(event.id, data)}
                                  />
                                  <button 
                                    onClick={() => clearAttendance(event.id)}
                                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                  >
                                    <X size={14} /> REINICIAR LISTA
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Stats Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-surface-container-high space-y-6">
                <h3 className="text-xl font-black text-coffee flex items-center gap-2">
                  <Info className="text-primary" size={24} />
                  Información
                </h3>
                <p className="text-sm text-light-coffee leading-relaxed font-bold">
                  Las asambleas se realizan mensualmente según la planificación anual aprobada.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                    <span className="text-xs font-black text-coffee/60 uppercase">Día Habitual</span>
                    <span className="text-sm font-black text-coffee">Último Jueves</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface rounded-2xl">
                    <span className="text-xs font-black text-coffee/60 uppercase">Hora</span>
                    <span className="text-sm font-black text-coffee">19:00 hrs</span>
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[2.5rem] bg-coffee text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 space-y-4">
                  <h4 className="text-2xl font-black tracking-tight leading-none">Participación Proactiva</h4>
                  <p className="text-sm text-white/70 font-medium leading-relaxed">
                    Recuerda que tu asistencia es fundamental para la toma de decisiones democráticas en nuestra corporación.
                  </p>
                  <button className="flex items-center gap-2 text-primary font-black text-xs tracking-widest uppercase hover:translate-x-2 transition-transform">
                    Ver estatutos <ChevronRight size={16} />
                  </button>
                </div>
                <CalendarIcon className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48 group-hover:scale-110 transition-transform duration-1000" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowAddModal(false)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-coffee">Agendar Reunión</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Título del Evento</label>
                  <input 
                    required
                    className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="Ej: Asamblea Ordinaria Mayo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Fecha</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Hora</label>
                    <input 
                      type="time"
                      required
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Ubicación</label>
                  <input 
                    required
                    className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                    placeholder="Ej: Centro Cultural San Vicente"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Tabla / Agenda</label>
                  <textarea 
                    className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-medium text-sm min-h-[100px]"
                    value={newEvent.agenda}
                    onChange={(e) => setNewEvent({...newEvent, agenda: e.target.value})}
                    placeholder="Temas a tratar..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Tipo</label>
                    <select 
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold appearance-none"
                      value={newEvent.type}
                      onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                    >
                      <option value="ASAMBLEA">Asamblea</option>
                      <option value="DIRECTORIO">Directorio</option>
                      <option value="TALLER">Taller</option>
                      <option value="SOCIAL">Social</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Estado</label>
                    <select 
                      className="w-full px-5 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold appearance-none"
                      value={newEvent.status}
                      onChange={(e) => setNewEvent({...newEvent, status: e.target.value as any})}
                    >
                      <option value="PROGRAMADA">Programada</option>
                      <option value="REALIZADA">Realizada</option>
                      <option value="CANCELADA">Cancelada</option>
                    </select>
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black tracking-widest shadow-xl shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'PUBLICAR EVENTO'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
