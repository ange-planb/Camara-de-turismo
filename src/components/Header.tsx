import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, role } = useAuth();
  const [showNotifications, setShowNotifications] = React.useState(false);
  
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
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            
            {/* Notification Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-surface-container overflow-hidden z-[100]"
                >
                  <div className="p-4 bg-primary text-white flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-widest">Notificaciones</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">3 Nuevas</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {[
                      { title: "Nueva Acta Publicada", time: "Hace 2 horas", desc: "El acta de la reunión ordinaria de Mayo ya está disponible." },
                      { title: "Recordatorio de Pago", time: "Hoy", desc: "Próximo vencimiento de cuota social el 20 de Mayo." },
                      { title: "Evento Confirmado", time: "Ayer", desc: "La Ruta Digital Tagua Tagua ha sido confirmada para Junio." }
                    ].map((notif, idx) => (
                      <div key={idx} className="p-4 border-b border-surface-container hover:bg-surface cursor-pointer transition-colors">
                        <p className="text-xs font-bold text-coffee">{notif.title}</p>
                        <p className="text-[10px] text-light-coffee my-1">{notif.desc}</p>
                        <p className="text-[9px] text-primary font-medium">{notif.time}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-surface text-center">
                    <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Marcar todas como leídas</button>
                  </div>
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
      
      {/* Click outside to close notification */}
      {showNotifications && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowNotifications(false)}
        />
      )}
    </header>
  );
}
