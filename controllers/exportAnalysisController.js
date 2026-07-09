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
const ExcelJS = require("exceljs");
const { getYearlyAnalysis } = require("./analysisController");

exports.exportAnalysisExcel = async (req, res) => {
  try {
    // Reuse analysis logic but get raw data
    const { startDate, endDate, projectId } = req.query;
    const userId = req.userId;

    // Fetch data similar to getYearlyAnalysis but we'll build Excel directly
    // For brevity, we call the same logic but we need to restructure.
    // Alternative: call getYearlyAnalysis and then format Excel.
    // We'll implement a separate function to get data and then create workbook.
    const analysisResult = await getAnalysisData(userId, startDate, endDate, projectId);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Analysis Report");

   analysisResult.yearlyData.forEach((row) => {
  worksheet.addRow({
    year: row.year,
    sales: row.actualSales,
    projectExpenses: row.projectExpenses,
    generalExpenses: row.generalExpenses,
    totalExpenses: row.totalExpenses,
    profit: row.actualProfit,
    profitMargin: row.profitMargin?.toFixed(2) + "%",
  });
});
    analysisResult.monthlyData.forEach(row => {
      worksheet.addRow(row);
    });

    // Add summary row
    worksheet.addRow({});
    worksheet.addRow({ month: "TOTAL", sales: analysisResult.summary.totalSales, expenses: analysisResult.summary.totalExpenses, profit: analysisResult.summary.totalProfit });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=analysis_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function (same as getYearlyAnalysis but returns data)
async function getAnalysisData(userId, startDate, endDate, projectId) {
  // ... copy logic from analysisController and return { monthlyData, summary }
}