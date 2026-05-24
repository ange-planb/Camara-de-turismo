import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Wallet,
  Share2,
  Database
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut as DoughnutChart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, writeBatch, doc } from 'firebase/firestore';

import { FINANCIAL_HISTORY } from '../constants/financialData';
import CSVImporter from '../components/CSVImporter';
import { getMemberCalculatedData } from '../utils/paymentCalculator';

import { toast } from 'sonner';

export default function Dashboard() {
  const { isBoard } = useAuth();
  const [memberCount, setMemberCount] = React.useState(0);
  const [totalDebt, setTotalDebt] = React.useState(0);
  const [realBalance, setRealBalance] = React.useState<number | null>(null);
  const [existingEmails, setExistingEmails] = React.useState<Set<string>>(new Set());
  
  const currentFinances = FINANCIAL_HISTORY["2025"];

  const stats = React.useMemo(() => [
    { label: "Total Socios", value: memberCount.toString(), icon: Users, color: "text-primary", status: "Activos" },
    { label: "Saldo Social", value: realBalance !== null ? `$${realBalance.toLocaleString()}` : `$${currentFinances.balance.toLocaleString()}`, icon: Wallet, color: "text-secondary", status: "Caja Real" },
    { label: "Pendientes", value: isBoard ? `$${totalDebt.toLocaleString()}` : 'Ver Finanzas', icon: BarChart3, color: "text-red-500", status: "Recaudación" },
    { label: "Convenios", value: "8", icon: Share2, color: "text-primary", status: "Nuevos" },
  ], [memberCount, totalDebt, isBoard, currentFinances.balance, realBalance]);

  React.useEffect(() => {
    let localMembers: any[] = [];
    let localPayments: any[] = [];

    const recalculateDebt = () => {
      let debt = 0;
      const emails = new Set<string>();
      localMembers.forEach(m => {
        const calc = getMemberCalculatedData(m, localPayments);
        debt += calc.debt;
        if (m.email) emails.add(m.email.toLowerCase().trim());
      });
      setMemberCount(localMembers.length);
      setExistingEmails(emails);
      if (isBoard) setTotalDebt(debt);
    };

    // Real-time listener for user stats (pointing to socios collection)
    const qUsers = query(collection(db, 'socios'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      localMembers = snapshot.docs.map(doc => ({
        uid: doc.id,
        id: doc.id,
        ...doc.data(),
        name: doc.data().name || doc.data().nombre || 'Sin nombre',
        email: doc.data().email || doc.data().correo || '',
        role: doc.data().role || doc.data().rol || 'MEMBER',
        paymentModality: doc.data().paymentModality || 'MENSUAL'
      }));
      recalculateDebt();
    }, (error) => {
      console.error("Dashboard users listener error", error);
    });

    const qPayments = query(collection(db, 'payments'));
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      localPayments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      recalculateDebt();
    });

    // Real-time Balance
    const qTrans = query(collection(db, 'transactions'));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      let income = 0;
      let expenses = 0;
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.type === 'INCOME') income += d.amount || 0;
        if (d.type === 'EXPENSE') expenses += d.amount || 0;
      });
      if (snapshot.size > 0) {
        setRealBalance(income - expenses);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribePayments();
      unsubscribeTrans();
    };
  }, [isBoard]);

  // Chart Data
  const lineData = React.useMemo(() => ({
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Socios Activos',
        data: [20, 22, 24, 25, 25, memberCount],
        borderColor: '#006b5f',
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ],
  }), [memberCount]);

  const handleCSVData = async (rawData: any[]) => {
    if (!rawData || rawData.length === 0) return;
    const toastId = toast.loading("Sincronizando socios...");

    let nameIdx = -1;
    let emailIdx = -1;
    let rutIdx = -1;
    let businessIdx = -1;
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
        
        // Priority for name
        const nameKeywords = ['nombre', 'razón social', 'cliente', 'persona', 'socio'];
        let bestNameIdx = -1;
        let priority = -1;

        row.forEach((col, idx) => {
          const s = String(col).toLowerCase();
          nameKeywords.forEach((key, p) => {
            if (s.includes(key) && (priority === -1 || p < priority)) {
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
      const batchSize = 400;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatchRows = rows.slice(i, i + batchSize);

        for (const row of currentBatchRows) {
          if (!Array.isArray(row) || row.length === 0) continue;

          let currentRow = [...row];
          // Auto-detect semicolon or tab
          if (currentRow.length === 1) {
            if (String(currentRow[0]).includes(';')) currentRow = String(currentRow[0]).split(';');
            else if (String(currentRow[0]).includes('\t')) currentRow = String(currentRow[0]).split('\t');
          }

          let email = emailIdx !== -1 && emailIdx < currentRow.length ? currentRow[emailIdx] : null;
          let name = nameIdx !== -1 && nameIdx < currentRow.length ? currentRow[nameIdx] : null;
          let rut = rutIdx !== -1 && rutIdx < currentRow.length ? currentRow[rutIdx] : null;
          let business = businessIdx !== -1 && businessIdx < currentRow.length ? currentRow[businessIdx] : null;

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

          const id = 'user_' + emailClean.replace(/[^a-zA-Z0-9]/g, '');
          const userRef = doc(db, 'socios', id);
          
          batch.set(userRef, {
            uid: 'placeholder_' + Math.random().toString(36).substring(2, 8),
            name: name ? String(name).trim() : 'Socio sin nombre',
            email: emailClean,
            rut: rut ? String(rut).trim() : 'Pte.',
            business: business ? String(business).trim() : 'Sin empresa',
            // Spanish mappings for compatibility
            nombre: name ? String(name).trim() : 'Socio sin nombre',
            correo: emailClean,
            RUT: rut ? String(rut).trim() : 'Pte.',
            emprendimiento: business ? String(business).trim() : 'Sin empresa',
            role: 'MEMBER',
            category: 'COMERCIO',
            status: 'ACTIVO',
            estado: 'ACTIVO',
            debt: 0,
            attendance: 0,
            createdAt: new Date().toISOString()
          }, { merge: true });
          importedCount++;
          existingEmails.add(emailClean);
        }
        await batch.commit();
      }
      toast.success(`¡Éxito! ${importedCount} socios sincronizados.`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Error al sincronizar.", { id: toastId });
    } finally {
      // Force dismiss
      toast.dismiss(toastId);
    }
  };

  const barData = React.useMemo(() => ({
    labels: ['Vinos', 'Hoteles', 'Artesanía', 'Gastronomía', 'Transporte'],
    datasets: [
      {
        label: 'Proyectos por Categoría',
        data: [8, 12, 5, 9, 4],
        backgroundColor: [
          '#006b5f',
          '#2dd4bf',
          '#77574d',
          '#416900',
          '#acf847'
        ],
        borderRadius: 8,
      }
    ],
  }), []);

  return (
    <div className="flex flex-col min-w-0">
      <main className="px-6 py-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold text-coffee">Resumen General</h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-[10px] font-bold text-green-600 animate-pulse">
                  <Database size={10} />
                  SYNC ON
                </div>
              </div>
              <p className="text-xs font-bold text-light-coffee uppercase tracking-[0.2em]">Gestión Institucional</p>
            </motion.section>

            {isBoard && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <CSVImporter label="Nueva Carga Masiva" onDataLoaded={handleCSVData} />
              </motion.div>
            )}
          </div>

          {/* KPI Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-5 rounded-2xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg bg-surface ${stat.color} bg-opacity-10`}>
                    <stat.icon size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-secondary uppercase bg-secondary/10 px-2 py-1 rounded-full">{stat.status}</span>
                </div>
                <p className="text-xs font-medium text-light-coffee mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-coffee">{stat.value}</p>
              </motion.div>
            ))}
          </section>

          {/* Charts Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-soft"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-coffee flex items-center gap-2">
                  <TrendingUp className="text-primary" size={20} />
                  Socios Registrados
                </h3>
              </div>
              <div className="h-[250px] w-full">
                <Line 
                  data={lineData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: { y: { display: false }, x: { grid: { display: false } } },
                    plugins: { legend: { display: false } }
                  }} 
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-soft"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-coffee flex items-center gap-2">
                  <BarChart3 className="text-primary" size={20} />
                  Inversión por Sector
                </h3>
              </div>
              <div className="h-[250px] w-full">
                <Bar 
                  data={barData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                  }} 
                />
              </div>
            </motion.div>

            {!isBoard && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="lg:col-span-2 p-10 bg-primary/5 rounded-[2.5rem] border border-dashed border-primary/20 text-center space-y-4"
              >
                <div className="max-w-xl mx-auto space-y-2">
                  <h3 className="text-2xl font-black text-coffee uppercase tracking-tight">Bienvenido a su Portal de Socio</h3>
                  <p className="text-sm text-light-coffee font-medium">Aquí podrá descargar documentos, revisar actas de reuniones y participar en votaciones institucionales.</p>
                </div>
              </motion.div>
            )}

            {isBoard && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 p-10 bg-surface-container rounded-[2.5rem] border border-outline-variant/30 text-center space-y-4"
              >
                <div className="max-w-2xl mx-auto space-y-2">
                  <h3 className="text-xl font-black text-coffee uppercase tracking-tight">Panel de Control Estratégico</h3>
                  <p className="text-sm text-light-coffee font-medium">Gestiona socios, reuniones y finanzas desde los accesos directos laterales o el menú inferior.</p>
                </div>
              </motion.div>
            )}
          </section>

        </main>
      </div>
    );
}

