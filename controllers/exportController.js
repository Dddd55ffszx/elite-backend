const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const Apartment = require('../models/Apartment');
const Expense = require('../models/Expense');
const Commission = require('../models/Commission'); // NEW

// Helper: adds a 2-row banner (project name + sheet name) to any worksheet.
function addSheetHeader(sheet, projectName, sheetLabel, totalColumns = 6) {
  const lastCol = String.fromCharCode(64 + totalColumns);

  sheet.mergeCells(`A1:${lastCol}1`);
  const projectCell = sheet.getCell('A1');
  projectCell.value = `\u{1F3D7}  ${projectName.toUpperCase()}`;
  projectCell.font   = { size: 14, bold: true, color: { argb: 'FFFFFF' } };
  projectCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2A3A' } };
  projectCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(`A2:${lastCol}2`);
  const labelCell = sheet.getCell('A2');
  labelCell.value = sheetLabel;
  labelCell.font   = { size: 12, bold: true, color: { argb: 'FF1A2A3A' } };
  labelCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4B504' } };
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 22;

  return 3;
}

exports.exportProjectToExcel = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apartments  = await Apartment.find({ project: projectId });
    const expenses    = await Expense.find({ project: projectId }).sort({ date: -1 });
    const commissions = await Commission.find({ project: projectId }).sort({ date: -1 }); // NEW

    const workbook = new ExcelJS.Workbook();
    workbook.creator  = 'Elite For Contracting';
    workbook.created  = new Date();
    workbook.modified = new Date();

    // =====================================================
    // SUMMARY SHEET
    // =====================================================
    const summarySheet = workbook.addWorksheet('Project Summary');
    addSheetHeader(summarySheet, project.name, '📋  Project Summary', 2);

    summarySheet.addRow([]);

    summarySheet.addRow(['📋 PROJECT INFORMATION']);
    summarySheet.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FFE4B504' } };

    const infoData = [
      ['Project Name:',       project.name],
      ['Location:',           project.location || 'Not specified'],
      ['Created Date:',       new Date(project.createdAt).toLocaleDateString('en-GB')],
      ['Last Updated:',       new Date(project.updatedAt).toLocaleDateString('en-GB')],
      ['Expected Profit %:',  project.expectedProfitPercent + '%']
    ];
    infoData.forEach((row, index) => {
      summarySheet.addRow(row);
      summarySheet.getCell(`A${index + 5}`).font = { bold: true };
    });

    // Calculations
    const totalApartments       = apartments.length;
    const soldApartments        = apartments.filter(a => a.isSold).length;
    const availableApartments   = totalApartments - soldApartments;
    const cashApartments        = apartments.filter(a => a.paymentType === 'cash' && a.isSold).length;
    const installmentApartments = apartments.filter(a => a.paymentType === 'installments' && a.isSold).length;
    const estimatedSales        = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    let actualSales    = 0;
    let totalPaid      = 0;
    let totalRemaining = 0;

    apartments.forEach(apt => {
      if (apt.isSold) {
        const soldPrice = apt.soldPrice || apt.price || 0;
        if (apt.paymentType === 'cash') {
          actualSales += soldPrice;
          totalPaid   += soldPrice;
        } else {
          const paidPayments = (apt.payments || []).filter(p => p.isPaid);
          const payments = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          actualSales    += payments;
          totalPaid      += payments;
          totalRemaining += soldPrice - payments;
        }
      }
    });

    const totalExpenses    = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    // NEW: total commissions
    const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalCosts       = totalExpenses + totalCommissions; // combined for profit calc

    const estimatedProfit        = estimatedSales - totalCosts;
    const actualProfit           = actualSales    - totalCosts;
    const estimatedProfitPercent = estimatedSales > 0 ? ((estimatedProfit / estimatedSales) * 100).toFixed(2) : 0;
    const actualProfitPercent    = actualSales    > 0 ? ((actualProfit    / actualSales)    * 100).toFixed(2) : 0;

    const statsHeaderRow = infoData.length + 5 + 1;
    summarySheet.addRow([]);
    summarySheet.addRow(['📊 PROJECT STATISTICS']);
    summarySheet.getCell(`A${statsHeaderRow}`).font = { bold: true, size: 14, color: { argb: 'FFE4B504' } };

    const statsData = [
      ['Total Apartments:',            totalApartments],
      ['Sold Apartments:',             soldApartments],
      ['Available Apartments:',        availableApartments],
      ['Cash Sales:',                  cashApartments],
      ['Installment Sales:',           installmentApartments],
      ['Actual Sales:',                estimatedSales.toLocaleString()  + ' EGP'],
      ['Realized Sales:',              actualSales.toLocaleString()     + ' EGP'],
      ['Total Expenses:',              totalExpenses.toLocaleString()   + ' EGP'],
      ['Total Commissions:',           totalCommissions.toLocaleString() + ' EGP'], // NEW
      ['Total Costs (Exp+Comm):',      totalCosts.toLocaleString()      + ' EGP'], // NEW
      ['Total Paid:',                  totalPaid.toLocaleString()       + ' EGP'],
      ['Total Remaining:',             totalRemaining.toLocaleString()  + ' EGP'],
      ['Actual Profit:',               estimatedProfit.toLocaleString() + ' EGP'],
      ['Realized Profit:',             actualProfit.toLocaleString()    + ' EGP'],
      ['Estimated Profit %:',          estimatedProfitPercent + '%'],
      ['Realized Profit %:',           actualProfitPercent    + '%']
    ];

    statsData.forEach((row, index) => {
      const rowNum = index + statsHeaderRow + 1;
      summarySheet.addRow(row);
      summarySheet.getCell(`A${rowNum}`).font = { bold: true };
      if (row[0].includes('Profit')) {
        const profitCell  = summarySheet.getCell(`B${rowNum}`);
        const profitValue = parseFloat(row[1]);
        if (profitValue > 0) profitCell.font = { color: { argb: 'FF00FF00' } };
        else if (profitValue < 0) profitCell.font = { color: { argb: 'FFFF0000' } };
      }
    });
    summarySheet.columns = [{ width: 25 }, { width: 30 }];

    // =====================================================
    // APARTMENTS SHEET
    // =====================================================
    const aptSheet = workbook.addWorksheet('Apartments');
    addSheetHeader(aptSheet, project.name, '🏢  Apartments', 14);

    aptSheet.columns = [
      { key: 'apartmentId',     width: 15 },
      { key: 'floor',           width: 10 },
      { key: 'size',            width: 12 },
      { key: 'price',           width: 18 },
      { key: 'soldPrice',       width: 18 },
      { key: 'status',          width: 12 },
      { key: 'paymentType',     width: 15 },
      { key: 'clientName',      width: 20 },
      { key: 'clientPhone',     width: 15 },
      { key: 'nationalId',      width: 18 },
      { key: 'totalPaid',       width: 18 },
      { key: 'remaining',       width: 18 },
      { key: 'paidPercent',     width: 12 },
      { key: 'remainingPercent',width: 15 }
    ];

    const aptHeaderRow = aptSheet.getRow(3);
    [
      'Apartment ID','Floor','Size (m²)','Price (EGP)','Sold Price (EGP)',
      'Status','Payment Type','Client Name','Client Phone','National ID',
      'Total Paid','Remaining','Paid %','Remaining %'
    ].forEach((h, i) => aptHeaderRow.getCell(i + 1).value = h);
    aptHeaderRow.eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2A3A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    aptHeaderRow.commit();

    apartments.forEach(apt => {
      const soldPrice         = apt.soldPrice || apt.price || 0;
      let totalPaidApartment  = 0;
      if (apt.isSold) {
        if (apt.paymentType === 'cash') {
          totalPaidApartment = soldPrice;
        } else {
          totalPaidApartment = (apt.payments || [])
            .filter(p => p.isPaid)
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        }
      }
      const remaining        = apt.isSold ? soldPrice - totalPaidApartment : 0;
      const paidPercent      = soldPrice > 0 ? ((totalPaidApartment / soldPrice) * 100).toFixed(1) : 0;
      const remainingPercent = soldPrice > 0 ? ((remaining          / soldPrice) * 100).toFixed(1) : 0;

      const row = aptSheet.addRow({
        apartmentId: apt.apartmentId || apt._id.toString().slice(-6),
        floor: apt.floor || '-', size: apt.size || '-',
        price: apt.price ? apt.price.toLocaleString() + ' EGP' : '-',
        soldPrice: apt.isSold ? soldPrice.toLocaleString() + ' EGP' : '-',
        status: apt.isSold ? 'SOLD' : 'AVAILABLE',
        paymentType: apt.paymentType || '-',
        clientName: apt.client?.name     || '-',
        clientPhone: apt.client?.phone    || '-',
        nationalId: apt.client?.nationalId || '-',
        totalPaid: apt.isSold ? totalPaidApartment.toLocaleString() + ' EGP' : '-',
        remaining: apt.isSold ? remaining.toLocaleString()          + ' EGP' : '-',
        paidPercent: apt.isSold ? paidPercent      + '%' : '-',
        remainingPercent: apt.isSold ? remainingPercent + '%' : '-'
      });
      row.getCell('F').font = apt.isSold
        ? { color: { argb: 'FF00FF00' } }
        : { color: { argb: 'FFFFA500' } };
    });

    // =====================================================
    // EXPENSES SHEET
    // =====================================================
    const expSheet = workbook.addWorksheet('Expenses');
    addSheetHeader(expSheet, project.name, '💰  Expenses', 3);
    expSheet.columns = [{ key: 'date', width: 15 }, { key: 'reason', width: 40 }, { key: 'amount', width: 20 }];
    const expHeaderRow = expSheet.getRow(3);
    ['Date', 'Reason', 'Amount (EGP)'].forEach((h, i) => expHeaderRow.getCell(i + 1).value = h);
    expHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2A3A' } };
    });
    expHeaderRow.commit();
    if (expenses.length === 0) {
      expSheet.addRow(['No expenses recorded', '', '']);
    } else {
      expenses.forEach(exp => {
        expSheet.addRow({
          date:   new Date(exp.date).toLocaleDateString('en-GB'),
          reason: exp.reason || 'No reason provided',
          amount: exp.amount ? exp.amount.toLocaleString() + ' EGP' : '0'
        });
      });
      expSheet.addRow([]);
      expSheet.addRow(['TOTAL EXPENSES:', '', totalExpenses.toLocaleString() + ' EGP']);
    }

    // =====================================================
    // COMMISSIONS SHEET (NEW)
    // =====================================================
    const commSheet = workbook.addWorksheet('Commissions');
    addSheetHeader(commSheet, project.name, '💼  Commissions', 3);
    commSheet.columns = [
      { key: 'date',   width: 15 },
      { key: 'label',  width: 35 },
      { key: 'amount', width: 20 }
    ];
    const commHeaderRow = commSheet.getRow(3);
    ['Date', 'For (Apt / Project)', 'Amount (EGP)'].forEach((h, i) => commHeaderRow.getCell(i + 1).value = h);
    commHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1F6E' } };
    });
    commHeaderRow.commit();

    if (commissions.length === 0) {
      commSheet.addRow(['No commissions recorded', '', '']);
    } else {
      commissions.forEach(c => {
        commSheet.addRow({
          date:   c.date ? new Date(c.date).toLocaleDateString('en-GB') : 'No date',
          label:  c.label === 'project' ? 'Project (general)' : `Apt ${c.label}`,
          amount: c.amount ? c.amount.toLocaleString() + ' EGP' : '0'
        });
      });
      commSheet.addRow([]);
      commSheet.addRow(['TOTAL COMMISSIONS:', '', totalCommissions.toLocaleString() + ' EGP']);
    }

    // =====================================================
    // INSTALLMENT HISTORY SHEET
    // =====================================================
    const paymentsSheet = workbook.addWorksheet('Instalment History');
    addSheetHeader(paymentsSheet, project.name, '📅  Instalment History', 6);
    paymentsSheet.columns = [
      { width: 15 }, { width: 20 }, { width: 30 },
      { width: 18 }, { width: 15 }, { width: 20 }
    ];

    const sortedApartments = [...apartments].sort((a, b) =>
      (a.apartmentId || '').localeCompare(b.apartmentId || '')
    );
    let currentRow = 3;

    sortedApartments.forEach(apt => {
      if (apt.payments && apt.payments.length > 0) {
        paymentsSheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const headerCell  = paymentsSheet.getCell(`A${currentRow}`);
        const soldPrice   = apt.soldPrice || apt.price || 0;
        const totalPaidApt = (apt.payments || [])
          .filter(p => p.isPaid)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const remaining        = soldPrice - totalPaidApt;
        const paidPercent      = soldPrice > 0 ? ((totalPaidApt / soldPrice) * 100).toFixed(1) : 0;
        const remainingPercent = soldPrice > 0 ? ((remaining    / soldPrice) * 100).toFixed(1) : 0;

        headerCell.value = `🏢 Apartment ${apt.apartmentId || apt._id.toString().slice(-6)} - Floor ${apt.floor || '-'} - Client: ${apt.client?.name || 'No Client'}`;
        headerCell.font  = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
        headerCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2A3A' } };
        currentRow++;

        paymentsSheet.addRow(['SUMMARY', '', '', '', '', '']); currentRow++;
        paymentsSheet.addRow(['Sold Price:', soldPrice.toLocaleString() + ' EGP', 'Total Paid:', totalPaidApt.toLocaleString() + ' EGP', 'Remaining:', remaining.toLocaleString() + ' EGP']); currentRow++;
        paymentsSheet.addRow(['Paid %:', paidPercent + '%', 'Remaining %:', remainingPercent + '%', 'Status:', remaining === 0 ? '✓ FULLY PAID' : '⏳ IN PROGRESS']); currentRow++;
        paymentsSheet.addRow([]); currentRow++;
        paymentsSheet.addRow(['Date', 'Amount (EGP)', 'Reason', 'Status', '', '']);
        const colHeaderRow = paymentsSheet.getRow(currentRow);
        colHeaderRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4B504' } };
        });
        currentRow++;

        apt.payments.sort((a, b) => {
          if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
          return new Date(b.date) - new Date(a.date);
        });

        apt.payments.forEach(payment => {
          const isPaid = payment.isPaid === true;
          const paymentRow = paymentsSheet.addRow([
            new Date(payment.date).toLocaleDateString('en-GB'),
            (payment.amount || 0).toLocaleString() + ' EGP',
            payment.reason || 'Installment Payment',
            isPaid ? '✓ PAID' : '✗ NOT PAID',
            '', ''
          ]);
          const statusCell = paymentRow.getCell(4);
          if (isPaid) {
            statusCell.font = { color: { argb: 'FF00AA00' }, bold: true };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFFFE0' } };
          } else {
            statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
          }
          currentRow++;
        });
        paymentsSheet.addRow([]); paymentsSheet.addRow([]);
        currentRow += 2;
      }
    });

    if (!apartments.some(apt => apt.payments?.length > 0)) {
      paymentsSheet.addRow(['No payment records found']);
    }

    // =====================================================
    // PROFIT ANALYSIS SHEET (now includes commissions)
    // =====================================================
    const profitSheet = workbook.addWorksheet('Profit Analysis');
    addSheetHeader(profitSheet, project.name, '📈  Profit Analysis', 3);
    profitSheet.columns = [{ key: 'category', width: 30 }, { key: 'amount', width: 25 }, { key: 'percentage', width: 15 }];
    const profitHeaderRow = profitSheet.getRow(3);
    ['Category', 'Amount (EGP)', 'Percentage'].forEach((h, i) => profitHeaderRow.getCell(i + 1).value = h);
    profitHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2A3A' } };
    });
    profitHeaderRow.commit();

    profitSheet.addRow(['ESTIMATED PROFIT (incl. commissions)']);
    profitSheet.addRow(['Actual Sales:',       estimatedSales.toLocaleString() + ' EGP', '100%']);
    profitSheet.addRow(['Total Expenses:',     totalExpenses.toLocaleString()  + ' EGP',
      estimatedSales > 0 ? ((totalExpenses / estimatedSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Total Commissions:',  totalCommissions.toLocaleString() + ' EGP',
      estimatedSales > 0 ? ((totalCommissions / estimatedSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Total Costs:',        totalCosts.toLocaleString()      + ' EGP',
      estimatedSales > 0 ? ((totalCosts / estimatedSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Actual Profit:',      estimatedProfit.toLocaleString() + ' EGP',
      estimatedSales > 0 ? ((estimatedProfit / estimatedSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow([]);
    profitSheet.addRow(['REALIZED PROFIT (incl. commissions)']);
    profitSheet.addRow(['Realized Sales:',     actualSales.toLocaleString()     + ' EGP', '100%']);
    profitSheet.addRow(['Total Expenses:',     totalExpenses.toLocaleString()   + ' EGP',
      actualSales > 0 ? ((totalExpenses / actualSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Total Commissions:',  totalCommissions.toLocaleString() + ' EGP',
      actualSales > 0 ? ((totalCommissions / actualSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Total Costs:',        totalCosts.toLocaleString()      + ' EGP',
      actualSales > 0 ? ((totalCosts / actualSales) * 100).toFixed(2) + '%' : '0%']);
    profitSheet.addRow(['Realized Profit:',    actualProfit.toLocaleString()    + ' EGP',
      actualSales > 0 ? ((actualProfit / actualSales) * 100).toFixed(2) + '%' : '0%']);

    // =====================================================
    // SEND RESPONSE
    // =====================================================
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_Complete_Report_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
};