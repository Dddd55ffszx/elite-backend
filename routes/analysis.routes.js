const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");

const Project = require("../models/Project");
const Apartment = require("../models/Apartment");
const Expense = require("../models/Expense");
const GeneralExpense = require("../models/GeneralExpense");
const TadaemMicheal = require("../models/TadaemMicheal");
const Commission = require("../models/Commission");

// ===== MAIN ANALYSIS ROUTE =====
router.get("/", auth, async (req, res) => {
  try {
    const { projectId, startYear, endYear, startDate, endDate } = req.query;

    let filterStart = null;
    let filterEnd = null;
    if (startDate) filterStart = new Date(startDate);
    if (endDate) filterEnd = new Date(endDate);
    if (startYear && !filterStart) filterStart = new Date(`${startYear}-01-01`);
    if (endYear && !filterEnd) filterEnd = new Date(`${endYear}-12-31`);

    const hasFilter = !!(filterStart || filterEnd);

    const isInFilter = (date) => {
      if (!date) return false;
      const d = new Date(date);
      if (isNaN(d)) return false;
      if (filterStart && d < filterStart) return false;
      if (filterEnd && d > filterEnd) return false;
      return true;
    };

    let projectFilter = {};
    if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
      projectFilter._id = new mongoose.Types.ObjectId(projectId);
    }

    const projects = await Project.find(projectFilter);
    const projectIds = projects.map((p) => p._id);
    const apartments = await Apartment.find({ project: { $in: projectIds } });
    const projectExpenses = await Expense.find({ project: { $in: projectIds } });
    const generalExpenses = await GeneralExpense.find({});
    const tadaemMichealList = await TadaemMicheal.find({});
    // NEW: fetch all commissions for these projects
    const allCommissions = await Commission.find({ project: { $in: projectIds } });

    const projectMap = {};
    projects.forEach((p) => { projectMap[p._id.toString()] = p; });

    const yearlyMap = {};
    const ensureYear = (year) => {
      if (!yearlyMap[year]) {
        yearlyMap[year] = {
          year,
          estimatedSales: 0,
          actualSales: 0,
          unpaidInstallments: 0,
          projectExpenses: 0,
          generalExpenses: 0,
          commissions: 0,         // NEW
          totalExpenses: 0,
          actualProfit: 0,
          tadaemMicheal: 0,
          eliteIndebtedness: 0,
          soldCount: 0,
          totalUnits: 0,
        };
      }
    };

    apartments.forEach((apt) => {
      const soldPrice = apt.soldPrice || apt.price || 0;
      const baseYear = new Date(apt.createdAt).getFullYear();
      ensureYear(baseYear);
      yearlyMap[baseYear].totalUnits += 1;

      if (!apt.isSold) return;

      if (apt.paymentType === "cash") {
        const cashDate = apt.soldDate || apt.createdAt;
        if (hasFilter && !isInFilter(cashDate)) return;
        const year = new Date(cashDate).getFullYear();
        ensureYear(year);
        yearlyMap[year].actualSales += soldPrice;
        yearlyMap[year].estimatedSales += soldPrice;
        yearlyMap[year].soldCount += 1;
      }

      if (apt.paymentType === "installments") {
        let soldCounted = false;
        (apt.payments || []).forEach((p) => {
          const amount = Number(p.amount) || 0;
          if (p.isPaid === true) {
            const payDate = p.paidDate || p.date;
            if (hasFilter && !isInFilter(payDate)) return;
            const year = new Date(payDate).getFullYear();
            ensureYear(year);
            yearlyMap[year].actualSales += amount;
            yearlyMap[year].estimatedSales += amount;
            if (!soldCounted) { yearlyMap[year].soldCount += 1; soldCounted = true; }
          } else {
            const dueDate = p.date;
            if (!dueDate) return;
            if (hasFilter && !isInFilter(dueDate)) return;
            const year = new Date(dueDate).getFullYear();
            ensureYear(year);
            yearlyMap[year].unpaidInstallments += amount;
            yearlyMap[year].estimatedSales += amount;
            if (!soldCounted) { yearlyMap[year].soldCount += 1; soldCounted = true; }
          }
        });
      }
    });

    projectExpenses.forEach((exp) => {
      const expDate = exp.date || exp.createdAt;
      if (hasFilter && !isInFilter(expDate)) return;
      const year = new Date(expDate).getFullYear();
      ensureYear(year);
      yearlyMap[year].projectExpenses += Number(exp.amount) || 0;
    });

    generalExpenses.forEach((ge) => {
      if (!ge.expenseDate) return;
      const geDate = new Date(ge.expenseDate);
      if (hasFilter && !isInFilter(geDate)) return;

      const matchingProjects = projects.filter((proj) => {
        const projStart = proj.startDate ? new Date(proj.startDate) : null;
        const projEnd = proj.endDate ? new Date(proj.endDate) : null;
        if (projStart && geDate < projStart) return false;
        if (projEnd && geDate > projEnd) return false;
        return true;
      });

      if (matchingProjects.length === 0) return;

      const geYear = geDate.getFullYear();
      ensureYear(geYear);
      yearlyMap[geYear].generalExpenses += Number(ge.amount) || 0;
    });

    // NEW: accumulate commissions per year
    allCommissions.forEach((comm) => {
      const commDate = comm.date || comm.createdAt;
      if (!commDate) return;
      if (hasFilter && !isInFilter(commDate)) return;
      const year = new Date(commDate).getFullYear();
      ensureYear(year);
      yearlyMap[year].commissions += Number(comm.amount) || 0;
    });

    tadaemMichealList.forEach((tm) => {
      if (!tm.expenseDate) return;
      const tmDate = new Date(tm.expenseDate);
      if (hasFilter && !isInFilter(tmDate)) return;
      const tmYear = tmDate.getFullYear();
      ensureYear(tmYear);
      yearlyMap[tmYear].tadaemMicheal += Number(tm.amount) || 0;
    });

    const yearlyData = Object.values(yearlyMap)
      .map((y) => {
        // commissions are treated as part of totalExpenses
        y.totalExpenses = y.projectExpenses + y.generalExpenses + y.commissions;
        y.actualProfit = y.actualSales - y.totalExpenses;
        y.eliteIndebtedness = y.actualProfit + y.tadaemMicheal;
        y.occupancyRate = y.totalUnits ? (y.soldCount / y.totalUnits) * 100 : 0;
        y.profitMargin = y.actualSales ? (y.actualProfit / y.actualSales) * 100 : 0;
        return y;
      })
      .filter((y) => {
        if (!hasFilter) return true;
        if (filterStart && y.year < filterStart.getFullYear()) return false;
        if (filterEnd && y.year > filterEnd.getFullYear()) return false;
        return true;
      })
      .sort((a, b) => a.year - b.year);

    const summary = {
  totalEstimatedSales: yearlyData.reduce((s, y) => s + y.estimatedSales, 0),

  totalActualSales: yearlyData.reduce((s, y) => s + y.actualSales, 0),

  totalUnpaidInstallments: yearlyData.reduce(
    (s, y) => s + y.unpaidInstallments,
    0
  ),

  totalExpenses: yearlyData.reduce(
    (s, y) => s + y.totalExpenses,
    0
  ),

  totalCommissions: yearlyData.reduce(
    (s, y) => s + y.commissions,
    0
  ),

  totalActualProfit: yearlyData.reduce(
    (s, y) => s + y.actualProfit,
    0
  ),

  totalTadaemMicheal: yearlyData.reduce(
    (s, y) => s + y.tadaemMicheal,
    0
  ),

  totalEliteIndebtedness: yearlyData.reduce(
    (s, y) => s + y.eliteIndebtedness,
    0
  ),

  // NEW
  totalNetDebt:
    yearlyData.reduce((s, y) => s + y.eliteIndebtedness, 0) +
    yearlyData.reduce((s, y) => s + y.unpaidInstallments, 0),

  totalSold: yearlyData.reduce(
    (s, y) => s + y.soldCount,
    0
  ),

  totalUnits: apartments.length,
};
    const completedProjectsCount = projects.filter((proj) => {
      const projApts = apartments.filter((a) => a.project.toString() === proj._id.toString());
      return projApts.length > 0 && projApts.every((apt) => apt.isSold);
    }).length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const installmentSchedule = [];

    apartments.forEach((apt) => {
      if (apt.paymentType !== "installments" || !apt.isSold) return;
      const project = projectMap[apt.project.toString()];

      (apt.payments || []).forEach((p) => {
        if (p.isPaid === true) return;
        const dueDate = p.date ? new Date(p.date) : null;
        if (!dueDate) return;

        installmentSchedule.push({
          paymentId: p._id,
          apartmentId: apt._id,
          apartmentNumber: apt.apartmentId,
          projectName: project?.name || "Unknown",
          clientName: apt.client?.name || "Unknown",
          amount: p.amount,
          dueDate: dueDate.toISOString(),
          dueMonth: dueDate.getMonth(),
          dueYear: dueDate.getFullYear(),
          reason: p.reason || "",
          isOverdue:
            dueDate.getFullYear() < currentYear ||
            (dueDate.getFullYear() === currentYear && dueDate.getMonth() < currentMonth),
        });
      });
    });

    installmentSchedule.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const filteredTadaemMicheal = tadaemMichealList.filter((tm) => {
      if (!tm.expenseDate) return false;
      if (hasFilter && !isInFilter(new Date(tm.expenseDate))) return false;
      return true;
    });

    // NEW: filtered commissions list for the UI block
    const filteredCommissions = allCommissions.filter((c) => {
      const d = c.date || c.createdAt;
      if (!d) return false;
      if (hasFilter && !isInFilter(new Date(d))) return false;
      return true;
    });

    res.json({
      success: true,
      yearlyData,
      summary: { ...summary, completedProjectsCount, filteredProjectsCount: projects.length },
      generalExpenses,
      tadaemMichealList: filteredTadaemMicheal,
      installmentSchedule,
      commissionsList: filteredCommissions,  // NEW
    });
  } catch (err) {
    console.error("ANALYSIS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===== TADAEM MICHEAL CRUD =====
router.get("/tadaem-micheal", auth, async (req, res) => {
  try {
    const items = await TadaemMicheal.find({}).sort({ expenseDate: -1 });
    res.json({ success: true, items });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/tadaem-micheal", auth, async (req, res) => {
  try {
    const { reason, amount, expenseDate } = req.body;
    const item = await TadaemMicheal.create({ reason, amount, expenseDate });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/tadaem-micheal/:id", auth, async (req, res) => {
  try {
    await TadaemMicheal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ===== EXPORT EXCEL =====
router.get("/export", auth, async (req, res) => {
  try {
    const { projectId, startYear, endYear, startDate, endDate } = req.query;

    let filterStart = null;
    let filterEnd = null;
    if (startDate) filterStart = new Date(startDate);
    if (endDate) filterEnd = new Date(endDate);
    if (startYear && !filterStart) filterStart = new Date(`${startYear}-01-01`);
    if (endYear && !filterEnd) filterEnd = new Date(`${endYear}-12-31`);
    const hasFilter = !!(filterStart || filterEnd);

    const periodText =
      filterStart && filterEnd
        ? `${filterStart.toLocaleDateString("en-GB")} – ${filterEnd.toLocaleDateString("en-GB")}`
        : filterStart ? `From ${filterStart.toLocaleDateString("en-GB")}`
        : filterEnd ? `Until ${filterEnd.toLocaleDateString("en-GB")}`
        : null;

    const isInFilter = (date) => {
      if (!date) return false;
      const d = new Date(date);
      if (isNaN(d)) return false;
      if (filterStart && d < filterStart) return false;
      if (filterEnd && d > filterEnd) return false;
      return true;
    };

    const isSingleProject =
      projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId);

    const match = {};
    if (isSingleProject) match._id = new mongoose.Types.ObjectId(projectId);

    const projects = await Project.find(match).lean();
    const projectIds = projects.map((p) => p._id);
    const apartments = await Apartment.find({ project: { $in: projectIds } }).lean();
    const projectExpenses = await Expense.find({ project: { $in: projectIds } }).lean();
    const generalExpenses = await GeneralExpense.find({}).lean();
    const tadaemMichealList = await TadaemMicheal.find({}).lean();
    const allCommissions = await Commission.find({ project: { $in: projectIds } }).lean();

    const singleProjectName = isSingleProject && projects.length === 1 ? projects[0].name : null;
    const projectMap = {};
    projects.forEach((p) => { projectMap[p._id.toString()] = p; });

    const yearlyMap = {};
    const ensureYear = (year) => {
      if (!yearlyMap[year]) {
        yearlyMap[year] = {
          year, estimatedSales: 0, actualSales: 0, unpaidInstallments: 0,
          projectExpenses: 0, generalExpenses: 0, commissions: 0,
          totalExpenses: 0, actualProfit: 0, tadaemMicheal: 0,
          eliteIndebtedness: 0, soldCount: 0, totalUnits: 0, projects: [],
        };
      }
    };

    apartments.forEach((apt) => {
      const baseYear = new Date(apt.createdAt).getFullYear();
      ensureYear(baseYear);
      yearlyMap[baseYear].totalUnits += 1;
      if (!apt.isSold) return;

      if (apt.paymentType === "cash") {
        const cashDate = apt.soldDate || apt.createdAt;
        if (hasFilter && !isInFilter(cashDate)) return;
        const soldPrice = apt.soldPrice || apt.price || 0;
        const year = new Date(cashDate).getFullYear();
        ensureYear(year);
        yearlyMap[year].actualSales += soldPrice;
        yearlyMap[year].estimatedSales += soldPrice;
        yearlyMap[year].soldCount += 1;
      }

      if (apt.paymentType === "installments") {
        let soldCounted = false;
        (apt.payments || []).forEach((p) => {
          const amount = Number(p.amount) || 0;
          if (p.isPaid === true) {
            const payDate = p.paidDate || p.date;
            if (hasFilter && !isInFilter(payDate)) return;
            const year = new Date(payDate).getFullYear();
            ensureYear(year);
            yearlyMap[year].actualSales += amount;
            yearlyMap[year].estimatedSales += amount;
            if (!soldCounted) { yearlyMap[year].soldCount += 1; soldCounted = true; }
          } else {
            const dueDate = p.date;
            if (!dueDate || (hasFilter && !isInFilter(dueDate))) return;
            const year = new Date(dueDate).getFullYear();
            ensureYear(year);
            yearlyMap[year].unpaidInstallments += amount;
            yearlyMap[year].estimatedSales += amount;
            if (!soldCounted) { yearlyMap[year].soldCount += 1; soldCounted = true; }
          }
        });
      }
    });

    projects.forEach((proj) => {
      const year = new Date(proj.startDate || proj.createdAt).getFullYear();
      ensureYear(year);
      if (!yearlyMap[year].projects.includes(proj.name)) yearlyMap[year].projects.push(proj.name);
    });

    projectExpenses.forEach((exp) => {
      const expDate = exp.date || exp.createdAt;
      if (hasFilter && !isInFilter(expDate)) return;
      const year = new Date(expDate).getFullYear();
      ensureYear(year);
      yearlyMap[year].projectExpenses += Number(exp.amount) || 0;
    });

    generalExpenses.forEach((ge) => {
      if (!ge.expenseDate) return;
      const geDate = new Date(ge.expenseDate);
      if (hasFilter && !isInFilter(geDate)) return;
      const matchingProjects = projects.filter((proj) => {
        const projStart = proj.startDate ? new Date(proj.startDate) : null;
        const projEnd = proj.endDate ? new Date(proj.endDate) : null;
        if (projStart && geDate < projStart) return false;
        if (projEnd && geDate > projEnd) return false;
        return true;
      });
      if (matchingProjects.length === 0) return;
      const geYear = geDate.getFullYear();
      ensureYear(geYear);
      yearlyMap[geYear].generalExpenses += Number(ge.amount) || 0;
    });

    // NEW: commissions in export
    allCommissions.forEach((comm) => {
      const commDate = comm.date || comm.createdAt;
      if (!commDate) return;
      if (hasFilter && !isInFilter(commDate)) return;
      const year = new Date(commDate).getFullYear();
      ensureYear(year);
      yearlyMap[year].commissions += Number(comm.amount) || 0;
    });

    tadaemMichealList.forEach((tm) => {
      if (!tm.expenseDate) return;
      const tmDate = new Date(tm.expenseDate);
      if (hasFilter && !isInFilter(tmDate)) return;
      const tmYear = tmDate.getFullYear();
      ensureYear(tmYear);
      yearlyMap[tmYear].tadaemMicheal += Number(tm.amount) || 0;
    });

    const yearlyData = Object.values(yearlyMap)
      .map((y) => {
        y.totalExpenses = y.projectExpenses + y.generalExpenses + y.commissions;
        y.actualProfit = y.actualSales - y.totalExpenses;
        y.eliteIndebtedness = y.actualProfit + y.tadaemMicheal;
        y.profitMargin = y.actualSales ? (y.actualProfit / y.actualSales) * 100 : 0;
        y.projectNames = [...new Set(y.projects || [])].join(", ");
        return y;
      })
      .filter((y) => {
        if (!hasFilter) return true;
        if (filterStart && y.year < filterStart.getFullYear()) return false;
        if (filterEnd && y.year > filterEnd.getFullYear()) return false;
        return true;
      })
      .sort((a, b) => a.year - b.year);

    const scheduleRows = [];
    apartments.forEach((apt) => {
      if (apt.paymentType !== "installments" || !apt.isSold) return;
      const project = projectMap[apt.project.toString()];
      (apt.payments || []).forEach((p) => {
        if (p.isPaid === true) return;
        const dueDate = p.date ? new Date(p.date) : null;
        if (!dueDate) return;
        if (hasFilter && !isInFilter(dueDate)) return;
        scheduleRows.push({
          projectName: project?.name || "Unknown",
          apartmentNumber: apt.apartmentId,
          clientName: apt.client?.name || "Unknown",
          amount: p.amount,
          dueDate: dueDate.toISOString(),
          reason: p.reason || "",
          isOverdue: dueDate < new Date(),
        });
      });
    });
    scheduleRows.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const summary = yearlyData.reduce(
      (acc, curr) => {
        acc.totalEstimatedSales    += curr.estimatedSales;
        acc.totalActualSales       += curr.actualSales;
        acc.totalUnpaidInstallments += curr.unpaidInstallments;
        acc.totalExpenses          += curr.totalExpenses;
        acc.totalCommissions       += curr.commissions;  // NEW
        acc.totalActualProfit      += curr.actualProfit;
        acc.totalTadaemMicheal     += curr.tadaemMicheal;
        acc.totalEliteIndebtedness += curr.eliteIndebtedness;
        acc.totalSold              += curr.soldCount;
        acc.totalUnits             += curr.totalUnits;
        return acc;
      },
      {
        totalEstimatedSales: 0, totalActualSales: 0, totalUnpaidInstallments: 0,
        totalExpenses: 0, totalCommissions: 0,
        totalActualProfit: 0, totalTadaemMicheal: 0, totalEliteIndebtedness: 0,
        totalSold: 0, totalUnits: 0,
      }
    );

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const fmt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

    const addSheetBanner = (sheet, colSpan, sheetTitle) => {
      const lastCol = String.fromCharCode(64 + colSpan);
      let nextRow = 1;

      sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`);
      const titleCell = sheet.getCell(`A${nextRow}`);
      titleCell.value     = sheetTitle.toUpperCase();
      titleCell.font      = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      titleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D5C63" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(nextRow).height = 30;
      nextRow++;

      if (singleProjectName) {
        sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`);
        const cell = sheet.getCell(`A${nextRow}`);
        cell.value     = `\u{1F3D7}  ${singleProjectName.toUpperCase()}`;
        cell.font      = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2A3A" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        sheet.getRow(nextRow).height = 26;
        nextRow++;
      }

      if (periodText) {
        sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`);
        const cell = sheet.getCell(`A${nextRow}`);
        cell.value     = `\u{1F4C5}  Period: ${periodText}`;
        cell.font      = { bold: true, size: 11, color: { argb: "FF1A2A3A" } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4B504" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        sheet.getRow(nextRow).height = 22;
        nextRow++;
      }

      return nextRow;
    };

    const styleHeader = (sheet, headerRowNum) => {
      const header = sheet.getRow(headerRowNum);
      header.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      header.alignment = { horizontal: "center", vertical: "middle" };
      header.height    = 25;
      sheet.eachRow((row, rowNum) => {
        if (rowNum <= headerRowNum) return;
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" }, left: { style: "thin" },
            bottom: { style: "thin" }, right: { style: "thin" },
          };
        });
        if (rowNum % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      });
    };

    // ========== Sheet 1: Yearly Breakdown (now includes commissions column) ==========
    const ys = workbook.addWorksheet("Yearly Breakdown");
    ys.columns = [
      { key: "year",               width: 8  },
      { key: "projectNames",       width: 40 },
      { key: "estimatedSales",     width: 22 },
      { key: "actualSales",        width: 20 },
      { key: "unpaidInstallments", width: 24 },
      { key: "projectExpenses",    width: 22 },
      { key: "generalExpenses",    width: 22 },
      { key: "commissions",        width: 22 }, // NEW
      { key: "totalExpenses",      width: 20 },
      { key: "actualProfit",       width: 20 },
      { key: "tadaemMicheal",      width: 22 },
      { key: "eliteIndebtedness",  width: 24 },
      { key: "profitMargin",       width: 15 },
      { key: "soldCount",          width: 12 },
      { key: "totalUnits",         width: 12 },
    ];
    const ysHeaderRow = addSheetBanner(ys, 15, "Yearly Breakdown");
    const ysHeaders = ys.getRow(ysHeaderRow);
    [
      "Year","Project Names","Actual Sales (EGP)","Realised Sales (EGP)",
      "Unpaid Installments (EGP)","Project Expenses (EGP)","General Expenses (EGP)",
      "Commissions (EGP)",  // NEW
      "Total Expenses (EGP)","Realised Profit (EGP)","Tadaem Micheal (EGP)",
      "Elite Indebtedness (EGP)","Profit Margin","Sold Units","Total Units",
    ].forEach((h, i) => ysHeaders.getCell(i + 1).value = h);
    ysHeaders.commit();

    yearlyData.forEach((r) => ys.addRow({
      year: r.year, projectNames: r.projectNames || "",
      estimatedSales: fmt(r.estimatedSales), actualSales: fmt(r.actualSales),
      unpaidInstallments: fmt(r.unpaidInstallments), projectExpenses: fmt(r.projectExpenses),
      generalExpenses: fmt(r.generalExpenses),
      commissions: fmt(r.commissions), // NEW
      totalExpenses: fmt(r.totalExpenses),
      actualProfit: fmt(r.actualProfit), tadaemMicheal: fmt(r.tadaemMicheal),
      eliteIndebtedness: fmt(r.eliteIndebtedness),
      profitMargin: r.profitMargin.toFixed(2) + "%",
      soldCount: r.soldCount, totalUnits: r.totalUnits,
    }));
    styleHeader(ys, ysHeaderRow);

    // ========== Sheet 2: Summary ==========
    const ss = workbook.addWorksheet("Summary");
    ss.columns = [{ key: "metric", width: 35 }, { key: "value", width: 30 }];
    const ssHeaderRow = addSheetBanner(ss, 2, "Summary");
    const ssHeaders = ss.getRow(ssHeaderRow);
    ssHeaders.getCell(1).value = "Metric";
    ssHeaders.getCell(2).value = "Value";
    ssHeaders.commit();

    ss.addRows([
      { metric: "Total Actual Sales",             value: fmt(summary.totalEstimatedSales)     + " EGP" },
      { metric: "Total Realised Sales",            value: fmt(summary.totalActualSales)        + " EGP" },
      { metric: "Total Unpaid Installments",       value: fmt(summary.totalUnpaidInstallments) + " EGP" },
      { metric: "Total Expenses (incl. commissions)", value: fmt(summary.totalExpenses)        + " EGP" },
      { metric: "Total Commissions",               value: fmt(summary.totalCommissions)        + " EGP" }, // NEW
      { metric: "Total Realised Profit",           value: fmt(summary.totalActualProfit)       + " EGP" },
      { metric: "Total Tadaem Micheal",            value: fmt(summary.totalTadaemMicheal)      + " EGP" },
      { metric: "Elite Indebtedness",              value: fmt(summary.totalEliteIndebtedness)  + " EGP" },
      { metric: "Total Sold Units",                value: summary.totalSold },
      { metric: "Total Units",                     value: summary.totalUnits },
      {
        metric: "Overall Profit Margin",
        value: summary.totalActualSales
          ? ((summary.totalActualProfit / summary.totalActualSales) * 100).toFixed(2) + "%"
          : "0%",
      },
    ]);
    styleHeader(ss, ssHeaderRow);

    // ========== Sheet 3: General Expenses ==========
    const es = workbook.addWorksheet("General Expenses");
    es.columns = [{ key: "date", width: 15 }, { key: "reason", width: 50 }, { key: "amount", width: 20 }];
    const esHeaderRow = addSheetBanner(es, 3, "General Expenses");
    const esHeaders = es.getRow(esHeaderRow);
    ["Date", "Reason", "Amount (EGP)"].forEach((h, i) => esHeaders.getCell(i + 1).value = h);
    esHeaders.commit();
    generalExpenses
      .filter((ge) => !hasFilter || isInFilter(ge.expenseDate))
      .forEach((exp) => {
        es.addRow({
          date:   exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-GB") : "",
          reason: exp.reason,
          amount: fmt(exp.amount),
        });
      });
    styleHeader(es, esHeaderRow);

    // ========== Sheet 4: Tadaem Micheal ==========
    const ts = workbook.addWorksheet("Tadaem Micheal");
    ts.columns = [{ key: "date", width: 15 }, { key: "reason", width: 50 }, { key: "amount", width: 20 }];
    const tsHeaderRow = addSheetBanner(ts, 3, "Tadaem Micheal");
    const tsHeaders = ts.getRow(tsHeaderRow);
    ["Date", "Reason", "Amount (EGP)"].forEach((h, i) => tsHeaders.getCell(i + 1).value = h);
    tsHeaders.commit();
    const filteredTmExport = tadaemMichealList.filter((tm) => !hasFilter || isInFilter(tm.expenseDate));
    filteredTmExport.forEach((tm) => {
      ts.addRow({
        date:   tm.expenseDate ? new Date(tm.expenseDate).toLocaleDateString("en-GB") : "",
        reason: tm.reason,
        amount: fmt(tm.amount),
      });
    });
    const tmTotalRow = ts.addRow({
      date: "TOTAL", reason: "",
      amount: fmt(filteredTmExport.reduce((s, t) => s + (t.amount || 0), 0)),
    });
    tmTotalRow.font = { bold: true };
    tmTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FA" } };
    styleHeader(ts, tsHeaderRow);

    // ========== Sheet 5: Commissions (NEW) ==========
    const cs = workbook.addWorksheet("Commissions");
    cs.columns = [
      { key: "date",        width: 15 },
      { key: "project",     width: 30 },
      { key: "label",       width: 25 },
      { key: "amount",      width: 20 },
    ];
    const csHeaderRow = addSheetBanner(cs, 4, "Commissions");
    const csHeaders = cs.getRow(csHeaderRow);
    ["Date", "Project", "For (Apt / Project)", "Amount (EGP)"].forEach((h, i) => csHeaders.getCell(i + 1).value = h);
    csHeaders.commit();

    const filteredCommExport = allCommissions.filter((c) => {
      const d = c.date || c.createdAt;
      return !hasFilter || isInFilter(d);
    });
    filteredCommExport.forEach((c) => {
      const proj = projectMap[c.project?.toString()];
      cs.addRow({
        date:    c.date ? new Date(c.date).toLocaleDateString("en-GB") : "",
        project: proj ? proj.name : "Unknown",
        label:   c.label === "project" ? "Project (general)" : `Apt ${c.label}`,
        amount:  fmt(c.amount),
      });
    });
    const commTotalRow = cs.addRow({
      date: "TOTAL", project: "", label: "",
      amount: fmt(filteredCommExport.reduce((s, c) => s + (c.amount || 0), 0)),
    });
    commTotalRow.font = { bold: true };
    commTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5EEFF" } };
    styleHeader(cs, csHeaderRow);

    // ========== Sheet 6: Installment Schedule ==========
    const isSheet = workbook.addWorksheet("Installment Schedule");
    isSheet.columns = [
      { key: "projectName",     width: 20 },
      { key: "apartmentNumber", width: 10 },
      { key: "clientName",      width: 20 },
      { key: "amount",          width: 15 },
      { key: "dueDate",         width: 15 },
      { key: "reason",          width: 25 },
      { key: "status",          width: 12 },
    ];
    const isHeaderRow = addSheetBanner(isSheet, 7, "Installment Schedule");
    const isHeaders = isSheet.getRow(isHeaderRow);
    ["Project", "Apt #", "Client", "Amount (EGP)", "Due Date", "Reason", "Status"]
      .forEach((h, i) => isHeaders.getCell(i + 1).value = h);
    isHeaders.commit();
    scheduleRows.forEach((item) => {
      isSheet.addRow({
        projectName: item.projectName, apartmentNumber: item.apartmentNumber,
        clientName: item.clientName, amount: fmt(item.amount),
        dueDate: new Date(item.dueDate).toLocaleDateString("en-GB"),
        reason: item.reason, status: item.isOverdue ? "Overdue" : "Due",
      });
    });
    styleHeader(isSheet, isHeaderRow);
    const totalRow = isSheet.addRow({
      projectName: "TOTAL", apartmentNumber: "", clientName: "",
      amount: fmt(scheduleRows.reduce((s, i) => s + (i.amount || 0), 0)),
      dueDate: "", reason: "", status: "",
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0FA" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=analysis_export_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;