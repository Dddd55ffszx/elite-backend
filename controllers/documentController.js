const Document = require("../models/Document");

const uploadDocument = async (req, res) => {
  console.log("BODY:", req.body);
  console.log("FILE:", req.file);

  const { relatedType, relatedId, documentType } = req.body;

  // Validate required fields
  if (!req.file) return res.status(400).json({ message: "File is required" });
  if (!relatedType || !relatedId || !documentType)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const doc = await Document.create({
      relatedType,
      relatedId,
      documentType,
      fileUrl: `/uploads/${req.file.filename}`,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { uploadDocument };
