import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Users, 
  FileText, 
  Calendar, 
  Vote, 
  User, 
  ChevronLeft, 
  ChevronRight,
  LayoutDashboard,
  Settings,
  HelpCircle,
  Briefcase,
  DollarSign,
  Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { isBoard } = useAuth();
  
  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
    { to: "/members", icon: Users, label: "Socios" },
    { to: "/minutes", icon: FileText, label: "Actas" },
    { to: "/finances", icon: DollarSign, label: "Finanzas" },
    { to: "/documents", icon: Folder, label: "Documentos" },
    { to: "/events", icon: Calendar, label: "Reuniones" },
    { to: "/voting", icon: Vote, label: "Votaciones" },
  ];

  const filteredItems = navItems.filter(item => !item.boardOnly || isBoard);

  const bottomItems = [
    { to: "/profile", icon: User, label: "Mi Perfil" },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="hidden md:flex flex-col h-screen bg-white border-r border-surface-container sticky top-0 z-40 shadow-sm"
    >
      <div className="p-6 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                 <Logo size={24} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-coffee whitespace-nowrap text-xs leading-tight">Cámara de Turismo</span>
                <span className="text-[9px] text-primary font-medium tracking-tighter">SAN VICENTE T.T.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg bg-surface hover:bg-surface-container-high text-primary transition-colors ml-auto"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary-container text-on-primary-container shadow-sm' 
                  : 'text-light-coffee hover:bg-surface hover:text-primary'
              }`
            }
          >
            <item.icon size={22} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-medium text-sm overflow-hidden whitespace-nowrap">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-6 border-t border-surface-container space-y-2">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-4 px-3 py-3 rounded-xl text-light-coffee hover:bg-surface hover:text-primary transition-all group"
          >
            <item.icon size={22} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-medium text-sm overflow-hidden whitespace-nowrap">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </motion.aside>
  );
}
