import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isBoard } = useAuth();

  const navItems = [
    { to: "/dashboard", label: "Inicio" },
    { to: "/members", label: "Socios", boardOnly: true },
    { to: "/minutes", label: "Actas", boardOnly: true },
    { to: "/finances", label: "Finanzas", boardOnly: true },
    { to: "/documents", label: "Documentos" },
    { to: "/events", label: "Reuniones" },
    { to: "/voting", label: "Votaciones" },
    { to: "/profile", label: "Mi Perfil" },
  ];

  const filteredItems = navItems.filter(item => !item.boardOnly || isBoard);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {children}
        </main>

        <BottomNav />

        {/* Mobile Sidebar / Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-coffee/40 backdrop-blur-sm z-[60] md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[70] md:hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 flex justify-between items-center border-b border-surface-container">
                  <span className="font-bold text-coffee uppercase text-xs tracking-widest">Menú Principal</span>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl bg-surface text-coffee hover:scale-110 active:scale-95 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-200 ${
                          isActive 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                            : 'text-light-coffee hover:bg-surface hover:text-primary'
                        }`
                      }
                    >
                      <span className="font-bold text-sm">{item.label}</span>
                    </NavLink>
                  ))}
                </div>

                <div className="p-6 border-t border-surface-container">
                  <p className="text-[10px] text-light-coffee font-bold uppercase tracking-widest text-center">
                    Cámara de Turismo San Vicente T.T.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
