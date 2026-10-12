// Shared styling helpers so every exported workbook looks consistent and professional.
// Numbers are written as real numbers (not text) with number formats, so they can be
// summed, sorted and filtered in Excel.

const COLORS = {
  navy: "FF1B2A41",
  navyLight: "FF2C3E5A",
  gold: "FFC9A227",
  goldSoft: "FFFBF3D5",
  white: "FFFFFFFF",
  text: "FF1F2933",
  muted: "FF6B7280",
  border: "FFD1D5DB",
  stripe: "FFF5F7FA",
  totalFill: "FFE8ECF2",
  green: "FF15803D",
  greenFill: "FFDCFCE7",
  red: "FFB91C1C",
  redFill: "FFFEE2E2",
  orange: "FFB45309",
  orangeFill: "FFFEF3C7",
  purple: "FF6D28D9",
};

const FONT = "Calibri";

const FORMATS = {
  money: '#,##0;[Red]-#,##0',
  moneyDec: '#,##0.00;[Red]-#,##0.00',
  int: "#,##0",
  percent: "0.00%;[Red]-0.00%",
  date: "dd/mm/yyyy",
};

const thinBorder = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function createSheet(workbook, name, { tabColor = COLORS.navy, landscape = true } = {}) {
  const sheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: tabColor }, defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: landscape ? "landscape" : "portrait",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: "&LElite For Contracting&CPage &P of &N&R&D",
    },
  });
  return sheet;
}

function setWidths(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/**
 * Title banner at the top of a sheet.
 * lines: array of strings shown under the title (project, period, filters...).
 * Returns the next free row number (leaves one blank spacer row).
 */
function addBanner(sheet, colCount, title, lines = []) {
  let r = 1;

  sheet.mergeCells(r, 1, r, colCount);
  let c = sheet.getCell(r, 1);
  c.value = "ELITE FOR CONTRACTING";
  c.font = { name: FONT, bold: true, size: 16, color: { argb: COLORS.white } };
  c.fill = solid(COLORS.navy);
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(r).height = 30;
  r++;

  sheet.mergeCells(r, 1, r, colCount);
  c = sheet.getCell(r, 1);
  c.value = title;
  c.font = { name: FONT, bold: true, size: 12, color: { argb: COLORS.navy } };
  c.fill = solid(COLORS.gold);
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(r).height = 22;
  r++;

  lines.filter(Boolean).forEach((line) => {
    sheet.mergeCells(r, 1, r, colCount);
    const lc = sheet.getCell(r, 1);
    lc.value = line;
    lc.font = { name: FONT, size: 10, color: { argb: COLORS.muted } };
    lc.fill = solid(COLORS.goldSoft);
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    sheet.getRow(r).height = 18;
    r++;
  });

  sheet.getRow(r).height = 8; // spacer
  return r + 1;
}

/** Section heading (used on summary-style sheets). */
function addSection(sheet, row, colCount, text) {
  sheet.mergeCells(row, 1, row, colCount);
  const c = sheet.getCell(row, 1);
  c.value = text.toUpperCase();
  c.font = { name: FONT, bold: true, size: 11, color: { argb: COLORS.white } };
  c.fill = solid(COLORS.navyLight);
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 22;
  return row + 1;
}

function applyValue(cell, value, type) {
  if (value === null || value === undefined || value === "") {
    cell.value = null;
    return;
  }
  switch (type) {
    case "money":
      cell.value = Number(value) || 0;
      cell.numFmt = FORMATS.money;
      cell.alignment = { horizontal: "right", vertical: "middle" };
      break;
    case "int":
      cell.value = Number(value) || 0;
      cell.numFmt = FORMATS.int;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      break;
    case "percent":
      cell.value = Number(value) || 0; // fraction, e.g. 0.125 => 12.50%
      cell.numFmt = FORMATS.percent;
      cell.alignment = { horizontal: "right", vertical: "middle" };
      break;
    case "date": {
      const d = new Date(value);
      if (isNaN(d)) {
        cell.value = String(value);
      } else {
        cell.value = d;
        cell.numFmt = FORMATS.date;
      }
      cell.alignment = { horizontal: "center", vertical: "middle" };
      break;
    }
    default:
      cell.value = value;
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 0 };
  }
}

/**
 * Draws a formatted table.
 *   columns: [{ header, key, width, type: 'text'|'money'|'int'|'percent'|'date' }]
 *   rows:    array of objects keyed by column.key
 *   opts.totals: array of column keys to total (SUM formula), label placed in first column
 *   opts.totalLabel: text for the total row (default "TOTAL")
 *   opts.emptyText: text if there are no rows
 *   opts.cellStyle(rowObj, col, cell): optional per-cell styling hook
 *   opts.freeze: freeze panes under header (default true)
 * Returns { headerRow, firstRow, lastRow, nextRow }.
 */
function addTable(sheet, startRow, columns, rows, opts = {}) {
  const { totals = [], totalLabel = "TOTAL", emptyText = "No records for the selected filters", freeze = true, cellStyle } = opts;

  const headerRow = sheet.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: FONT, bold: true, size: 10.5, color: { argb: COLORS.white } };
    cell.fill = solid(COLORS.navy);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });
  headerRow.height = 26;

  let r = startRow + 1;
  const firstRow = r;

  if (rows.length === 0) {
    sheet.mergeCells(r, 1, r, columns.length);
    const c = sheet.getCell(r, 1);
    c.value = emptyText;
    c.font = { name: FONT, italic: true, size: 10, color: { argb: COLORS.muted } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = thinBorder;
    return { headerRow: startRow, firstRow, lastRow: r, nextRow: r + 2, empty: true };
  }

  rows.forEach((rowObj, idx) => {
    const row = sheet.getRow(r);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      applyValue(cell, rowObj[col.key], col.type);
      cell.font = { name: FONT, size: 10, color: { argb: COLORS.text } };
      cell.border = thinBorder;
      if (idx % 2 === 1) cell.fill = solid(COLORS.stripe);
      if (cellStyle) cellStyle(rowObj, col, cell);
    });
    row.height = 18;
    r++;
  });
  const lastRow = r - 1;

  if (totals.length > 0) {
    const row = sheet.getRow(r);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = solid(COLORS.totalFill);
      cell.border = {
        top: { style: "medium", color: { argb: COLORS.navy } },
        left: thinBorder.left,
        bottom: thinBorder.bottom,
        right: thinBorder.right,
      };
      cell.font = { name: FONT, bold: true, size: 10.5, color: { argb: COLORS.navy } };
      if (i === 0) {
        cell.value = totalLabel;
        cell.alignment = { horizontal: "left", vertical: "middle", indent: 0 };
      }
      if (totals.includes(col.key)) {
        const letter = sheet.getColumn(i + 1).letter;
        const result = rows.reduce((s, ro) => s + (Number(ro[col.key]) || 0), 0);
        cell.value = { formula: `SUM(${letter}${firstRow}:${letter}${lastRow})`, result };
        cell.numFmt = col.type === "int" ? FORMATS.int : FORMATS.money;
        cell.alignment = { horizontal: col.type === "int" ? "center" : "right", vertical: "middle" };
      }
    });
    row.height = 22;
    r++;
  }

  if (freeze) {
    sheet.views = [{ state: "frozen", ySplit: startRow, showGridLines: false }];
  }
  sheet.autoFilter = {
    from: { row: startRow, column: 1 },
    to: { row: lastRow, column: columns.length },
  };
  // Repeat the header row on every printed page
  sheet.pageSetup.printTitlesRow = `${startRow}:${startRow}`;

  return { headerRow: startRow, firstRow, lastRow, nextRow: r + 1 };
}

/**
 * Label / value list for summary-style sheets.
 *   items: [{ label, value, type, bold, tone: 'good'|'bad'|'warn'|'purple' }]
 * label sits in column 1, value in column 2 (and optional note in column 3).
 */
function addKeyValue(sheet, startRow, items) {
  let r = startRow;
  items.forEach((item, idx) => {
    const row = sheet.getRow(r);
    const labelCell = row.getCell(1);
    const valueCell = row.getCell(2);

    labelCell.value = item.label;
    labelCell.font = { name: FONT, size: 10.5, bold: !!item.bold, color: { argb: COLORS.text } };
    labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    labelCell.border = thinBorder;

    applyValue(valueCell, item.value, item.type || "text");
    if ((item.type || "text") === "text") {
      valueCell.alignment = { horizontal: "right", vertical: "middle" };
    }
    let color = COLORS.text;
    if (item.tone === "good") color = COLORS.green;
    if (item.tone === "bad") color = COLORS.red;
    if (item.tone === "warn") color = COLORS.orange;
    if (item.tone === "purple") color = COLORS.purple;
    if (item.autoTone && typeof item.value === "number") {
      color = item.value > 0 ? COLORS.green : item.value < 0 ? COLORS.red : COLORS.text;
    }
    valueCell.font = { name: FONT, size: 10.5, bold: item.bold !== false, color: { argb: color } };
    valueCell.border = thinBorder;

    if (idx % 2 === 1) {
      labelCell.fill = solid(COLORS.stripe);
      valueCell.fill = solid(COLORS.stripe);
    }
    row.height = 20;
    r++;
  });
  return r + 1;
}

function statusStyle(cell, kind) {
  if (kind === "good") {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLORS.green } };
    cell.fill = solid(COLORS.greenFill);
  } else if (kind === "bad") {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLORS.red } };
    cell.fill = solid(COLORS.redFill);
  } else if (kind === "warn") {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLORS.orange } };
    cell.fill = solid(COLORS.orangeFill);
  }
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

const safeFileName = (s) => String(s || "report").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

module.exports = {
  COLORS,
  FORMATS,
  FONT,
  createSheet,
  setWidths,
  addBanner,
  addSection,
  addTable,
  addKeyValue,
  statusStyle,
  safeFileName,
};