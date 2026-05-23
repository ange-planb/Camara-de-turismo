import React from 'react';
import { Menu, Bell, BellOff, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationSupported,
} from '../lib/notifications';

interface HeaderProps {
  onMenuClick?: () => void;
}

interface EventNotif {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  status: string;
  createdAt: any;
}

function formatRelative(dateStr: string, timeStr: string): string {
  const eventDate = new Date(`${dateStr}T${timeStr || '00:00'}`);
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Realizado';
  if (diffDays === 0) return '¡Hoy!';
  if (diffDays === 1) return 'Mañana';
  if (diffDays <= 7) return `En ${diffDays} días`;
  return new Date(`${dateStr}T00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

const TYPE_LABEL: Record<string, string> = {
  ASAMBLEA: 'Asamblea',
  DIRECTORIO: 'Directorio',
  TALLER: 'Taller',
  SOCIAL: 'Evento Social',
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, role } = useAuth();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [upcomingEvents, setUpcomingEvents] = React.useState<EventNotif[]>([]);
  const [permission, setPermission] = React.useState<string>(() => getNotificationPermission());

  React.useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const today = new Date().toISOString().split('T')[0];
      const upcoming = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as EventNotif))
        .filter(e => e.status === 'PROGRAMADA' && e.date >= today)
        .slice(0, 5);
      setUpcomingEvents(upcoming);
    });
    return () => unsub();
  }, []);

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPermission(result as string);
  };

  const newCount = upcomingEvents.length;

  return (
    <header className="bg-surface-container-lowest shadow-md sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-6 py-3 max-w-7xl mx-auto h-[64px]">
        <div className="flex items-center gap-4">
          <Menu
            className="text-primary cursor-pointer md:hover:scale-110 active:scale-95 transition-all"
            size={24}
            onClick={onMenuClick}
          />
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Logo size={28} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-coffee leading-tight">Cámara de Turismo</h1>
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">San Vicente de Tagua Tagua</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-coffee leading-none">{user?.displayName || 'Socio'}</span>
            <span className="text-[9px] font-medium text-primary uppercase tracking-widest">{role || 'Cargando...'}</span>
          </div>
          <div className="relative group">
            <Bell
              className="text-coffee cursor-pointer hover:text-primary transition-colors"
              size={24}
              onClick={() => setShowNotifications(!showNotifications)}
            />
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-[8px] text-white font-bold">{newCount}</span>
              </span>
            )}

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-surface-container overflow-hidden z-[100]"
                >
                  <div className="p-4 bg-primary text-white flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-widest">Próximos Eventos</span>
                    {newCount > 0 && (
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{newCount} programados</span>
                    )}
                  </div>

                  <div className="max-h-[280px] overflow-y-auto">
                    {upcomingEvents.length === 0 ? (
                      <div className="p-6 text-center text-xs text-light-coffee">No hay eventos próximos programados.</div>
                    ) : (
                      upcomingEvents.map((ev) => (
                        <div key={ev.id} className="p-4 border-b border-surface-container hover:bg-surface cursor-pointer transition-colors">
                          <p className="text-xs font-bold text-coffee">{ev.title}</p>
                          <p className="text-[10px] text-light-coffee my-0.5">{TYPE_LABEL[ev.type] || ev.type}</p>
                          <p className="text-[9px] text-primary font-medium">{formatRelative(ev.date, ev.time)}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {isNotificationSupported() && (
                    <div className="p-3 bg-surface border-t border-surface-container">
                      {permission === 'granted' ? (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-primary font-bold">
                          <BellRing size={12} />
                          Notificaciones activadas
                        </div>
                      ) : permission === 'denied' ? (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-red-500 font-bold">
                          <BellOff size={12} />
                          Notificaciones bloqueadas en el navegador
                        </div>
                      ) : (
                        <button
                          onClick={handleEnableNotifications}
                          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                        >
                          <Bell size={12} />
                          Habilitar notificaciones
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-primary/20 shadow-sm ring-2 ring-primary/5">
            <img
              src={user?.photoURL || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1587&auto=format&fit=crop"}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        />
      )}
    </header>
  );
}
