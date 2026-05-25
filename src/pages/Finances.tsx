import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  PieChart,
  History,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  X,
  CreditCard,
  MessageCircle,
  BarChart,
  Edit2,
  Trash2
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
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
import { FINANCIAL_HISTORY } from '../constants/financialData';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  where, 
  orderBy,
  Timestamp,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/Skeleton';
import { getMemberCalculatedData } from '../utils/paymentCalculator';

type Year = string;

interface Member {
  uid: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  paymentModality?: 'MENSUAL' | 'ANUAL';
  status: string;
  debt: number;
  lastPaymentDate?: string;
  lastPaymentMonth?: string;
  createdAt: string;
}

interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string;
  period: string;
  type: string;
  recordedBy: string;
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  date: string;
  timestamp: string;
}

export default function Finances() {
  const { role, isBoard, user: currentUser } = useAuth();
  const [selectedYear, setSelectedYear] = useState<Year>("2026");
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FEES' | 'EXPENSES'>('GENERAL');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const years = React.useMemo(() => {
    const staticYears = Object.keys(FINANCIAL_HISTORY);
    const transYears = transactions
      .map(t => t.date ? t.date.split('-')[0] : '')
      .filter(y => y && y.length === 4 && !isNaN(Number(y)));
    const uniqueYears = Array.from(new Set([...staticYears, ...transYears, "2026"]));
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    category: '',
    date: ''
  });
  
  const realTimeSummary = React.useMemo(() => {
    const yearTrans = transactions.filter(t => t.date.startsWith(selectedYear.toString()));
    const income = yearTrans.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expenses = yearTrans.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    
    // Fallback constants if no real data yet
    const base = FINANCIAL_HISTORY[selectedYear] || { totalIncome: 0, totalExpenses: 0, balance: 0, income: [], expenses: [] };
    
    // Smart balance: if we have real transactions for 'CUOTAS', we remove the 'Cuotas' estimate from base
    const hasRealIncome = yearTrans.some(t => t.type === 'INCOME');
    const baseIncomeFiltered = hasRealIncome 
      ? base.income.filter((i: any) => i.category !== 'Cuotas' && i.category !== 'CUOTAS')
      : base.income;
    
    const baseIncomeSum = baseIncomeFiltered.reduce((acc: number, i: any) => acc + i.amount, 0);
    const baseExpenseSum = base.expenses.reduce((acc: number, i: any) => acc + i.amount, 0);

    const rawIncomeList = [...yearTrans.filter(t => t.type === 'INCOME'), ...baseIncomeFiltered];
    
    // Privacy feature: Aggregate all 'CUOTAS' into a single entry per year for the general history
    const quotasIncomes = rawIncomeList.filter(t => t.category === 'CUOTAS' || t.category === 'Cuotas');
    const otherIncomes = rawIncomeList.filter(t => t.category !== 'CUOTAS' && t.category !== 'Cuotas');
    
    // Group totals by year to fulfill "unificar los pagos de cuotas como cuotas y el año"
    const quotasByYear: Record<string, number> = {};
    quotasIncomes.forEach(t => {
      const year = t.date ? t.date.split('-')[0] : selectedYear.toString();
      quotasByYear[year] = (quotasByYear[year] || 0) + t.amount;
    });
    
    const displayIncomeList = [...otherIncomes];
    Object.entries(quotasByYear).forEach(([year, amount]) => {
      displayIncomeList.push({
        id: `summary_quotas_${year}`,
        type: 'INCOME',
        category: 'CUOTAS',
        amount: amount,
        description: `Total Recaudado en Cuotas ${year}`,
        date: `${year}-12-31`, 
        timestamp: new Date().toISOString()
      } as Transaction);
    });

    return {
      totalIncome: income + baseIncomeSum,
      totalExpenses: expenses + baseExpenseSum,
      balance: (income + baseIncomeSum) - (expenses + baseExpenseSum),
      incomeList: displayIncomeList,
      expenseList: [...yearTrans.filter(t => t.type === 'EXPENSE'), ...base.expenses]
    };
  }, [transactions, selectedYear]);

  const historicalChartData = React.useMemo(() => {
    const labels = [...years].reverse(); // oldest to newest for chart display
    return {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: labels.map(y => {
            const yrTrans = transactions.filter(t => t.date && t.date.startsWith(y));
            const realIncome = yrTrans.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
            return realIncome || ((FINANCIAL_HISTORY as any)[y]?.totalIncome || 0);
          }),
          backgroundColor: '#006b5f',
          borderRadius: 8,
        },
        {
          label: 'Gastos',
          data: labels.map(y => {
            const yrTrans = transactions.filter(t => t.date && t.date.startsWith(y));
            const realExpenses = yrTrans.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
            return realExpenses || ((FINANCIAL_HISTORY as any)[y]?.totalExpenses || 0);
          }),
          backgroundColor: '#ef4444',
          borderRadius: 8,
        }
      ]
    };
  }, [transactions, years]);

  const categoryChartData = React.useMemo(() => {
    const { expenseList } = realTimeSummary;
    const categoryTotals: Record<string, number> = {};
    expenseList.forEach((e: any) => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    
    return {
      labels: Object.keys(categoryTotals),
      datasets: [{
        data: Object.values(categoryTotals),
        backgroundColor: ['#006b5f', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#77574d'],
        borderWidth: 0,
      }]
    };
  }, [realTimeSummary]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showQuotaImportModal, setShowQuotaImportModal] = useState(false);
  const [showHistoryManager, setShowHistoryManager] = useState(false);
  const [historyYear, setHistoryYear] = useState("2025");
  const [quotaRawData, setQuotaRawData] = useState("");
  const [importYear, setImportYear] = useState<string>("2025");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMonthHistory, setSelectedMonthHistory] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false);
  const [memberHistory, setMemberHistory] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const viewMemberDetails = async (member: Member) => {
    setSelectedMember(member);
    setShowMemberDetailModal(true);
    setLoadingHistory(true);
    
    try {
      // Find all transactions for this user
      const userTrans = transactions.filter(t => t.userId === member.uid);
      setMemberHistory(userTrans);
    } catch (error) {
      console.error("Error loading member history", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Month names for the grid
  const MONTHS = [
    { id: '01', name: 'Enero' }, { id: '02', name: 'Febrero' }, { id: '03', name: 'Marzo' },
    { id: '04', name: 'Abril' }, { id: '05', name: 'Mayo' }, { id: '06', name: 'Junio' },
    { id: '07', name: 'Julio' }, { id: '08', name: 'Agosto' }, { id: '09', name: 'Septiembre' },
    { id: '10', name: 'Octubre' }, { id: '11', name: 'Noviembre' }, { id: '12', name: 'Diciembre' }
  ];

  const handleToggleHistoryMonth = (monthId: string) => {
    const period = `${historyYear}-${monthId}`;
    if (selectedMonthHistory.includes(period)) {
      setSelectedMonthHistory(prev => prev.filter(p => p !== period));
    } else {
      setSelectedMonthHistory(prev => [...prev, period]);
    }
  };

  const handleSaveMemberHistory = async (isAnnual: boolean = false) => {
    if (!selectedMember) return;
    if (!isAnnual && selectedMonthHistory.length === 0) {
      toast.error("Selecciona al menos un mes.");
      return;
    }
    
    const memberName = selectedMember.name;
    const targetUid = selectedMember.uid;
    
    // Close modal and clear state immediately for better UX
    setShowHistoryManager(false);
    setIsSubmitting(true);
    
    try {
      const batch = writeBatch(db);
      const standardFee = 3000;
      const annualFee = 30000;
      let count = 0;

      if (isAnnual) {
        const transId = `hist_${targetUid}_${historyYear}_annual`;
        const transRef = doc(db, 'transactions', transId);
        
        batch.set(transRef, {
          type: 'INCOME',
          category: 'CUOTAS',
          amount: annualFee,
          description: `Cuota Anual ${historyYear} (Carga Manual) - ${memberName}`,
          date: `${historyYear}-01-01`,
          timestamp: new Date().toISOString(),
          userId: targetUid,
          manualHistory: true,
          isAnnual: true
        }, { merge: true });
        
        const userRef = doc(db, 'socios', targetUid);
        batch.update(userRef, {
          status: 'ACTIVO',
          paymentModality: 'ANUAL',
          lastPaymentMonth: `${historyYear}-12`,
          debt: 0,
          updatedAt: new Date().toISOString()
        });
      } else {
        for (const period of selectedMonthHistory) {
          const transId = `hist_${targetUid}_${period}`;
          const transRef = doc(db, 'transactions', transId);
          
          batch.set(transRef, {
            type: 'INCOME',
            category: 'CUOTAS',
            amount: standardFee,
            description: `Cuota ${period} (Carga Manual) - ${memberName}`,
            date: `${period}-01`,
            timestamp: new Date().toISOString(),
            userId: targetUid,
            manualHistory: true
          }, { merge: true });
          count++;
        }

        const sortedHistory = [...selectedMonthHistory].sort().reverse();
        const latestMonth = sortedHistory[0];
        
        const userRef = doc(db, 'socios', targetUid);
        batch.update(userRef, {
          status: 'ACTIVO', // Direct to active to satisfy user request
          lastPaymentMonth: latestMonth > (selectedMember.lastPaymentMonth || "") ? latestMonth : selectedMember.lastPaymentMonth,
          debt: 0,
          updatedAt: new Date().toISOString()
        });
      }

      await batch.commit();
      toast.success(isAnnual ? `Anualidad ${historyYear} registrada` : `Historial actualizado (${count} meses)`);
      setSelectedMonthHistory([]);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar historial");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [paymentForm, setPaymentForm] = useState({
    amount: 3000,
    type: 'MENSUAL' as 'MENSUAL' | 'ANUAL',
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: 0,
    description: '',
    category: 'GASTOS OPERATIVOS',
    date: new Date().toISOString().split('T')[0]
  });

  const isFinanceAdmin = role === 'PRESIDENTA' || role === 'TESORERA';

  const handleStartEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setEditForm({
      amount: t.amount,
      description: t.description,
      category: t.category,
      date: t.date || new Date().toISOString().split('T')[0]
    });
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'transactions', editingTransaction.id), {
        amount: Number(editForm.amount),
        description: editForm.description,
        category: editForm.category,
        date: editForm.date
      });
      setEditingTransaction(null);
      toast.success("¡Transacción actualizada exitosamente!");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Error al actualizar la transacción");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta transacción de forma permanente? No se puede deshacer.")) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'transactions', id));
      toast.success("¡Transacción eliminada exitosamente!");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Error al eliminar la transacción");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este pago de $${payment.amount.toLocaleString()} de ${payment.userName}?`)) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // Delete the payment document
      batch.delete(doc(db, 'payments', payment.id));
      
      // If payment has transactionId, delete that transaction
      if ((payment as any).transactionId) {
        batch.delete(doc(db, 'transactions', (payment as any).transactionId));
      } else {
        // Fallback: search in transactions state for matching transaction
        const matchingTrans = transactions.find(t => 
          t.userId === payment.userId && 
          t.amount === payment.amount && 
          t.category === 'CUOTAS' &&
          (t.date === payment.date || t.description?.includes(payment.period))
        );
        if (matchingTrans && matchingTrans.id) {
          batch.delete(doc(db, 'transactions', matchingTrans.id));
        }
      }

      // Update the member's DB state to match the recalculated data
      const remainingPayments = payments.filter(p => p.userId === payment.userId && p.id !== payment.id);
      const memberObj = members.find(m => m.uid === payment.userId);
      if (memberObj) {
        const { getMemberCalculatedData } = await import('../utils/paymentCalculator');
        const calc = getMemberCalculatedData(memberObj, remainingPayments);
        const userRef = doc(db, 'socios', payment.userId);
        batch.update(userRef, {
          debt: calc.debt,
          status: calc.status,
          lastPaymentMonth: calc.lastPaymentMonth || '',
          updatedAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast.success("¡Pago eliminado exitosamente!");
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error("Error al eliminar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Safety timeout to prevent infinite loading screen
    const safetyTimer = setTimeout(() => setLoading(false), 3000);

    // Fetch transactions (Global for general summary)
    const transQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribeTrans = onSnapshot(transQuery, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      setTransactions(transData);
      if (activeTab === 'GENERAL') setLoading(false);
    }, (error) => {
      console.error("Transactions read error:", error);
      if (activeTab === 'GENERAL') setLoading(false);
    });

    // Fetch members and payments if in Fees tab and user is board member
    let unsubscribeUsers = () => {};
    let unsubscribePayments = () => {};

    if (activeTab === 'FEES') {
      const usersQuery = query(collection(db, 'socios'));
      unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            uid: doc.id,
            ...d,
            name: d.name || d.nombre || 'Sin nombre',
            email: d.email || d.correo || '',
            rut: d.rut || d.RUT || '',
            business: d.business || d.emprendimiento || '',
            phone: d.phone || d.telefono || '',
            category: d.category || d.categoria || 'COMERCIO',
            status: d.status || d.estado || 'ACTIVO',
            role: d.role || d.rol || 'MEMBER',
            paymentModality: d.paymentModality || 'MENSUAL',
            lastPaymentMonth: d.lastPaymentMonth || '',
            debt: d.debt || 0,
            createdAt: d.createdAt || ''
          };
        }) as Member[];

        // Sort by name in memory
        usersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setMembers(usersData);
        setLoading(false);
      });

      const paymentsQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));
      unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Payment[];
        setPayments(paymentsData);
      });
    } else {
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeTrans();
      unsubscribeUsers();
      unsubscribePayments();
    };
  }, [activeTab, isFinanceAdmin, isBoard]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !currentUser) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // Determine transaction date from period
      // If period is YYYY-MM, use YYYY-MM-01. If it's ANNUAL, use YYYY-01-01
      let transDate = new Date().toISOString().split('T')[0];
      if (paymentForm.period.includes('-')) {
        const [y, m] = paymentForm.period.split('-');
        if (y && m) transDate = `${y}-${m}-01`;
      }

      const transRef = doc(collection(db, 'transactions'));
      const payRef = doc(collection(db, 'payments'));

      // 1. Record payment record (audit)
      batch.set(payRef, {
        userId: selectedMember.uid,
        userName: selectedMember.name,
        amount: paymentForm.amount,
        date: transDate,
        period: paymentForm.period,
        type: paymentForm.type,
        recordedBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        transactionId: transRef.id
      });

      // 2. Update user debt and status
      const newDebt = Math.max(0, (selectedMember.debt || 0) - paymentForm.amount);
      const newStatus = newDebt === 0 ? 'ACTIVO' : 'MOROSO';
      const userRef = doc(db, 'socios', selectedMember.uid);
      
      const updates: any = {
        debt: newDebt,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // Update lastPaymentMonth if it's more recent
      if (paymentForm.type === 'MENSUAL' && (!selectedMember.lastPaymentMonth || paymentForm.period > selectedMember.lastPaymentMonth)) {
        updates.lastPaymentMonth = paymentForm.period;
      }

      batch.update(userRef, updates);

      // 3. Record generic transaction for summary
      batch.set(transRef, {
        type: 'INCOME',
        category: 'CUOTAS',
        amount: paymentForm.amount,
        description: `Pago Cuota ${paymentForm.period} - ${selectedMember.name}`,
        date: transDate,
        timestamp: new Date().toISOString(),
        userId: selectedMember.uid
      });

      await batch.commit();
      setShowPaymentModal(false);
      setSelectedMember(null);
      toast.success("¡Pago registrado exitosamente!");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isFinanceAdmin) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        ...expenseForm,
        type: 'EXPENSE',
        timestamp: new Date().toISOString(),
        recordedBy: currentUser.uid
      });

      setShowExpenseModal(false);
      setExpenseForm({ amount: 0, description: '', category: 'GASTOS OPERATIVOS', date: new Date().toISOString().split('T')[0] });
      toast.success("Gasto registrado");
    } catch (error) {
      toast.error("Error al registrar gasto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessQuotaSheet = async () => {
    if (!quotaRawData.trim()) return;
    
    const dataToProcess = quotaRawData;
    setShowQuotaImportModal(false);
    setIsSubmitting(true);
    setQuotaRawData("");

    try {
      const parseLine = (line: string) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        const commaCount = (line.match(/,/g) || []).length;
        const semiCount = (line.match(/;/g) || []).length;
        const sep = semiCount > commaCount ? ';' : ',';
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === sep && !inQuotes) { result.push(current.trim()); current = ''; }
          else current += char;
        }
        result.push(current.trim());
        return result;
      };

      const rows = dataToProcess.split(/\r?\n/).filter(line => line.trim()).map(parseLine);
      if (members.length === 0) { 
        toast.error("No hay socios cargados."); 
        setIsSubmitting(false); 
        return; 
      }

      let batches = [writeBatch(db)];
      let batchOperationCount = 0;
      let updatedCount = 0;

      const monthsMap: Record<string, string> = {
        'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04', 
        'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08', 
        'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
      };

      let headers: string[] = [];
      let nameColIdx = -1;

      const normalize = (str: string | undefined) => {
        if (!str) return "";
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
      };

      const checkBatchAndRotate = () => {
        if (batchOperationCount >= 450) {
          batches.push(writeBatch(db));
          batchOperationCount = 0;
        }
      };

      for (const row of rows) {
        if (row.length < 2) continue;
        
        const isHeaderRow = row.some(c => ["SOCIO", "SOCIOS", "NOMBRE", "ENERO", "AGOSTO"].includes(c.toUpperCase().trim()));
        if (isHeaderRow && headers.length === 0) {
          headers = row.map(h => h.toUpperCase().trim());
          nameColIdx = headers.findIndex(h => ["SOCIO", "SOCIOS", "NOMBRE"].some(k => h.includes(k)));
          if (nameColIdx === -1) nameColIdx = 0;
          continue;
        }

        if (headers.length > 0) {
          const rawName = row[nameColIdx];
          if (!rawName) continue;
          const nName = normalize(rawName);
          if (["TOTAL", "SUBTOTAL", "RESUMEN"].some(w => nName.includes(w.toLowerCase()))) continue;

          const member = members.find(m => {
            const mNorm = normalize(m.name);
            return mNorm === nName || mNorm.includes(nName) || nName.includes(mNorm);
          });

          if (!member) continue;

          let memberTotalPaid = 0;
          let lastMonth = "";
          
          headers.forEach((header, idx) => {
            if (idx === nameColIdx) return;
            const val = parseInt(row[idx]?.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
            if (val > 0) {
              const head = header.toUpperCase().trim();
              if (head === 'TOTAL') return;
              const mCode = monthsMap[head] || monthsMap[head.split(' ')[0]];
              if (mCode || head === "ANUAL") {
                memberTotalPaid += val;
                if (mCode) lastMonth = `${importYear}-${mCode}`;
                
                checkBatchAndRotate();
                const tId = `imp_${importYear}_${mCode || 'ann'}_${member.uid}`;
                batches[batches.length - 1].set(doc(db, 'transactions', tId), {
                  type: 'INCOME', category: 'CUOTAS', amount: val,
                  description: `Importe ${header} ${importYear} - ${member.name}`,
                  date: `${importYear}-${mCode || '01'}-01`,
                  timestamp: new Date().toISOString(),
                  userId: member.uid, imported: true
                }, { merge: true });
                batchOperationCount++;
              }
            }
          });

          if (memberTotalPaid > 0) {
            checkBatchAndRotate();
            const updates: any = { status: 'ACTIVO', debt: 0, updatedAt: new Date().toISOString() };
            if (lastMonth && (!member.lastPaymentMonth || lastMonth > member.lastPaymentMonth)) {
              updates.lastPaymentMonth = lastMonth;
            }
            batches[batches.length - 1].update(doc(db, 'socios', member.uid), updates);
            batchOperationCount++;
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        await Promise.all(batches.map(b => b.commit()));
        toast.success(`Carga completada: ${updatedCount} socios actualizados.`);
      } else {
        toast.warning("No se encontraron coincidencias en la lista.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar la planilla.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const computedMembers = React.useMemo(() => {
    return members.map(m => {
      const calc = getMemberCalculatedData(m, payments);
      return {
        ...m,
        status: calc.status,
        debt: calc.debt,
        lastPaymentMonth: calc.lastPaymentMonth || m.lastPaymentMonth
      };
    });
  }, [members, payments]);

  const filteredMembers = computedMembers.filter(m => 
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-w-0 overflow-hidden text-coffee">
      <main className="px-6 py-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-coffee tracking-tight">Finanzas</h2>
            <p className="text-sm text-light-coffee font-medium">Gestión económica y control de membresías.</p>
          </div>

          <div className="flex bg-surface-container rounded-2xl p-1.5 border border-outline-variant/30">
            <button 
              onClick={() => setActiveTab('GENERAL')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all ${
                activeTab === 'GENERAL' ? 'bg-white shadow-sm text-primary' : 'text-light-coffee hover:text-coffee'
              }`}
            >
              RESUMEN GENERAL
            </button>
            <button 
              onClick={() => setActiveTab('FEES')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all ${
                activeTab === 'FEES' ? 'bg-white shadow-sm text-primary' : 'text-light-coffee hover:text-coffee'
              }`}
            >
              CUOTAS
            </button>
            {isBoard && (
              <button 
                onClick={() => setActiveTab('EXPENSES')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all ${
                  activeTab === 'EXPENSES' ? 'bg-white shadow-sm text-primary' : 'text-light-coffee hover:text-coffee'
                }`}
              >
                GASTOS
              </button>
            )}
          </div>
        </header>

        {activeTab === 'GENERAL' ? (
          <>
            {/* Core Summary Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary text-white p-8 rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group"
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Ingresos Reales</span>
                    <TrendingUp size={24} className="opacity-40" />
                  </div>
                  <div>
                    <p className="text-4xl font-black">${realTimeSummary.totalIncome.toLocaleString()}</p>
                    <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest">Ejecutado {selectedYear}</p>
                  </div>
                </div>
                <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full group-hover:scale-125 transition-transform duration-1000" />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-8 rounded-[2.5rem] border border-outline-variant/30 shadow-soft"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-black text-light-coffee uppercase tracking-widest">Gastos Ejecutados</span>
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                    <TrendingDown size={24} />
                  </div>
                </div>
                <p className="text-4xl font-black text-coffee">${realTimeSummary.totalExpenses.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-light-coffee mt-1 uppercase tracking-widest">Egresos operativos</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group ${realTimeSummary.balance >= 0 ? 'bg-coffee text-white' : 'bg-red-600 text-white'}`}
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo en Caja</span>
                    <DollarSign size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-4xl font-black">${realTimeSummary.balance.toLocaleString()}</p>
                    <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest">Balance actual</p>
                  </div>
                </div>
              </motion.div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-[2.5rem] border border-outline-variant/30 shadow-soft"
              >
                <h3 className="text-lg font-black text-coffee mb-6 flex items-center gap-2">
                  <BarChart className="text-primary" size={20} />
                  Comparativa Histórica
                </h3>
                <div className="h-[300px]">
                  <Bar data={historicalChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-[2.5rem] border border-outline-variant/30 shadow-soft"
              >
                <h3 className="text-lg font-black text-coffee mb-6 flex items-center gap-2">
                  <PieChart className="text-primary" size={20} />
                  Distribución de Gastos {selectedYear}
                </h3>
                <div className="h-[300px]">
                   <Doughnut data={categoryChartData} options={{ 
                     responsive: true, 
                     maintainAspectRatio: false,
                     plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } } }
                   }} />
                </div>
              </motion.div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Income Table */}
              <div className="lg:col-span-12">
                <div className="bg-white rounded-[2.5rem] border border-outline-variant/30 shadow-soft overflow-hidden">
                  <div className="p-4 sm:p-8 border-b border-outline-variant/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <h3 className="text-xl font-bold text-coffee flex items-center gap-2">
                       <PieChart className="text-primary" size={20} />
                       Historial de Transacciones {selectedYear}
                    </h3>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                      <div className="relative w-full sm:w-auto">
                        <select 
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value as Year)}
                          className="w-full sm:w-auto appearance-none bg-surface border border-outline-variant/30 rounded-xl px-6 py-2.5 pr-12 text-xs font-black text-coffee tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                          {years.map(y => (
                            <option key={y} value={y}>FILTRAR: {y}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none" size={16} />
                      </div>
                      {isFinanceAdmin && (
                        <button 
                          onClick={() => setShowExpenseModal(true)}
                          className="w-full sm:w-auto justify-center px-6 py-2.5 bg-red-500 text-white rounded-xl text-xs font-black tracking-widest shadow-md flex items-center gap-2 hover:bg-red-600 transition-all"
                        >
                          <Plus size={16} /> REGISTRAR GASTO
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-surface text-[10px] font-bold text-light-coffee uppercase tracking-widest">
                          <th className="px-8 py-6">Fecha</th>
                          <th className="px-8 py-6">Concepto</th>
                          <th className="px-8 py-6">Categoría</th>
                          <th className="px-8 py-6 text-right">Monto</th>
                          {isBoard && <th className="px-8 py-6 text-center">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 font-medium">
                        {[...realTimeSummary.incomeList, ...realTimeSummary.expenseList]
                          .sort((a: any, b: any) => {
                            const dateA = a.date || `${selectedYear}-01-01`;
                            const dateB = b.date || `${selectedYear}-01-01`;
                            return dateB.localeCompare(dateA);
                          })
                          .map((item, i) => (
                          <tr key={i} className="hover:bg-surface transition-colors group">
                            <td className="px-8 py-6 text-xs text-light-coffee">{item.date || `${selectedYear}-??-??`}</td>
                            <td className="px-8 py-6">
                              <p className="text-sm font-bold text-coffee group-hover:text-primary transition-colors">{item.description}</p>
                            </td>
                            <td className="px-8 py-6">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase ${
                                item.type === 'INCOME' ? 'bg-primary/5 text-primary border-primary/10' : 'bg-red-50 text-red-500 border-red-100'
                              }`}>
                                {item.category}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <p className={`text-sm font-black ${item.type === 'INCOME' ? 'text-primary' : 'text-red-500'}`}>
                                {item.type === 'INCOME' ? '+' : '-'}${item.amount.toLocaleString()}
                              </p>
                            </td>
                            {isBoard && (
                              <td className="px-8 py-6 text-center">
                                {item.id && !item.id.startsWith('summary_') ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleStartEdit(item)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all"
                                      title="Editar transacción"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(item.id)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all"
                                      title="Borrar transacción"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-light-coffee/40 italic font-mono">Histórico</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* FEE MANAGEMENT TAB */
          <div className="space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-outline-variant/30 text-center space-y-2">
                <p className="text-[10px] font-black text-light-coffee uppercase tracking-widest font-mono">Total Socios</p>
                <p className="text-3xl font-black text-coffee">{computedMembers.length}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-3xl border border-green-100 text-center space-y-2">
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest font-mono">Al Día</p>
                <p className="text-3xl font-black text-green-700">{computedMembers.filter(m => m.status === 'ACTIVO').length}</p>
              </div>
              <div className="bg-red-50 p-6 rounded-3xl border border-red-100 text-center space-y-2">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest font-mono">Morosos</p>
                <p className="text-3xl font-black text-red-700">{computedMembers.filter(m => m.status === 'MOROSO').length}</p>
              </div>
              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/20 text-center space-y-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest font-mono">Deuda Total</p>
                <p className="text-3xl font-black text-primary">${computedMembers.reduce((acc, m) => acc + (m.debt || 0), 0).toLocaleString()}</p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Member List */}
              <div className="lg:col-span-8 space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110" size={20} />
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-white border border-outline-variant/30 rounded-2xl shadow-soft font-bold text-coffee outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:font-medium"
                    placeholder="Buscar socio por nombre o RUT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="bg-white rounded-[2.5rem] border border-outline-variant/30 shadow-soft overflow-hidden">
                  <div className="p-8 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
                    <h3 className="text-lg font-black text-coffee uppercase tracking-tight">Listado de Socios y Deudas</h3>
                    {isBoard && (
                      <button 
                        onClick={() => setShowQuotaImportModal(true)}
                        className="text-[10px] font-black text-primary px-4 py-2 border border-primary/20 rounded-xl hover:bg-primary/5 transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> IMPORTAR PLANILLA PAGOS
                      </button>
                    )}
                  </div>
                  
                  {loading ? (
                    <div className="p-8 space-y-4">
                      {[1, 2, 3, 4, 5].map(i => <div key={i}><Skeleton className="h-16 w-full" /></div>)}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-surface text-[9px] font-black text-light-coffee uppercase tracking-[0.2em] border-b border-outline-variant/10">
                            <th className="px-8 py-5">Socio</th>
                            <th className="px-8 py-5">Modalidad</th>
                            <th className="px-8 py-5">Estado</th>
                            <th className="px-8 py-5 text-right">Deuda Pendiente</th>
                            <th className="px-8 py-5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                          {filteredMembers.map((member) => (
                            <tr key={member.uid} className="hover:bg-surface/50 transition-colors group">
                              <td className="px-8 py-5">
                                <div>
                                  <p className="text-sm font-black text-coffee uppercase">{member.name}</p>
                                  <p className="text-[9px] font-bold text-light-coffee uppercase tracking-widest">
                                    {member.lastPaymentMonth ? `Último pago: ${member.lastPaymentMonth}` : 'Sin pagos registrados'}
                                  </p>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`text-[10px] font-black px-2 py-1 rounded border cursor-pointer hover:brightness-95 transition-all ${
                                  member.paymentModality === 'ANUAL' 
                                  ? 'bg-purple-50 text-purple-600 border-purple-100' 
                                  : 'bg-blue-50 text-blue-600 border-blue-100'
                                }`}
                                onClick={() => viewMemberDetails(member)}
                                title="Ver historial detallado"
                                >
                                  {member.paymentModality || 'MENSUAL'}
                                </span>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-2">
                                  {member.status === 'ACTIVO' ? (
                                    <CheckCircle2 size={16} className="text-green-500" />
                                  ) : (
                                    <AlertCircle size={16} className="text-red-500" />
                                  )}
                                  <span className={`text-[10px] font-black ${
                                    member.status === 'ACTIVO' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {member.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <p className={`text-sm font-black ${member.debt > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                  ${(member.debt || 0).toLocaleString()}
                                </p>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {isBoard && (
                                    <>
                                      <button 
                                        onClick={() => {
                                          setSelectedMember(member);
                                          setPaymentForm({
                                            ...paymentForm,
                                            amount: member.paymentModality === 'ANUAL' ? 30000 : 3000,
                                            type: member.paymentModality || 'MENSUAL',
                                            period: member.paymentModality === 'ANUAL' ? '2026' : new Date().toISOString().slice(0, 7)
                                          });
                                          setShowPaymentModal(true);
                                        }}
                                        className="bg-primary/10 text-primary p-3 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                                        title="Registrar Pago"
                                      >
                                        <CreditCard size={18} />
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    onClick={() => {
                                      if (member.phone) {
                                        const cleanPhone = member.phone.replace(/\D/g, '');
                                        window.open(`https://wa.me/${cleanPhone.startsWith('56') ? cleanPhone : '56' + cleanPhone}`, '_blank');
                                      } else {
                                        toast.error("No hay teléfono registrado");
                                      }
                                    }}
                                    className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                    title="Contactar WhatsApp"
                                  >
                                    <MessageCircle size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Payments */}
              <div className="lg:col-span-4">
                <div className="bg-white rounded-[2.5rem] border border-outline-variant/30 shadow-soft overflow-hidden">
                  <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between">
                    <h3 className="text-md font-black text-coffee uppercase tracking-tight flex items-center gap-2">
                      <History size={18} className="text-primary" />
                      Historial Reciente
                    </h3>
                  </div>
                  <div className="p-2 h-[600px] overflow-y-auto space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="p-4 rounded-3xl bg-surface border border-outline-variant/10 flex flex-col gap-2 hover:border-primary/20 transition-all relative group">
                        <div className="flex justify-between items-start">
                          <p className="text-[11px] font-black text-coffee uppercase line-clamp-1 pr-6">{p.userName}</p>
                          <span className="text-[10px] font-black text-primary font-mono">${p.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[9px] font-bold text-light-coffee uppercase tracking-widest">{p.period}</p>
                            <p className="text-[8px] font-medium text-light-coffee/60 italic">{p.type}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-light-coffee">{p.date}</span>
                            {isBoard && (
                              <button
                                onClick={() => handleDeletePayment(p)}
                                disabled={isSubmitting}
                                className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all"
                                title="Eliminar este pago"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {payments.length === 0 && (
                      <div className="p-10 text-center opacity-40">
                         <p className="text-xs font-bold">No hay pagos registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Expense Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowExpenseModal(false)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md p-8 rounded-[3rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">Registrar Gasto</h3>
                   <p className="text-xs font-bold text-red-500 uppercase tracking-widest pl-1">Egreso de Caja</p>
                </div>
                <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleRecordExpense} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">Monto del Gasto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-red-500" size={20} />
                    <input 
                      type="number"
                      required
                      className="w-full pl-12 pr-6 py-4 bg-red-50/50 border border-red-200 rounded-2xl outline-none font-black text-xl text-red-600"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({...expenseForm, amount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Descripción / Concepto</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Pago de luz sede, Materiales ferias..."
                    className="w-full px-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Fecha</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Categoría</label>
                    <select 
                      className="w-full px-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-[10px] appearance-none"
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                    >
                      <option value="GASTOS OPERATIVOS">OPERATIVOS</option>
                      <option value="SERVICIOS BÁSICOS">SERVICIOS</option>
                      <option value="EVENTOS">EVENTOS</option>
                      <option value="MARKETING">MARKETING</option>
                      <option value="OTROS">OTROS</option>
                    </select>
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full bg-red-500 text-white py-5 rounded-[2rem] font-black tracking-widest shadow-xl shadow-red-200 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'REGISTRAR GASTO'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setEditingTransaction(null)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md p-8 rounded-[3rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">Editar Transacción</h3>
                   <p className="text-xs font-bold text-primary uppercase tracking-widest pl-1">
                     {editingTransaction.type === 'INCOME' ? 'Ingreso de Caja' : 'Egreso de Caja'}
                   </p>
                </div>
                <button onClick={() => setEditingTransaction(null)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleUpdateTransaction} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Monto ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={20} />
                    <input 
                      type="number"
                      required
                      className="w-full pl-12 pr-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-black text-xl text-primary"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({...editForm, amount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Concepto / Descripción</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Fecha</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm"
                      value={editForm.date}
                      onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Categoría</label>
                    {editingTransaction.type === 'INCOME' ? (
                      <select 
                        className="w-full px-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-[10px] appearance-none"
                        value={editForm.category}
                        onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                      >
                        <option value="CUOTAS">CUOTAS</option>
                        <option value="DONACIONES">DONACIONES</option>
                        <option value="EVENTOS">EVENTOS</option>
                        <option value="OTROS">OTROS</option>
                      </select>
                    ) : (
                      <select 
                        className="w-full px-4 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-[10px] appearance-none"
                        value={editForm.category}
                        onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                      >
                        <option value="GASTOS OPERATIVOS">OPERATIVOS</option>
                        <option value="SERVICIOS BÁSICOS">SERVICIOS</option>
                        <option value="EVENTOS">EVENTOS</option>
                        <option value="MARKETING">MARKETING</option>
                        <option value="OTROS">OTROS</option>
                      </select>
                    )}
                  </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-5 rounded-[2rem] font-black tracking-widest shadow-xl shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'ACTUALIZAR TRANSACCIÓN'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Manager Modal (Manual Entry) */}
      <AnimatePresence>
        {showHistoryManager && selectedMember && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowHistoryManager(false)}
              className="absolute inset-0 bg-coffee/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-3xl p-10 rounded-[3rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">Ajustar Historial: {selectedMember.name}</h3>
                   <p className="text-xs font-bold text-primary uppercase tracking-widest">Carga Manual de Cuotas Pasadas</p>
                </div>
                <button 
                  onClick={() => setShowHistoryManager(false)} 
                  disabled={isSubmitting}
                  className="p-2 hover:bg-surface rounded-xl transition-colors"
                >
                  <X />
                </button>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-6 p-6 bg-surface rounded-[2rem] border border-outline-variant/30">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Seleccionar Año:</p>
                  <div className="flex gap-2">
                    {["2023", "2024", "2025"].map(year => (
                      <button
                        key={year}
                        onClick={() => {
                          setHistoryYear(year);
                          setSelectedMonthHistory([]);
                        }}
                        className={`px-6 py-3 rounded-xl text-[11px] font-black transition-all ${
                          historyYear === year 
                            ? "bg-primary text-white shadow-lg shadow-primary/20" 
                            : "bg-white border border-outline-variant/30 text-light-coffee hover:bg-primary/5"
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <header className="flex justify-between items-end">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Matriz de Meses {historyYear}</p>
                    <p className="text-[9px] font-bold text-light-coffee italic">Haz clic en los meses que ya pagó</p>
                  </header>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {MONTHS.map(month => {
                      const period = `${historyYear}-${month.id}`;
                      const isSelected = selectedMonthHistory.includes(period);
                      return (
                        <button
                          key={month.id}
                          onClick={() => handleToggleHistoryMonth(month.id)}
                          className={`group relative p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 overflow-hidden ${
                            isSelected 
                              ? "bg-primary/5 border-primary shadow-inner" 
                              : "bg-surface border-transparent hover:border-primary/20"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isSelected ? "bg-primary text-white" : "bg-outline-variant/20 text-light-coffee"
                          }`}>
                            {isSelected ? <Check size={14} strokeWidth={3} /> : <Calendar size={14} />}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-tight transition-all ${
                            isSelected ? "text-primary" : "text-light-coffee"
                          }`}>
                            {month.name}
                          </span>
                          {isSelected && (
                            <div className="absolute top-0 right-0 p-1">
                              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl">
                      <AlertCircle className="text-primary" size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-coffee uppercase">Resumen de Carga</p>
                      <p className="text-[11px] font-medium text-light-coffee">
                        Registrarás <span className="font-bold text-primary">{selectedMonthHistory.length} cuotas</span> a $3.000 c/u para el año {historyYear}.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-light-coffee uppercase">Total a Registrar</p>
                    <p className="text-lg font-black text-primary">${(selectedMonthHistory.length * 3000).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowHistoryManager(false)}
                    disabled={isSubmitting}
                    className="flex-1 px-8 py-5 rounded-[2rem] border border-outline-variant/30 text-[11px] font-black tracking-widest hover:bg-surface transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={() => handleSaveMemberHistory(true)}
                    disabled={isSubmitting}
                    className="flex-1 bg-coffee text-white px-8 py-5 rounded-[2rem] text-[11px] font-black tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    PAGO ANUAL ($30.000)
                  </button>
                  <button 
                    onClick={() => handleSaveMemberHistory(false)}
                    disabled={isSubmitting || selectedMonthHistory.length === 0}
                    className="flex-[2] bg-primary text-white px-8 py-5 rounded-[2rem] text-[11px] font-black tracking-widest shadow-xl shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'GUARDAR MESES SELECCIONADOS'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quota Import Modal */}
      <AnimatePresence>
        {showQuotaImportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowQuotaImportModal(false)}
              className="absolute inset-0 bg-coffee/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl p-10 rounded-[3rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">Importar Planilla de Cuotas</h3>
                   <p className="text-xs font-bold text-primary uppercase tracking-widest">Sincronización Masiva de Pagos Históricos</p>
                </div>
                <button onClick={() => setShowQuotaImportModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-coffee flex items-center gap-2">
                      <AlertCircle size={14} className="text-primary" /> Paso 1: Selecciona el Año
                    </p>
                    <select 
                      value={importYear}
                      onChange={(e) => setImportYear(e.target.value)}
                      className="bg-white border border-outline-variant/30 rounded-xl px-4 py-2 text-xs font-black text-primary outline-none"
                    >
                      <option value="2025">Año 2025</option>
                      <option value="2024">Año 2024</option>
                      <option value="2023">Año 2023</option>
                      <option value="2022">Año 2022</option>
                    </select>
                  </div>
                  <ul className="text-[11px] font-medium text-light-coffee/80 list-disc pl-5 space-y-1">
                    <li>Copia y pega el contenido de tu Excel (CSV) en el recuadro inferior.</li>
                    <li>Asegúrate de que la primera fila contenga los meses (Enero, Febrero, etc).</li>
                    <li>El sistema vinculará los pagos al año seleccionado arriba.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Contenido CSV / Texto</label>
                  <textarea 
                    className="w-full h-48 px-6 py-4 bg-surface border border-outline-variant/30 rounded-3xl outline-none font-mono text-[10px] resize-none"
                    placeholder=",SOCIO,ENERO,FEBRERO,MARZO,ABRIL,MAYO..."
                    value={quotaRawData}
                    onChange={(e) => setQuotaRawData(e.target.value)}
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowQuotaImportModal(false)}
                    className="flex-1 px-8 py-5 rounded-[2rem] border border-outline-variant/30 text-[11px] font-black tracking-widest hover:bg-surface transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={handleProcessQuotaSheet}
                    disabled={isSubmitting || !quotaRawData.trim()}
                    className="flex-[2] bg-primary text-white px-8 py-5 rounded-[2rem] text-[11px] font-black tracking-widest shadow-xl shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'PROCESAR Y ACTUALIZAR'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowPaymentModal(false)}
              className="absolute inset-0 bg-coffee/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md p-8 rounded-[3rem] shadow-2xl relative z-10"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">Registrar Pago</h3>
                   <p className="text-xs font-bold text-primary uppercase tracking-widest">{selectedMember.name}</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Concepto de Pago</label>
                  <select 
                    className="w-full px-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-black text-xs appearance-none cursor-pointer"
                    value={paymentForm.type}
                    onChange={(e) => {
                      const type = e.target.value as 'MENSUAL' | 'ANUAL';
                      setPaymentForm({
                        ...paymentForm, 
                        type,
                        amount: type === 'ANUAL' ? 30000 : 3000,
                        period: type === 'ANUAL' ? '2026' : new Date().toISOString().slice(0, 7)
                      });
                    }}
                  >
                    <option value="MENSUAL">Cuota Mensual ($3.000)</option>
                    <option value="ANUAL">Cuota Anual Completa ($30.000)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Período Correspondiente</label>
                  {paymentForm.type === 'ANUAL' ? (
                    <select
                      className="w-full h-14 px-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm cursor-pointer"
                      value={paymentForm.period}
                      onChange={(e) => setPaymentForm({...paymentForm, period: e.target.value})}
                    >
                      <option value="2026">Año 2026</option>
                      <option value="2025">Año 2025</option>
                      <option value="2024">Año 2024</option>
                      <option value="2023">Año 2023</option>
                    </select>
                  ) : (
                    <input 
                      type="month"
                      required
                      className="w-full px-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-bold text-sm h-14"
                      value={paymentForm.period}
                      onChange={(e) => setPaymentForm({...paymentForm, period: e.target.value})}
                    />
                  )}
                  <p className="text-[9px] text-light-coffee/60 font-medium px-2 italic">Indica el mes o año que se está cancelando.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Monto a Registrar</label>
                  <div className="relative">
                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-primary" size={20} />
                    <input 
                      type="number"
                      required
                      className="w-full pl-12 pr-6 py-4 bg-surface border border-outline-variant/30 rounded-2xl outline-none font-black text-xl text-primary"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({...paymentForm, amount: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/20 space-y-1">
                   <div className="flex justify-between items-center text-[10px] font-bold text-coffee/60">
                      <span>Deuda Actual</span>
                      <span>${(selectedMember.debt || 0).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs font-black text-primary">
                      <span>Nuevo Saldo</span>
                      <span>${Math.max(0, (selectedMember.debt || 0) - paymentForm.amount).toLocaleString()}</span>
                   </div>
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-5 rounded-[2rem] font-black tracking-widest shadow-xl shadow-primary/30 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      PROCESANDO...
                    </>
                  ) : 'CONFIRMAR PAGO'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Detail History Modal */}
      <AnimatePresence>
        {showMemberDetailModal && selectedMember && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowMemberDetailModal(false)}
              className="absolute inset-0 bg-coffee/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl p-8 rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-coffee">{selectedMember.name}</h3>
                   <p className="text-xs font-bold text-primary uppercase tracking-widest">Historial Individual de Pagos</p>
                </div>
                <button onClick={() => setShowMemberDetailModal(false)} className="p-2 hover:bg-surface rounded-xl transition-colors">
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                {loadingHistory ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                ) : memberHistory.length === 0 ? (
                  <div className="p-10 text-center opacity-50 space-y-4">
                    <History size={48} className="mx-auto" />
                    <p className="font-bold">No se encontraron pagos registrados para este socio.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberHistory
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((t, idx) => (
                      <div key={idx} className="p-5 bg-surface rounded-2xl border border-outline-variant/20 flex justify-between items-center group hover:border-primary transition-all">
                        <div>
                          <p className="text-sm font-black text-coffee">{t.description}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-light-coffee flex items-center gap-1">
                              <Calendar size={10} /> {t.date}
                            </span>
                            <span className="text-[10px] font-bold text-light-coffee flex items-center gap-1">
                              <CheckCircle2 size={10} className="text-green-500" /> Confirmado
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">${t.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-outline-variant/30 flex justify-end">
                <button 
                  onClick={() => setShowMemberDetailModal(false)}
                  className="px-8 py-4 bg-surface text-coffee font-black text-xs tracking-widest rounded-2xl hover:bg-surface-container transition-all"
                >
                  CERRAR HISTORIAL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
