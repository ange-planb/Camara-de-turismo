import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, Calendar, User, Vote, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { isBoard } = useAuth();
  
    const navItems = [
    { to: "/dashboard", icon: Home, label: "Inicio" },
    { to: "/members", icon: Users, label: "Socios" },
    { to: "/finances", icon: DollarSign, label: "Finanzas" },
    { to: "/profile", icon: User, label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container-lowest shadow-[0_-4px_12px_rgba(93,64,55,0.05)] rounded-t-xl md:hidden border-t border-surface-container">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-2 py-1 transition-all duration-200 ${
              isActive ? 'text-primary scale-110' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon size={22} className={isActive ? 'fill-primary' : ''} />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
