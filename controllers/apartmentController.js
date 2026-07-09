const Apartment = require("../models/Apartment");

// Helper function to calculate apartment payment stats
const calculateApartmentStats = (apartment) => {
  const listedPrice = apartment.price || 0; // Original listed price (for expected)
  const soldPrice = apartment.soldPrice || apartment.price || 0; // Actual sold price (if different)
  
  let totalPaid = 0;
  let status = 'available';
  let paidPercentage = 0;
  let remainingAmount = listedPrice;
  let isFullyPaid = false;
  
  if (apartment.isSold) {
    if (apartment.paymentType === 'cash') {
      totalPaid = apartment.cashPaid || 0;
      // For actual sales, we use the sold price, not the cash paid
      // But for payment tracking, we track what's paid
      status = totalPaid >= soldPrice ? 'fully_paid' : 'in_progress';
      isFullyPaid = totalPaid >= soldPrice;
    } else if (apartment.paymentType === 'installments') {
totalPaid = (apartment.payments || [])
  .filter(p => p.isPaid)
  .reduce((sum, p) => sum + (p.amount || 0), 0);      status = totalPaid >= soldPrice ? 'fully_paid' : 'in_progress';
      isFullyPaid = totalPaid >= soldPrice;
    }
    paidPercentage = soldPrice > 0 ? (totalPaid / soldPrice * 100) : 0;
    remainingAmount = Math.max(0, soldPrice - totalPaid);
  }
  
  return {
    listedPrice, // Original price (for expected sales)
    soldPrice,   // Actual sold price (for actual sales)
    totalPaid,
    status,
    paidPercentage: Math.round(paidPercentage * 100) / 100,
    remainingAmount,
    isFullyPaid
  };
};

// Create apartment
exports.createApartment = async (req, res) => {
  try {
    const apartmentData = {
      ...req.body,
      isSold: false,
      cashPaid: 0,
      payments: [],
      // If soldPrice is not provided, default to price
      soldPrice: req.body.soldPrice || req.body.price || 0
    };
    
    const apartment = new Apartment(apartmentData);
    await apartment.save();
    
    res.status(201).json(apartment);
  } catch (err) {
    console.error("Create apartment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get apartments by project
exports.getApartmentsByProject = async (req, res) => {
  try {
    const apartments = await Apartment.find({
      project: req.params.projectId,
    }).sort({ apartmentId: 1 });
    
    // Add calculated stats to each apartment
    const apartmentsWithStats = apartments.map(apt => {
      const stats = calculateApartmentStats(apt);
      return {
        ...apt.toObject(),
        ...stats
      };
    });
    
    res.json(apartmentsWithStats);
  } catch (err) {
    console.error("Get apartments error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get single apartment
exports.getApartmentById = async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }
    
    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };
    
    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Get apartment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Add payment to apartment
exports.addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, reason } = req.body;

    if (amount === undefined || amount === null || isNaN(amount)) {
      return res.status(400).json({ error: "Amount must be a valid number" });
    }

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    // Add payment
    apartment.payments.push({
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      reason: reason || "",
    });

    // If it's a cash apartment, update cashPaid
    if (apartment.paymentType === 'cash') {
      apartment.cashPaid = (apartment.cashPaid || 0) + Number(amount);
    }

    // Mark as sold if not already
    if (!apartment.isSold) {
      apartment.isSold = true;
      // Set soldPrice to price if not already set
      if (!apartment.soldPrice) {
        apartment.soldPrice = apartment.price;
      }
    }

    await apartment.save();
    
    // Get updated stats
    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };

    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Add payment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Mark apartment as sold (for cash full payment)
exports.markAsSold = async (req, res) => {
  try {
    const { id } = req.params;
    
    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }
    
    apartment.isSold = true;
    
    // Set soldPrice if not already set
    if (!apartment.soldPrice) {
      apartment.soldPrice = apartment.price;
    }
    
    // For cash apartments, set cashPaid to sold price
    if (apartment.paymentType === 'cash') {
      apartment.cashPaid = apartment.soldPrice;
      
      // Add a payment record
      apartment.payments.push({
        amount: apartment.soldPrice,
        date: new Date(),
        reason: "Full payment (cash)"
      });
    }
    
    await apartment.save();
    
    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };
    
    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Mark as sold error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update apartment
exports.updateApartment = async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };

    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Update apartment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete payment
exports.deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    // Find the payment to get its amount
    const payment = apartment.payments.id(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // If cash apartment, reduce cashPaid
    if (apartment.paymentType === 'cash') {
      apartment.cashPaid = (apartment.cashPaid || 0) - (payment.amount || 0);
    }

    // Remove payment
    apartment.payments.pull(paymentId);
    
    // Check if apartment should still be marked as sold
    const totalPaid = apartment.paymentType === 'cash' 
      ? (apartment.cashPaid || 0)
      : apartment.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // If no payments left and not fully paid, mark as not sold
    if (totalPaid === 0) {
      apartment.isSold = false;
    }

    await apartment.save();

    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };

    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Delete payment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Update payment
exports.updatePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { amount, date, reason } = req.body;

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    const payment = apartment.payments.id(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Update payment
    payment.amount = Number(amount);
    payment.date = date ? new Date(date) : payment.date;
    payment.reason = reason || "";

    // Recalculate cashPaid for cash apartments
    if (apartment.paymentType === 'cash') {
      apartment.cashPaid = apartment.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }

    await apartment.save();

    const stats = calculateApartmentStats(apartment);
    const apartmentWithStats = {
      ...apartment.toObject(),
      ...stats
    };

    res.json(apartmentWithStats);
  } catch (err) {
    console.error("Update payment error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete apartment
exports.deleteApartment = async (req, res) => {
  try {
    const apartment = await Apartment.findByIdAndDelete(req.params.id);
    if (!apartment) {
      return res.status(404).json({ error: "Apartment not found" });
    }
    res.json({ message: "Apartment deleted successfully" });
  } catch (err) {
    console.error("Delete apartment error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    const apartment = await Apartment.findById(req.params.id);

    if (!apartment) {
      return res.status(404).json({ message: "Apartment not found" });
    }

    apartment.files.push({
      name: req.file.originalname,
      path: req.file.path
    });

    await apartment.save();

    res.json(apartment);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};