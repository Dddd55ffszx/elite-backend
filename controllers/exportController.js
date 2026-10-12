const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const Apartment = require('../models/Apartment');
const Expense = require('../models/Expense');
const Commission = require('../models/Commission');
const X = require('../utils/excelStyle');

// Money actually collected for one apartment (same rules used everywhere else in the app)
function paidForApartment(apt) {
  if (!apt.isSold) return 0;
  const soldPrice = apt.soldPrice || apt.price || 0;
  const paidPayments = (apt.payments || []).filter((p) => p.isPaid);
  const sumPaid = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);
  if (apt.paymentType === 'cash' && (apt.payments || []).length === 0) {
    // plain cash sale with no payment history => paid in full at time of sale
    return soldPrice;
  }
  return sumPaid;
}

exports.exportProjectToExcel = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apartments = await Apartment.find({ project: projectId }).sort({ apartmentId: 1 });
    const expenses = await Expense.find({ project: projectId }).sort({ date: -1 });
    const commissions = await Commission.find({ project: projectId }).sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Elite For Contracting';
    workbook.created = new Date();
    workbook.modified = new Date();

    const generatedOn = `Generated on ${new Date().toLocaleDateString('en-GB')}`;
    const bannerLines = (extra) => [`Project: ${project.name}${project.location ? '  |  ' + project.location : ''}`, extra, generatedOn];

    // ---------------------------------------------------------------- calculations
    const totalApartments = apartments.length;
    const soldApartments = apartments.filter((a) => a.isSold).length;
    const availableApartments = totalApartments - soldApartments;
    const cashSold = apartments.filter((a) => a.isSold && a.paymentType === 'cash').length;
    const installmentSold = apartments.filter((a) => a.isSold && a.paymentType === 'installments').length;

    const actualSales = apartments.reduce((s, a) => s + (a.price || 0), 0); // "Actual Sales" card
    let realisedSales = 0;
    let totalRemaining = 0;
    apartments.forEach((apt) => {
      if (!apt.isSold) return;
      const soldPrice = apt.soldPrice || apt.price || 0;
      const paid = paidForApartment(apt);
      realisedSales += paid;
      totalRemaining += soldPrice - paid;
    });

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalCommissions = commissions.reduce((s, c) => s + (c.amount || 0), 0);
    const totalCosts = totalExpenses + totalCommissions;

    const actualProfit = actualSales - totalCosts;
    const realisedProfit = realisedSales - totalCosts;
    const actualProfitPct = actualSales > 0 ? actualProfit / actualSales : 0;
    const realisedProfitPct = realisedSales > 0 ? realisedProfit / realisedSales : 0;

    // =====================================================================
    // 1) SUMMARY
    // =====================================================================
    const sum = X.createSheet(workbook, 'Project Summary', { tabColor: X.COLORS.navy, landscape: false });
    X.setWidths(sum, [38, 28, 4]);
    let r = X.addBanner(sum, 2, 'Project Summary Report', bannerLines(null));

    r = X.addSection(sum, r, 2, 'Project Information');
    r = X.addKeyValue(sum, r, [
      { label: 'Project Name', value: project.name, bold: true },
      { label: 'Location', value: project.location || 'Not specified', bold: false },
      { label: 'Start Date', value: project.startDate ? new Date(project.startDate) : null, type: project.startDate ? 'date' : 'text', bold: false },
      { label: 'End Date', value: project.endDate ? new Date(project.endDate) : null, type: project.endDate ? 'date' : 'text', bold: false },
      { label: 'Expected Profit %', value: (Number(project.expectedProfitPercent) || 0) / 100, type: 'percent', bold: false },
      { label: 'Created', value: project.createdAt, type: 'date', bold: false },
      { label: 'Last Updated', value: project.updatedAt, type: 'date', bold: false },
    ]);

    r = X.addSection(sum, r, 2, 'Apartments');
    r = X.addKeyValue(sum, r, [
      { label: 'Total Apartments', value: totalApartments, type: 'int' },
      { label: 'Sold', value: soldApartments, type: 'int', bold: false },
      { label: 'Available', value: availableApartments, type: 'int', bold: false },
      { label: 'Sold - Cash', value: cashSold, type: 'int', bold: false },
      { label: 'Sold - Installments', value: installmentSold, type: 'int', bold: false },
    ]);

    r = X.addSection(sum, r, 2, 'Financials (EGP)');
    r = X.addKeyValue(sum, r, [
      { label: 'Actual Sales (sum of apartment prices)', value: actualSales, type: 'money' },
      { label: 'Realised Sales (payments received)', value: realisedSales, type: 'money' },
      { label: 'Remaining To Collect', value: totalRemaining, type: 'money', bold: false },
      { label: 'Total Expenses', value: totalExpenses, type: 'money', tone: 'bad' },
      { label: 'Total Commissions', value: totalCommissions, type: 'money', tone: 'purple' },
      { label: 'Total Costs (Expenses + Commissions)', value: totalCosts, type: 'money', bold: false },
    ]);

    r = X.addSection(sum, r, 2, 'Profit');
    r = X.addKeyValue(sum, r, [
      { label: 'Actual Profit', value: actualProfit, type: 'money', autoTone: true },
      { label: 'Actual Profit %', value: actualProfitPct, type: 'percent', autoTone: true },
      { label: 'Realised Profit', value: realisedProfit, type: 'money', autoTone: true },
      { label: 'Realised Profit %', value: realisedProfitPct, type: 'percent', autoTone: true },
    ]);

    // =====================================================================
    // 2) APARTMENTS
    // =====================================================================
    const aptSheet = X.createSheet(workbook, 'Apartments', { tabColor: 'FF2563EB' });
    const aptCols = [
      { header: 'Apartment', key: 'apartmentId', width: 13, type: 'text' },
      { header: 'Floor', key: 'floor', width: 9, type: 'text' },
      { header: 'Size (m²)', key: 'size', width: 11, type: 'int' },
      { header: 'Status', key: 'status', width: 13, type: 'text' },
      { header: 'Payment Type', key: 'paymentType', width: 15, type: 'text' },
      { header: 'Client Name', key: 'clientName', width: 24, type: 'text' },
      { header: 'Client Phone', key: 'clientPhone', width: 16, type: 'text' },
      { header: 'National ID', key: 'nationalId', width: 18, type: 'text' },
      { header: 'List Price (EGP)', key: 'price', width: 18, type: 'money' },
      { header: 'Sold Price (EGP)', key: 'soldPrice', width: 18, type: 'money' },
      { header: 'Total Paid (EGP)', key: 'paid', width: 18, type: 'money' },
      { header: 'Remaining (EGP)', key: 'remaining', width: 18, type: 'money' },
      { header: 'Paid %', key: 'paidPct', width: 10, type: 'percent' },
    ];
    X.setWidths(aptSheet, aptCols.map((c) => c.width));
    let ar = X.addBanner(aptSheet, aptCols.length, 'Apartments', bannerLines(`${totalApartments} apartments  |  ${soldApartments} sold  |  ${availableApartments} available`));
    const aptRows = apartments.map((apt) => {
      const soldPrice = apt.soldPrice || apt.price || 0;
      const paid = paidForApartment(apt);
      return {
        apartmentId: apt.apartmentId || apt._id.toString().slice(-6),
        floor: apt.floor || '',
        size: apt.size || '',
        status: apt.isSold ? 'Sold' : 'Available',
        paymentType: apt.isSold ? (apt.paymentType === 'cash' ? 'Cash' : 'Installments') : '',
        clientName: apt.client?.name || '',
        clientPhone: apt.client?.phone || '',
        nationalId: apt.client?.nationalId || '',
        price: apt.price || 0,
        soldPrice: apt.isSold ? soldPrice : '',
        paid: apt.isSold ? paid : '',
        remaining: apt.isSold ? soldPrice - paid : '',
        paidPct: apt.isSold && soldPrice > 0 ? paid / soldPrice : '',
      };
    });
    X.addTable(aptSheet, ar, aptCols, aptRows, {
      totals: ['price', 'soldPrice', 'paid', 'remaining'],
      cellStyle: (row, col, cell) => {
        if (col.key === 'status') X.statusStyle(cell, row.status === 'Sold' ? 'good' : 'warn');
      },
    });

    // =====================================================================
    // 3) EXPENSES
    // =====================================================================
    const expSheet = X.createSheet(workbook, 'Expenses', { tabColor: 'FFDC2626', landscape: false });
    const expCols = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reason', key: 'reason', width: 55, type: 'text' },
      { header: 'Amount (EGP)', key: 'amount', width: 20, type: 'money' },
    ];
    X.setWidths(expSheet, expCols.map((c) => c.width));
    const er = X.addBanner(expSheet, expCols.length, 'Project Expenses', bannerLines(`${expenses.length} expense record${expenses.length === 1 ? '' : 's'}`));
    X.addTable(expSheet, er, expCols, expenses.map((e) => ({ date: e.date, reason: e.reason || 'No reason provided', amount: e.amount || 0 })), {
      totals: ['amount'],
      emptyText: 'No expenses recorded',
    });

    // =====================================================================
    // 4) COMMISSIONS
    // =====================================================================
    const commSheet = X.createSheet(workbook, 'Commissions', { tabColor: 'FF7C3AED', landscape: false });
    const commCols = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'For (Apartment / Project)', key: 'label', width: 40, type: 'text' },
      { header: 'Amount (EGP)', key: 'amount', width: 20, type: 'money' },
    ];
    X.setWidths(commSheet, commCols.map((c) => c.width));
    const cr = X.addBanner(commSheet, commCols.length, 'Commissions', bannerLines(`${commissions.length} commission record${commissions.length === 1 ? '' : 's'}`));
    X.addTable(commSheet, cr, commCols, commissions.map((c) => ({
      date: c.date,
      label: c.label === 'project' ? 'Project (general)' : `Apt ${c.label}`,
      amount: c.amount || 0,
    })), { totals: ['amount'], emptyText: 'No commissions recorded' });

    // =====================================================================
    // 5) PAYMENTS (one flat, filterable table of every instalment)
    // =====================================================================
    const paySheet = X.createSheet(workbook, 'Payments', { tabColor: 'FF16A34A' });
    const payCols = [
      { header: 'Apartment', key: 'apt', width: 13, type: 'text' },
      { header: 'Floor', key: 'floor', width: 9, type: 'text' },
      { header: 'Client', key: 'client', width: 26, type: 'text' },
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reason', key: 'reason', width: 30, type: 'text' },
      { header: 'Amount (EGP)', key: 'amount', width: 18, type: 'money' },
      { header: 'Status', key: 'status', width: 14, type: 'text' },
    ];
    X.setWidths(paySheet, payCols.map((c) => c.width));
    const payRows = [];
    apartments.forEach((apt) => {
      (apt.payments || []).forEach((p) => {
        payRows.push({
          apt: apt.apartmentId || apt._id.toString().slice(-6),
          floor: apt.floor || '',
          client: apt.client?.name || '',
          date: p.date,
          reason: p.reason || 'Installment Payment',
          amount: p.amount || 0,
          status: p.isPaid ? 'Paid' : 'Not paid',
        });
      });
    });
    payRows.sort((a, b) => String(a.apt).localeCompare(String(b.apt), undefined, { numeric: true }) || new Date(a.date) - new Date(b.date));
    const paidTotal = payRows.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
    const unpaidTotal = payRows.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.amount, 0);
    const pr = X.addBanner(paySheet, payCols.length, 'Payments & Instalments', bannerLines(`Paid: ${paidTotal.toLocaleString('en-US')} EGP  |  Not yet paid: ${unpaidTotal.toLocaleString('en-US')} EGP`));
    X.addTable(paySheet, pr, payCols, payRows, {
      totals: ['amount'],
      emptyText: 'No payment records found',
      cellStyle: (row, col, cell) => {
        if (col.key === 'status') X.statusStyle(cell, row.status === 'Paid' ? 'good' : 'bad');
      },
    });

    // =====================================================================
    // SEND
    // =====================================================================
    const filename = `${X.safeFileName(project.name)}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
};