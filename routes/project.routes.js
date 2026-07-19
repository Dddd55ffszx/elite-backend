const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const fs = require("fs");

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const Project = require("../models/Project");
const Expense = require("../models/Expense");
const Apartment = require("../models/Apartment");
const Commission = require("../models/Commission");

// ================= CREATE PROJECT =================
router.post("/", auth, async (req, res) => {
  try {
    const { name, location, startDate, endDate } = req.body;

    if (!name || !location) {
      return res.status(400).json({ message: "Name and location are required" });
    }

    const projectData = {
      name,
      location,
      user: req.userId,
      expectedProfitPercent: 0,
    };

    if (startDate) projectData.startDate = new Date(startDate);
    if (endDate) projectData.endDate = new Date(endDate);

    const project = await Project.create(projectData);
    res.json(project);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET ALL PROJECTS =================
router.get("/", auth, async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ createdAt: -1 });

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const apartments = await Apartment.find({ project: project._id });
        const expenses = await Expense.find({ project: project._id });
        const commissions = await Commission.find({ project: project._id });

        const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

        let actualSales = 0;
        let soldCount = 0;
        let fullyPaidCount = 0;
        let inProgressCount = 0;
        let availableCount = 0;

        apartments.forEach((apt) => {
          if (!apt.isSold) {
            availableCount++;
            return;
          }

          soldCount++;
          const soldPrice = apt.soldPrice || apt.price || 0;

          if (apt.paymentType === "cash") {
            if ((apt.payments || []).length > 0) {
              // Some cash sales are tracked with a partial-payment schedule
              const cashReceived = apt.cashPaid || 0;
              actualSales += cashReceived;

              if (cashReceived >= soldPrice) {
                fullyPaidCount++;
              } else {
                inProgressCount++;
              }
            } else {
              // No payment history recorded => a plain cash sale, paid in full at time of sale
              actualSales += soldPrice;
              fullyPaidCount++;
            }
          } else if (apt.paymentType === "installments") {
            const totalPayments = (apt.payments || [])
              .filter(p => p.isPaid === true)
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            actualSales += totalPayments;

            if (totalPayments >= soldPrice) {
              fullyPaidCount++;
            } else {
              inProgressCount++;
            }
          }
        });

        const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
        const totalExpenses = projectExpenses + totalCommissions;   // <-- commissions included

        const estimatedProfit = estimatedSales - totalExpenses ;
        const actualProfit = actualSales - totalExpenses ;

        const estimatedProfitPercent =
          estimatedSales > 0
            ? ((estimatedProfit / estimatedSales) * 100).toFixed(2)
            : 0;

        const actualProfitPercent =
          actualSales > 0 ? ((actualProfit / actualSales) * 100).toFixed(2) : 0;

        return {
          _id: project._id,
          name: project.name,
          location: project.location,
          startDate: project.startDate,
          endDate: project.endDate,
          user: project.user,
          expectedProfitPercent: project.expectedProfitPercent || 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          files: project.files || [],
          estimatedSales,
          actualSales,
          estimatedProfit,
          actualProfit,
          estimatedProfitPercent: Number(estimatedProfitPercent),
          actualProfitPercent: Number(actualProfitPercent),
          totalApartments: apartments.length,
          soldCount,
          soldApartments: soldCount,
          inProgressCount,
          inProgressApartments: inProgressCount,
          availableCount,
          availableApartments: availableCount,
          fullyPaidCount,
          fullyPaidApartments: fullyPaidCount,
          totalExpenses,          // expenses + commissions
          totalCommissions,       // separate field for display
        };
      })
    );

    res.json(projectsWithStats);
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= GET SINGLE PROJECT =================
router.get("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const apartments = await Apartment.find({ project: project._id });
    const expenses = await Expense.find({ project: project._id });
    const commissions = await Commission.find({ project: project._id });

    const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    let actualSales = 0;
    let soldCount = 0;
    let fullyPaidCount = 0;
    let inProgressCount = 0;
    let availableCount = 0;

    apartments.forEach((apt) => {
      if (!apt.isSold) {
        availableCount++;
        return;
      }

      soldCount++;
      const soldPrice = apt.soldPrice || apt.price || 0;

      if (apt.paymentType === "cash") {
        if ((apt.payments || []).length > 0) {
          const cashReceived = apt.cashPaid || 0;
          actualSales += cashReceived;

          if (cashReceived >= soldPrice) {
            fullyPaidCount++;
          } else {
            inProgressCount++;
          }
        } else {
          actualSales += soldPrice;
          fullyPaidCount++;
        }
      } else if (apt.paymentType === "installments") {
        const totalPayments = (apt.payments || [])
          .filter(p => p.isPaid === true)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        actualSales += totalPayments;

        if (totalPayments >= soldPrice) {
          fullyPaidCount++;
        } else {
          inProgressCount++;
        }
      }
    });

    const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const totalExpenses = projectExpenses + totalCommissions;   // <-- commissions included

    const estimatedProfit = estimatedSales - totalExpenses ;
    const actualProfit = actualSales - totalExpenses;

    const estimatedProfitPercent =
      estimatedSales > 0
        ? ((estimatedProfit / estimatedSales) * 100).toFixed(2)
        : 0;

    const actualProfitPercent =
      actualSales > 0 ? ((actualProfit / actualSales) * 100).toFixed(2) : 0;

    const projectData = {
      _id: project._id,
      name: project.name,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      user: project.user,
      expectedProfitPercent: project.expectedProfitPercent || 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      files: project.files || [],
      estimatedSales,
      actualSales,
      estimatedProfit,
      actualProfit,
      estimatedProfitPercent: Number(estimatedProfitPercent),
      actualProfitPercent: Number(actualProfitPercent),
      totalApartments: apartments.length,
      soldCount,
      soldApartments: soldCount,
      inProgressCount,
      inProgressApartments: inProgressCount,
      availableCount,
      availableApartments: availableCount,
      fullyPaidCount,
      fullyPaidApartments: fullyPaidCount,
      totalExpenses,
      totalCommissions,
      isFinished: apartments.length > 0 && apartments.every((apt) => apt.isSold),
    };

    res.json(projectData);
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= UPDATE PROJECT =================
router.put("/:id", auth, async (req, res) => {
  try {
    const { expectedProfitPercent, startDate, endDate } = req.body;

    const updateFields = {};
    if (expectedProfitPercent !== undefined) {
      updateFields.expectedProfitPercent = Number(expectedProfitPercent);
    }
    if (startDate !== undefined) {
      updateFields.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      updateFields.endDate = endDate ? new Date(endDate) : null;
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id },
      updateFields,
      { new: true }
    );

    if (!project) return res.status(404).json({ message: "Project not found" });

    // Recalculate stats (commissions included) for the response
    const apartments = await Apartment.find({ project: project._id });
    const expenses = await Expense.find({ project: project._id });
    const commissions = await Commission.find({ project: project._id });

    const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    let actualSales = 0;
    let soldCount = 0;
    let fullyPaidCount = 0;
    let inProgressCount = 0;
    let availableCount = 0;

    apartments.forEach((apt) => {
      if (!apt.isSold) {
        availableCount++;
        return;
      }

      soldCount++;
      const soldPrice = apt.soldPrice || apt.price || 0;

      if (apt.paymentType === "cash") {
        if ((apt.payments || []).length > 0) {
          const cashReceived = apt.cashPaid || 0;
          actualSales += cashReceived;
          if (cashReceived >= soldPrice) fullyPaidCount++;
          else inProgressCount++;
        } else {
          actualSales += soldPrice;
          fullyPaidCount++;
        }
      } else if (apt.paymentType === "installments") {
        const totalPayments = (apt.payments || [])
          .filter(p => p.isPaid === true)
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        actualSales += totalPayments;
        if (totalPayments >= soldPrice) fullyPaidCount++;
        else inProgressCount++;
      }
    });

    const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const totalExpenses = projectExpenses + totalCommissions;

    const projectData = {
      _id: project._id,
      name: project.name,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      user: project.user,
      expectedProfitPercent: project.expectedProfitPercent || 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      files: project.files || [],
      estimatedSales,
      actualSales,
      totalApartments: apartments.length,
      soldCount,
      soldApartments: soldCount,
      inProgressCount,
      inProgressApartments: inProgressCount,
      availableCount,
      availableApartments: availableCount,
      fullyPaidCount,
      fullyPaidApartments: fullyPaidCount,
      totalExpenses,
      totalCommissions,
    };

    res.json(projectData);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= DELETE PROJECT =================
router.delete("/:id", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id });
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.files && project.files.length > 0) {
      project.files.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }

    await Project.findByIdAndDelete(req.params.id);
    await Apartment.deleteMany({ project: req.params.id });
    await Expense.deleteMany({ project: req.params.id });

    res.json({ success: true, message: "Project and all related data deleted" });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= UPLOAD FILE TO PROJECT =================
router.post("/:id/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.userId });
    if (!project) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Project not found" });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.userId,
    };

    project.files.push(fileData);
    await project.save();

    res.json({ message: "File uploaded successfully", file: fileData, project });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE FILE FROM PROJECT =================
router.delete("/:id/file/:fileId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const file = project.files.id(req.params.fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    project.files.pull(req.params.fileId);
    await project.save();

    res.json({ message: "File deleted successfully", project });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET PROJECT EXPENSES =================
router.get("/:projectId/expenses", auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const expenses = await Expense.find({ project: projectId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses: expenses.map((exp) => ({
        id: exp._id,
        reason: exp.reason,
        amount: exp.amount,
        date: exp.date || exp.createdAt,
      })),
    });
  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;