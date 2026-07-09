const express = require("express");
const router = express.Router();
const Apartment = require("../models/Apartment");
const upload = require("../middleware/upload");
const fs = require("fs");

// ================= CREATE APARTMENT =================
router.post("/", async (req, res) => {
  try {
    const apartment = new Apartment(req.body);
    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= GET BY PROJECT =================
router.get("/project/:projectId", async (req, res) => {
  try {
    const apartments = await Apartment.find({ project: req.params.projectId });
    res.json(apartments);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= GET SINGLE =================
router.get("/:id", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= UPDATE APARTMENT =================
router.put("/:id", async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= UPLOAD FILE =================
router.post("/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    apartment.files.push({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date()
    });
    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE FILE =================
router.delete("/:id/file/:fileId", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    const file = apartment.files.id(req.params.fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    apartment.files.pull(req.params.fileId);
    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= ADD PAYMENT =================
router.post("/:id/pay", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    // Always start as unpaid
    apartment.payments.push({ ...req.body, isPaid: false });

    // Only count isPaid === true toward cashPaid
    apartment.cashPaid = apartment.payments
      .filter(p => p.isPaid === true)
      .reduce((sum, p) => sum + p.amount, 0);

    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= MARK PAYMENT AS PAID =================
 router.put("/:id/pay/:paymentId/mark-paid", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    const payment = apartment.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.isPaid = true;
    payment.date = new Date();   // ← mark it with today’s date

    apartment.cashPaid = apartment.payments
      .filter(p => p.isPaid === true)
      .reduce((sum, p) => sum + p.amount, 0);

    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= UPDATE PAYMENT =================
router.put("/:id/pay/:paymentId", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    const payment = apartment.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    // Preserve isPaid — never overwrite it from req.body
    const currentIsPaid = payment.isPaid;
    payment.set(req.body);
    payment.isPaid = currentIsPaid;

    apartment.cashPaid = apartment.payments
      .filter(p => p.isPaid === true)
      .reduce((sum, p) => sum + p.amount, 0);

    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= DELETE PAYMENT =================
router.delete("/:id/pay/:paymentId", async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    apartment.payments.pull(req.params.paymentId);

    apartment.cashPaid = apartment.payments
      .filter(p => p.isPaid === true)
      .reduce((sum, p) => sum + p.amount, 0);

    await apartment.save();
    res.json(apartment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= DELETE APARTMENT =================
router.delete("/:id", async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndDelete(req.params.id);
    if (!apartment) return res.status(404).json({ error: "Apartment not found" });

    if (apartment.files && apartment.files.length > 0) {
      apartment.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }

    res.json({ message: "Apartment deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;