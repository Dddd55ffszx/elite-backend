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
      expectedSales: 0,
      actualSales: 0,
      expectedProfitPercent: 0,
      actualProfitPercent: 0
    };

    if (startDate) projectData.startDate = new Date(startDate);
    if (endDate) projectData.endDate = new Date(endDate);

    const project = await Project.create(projectData);

    res.status(201).json(project);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= GET ALL PROJECTS =================
router.get("/", auth, async (req, res) => {
  try {
    const projects = await Project.find({ user: req.userId }).sort({ createdAt: -1 });

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const apartments = await Apartment.find({ project: project._id });
        const expenses = await Expense.find({ project: project._id });

        const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

        let actualSales = 0;
        let soldCount = 0;
        let fullyPaidCount = 0;
        let inProgressCount = 0;
        let availableCount = 0;

        apartments.forEach(apt => {
          if (!apt.isSold) {
            availableCount++;
            return;
          }

          soldCount++;
          const soldPrice = apt.soldPrice || apt.price || 0;

          if (apt.paymentType === 'cash') {
            actualSales += soldPrice;
            fullyPaidCount++;
          } else if (apt.paymentType === 'installments') {
            const totalPayments = (apt.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            actualSales += totalPayments;

            if (totalPayments >= soldPrice) {
              fullyPaidCount++;
            } else {
              inProgressCount++;
            }
          }
        });

        const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const totalExpenses = projectExpenses;

        const estimatedProfit = estimatedSales - totalExpenses;
        const actualProfit = actualSales - totalExpenses;

        const commissions = await Commission.find({
    project: project._id
});

const totalCommissions =
    commissions.reduce(
       (sum,c)=>sum + c.amount,
       0
    );
        const estimatedProfitPercent = estimatedSales > 0
          ? ((estimatedProfit / estimatedSales) * 100).toFixed(2)
          : 0;

        const actualProfitPercent = actualSales > 0
          ? ((actualProfit / actualSales) * 100).toFixed(2)
          : 0;

        await Project.findByIdAndUpdate(project._id, {
          expectedSales: estimatedSales,
          actualSales: actualSales,
          expectedProfitPercent: Number(estimatedProfitPercent),
          actualProfitPercent: Number(actualProfitPercent)
        });

        return {
          _id: project._id,
          name: project.name,
          location: project.location,
          startDate: project.startDate,
          endDate: project.endDate,
          user: project.user,
          expectedSales: estimatedSales,
          actualSales: actualSales,
          expectedProfitPercent: Number(estimatedProfitPercent),
          actualProfitPercent: Number(actualProfitPercent),
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          files: project.files || [],
          estimatedSales,
          actualSales,
          estimatedProfit,
          actualProfit,
          totalApartments: apartments.length,
          soldCount,
          soldApartments: soldCount,
          inProgressCount,
          inProgressApartments: inProgressCount,
          availableCount,
          availableApartments: availableCount,
          fullyPaidCount,
          fullyPaidApartments: fullyPaidCount,
          totalExpenses
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
      return res.status(400).json({ message: "Invalid project ID format" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const apartments = await Apartment.find({ project: project._id });
    const expenses = await Expense.find({ project: project._id });

    const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    let actualSales = 0;
    let soldCount = 0;
    let fullyPaidCount = 0;
    let inProgressCount = 0;
    let availableCount = 0;

    apartments.forEach(apt => {
      if (!apt.isSold) {
        availableCount++;
        return;
      }

      soldCount++;
      const soldPrice = apt.soldPrice || apt.price || 0;

      if (apt.paymentType === 'cash') {
        actualSales += soldPrice;
        fullyPaidCount++;
      } else if (apt.paymentType === 'installments') {
        const totalPayments = (apt.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        actualSales += totalPayments;

        if (totalPayments >= soldPrice) {
          fullyPaidCount++;
        } else {
          inProgressCount++;
        }
      }
    });

    const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalExpenses = projectExpenses;

    const estimatedProfit = estimatedSales - totalExpenses;
    const actualProfit = actualSales - totalExpenses;

    const estimatedProfitPercent = estimatedSales > 0
      ? ((estimatedProfit / estimatedSales) * 100).toFixed(2)
      : 0;

    const actualProfitPercent = actualSales > 0
      ? ((actualProfit / actualSales) * 100).toFixed(2)
      : 0;

    await Project.findByIdAndUpdate(project._id, {
      expectedSales: estimatedSales,
      actualSales: actualSales,
      expectedProfitPercent: Number(estimatedProfitPercent),
      actualProfitPercent: Number(actualProfitPercent)
    });


    project.totalCommissions = totalCommissions;
    const projectData = {
      _id: project._id,
      name: project.name,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      user: project.user,
      expectedSales: estimatedSales,
      actualSales: actualSales,
      expectedProfitPercent: Number(estimatedProfitPercent),
      actualProfitPercent: Number(actualProfitPercent),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      files: project.files || [],
      estimatedSales,
      actualSales,
      estimatedProfit,
      actualProfit,
      totalApartments: apartments.length,
      soldCount,
      soldApartments: soldCount,
      inProgressCount,
      inProgressApartments: inProgressCount,
      availableCount,
      availableApartments: availableCount,
      fullyPaidCount,
      fullyPaidApartments: fullyPaidCount,
      totalExpenses
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid project ID format" });
    }

    const { expectedProfitPercent, startDate, endDate, name, location } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found or unauthorized" });
    }

    if (expectedProfitPercent !== undefined) {
      project.expectedProfitPercent = Number(expectedProfitPercent);
    }
    if (startDate !== undefined) {
      project.startDate = startDate ? new Date(startDate) : null;
    }
    if (endDate !== undefined) {
      project.endDate = endDate ? new Date(endDate) : null;
    }
    if (name !== undefined) {
      project.name = name;
    }
    if (location !== undefined) {
      project.location = location;
    }

    await project.save();

    const apartments = await Apartment.find({ project: project._id });
    const expenses = await Expense.find({ project: project._id });

    const estimatedSales = apartments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    let actualSales = 0;
    let soldCount = 0;
    let fullyPaidCount = 0;
    let inProgressCount = 0;
    let availableCount = 0;

    apartments.forEach(apt => {
      if (!apt.isSold) {
        availableCount++;
        return;
      }

      soldCount++;
      const soldPrice = apt.soldPrice || apt.price || 0;

      if (apt.paymentType === 'cash') {
        actualSales += soldPrice;
        fullyPaidCount++;
      } else if (apt.paymentType === 'installments') {
        const totalPayments = (apt.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        actualSales += totalPayments;

        if (totalPayments >= soldPrice) {
          fullyPaidCount++;
        } else {
          inProgressCount++;
        }
      }
    });

    const projectExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalExpenses = projectExpenses;

    const estimatedProfit = estimatedSales - totalExpenses;
    const actualProfit = actualSales - totalExpenses;

    const calculatedEstimatedProfitPercent = estimatedSales > 0
      ? Number(((estimatedProfit / estimatedSales) * 100).toFixed(2))
      : 0;

    const calculatedActualProfitPercent = actualSales > 0
      ? Number(((actualProfit / actualSales) * 100).toFixed(2))
      : 0;

    project.expectedSales = estimatedSales;
    project.actualSales = actualSales;
    project.actualProfitPercent = calculatedActualProfitPercent;

    if (expectedProfitPercent === undefined) {
      project.expectedProfitPercent = calculatedEstimatedProfitPercent;
    }

    await project.save();

    const projectData = {
      _id: project._id,
      name: project.name,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      user: project.user,
      expectedSales: project.expectedSales,
      actualSales: project.actualSales,
      expectedProfitPercent: project.expectedProfitPercent,
      actualProfitPercent: project.actualProfitPercent,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      files: project.files || [],
      estimatedSales: project.expectedSales,
      actualSales: project.actualSales,
      estimatedProfit,
      actualProfit,
      totalApartments: apartments.length,
      soldCount,
      soldApartments: soldCount,
      inProgressCount,
      inProgressApartments: inProgressCount,
      availableCount,
      availableApartments: availableCount,
      fullyPaidCount,
      fullyPaidApartments: fullyPaidCount,
      totalExpenses
    };

    res.json(projectData);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ================= DELETE PROJECT =================
router.delete("/:id", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid project ID format" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.files && project.files.length > 0) {
      project.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    await Project.findByIdAndDelete(req.params.id);
    await Apartment.deleteMany({ project: req.params.id });
    await Expense.deleteMany({ project: req.params.id });

    res.json({ success: true, message: "Project and related data deleted successfully" });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ================= UPLOAD FILE TO PROJECT =================
router.post("/:id/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!project) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: "Project not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.userId
    };

    project.files.push(fileData);
    await project.save();

    res.json({
      message: "File uploaded successfully",
      file: fileData,
      project: project
    });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE FILE FROM PROJECT =================
router.delete("/:id/file/:fileId", auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const file = project.files.id(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    project.files.pull(req.params.fileId);
    await project.save();

    res.json({
      message: "File deleted successfully",
      project: project
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= GET PROJECT EXPENSES =================
router.get("/:projectId/expenses", auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid project ID format" });
    }

    const expenses = await Expense.find({ project: projectId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses: expenses.map(exp => ({
        id: exp._id,
        reason: exp.reason,
        amount: exp.amount,
        date: exp.date || exp.createdAt
      }))
    });
  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;