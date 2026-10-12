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
    const { projectId, startYear, endYear, startDate, endDate, includeGeneralExpenses, includeCommissions } = req.query;

    // Both default to included (true) unless explicitly turned off.
    const includeGE = includeGeneralExpenses !== "false";
    const includeComm = includeCommissions !== "false";

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
        if ((apt.payments || []).length > 0) {
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
        } else {
          // No payment history => plain cash sale, paid in full at time of sale
          const cashDate = apt.soldDate || apt.createdAt;
          if (hasFilter && !isInFilter(cashDate)) return;
          const year = new Date(cashDate).getFullYear();
          ensureYear(year);
          yearlyMap[year].actualSales += soldPrice;
          yearlyMap[year].estimatedSales += soldPrice;
          yearlyMap[year].soldCount += 1;
        }
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
        // commissions and general expenses are treated as part of totalExpenses,
        // unless explicitly excluded via the includeGeneralExpenses/includeCommissions filters
        y.totalExpenses =
          y.projectExpenses +
          (includeGE ? y.generalExpenses : 0) +
          (includeComm ? y.commissions : 0);
        y.actualProfit = y.actualSales - y.totalExpenses;
        y.eliteIndebtedness = y.actualProfit + y.tadaemMicheal;
        y.occupancyRate = y.totalUnits ? (y.soldCount / y.totalUnits) * 100 : 0;
        // Realised Profit % = (Realised Sales - Total Expenses) / Realised Sales
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

    // ROI is the sales-to-expenses ratio.
    // The card displays the ratio as a number and the percentage separately.
    const totalExpensesForRatios = summary.totalExpenses;
    summary.totalROI = totalExpensesForRatios
      ? Number((summary.totalActualSales / totalExpensesForRatios).toFixed(2))
      : 0;
    summary.totalROIPercent = Number((summary.totalROI * 100).toFixed(2));

    // Realised Profit % = (Realised Sales - Total Expenses) / Realised Sales
    summary.profitMarginPercent = summary.totalActualSales
      ? Number(((summary.totalActualProfit / summary.totalActualSales) * 100).toFixed(2))
      : 0;
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

// ===== ANALYSIS CARD DRILL-DOWN DETAILS =====
// Powers the Analysis page: clicking a summary card opens a page
// with either the itemised records behind it (newest first) or,
// for computed metrics, the calculation that produced the number.
router.get("/details/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
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
    const projectMap = {};
    projects.forEach((p) => { projectMap[p._id.toString()] = p; });

    const listTypes = ["actual-sales", "realised-sales", "unpaid-installments", "total-expenses", "commissions"];
    const formulaTypes = ["actual-profit", "realised-profit", "roi", "elite-indebtedness", "net-debt"];

    if (!listTypes.includes(type) && !formulaTypes.includes(type)) {
      return res.status(400).json({ message: "Unknown detail type" });
    }

    // ================= ITEMISED LIST TYPES =================
    if (listTypes.includes(type)) {
      const items = [];

      if (type !== "total-expenses" && type !== "commissions") {
        const apartments = await Apartment.find({ project: { $in: projectIds } });

        apartments.forEach((apt) => {
          if (!apt.isSold) return;
          const project = projectMap[apt.project.toString()];

          (apt.payments || []).forEach((p) => {
            const amount = Number(p.amount) || 0;
            const isPaid = p.isPaid === true;
            const relevantDate = isPaid ? (p.paidDate || p.date) : p.date;
            if (!relevantDate) return;
            if (hasFilter && !isInFilter(relevantDate)) return;

            if (type === "realised-sales" && !isPaid) return;
            if (type === "unpaid-installments" && isPaid) return;
            // "actual-sales" (paid + unpaid) includes both

            items.push({
              date: new Date(relevantDate).toISOString(),
              amount,
              status: isPaid ? "Paid" : "Unpaid",
              apartmentNumber: apt.apartmentId,
              projectName: project?.name || "Unknown",
              clientName: apt.client?.name || "Unknown",
              reason: p.reason || (isPaid ? "Payment received" : "Installment due"),
            });
          });

          // Plain cash sale with no itemised payment history
          if (apt.paymentType === "cash" && (apt.payments || []).length === 0 && type !== "unpaid-installments") {
            const cashDate = apt.soldDate || apt.createdAt;
            if (!(hasFilter && !isInFilter(cashDate))) {
              items.push({
                date: new Date(cashDate).toISOString(),
                amount: apt.soldPrice || apt.price || 0,
                status: "Paid",
                apartmentNumber: apt.apartmentId,
                projectName: project?.name || "Unknown",
                clientName: apt.client?.name || "Unknown",
                reason: "Cash sale",
              });
            }
          }
        });
      }

      if (type === "total-expenses") {
        const projectExpenses = await Expense.find({ project: { $in: projectIds } });
        projectExpenses.forEach((exp) => {
          const d = exp.date || exp.createdAt;
          if (hasFilter && !isInFilter(d)) return;
          items.push({
            date: new Date(d).toISOString(),
            amount: Number(exp.amount) || 0,
            category: "Project Expense",
            projectName: projectMap[exp.project?.toString()]?.name || "Unknown",
            reason: exp.reason,
          });
        });

        const generalExpenses = await GeneralExpense.find({});
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
          items.push({
            date: geDate.toISOString(),
            amount: Number(ge.amount) || 0,
            category: "General Expense",
            projectName: "—",
            reason: ge.reason,
          });
        });
      }

      if (type === "total-expenses" || type === "commissions") {
        const allCommissions = await Commission.find({ project: { $in: projectIds } });
        allCommissions.forEach((comm) => {
          const d = comm.date || comm.createdAt;
          if (!d) return;
          if (hasFilter && !isInFilter(d)) return;
          items.push({
            date: new Date(d).toISOString(),
            amount: Number(comm.amount) || 0,
            category: "Commission",
            projectName: projectMap[comm.project?.toString()]?.name || "Unknown",
            reason: comm.label === "project" ? "Project commission" : `Apartment ${comm.label}`,
          });
        });
      }

      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      const total = items.reduce((s, i) => s + (i.amount || 0), 0);

      return res.json({ success: true, type, mode: "list", items, total });
    }

    // ================= COMPUTED / FORMULA TYPES =================
    const apartments = await Apartment.find({ project: { $in: projectIds } });
    const projectExpenses = await Expense.find({ project: { $in: projectIds } });
    const generalExpenses = await GeneralExpense.find({});
    const tadaemMichealList = await TadaemMicheal.find({});
    const allCommissions = await Commission.find({ project: { $in: projectIds } });

    let totalActualSales = 0;
    let totalUnpaidInstallments = 0;

    apartments.forEach((apt) => {
      if (!apt.isSold) return;
      (apt.payments || []).forEach((p) => {
        const amount = Number(p.amount) || 0;
        if (p.isPaid === true) {
          const payDate = p.paidDate || p.date;
          if (hasFilter && !isInFilter(payDate)) return;
          totalActualSales += amount;
        } else {
          const dueDate = p.date;
          if (!dueDate) return;
          if (hasFilter && !isInFilter(dueDate)) return;
          totalUnpaidInstallments += amount;
        }
      });
      if (apt.paymentType === "cash" && (apt.payments || []).length === 0) {
        const cashDate = apt.soldDate || apt.createdAt;
        if (!(hasFilter && !isInFilter(cashDate))) {
          totalActualSales += apt.soldPrice || apt.price || 0;
        }
      }
    });

    let totalProjectExpenses = 0;
    projectExpenses.forEach((exp) => {
      const d = exp.date || exp.createdAt;
      if (hasFilter && !isInFilter(d)) return;
      totalProjectExpenses += Number(exp.amount) || 0;
    });

    let totalGeneralExpenses = 0;
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
      totalGeneralExpenses += Number(ge.amount) || 0;
    });

    let totalCommissions = 0;
    allCommissions.forEach((comm) => {
      const d = comm.date || comm.createdAt;
      if (!d) return;
      if (hasFilter && !isInFilter(d)) return;
      totalCommissions += Number(comm.amount) || 0;
    });

    let totalTadaemMicheal = 0;
    tadaemMichealList.forEach((tm) => {
      if (!tm.expenseDate) return;
      const tmDate = new Date(tm.expenseDate);
      if (hasFilter && !isInFilter(tmDate)) return;
      totalTadaemMicheal += Number(tm.amount) || 0;
    });

    const totalExpenses = totalProjectExpenses + totalGeneralExpenses + totalCommissions;
    const totalActualProfit = totalActualSales - totalExpenses;
    const totalEliteIndebtedness = totalActualProfit + totalTadaemMicheal;
    const totalNetDebt = totalEliteIndebtedness + totalUnpaidInstallments;

    let terms = [];
    let result = {};

    if (type === "actual-profit") {
      // Actual Profit = Actual Sales (paid + unpaid) - Total Expenses
      terms = [
        { label: "Actual Sales", value: totalActualSales + totalUnpaidInstallments, op: "" },
        { label: "Total Expenses", value: totalExpenses, op: "-" },
      ];
      result = { label: "Actual Profit", value: totalActualSales + totalUnpaidInstallments - totalExpenses };
    } else if (type === "realised-profit") {
      terms = [
        { label: "Realised Sales", value: totalActualSales, op: "" },
        { label: "Total Expenses", value: totalExpenses, op: "-" },
      ];
      result = { label: "Realised Profit", value: totalActualProfit };
    } else if (type === "roi") {
      // ROI = Actual Sales / Total Expenses
      const roi = totalExpenses > 0 ? totalActualSales / totalExpenses : 0;
      terms = [
        { label: "Actual Sales", value: totalActualSales, op: "" },
        { label: "Total Expenses", value: totalExpenses, op: "÷" },
      ];
      result = {
        label: "ROI",
        value: Number(roi.toFixed(2)),
        percentage: Number((roi * 100).toFixed(2)),
      };
    } else if (type === "elite-indebtedness") {
      terms = [
        { label: "Realised Profit", value: totalActualProfit, op: "" },
        { label: "Tadaem Micheal", value: totalTadaemMicheal, op: "+" },
      ];
      result = { label: "Elite Indebtedness", value: totalEliteIndebtedness };
    } else if (type === "net-debt") {
      terms = [
        { label: "Elite Indebtedness", value: totalEliteIndebtedness, op: "" },
        { label: "Unpaid Installments", value: totalUnpaidInstallments, op: "+" },
      ];
      result = { label: "Net Debt", value: totalNetDebt };
    }

    return res.json({ success: true, type, mode: "formula", terms, result });
  } catch (err) {
    console.error("Analysis details error:", err);
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
    const { projectId, startYear, endYear, startDate, endDate, includeGeneralExpenses, includeCommissions } = req.query;

    // Same switches as the Analysis screen: both default to included unless turned off.
    const includeGE = includeGeneralExpenses !== "false";
    const includeComm = includeCommissions !== "false";

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
        if ((apt.payments || []).length > 0) {
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
        } else {
          // No payment history => plain cash sale, paid in full at time of sale
          const cashDate = apt.soldDate || apt.createdAt;
          if (hasFilter && !isInFilter(cashDate)) return;
          const soldPrice = apt.soldPrice || apt.price || 0;
          const year = new Date(cashDate).getFullYear();
          ensureYear(year);
          yearlyMap[year].actualSales += soldPrice;
          yearlyMap[year].estimatedSales += soldPrice;
          yearlyMap[year].soldCount += 1;
        }
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
        y.totalExpenses =
          y.projectExpenses +
          (includeGE ? y.generalExpenses : 0) +
          (includeComm ? y.commissions : 0);
        y.actualProfit = y.actualSales - y.totalExpenses;
        y.eliteIndebtedness = y.actualProfit + y.tadaemMicheal;
        // Realised Profit % = (Realised Sales - Total Expenses) / Realised Sales
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

    // ---------------------------------------------------------------------------
    // Itemised rows (so the workbook shows everything behind the numbers)
    // ---------------------------------------------------------------------------
    const isGeneralExpenseInScope = (ge) => {
      if (!ge.expenseDate) return false;
      const geDate = new Date(ge.expenseDate);
      if (hasFilter && !isInFilter(geDate)) return false;
      return projects.some((proj) => {
        const projStart = proj.startDate ? new Date(proj.startDate) : null;
        const projEnd = proj.endDate ? new Date(proj.endDate) : null;
        if (projStart && geDate < projStart) return false;
        if (projEnd && geDate > projEnd) return false;
        return true;
      });
    };

    const realisedRows = [];
    apartments.forEach((apt) => {
      if (!apt.isSold) return;
      const project = projectMap[apt.project.toString()];
      const base = {
        projectName: project?.name || "Unknown",
        apartmentNumber: apt.apartmentId,
        clientName: apt.client?.name || "",
        paymentType: apt.paymentType === "cash" ? "Cash" : "Installments",
      };
      if (apt.paymentType === "cash" && (apt.payments || []).length === 0) {
        const cashDate = apt.soldDate || apt.createdAt;
        if (hasFilter && !isInFilter(cashDate)) return;
        realisedRows.push({ ...base, date: cashDate, reason: "Cash sale", amount: apt.soldPrice || apt.price || 0 });
        return;
      }
      (apt.payments || []).forEach((p) => {
        if (p.isPaid !== true) return;
        const payDate = p.paidDate || p.date;
        if (hasFilter && !isInFilter(payDate)) return;
        realisedRows.push({ ...base, date: payDate, reason: p.reason || "Installment payment", amount: Number(p.amount) || 0 });
      });
    });
    realisedRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const projectExpenseRows = projectExpenses
      .filter((e) => !hasFilter || isInFilter(e.date || e.createdAt))
      .map((e) => ({
        date: e.date || e.createdAt,
        projectName: projectMap[e.project?.toString()]?.name || "Unknown",
        reason: e.reason || "",
        amount: Number(e.amount) || 0,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const generalExpenseRows = generalExpenses
      .filter(isGeneralExpenseInScope)
      .map((g) => ({ date: g.expenseDate, reason: g.reason || "", amount: Number(g.amount) || 0 }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const tadaemRows = tadaemMichealList
      .filter((tm) => tm.expenseDate && (!hasFilter || isInFilter(tm.expenseDate)))
      .map((tm) => ({ date: tm.expenseDate, reason: tm.reason || "", amount: Number(tm.amount) || 0 }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const commissionRows = allCommissions
      .filter((c) => {
        const d = c.date || c.createdAt;
        return d && (!hasFilter || isInFilter(d));
      })
      .map((c) => ({
        date: c.date || c.createdAt,
        projectName: projectMap[c.project?.toString()]?.name || "Unknown",
        label: c.label === "project" ? "Project (general)" : `Apt ${c.label}`,
        amount: Number(c.amount) || 0,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // ---------------------------------------------------------------------------
    // Workbook
    // ---------------------------------------------------------------------------
    const ExcelJS = require("exceljs");
    const X = require("../utils/excelStyle");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Elite For Contracting";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Lines describing exactly which filters were applied, repeated on every sheet
    const filterLines = [
      `Scope: ${singleProjectName ? singleProjectName : "All projects"}  |  Period: ${periodText || "All time"}`,
      `General expenses: ${includeGE ? "Included" : "Excluded"}  |  Commissions: ${includeComm ? "Included" : "Excluded"} (in total expenses & profit)`,
      `Generated on ${new Date().toLocaleDateString("en-GB")}`,
    ];

    const profitPct = summary.totalActualSales ? summary.totalActualProfit / summary.totalActualSales : 0;

    // ===== Sheet 1: Summary =====
    const ss = X.createSheet(workbook, "Summary", { tabColor: X.COLORS.navy, landscape: false });
    X.setWidths(ss, [42, 28]);
    let r = X.addBanner(ss, 2, "Analysis Summary", filterLines);

    r = X.addSection(ss, r, 2, "Sales (EGP)");
    r = X.addKeyValue(ss, r, [
      { label: "Actual Sales", value: summary.totalEstimatedSales, type: "money" },
      { label: "Realised Sales (received)", value: summary.totalActualSales, type: "money" },
      { label: "Unpaid Installments", value: summary.totalUnpaidInstallments, type: "money", tone: "warn" },
    ]);

    r = X.addSection(ss, r, 2, "Expenses (EGP)");
    const expItems = [
      { label: "Project Expenses", value: yearlyData.reduce((s, y) => s + y.projectExpenses, 0), type: "money", bold: false },
    ];
    if (includeGE) expItems.push({ label: "General Expenses", value: yearlyData.reduce((s, y) => s + y.generalExpenses, 0), type: "money", bold: false });
    if (includeComm) expItems.push({ label: "Commissions", value: summary.totalCommissions, type: "money", tone: "purple", bold: false });
    expItems.push({ label: "Total Expenses", value: summary.totalExpenses, type: "money", tone: "bad" });
    r = X.addKeyValue(ss, r, expItems);

    r = X.addSection(ss, r, 2, "Profit");
    r = X.addKeyValue(ss, r, [
      { label: "Realised Profit", value: summary.totalActualProfit, type: "money", autoTone: true },
      { label: "Realised Profit %", value: profitPct, type: "percent", autoTone: true },
      { label: "Tadaem Micheal", value: summary.totalTadaemMicheal, type: "money", bold: false },
      { label: "Elite Indebtedness", value: summary.totalEliteIndebtedness, type: "money", autoTone: true },
    ]);

    r = X.addSection(ss, r, 2, "Units");
    X.addKeyValue(ss, r, [
      { label: "Sold Units", value: summary.totalSold, type: "int" },
      { label: "Total Units", value: summary.totalUnits, type: "int", bold: false },
    ]);

    // ===== Sheet 2: Yearly Breakdown =====
    const ys = X.createSheet(workbook, "Yearly Breakdown", { tabColor: "FF2563EB" });
    const yCols = [
      { header: "Year", key: "year", width: 8, type: "int" },
      { header: "Projects", key: "projectNames", width: 34, type: "text" },
      { header: "Actual Sales (EGP)", key: "estimatedSales", width: 20, type: "money" },
      { header: "Realised Sales (EGP)", key: "actualSales", width: 20, type: "money" },
      { header: "Unpaid Installments (EGP)", key: "unpaidInstallments", width: 22, type: "money" },
      { header: "Project Expenses (EGP)", key: "projectExpenses", width: 21, type: "money" },
    ];
    if (includeGE) yCols.push({ header: "General Expenses (EGP)", key: "generalExpenses", width: 21, type: "money" });
    if (includeComm) yCols.push({ header: "Commissions (EGP)", key: "commissions", width: 19, type: "money" });
    yCols.push(
      { header: "Total Expenses (EGP)", key: "totalExpenses", width: 20, type: "money" },
      { header: "Realised Profit (EGP)", key: "actualProfit", width: 20, type: "money" },
      { header: "Profit %", key: "profitMargin", width: 11, type: "percent" },
      { header: "Tadaem Micheal (EGP)", key: "tadaemMicheal", width: 20, type: "money" },
      { header: "Elite Indebtedness (EGP)", key: "eliteIndebtedness", width: 22, type: "money" },
      { header: "Sold Units", key: "soldCount", width: 11, type: "int" },
      { header: "Total Units", key: "totalUnits", width: 11, type: "int" }
    );
    X.setWidths(ys, yCols.map((c) => c.width));
    const yr = X.addBanner(ys, yCols.length, "Yearly Breakdown", filterLines);
    X.addTable(
      ys,
      yr,
      yCols,
      yearlyData.map((y) => ({ ...y, profitMargin: (y.profitMargin || 0) / 100 })),
      {
        totals: yCols.filter((c) => c.type === "money" || (c.type === "int" && c.key !== "year")).map((c) => c.key),
        cellStyle: (row, col, cell) => {
          if (col.key === "actualProfit" || col.key === "profitMargin") {
            const v = col.key === "actualProfit" ? row.actualProfit : row.profitMargin;
            cell.font = { name: X.FONT, size: 10, bold: true, color: { argb: v < 0 ? X.COLORS.red : X.COLORS.green } };
          }
        },
      }
    );

    // ===== Sheet 3: Realised Sales (every payment received) =====
    const rs = X.createSheet(workbook, "Realised Sales", { tabColor: "FF16A34A" });
    const rsCols = [
      { header: "Date", key: "date", width: 13, type: "date" },
      { header: "Project", key: "projectName", width: 26, type: "text" },
      { header: "Apt #", key: "apartmentNumber", width: 10, type: "text" },
      { header: "Client", key: "clientName", width: 26, type: "text" },
      { header: "Payment Type", key: "paymentType", width: 15, type: "text" },
      { header: "Reason", key: "reason", width: 28, type: "text" },
      { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
    ];
    X.setWidths(rs, rsCols.map((c) => c.width));
    const rsr = X.addBanner(rs, rsCols.length, "Realised Sales - Payments Received", filterLines);
    X.addTable(rs, rsr, rsCols, realisedRows, { totals: ["amount"] });

    // ===== Sheet 4: Project Expenses =====
    const pe = X.createSheet(workbook, "Project Expenses", { tabColor: "FFDC2626" });
    const peCols = [
      { header: "Date", key: "date", width: 13, type: "date" },
      { header: "Project", key: "projectName", width: 28, type: "text" },
      { header: "Reason", key: "reason", width: 50, type: "text" },
      { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
    ];
    X.setWidths(pe, peCols.map((c) => c.width));
    const per = X.addBanner(pe, peCols.length, "Project Expenses", filterLines);
    X.addTable(pe, per, peCols, projectExpenseRows, { totals: ["amount"] });

    // ===== Sheet 5: General Expenses (only when included) =====
    if (includeGE) {
      const es = X.createSheet(workbook, "General Expenses", { tabColor: "FFEA580C", landscape: false });
      const eCols = [
        { header: "Date", key: "date", width: 13, type: "date" },
        { header: "Reason", key: "reason", width: 55, type: "text" },
        { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
      ];
      X.setWidths(es, eCols.map((c) => c.width));
      const er = X.addBanner(es, eCols.length, "General Expenses", filterLines);
      X.addTable(es, er, eCols, generalExpenseRows, { totals: ["amount"] });
    }

    // ===== Sheet 6: Commissions (only when included) =====
    if (includeComm) {
      const cs = X.createSheet(workbook, "Commissions", { tabColor: "FF7C3AED", landscape: false });
      const cCols = [
        { header: "Date", key: "date", width: 13, type: "date" },
        { header: "Project", key: "projectName", width: 28, type: "text" },
        { header: "For (Apartment / Project)", key: "label", width: 28, type: "text" },
        { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
      ];
      X.setWidths(cs, cCols.map((c) => c.width));
      const cr = X.addBanner(cs, cCols.length, "Commissions", filterLines);
      X.addTable(cs, cr, cCols, commissionRows, { totals: ["amount"] });
    }

    // ===== Sheet 7: Tadaem Micheal =====
    const ts = X.createSheet(workbook, "Tadaem Micheal", { tabColor: "FF0891B2", landscape: false });
    const tCols = [
      { header: "Date", key: "date", width: 13, type: "date" },
      { header: "Reason", key: "reason", width: 55, type: "text" },
      { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
    ];
    X.setWidths(ts, tCols.map((c) => c.width));
    const tr = X.addBanner(ts, tCols.length, "Tadaem Micheal", filterLines);
    X.addTable(ts, tr, tCols, tadaemRows, { totals: ["amount"] });

    // ===== Sheet 8: Installment Schedule (unpaid) =====
    const is = X.createSheet(workbook, "Installment Schedule", { tabColor: "FFCA8A04" });
    const iCols = [
      { header: "Due Date", key: "dueDate", width: 13, type: "date" },
      { header: "Project", key: "projectName", width: 26, type: "text" },
      { header: "Apt #", key: "apartmentNumber", width: 10, type: "text" },
      { header: "Client", key: "clientName", width: 26, type: "text" },
      { header: "Reason", key: "reason", width: 28, type: "text" },
      { header: "Amount (EGP)", key: "amount", width: 18, type: "money" },
      { header: "Status", key: "status", width: 12, type: "text" },
    ];
    X.setWidths(is, iCols.map((c) => c.width));
    const ir = X.addBanner(is, iCols.length, "Installment Schedule - Unpaid", filterLines);
    X.addTable(
      is,
      ir,
      iCols,
      scheduleRows.map((i) => ({ ...i, status: i.isOverdue ? "Overdue" : "Due" })),
      {
        totals: ["amount"],
        cellStyle: (row, col, cell) => {
          if (col.key === "status") X.statusStyle(cell, row.status === "Overdue" ? "bad" : "warn");
        },
      }
    );

    const scopeName = singleProjectName ? X.safeFileName(singleProjectName) : "All_Projects";
    const fileName = `Analysis_${scopeName}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;