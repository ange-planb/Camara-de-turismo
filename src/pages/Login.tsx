import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login, loginEmail, registerEmail, loading, user } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await registerEmail(email, password, name);
      } else {
        await loginEmail(email, password);
      }
    } catch (error: any) {
      alert("Error: " + (error.message || "Credenciales incorrectas"));
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] flex flex-col items-center text-center space-y-6 z-10"
      >
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white shadow-xl flex flex-col items-center justify-center p-6 border border-surface-container overflow-hidden">
           <Logo size={80} className="text-primary drop-shadow-sm" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-coffee tracking-tight">Acceso Socios</h1>
          <p className="text-sm text-light-coffee font-medium">Cámara de Turismo San Vicente</p>
        </div>

        <div className="w-full bg-white rounded-[2rem] p-8 shadow-soft border border-surface-container space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Nombre Completo</label>
                <input 
                  required
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Tu nombre completo"
                />
              </div>
            )}
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Correo Electrónico</label>
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="ejemplo@correo.com"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-light-coffee uppercase tracking-widest pl-1">Contraseña</label>
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-primary-dark transition-all active:scale-[0.98] shadow-md disabled:opacity-50"
            >
              {loading ? 'Cargando...' : isRegistering ? 'Crear Cuenta' : 'Entrar'}
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-white px-3 text-outline font-black uppercase tracking-widest">O entrar con</span>
            </div>
          </div>

          <button 
            onClick={login}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-outline-variant/40 text-coffee py-3.5 rounded-xl font-bold text-sm hover:bg-surface-container transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" className="w-5 h-5" />
            Google
          </button>
          
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs font-bold text-primary hover:underline"
          >
            {isRegistering ? '¿Ya tienes cuenta? Entrar' : '¿Eres nuevo socio? Regístrate aquí'}
          </button>
        </div>
          
        <p className="text-[10px] text-outline font-bold uppercase tracking-widest leading-relaxed">
          Ingresa con tu cuenta asociada para acceder a los beneficios y gestión de la cámara.
        </p>

        <div className="flex flex-col items-center gap-4 text-center mt-6">
          <p className="text-xs text-light-coffee font-medium flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            Acceso seguro y encriptado
          </p>
          <p className="text-xs text-light-coffee max-w-[300px] leading-relaxed">
            Al ingresar, aceptas nuestros términos de servicio y políticas de privacidad para miembros.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
