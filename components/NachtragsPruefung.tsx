"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface PruefErgebnis {
  zeile: number;
  spalte: string;
  original: string;
  nachtrag: string;
  schweregrad: "info" | "warnung" | "kritisch";
}

export default function NachtragsPruefung() {
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [nachtragData, setNachtragData] = useState<any[]>([]);
  const [ergebnisse, setErgebnisse] = useState<PruefErgebnis[]>([]);

  // Helper function to check if a row is empty or just whitespace
  const isEmptyRow = (row: any[]): boolean => {
    return row.every(cell => !cell || String(cell).trim() === "");
  };

  // Helper function to clean the data by removing empty rows
  const cleanData = (data: any[]): any[] => {
    return data.filter(row => !isEmptyRow(row));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "original" | "nachtrag"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { 
      type: "array", 
      cellFormula: true,  // Keep formulas but also read calculated values
      cellDates: false,
      cellNF: false,
      sheetStubs: false
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    console.log("sheet raw:", sheet);
    
    // Use array of arrays to avoid issues with merged cells
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,  // Get raw values (numbers as numbers, cached formula values)
      blankrows: false
    });

    // Remove empty rows first
    const cleanedData = cleanData(rawData);

    // Filter out category/section rows (rows with ≤3 filled cells)
    // Keep header row (first row) and data rows (rows with data in at least 4 columns)
    const dataOnlyRows = cleanedData.filter((row, idx) => {
      // Always keep the first row (header)
      if (idx === 0) return true;
      
      // Count filled cells (not null, not empty string, not just whitespace)
      const filledCells = row.filter((cell: any) => {
        if (cell === null || cell === undefined) return false;
        const cellStr = String(cell).trim();
        return cellStr !== "" && cellStr !== "-";
      }).length;
      
      // Keep rows with at least 4 filled cells (these are data rows)
      // Skip rows with ≤3 filled cells (these are section headers like "1.", "1.1.")
      return filledCells >= 4;
    });

    console.log(`${type} - Original rows: ${cleanedData.length}, After filtering: ${dataOnlyRows.length}`);

    // Normalize all values - convert to number or string
    const normalizedData = dataOnlyRows.map((row, rowIdx) => {
      return row.map((cell: any) => {
        const cellStr = String(cell || "").trim();
        
        if (cellStr === "" || cellStr === "-") {
          return ""; // Empty cells stay empty strings
        }
        
        // Try to detect and parse numbers with various formats
        // Remove currency symbols and extra spaces first
        let cleaned = cellStr
          .replace(/€/g, '')
          .replace(/\$/g, '')
          .replace(/USD/g, '')
          .replace(/EUR/g, '')
          .trim();
        
        // Check if this looks like a number
        // Numbers can have: digits, one decimal separator (. or ,), thousand separators, +/- signs
        const numberPattern = /^[+-]?[\d\s.,]+$/;
        
        if (numberPattern.test(cleaned)) {
          // Remove all spaces
          cleaned = cleaned.replace(/\s+/g, '');
          
          // Detect format:
          // 1,234.56 (US format - comma for thousands, dot for decimal)
          // 1.234,56 (EU format - dot for thousands, comma for decimal)
          // 1234.56 (simple - just dot)
          // 1234,56 (simple - just comma)
          
          const lastDot = cleaned.lastIndexOf('.');
          const lastComma = cleaned.lastIndexOf(',');
          
          if (lastDot > lastComma) {
            // Dot is the decimal separator (US format or simple)
            // Remove all commas (thousand separators)
            cleaned = cleaned.replace(/,/g, '');
          } else if (lastComma > lastDot) {
            // Comma is the decimal separator (EU format or simple)
            // Remove all dots (thousand separators) and replace comma with dot
            cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
          } else if (lastDot === -1 && lastComma === -1) {
            // No separator, just digits - it's already clean
          }
          
          // Try to convert to number
          const numValue = Number(cleaned);
          if (!isNaN(numValue)) {
            return numValue;
          }
        }
        
        // Otherwise return as trimmed string
        return cellStr;
      });
    });

    console.log("data raw:", normalizedData);
    console.log(`${type} geladen:`, normalizedData.length, "Zeilen");
    console.log(`${type} Beispiel Zeile 0:`, normalizedData[0]);
    console.log(`${type} Beispiel Zeile 1:`, normalizedData[1]);
    console.log(`${type} Beispiel Zeile 2:`, normalizedData[2]);
    
    if (type === "original") {
      setOriginalData(normalizedData);
    } else {
      setNachtragData(normalizedData);
    }
  };

  const vergleichen = () => {
    if (!originalData.length || !nachtragData.length) {
      alert("Bitte beide Dateien hochladen!");
      return;
    }

    const gefundeneUnterschiede: PruefErgebnis[] = [];

    console.log("=== VERGLEICH ===");
    console.log("Original:", originalData.length, "Zeilen");
    console.log("Nachtrag:", nachtragData.length, "Zeilen");

    // Create a map of nachtrag rows by their first column (key)
    const nachtragMap = new Map<string, any[]>();
    nachtragData.forEach((row, idx) => {
      if (idx === 0) return; // Skip header
      const key = String(row[0] || "").trim();
      if (key) {
        nachtragMap.set(key, row);
      }
    });

    // Compare each original row with matching nachtrag row
    for (let i = 0; i < originalData.length; i++) {
      const origZeile = originalData[i] as any[];
      
      // Skip header row
      if (i === 0) continue;

      const key = String(origZeile[0] || "").trim();
      
      if (!key) continue; // Skip rows without a key
      
      const nachtZeile = nachtragMap.get(key);

      // Row not found in nachtrag?
      if (!nachtZeile) {
        gefundeneUnterschiede.push({
          zeile: i + 1,
          spalte: "ALLE",
          original: origZeile.map(v => String(v)).join(" | "),
          nachtrag: "(nicht vorhanden)",
          schweregrad: "warnung"
        });
        continue;
      }

      // Compare all columns
      const maxSpalten = Math.max(origZeile.length, nachtZeile.length);

      for (let col = 0; col < maxSpalten; col++) {
        const origWert = origZeile[col];
        const nachtWert = nachtZeile[col];

        // Compare as strings for display, but handle numbers properly
        const origStr = typeof origWert === 'number' ? String(origWert) : String(origWert || "").trim();
        const nachtStr = typeof nachtWert === 'number' ? String(nachtWert) : String(nachtWert || "").trim();

        // For numbers, also compare numerically to handle floating point differences
        let isDifferent = false;
        if (typeof origWert === 'number' && typeof nachtWert === 'number') {
          // Compare numbers with small tolerance for floating point
          isDifferent = Math.abs(origWert - nachtWert) > 0.0001;
        } else {
          // String comparison
          isDifferent = origStr !== nachtStr;
        }

        if (isDifferent) {
          // Convert column index to letter (A, B, C, etc.)
          const spaltenName = String.fromCharCode(65 + col);
          
          gefundeneUnterschiede.push({
            zeile: i + 1,
            spalte: spaltenName,
            original: origStr,
            nachtrag: nachtStr,
            schweregrad: "info"
          });
        }
      }

      // Mark as found
      nachtragMap.delete(key);
    }

    // Check for new rows in nachtrag that don't exist in original
    nachtragMap.forEach((row, key) => {
      gefundeneUnterschiede.push({
        zeile: 0, // Don't know the line number
        spalte: "ALLE",
        original: "(nicht vorhanden)",
        nachtrag: row.map(v => String(v)).join(" | "),
        schweregrad: "info"
      });
    });

    console.log("Gefunden:", gefundeneUnterschiede.length, "Unterschiede");
    setErgebnisse(gefundeneUnterschiede);
  };

  const exportieren = () => {
    const ws = XLSX.utils.json_to_sheet(ergebnisse);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unterschiede");
    XLSX.writeFile(wb, `Vergleich_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h2 className="text-3xl font-bold">Excel Vergleich</h2>

      <div className="grid grid-cols-2 gap-6">
        {["original", "nachtrag"].map(type => (
          <div key={type} className="border-2 border-dashed rounded-xl p-8">
            <h3 className="font-semibold text-lg mb-4 capitalize">{type}</h3>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileUpload(e, type as any)}
              className="hidden"
              id={`file-${type}`}
            />
            <label htmlFor={`file-${type}`} className="cursor-pointer block text-center">
              <svg className="w-16 h-16 mx-auto text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="mt-2 block text-sm">
                {(type === "original" ? originalData : nachtragData).length > 0
                  ? `✓ ${(type === "original" ? originalData : nachtragData).length} Zeilen`
                  : "Datei hochladen"}
              </span>
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={vergleichen}
        disabled={!originalData.length || !nachtragData.length}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-zinc-300"
      >
        Vergleichen
      </button>

      {ergebnisse.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold">{ergebnisse.length} Unterschiede gefunden</h3>
            <button onClick={exportieren} className="px-4 py-2 bg-green-600 text-white rounded-lg">
              Excel Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Zeile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Spalte</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Original</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Nachtrag</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                {ergebnisse.map((erg, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{erg.zeile}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{erg.spalte}</td>
                    <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400">{erg.original || "(leer)"}</td>
                    <td className="px-6 py-4 text-sm text-green-600 dark:text-green-400">{erg.nachtrag || "(leer)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}