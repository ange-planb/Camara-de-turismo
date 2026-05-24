export interface Member {
  uid?: string;
  id?: string;
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

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string;
  period: string; // "2026-05" or "2026"
  type: 'MENSUAL' | 'ANUAL';
  recordedBy?: string;
  createdAt: string;
}

export function getMemberCalculatedData(m: any, paymentsList: any[]) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear(); // 2026
  const currentMonth = currentDate.getMonth() + 1; // 5 (May)

  const uid = m.uid || m.id;

  // President (User 'PlanB Angélica Bustos' or role 'PRESIDENTA') is always up to date
  if (m.role === 'PRESIDENTA') {
    return {
      status: 'ACTIVO',
      debt: 0,
      lastPaymentMonth: `${currentYear}-12`
    };
  }

  const isAnnual = m.paymentModality === 'ANUAL';

  if (isAnnual) {
    // Check if there is an annual payment in the current year
    const hasCurrentYearAnnualPayment = paymentsList.some(p => 
      p.userId === uid && 
      (p.period === `${currentYear}` || p.period?.startsWith(`${currentYear}`) || p.date?.startsWith(`${currentYear}`)) &&
      p.amount >= 30000
    );

    if (hasCurrentYearAnnualPayment) {
      return {
        status: 'ACTIVO',
        debt: 0,
        lastPaymentMonth: `${currentYear}-12`
      };
    } else {
      return {
        status: 'MOROSO',
        debt: 30000,
        lastPaymentMonth: m.lastPaymentMonth || '2025-12'
      };
    }
  } else {
    // Monthly modality
    // Find all monthly payments for the current year
    const paymentsForCurrentYear = paymentsList.filter(p => 
      p.userId === uid && 
      p.period?.startsWith(`${currentYear}-`)
    );

    // Collect paid months as short numbers (e.g., 1, 2, 3...)
    const paidMonths = new Set<number>();
    paymentsForCurrentYear.forEach(p => {
      const match = p.period?.match(/-(\d{2})$/);
      if (match) {
        paidMonths.add(parseInt(match[1]));
      }
    });

    // Alternatively, check lastPaymentMonth if it contains the current year
    if (m.lastPaymentMonth && m.lastPaymentMonth.startsWith(`${currentYear}-`)) {
      const lastMonthNum = parseInt(m.lastPaymentMonth.split('-')[1]);
      for (let i = 1; i <= lastMonthNum; i++) {
        paidMonths.add(i);
      }
    }

    // Since we are in the current month (e.g. 5 for May 2026),
    // let's check how many months from Jan (1) to currentMonth (5) are NOT paid
    let unpaidMonthsCount = 0;
    for (let mIndex = 1; mIndex <= currentMonth; mIndex++) {
      if (!paidMonths.has(mIndex)) {
        unpaidMonthsCount++;
      }
    }

    const calculatedDebt = unpaidMonthsCount * 3000;
    const calculatedStatus = calculatedDebt === 0 ? 'ACTIVO' : 'MOROSO';

    // Compute the last paid month description
    let displayLastPaymentMonth = m.lastPaymentMonth || 'Sin pagos';
    if (paidMonths.size > 0) {
      const maxPaidMonth = Math.max(...Array.from(paidMonths));
      const padMonth = maxPaidMonth.toString().padStart(2, '0');
      displayLastPaymentMonth = `${currentYear}-${padMonth}`;
    }

    return {
      status: calculatedStatus,
      debt: calculatedDebt,
      lastPaymentMonth: displayLastPaymentMonth
    };
  }
}
