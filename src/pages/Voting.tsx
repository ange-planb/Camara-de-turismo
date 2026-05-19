import React, { useState } from 'react';
import { Timer, ThumbsUp, ThumbsDown, Scale, CheckCircle, Vote as VoteIcon, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export default function Voting() {
  const [selected, setSelected] = useState<string | null>('favor');
  const [voted, setVoted] = useState(false);

  const options = [
    { id: 'favor', label: 'A favor', description: 'Apoyo la propuesta', icon: ThumbsUp, color: 'text-primary bg-primary/10' },
    { id: 'contra', label: 'En contra', description: 'Rechazo la propuesta', icon: ThumbsDown, color: 'text-red-500 bg-red-50' },
    { id: 'abstencion', label: 'Abstención', description: 'Sin preferencia', icon: Scale, color: 'text-light-coffee bg-surface-container' },
  ];

  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      <main className="flex-1 overflow-y-auto max-w-md mx-auto px-6 py-8 space-y-8">
          {/* Active Session Card */}
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 border border-outline-variant shadow-soft space-y-6"
        >
          <div className="flex items-center gap-3">
            <span className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest leading-none shadow-sm shadow-primary/20">Activa</span>
            <span className="text-xs font-bold text-light-coffee tracking-wider">ID: #CAM-2024-08</span>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-coffee leading-tight">Aprobación de Nuevos Estatutos 2024</h2>
            <p className="text-sm text-light-coffee leading-relaxed">Se somete a votación la propuesta de reforma estatutaria presentada por el directorio para el fortalecimiento del turismo regional.</p>
          </div>

          <div className="flex items-center gap-2 text-primary font-bold">
            <Clock size={18} />
            <span className="text-sm tracking-tight">Cierra en: 4h 12m</span>
          </div>
        </motion.section>

        {/* Voting Interface */}
        <section className="space-y-6">
          <h3 className="text-xs font-black text-outline uppercase tracking-[0.2em] px-2">Emitir Voto</h3>
          
          <div className="flex flex-col gap-4">
            {options.map((option) => (
              <button 
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`flex items-center justify-between w-full p-6 rounded-2xl border-2 transition-all group ${
                  selected === option.id ? 'border-primary bg-white shadow-lg' : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                    selected === option.id ? option.color : 'bg-white text-outline'
                  }`}>
                    <option.icon size={28} className={selected === option.id ? 'fill-current' : ''} />
                  </div>
                  <div className="text-left space-y-1">
                    <span className={`text-lg font-bold block ${selected === option.id ? 'text-coffee' : 'text-light-coffee'}`}>
                      {option.label}
                    </span>
                    <span className="text-xs font-medium text-light-coffee opacity-70 italic">{option.description}</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selected === option.id ? 'border-primary bg-primary' : 'border-outline-variant'
                }`}>
                  {selected === option.id && <div className="w-2 h-2 bg-white rounded-full shadow-inner"></div>}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Action Button */}
        {!voted ? (
          <button 
            onClick={() => setVoted(true)}
            className="w-full h-16 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <VoteIcon size={24} />
            Confirmar mi Voto
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-6 bg-green-500/10 border-2 border-green-500/20 rounded-3xl flex flex-col items-center gap-4 text-center"
          >
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
              <CheckCircle size={32} className="text-white" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-coffee">Voto registrado con éxito</p>
              <p className="text-sm text-light-coffee">Tu participación es fundamental para el gremio.</p>
            </div>
          </motion.div>
        )}

        {/* Decorative Divider */}
        <div className="rounded-3xl overflow-hidden h-40 relative shadow-xl group">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBcP60gLXKTd6I3E8Td-hveX4VekE-Ean136HSmtCVxjkbDEPjLUCPO4fPspj1vq47PrjPX0Eb2wh64x4xzIGWQb_-A3tnpZaStWicOnTmJAy5NMEwo5zlGl_WM14j5krBKf0FKwrKpAi-4Iq7UutzUPpCUQF8G2pt33bTsH3_g_hpRQy-0_SBaO8ke_YRqzPfoOMyUrLWfg4gVF541ZKFVwGxcMyrvcig4ouM3ojoEWD5E_724bFeg2acLbEY8thsbeF4R1VD7cbzt" 
            alt="Landscape"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-coffee/80 via-coffee/40 to-transparent flex items-end p-8">
            <p className="text-white text-xs font-bold italic opacity-90 leading-relaxed border-l-2 border-primary pl-4">
              "Cámara de Turismo - Comprometidos con el desarrollo sostenible de nuestra comuna"
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
