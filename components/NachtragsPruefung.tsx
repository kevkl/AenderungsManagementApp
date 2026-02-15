"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface PruefErgebnis {
  position: string;
  feldname: string;
  originalWert: number | string;
  nachtragWert: number | string;
  aenderung?: number; // Prozent
  schweregrad: "info" | "warnung" | "kritisch";
}

export default function NachtragsPruefung() {
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [nachtragData, setNachtragData] = useState<any[]>([]);
  const [ergebnisse, setErgebnisse] = useState<PruefErgebnis[]>([]);
  const [headerRow, setHeaderRow] = useState<string[]>([]);
  const [filter, setFilter] = useState<"alle" | "info" | "warnung" | "kritisch">("alle");

  const isEmptyRow = (row: any[]): boolean => {
    return row.every(cell => !cell || String(cell).trim() === "");
  };

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
      cellFormula: false,
      raw: true,
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false
    });

    const cleanedData = cleanData(rawData);

    // Erste Zeile = Header
    const header = cleanedData[0] as string[];
    if (type === "original") {
      setHeaderRow(header.map(h => String(h).trim()));
    }

    const dataOnlyRows = cleanedData.filter((row, idx) => {
      if (idx === 0) return true; // Header behalten
      const filledCells = row.filter((cell: any) => {
        const cellStr = String(cell || "").trim();
        return cellStr !== "" && cellStr !== "-";
      }).length;
      return filledCells >= 4;
    });

    const normalizedData = dataOnlyRows.map(row => {
      return row.map((cell: any) => {
        const cellStr = String(cell || "").trim();
        if (cellStr === "" || cellStr === "-") return "";
        
        let cleaned = cellStr.replace(/[€$]/g, '').trim();
        const numberPattern = /^[+-]?[\d\s.,]+$/;
        
        if (numberPattern.test(cleaned)) {
          cleaned = cleaned.replace(/\s+/g, '');
          const lastDot = cleaned.lastIndexOf('.');
          const lastComma = cleaned.lastIndexOf(',');
          
          if (lastDot > lastComma) {
            cleaned = cleaned.replace(/,/g, '');
          } else if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
          }
          
          const numValue = Number(cleaned);
          if (!isNaN(numValue)) return numValue;
        }
        
        return cellStr;
      });
    });

    console.log(`${type} geladen:`, normalizedData.length, "Zeilen");
    
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
    const header = headerRow.length > 0 ? headerRow : originalData[0];

    console.log("=== VERGLEICH ===");
    console.log("Header:", header);

    // Map: Position → Row
    const nachtragMap = new Map<string, any[]>();
    nachtragData.forEach((row, idx) => {
      if (idx === 0) return;
      const key = String(row[0] || "").trim();
      if (key) nachtragMap.set(key, row);
    });

    const originalMap = new Map<string, any[]>();
    originalData.forEach((row, idx) => {
      if (idx === 0) return;
      const key = String(row[0] || "").trim();
      if (key) originalMap.set(key, row);
    });

    // Neue Positionen
    nachtragMap.forEach((row, pos) => {
      if (!originalMap.has(pos)) {
        gefundeneUnterschiede.push({
          position: pos,
          feldname: "Neue Position",
          originalWert: "(nicht vorhanden)",
          nachtragWert: "Neu hinzugefügt",
          schweregrad: "info"
        });
      }
    });

    // Gelöschte Positionen
    originalMap.forEach((row, pos) => {
      if (!nachtragMap.has(pos)) {
        gefundeneUnterschiede.push({
          position: pos,
          feldname: "Position entfernt",
          originalWert: "War vorhanden",
          nachtragWert: "(entfernt)",
          schweregrad: "warnung"
        });
      }
    });

    // Vergleiche bestehende Positionen
    originalMap.forEach((origRow, pos) => {
      const nachtRow = nachtragMap.get(pos);
      if (!nachtRow) return;

      for (let col = 1; col < origRow.length; col++) {
        const feldname = header[col] || `Spalte ${col}`;
        const origWert = origRow[col];
        const nachtWert = nachtRow[col];

        let isDifferent = false;
        let prozentAenderung: number | undefined = undefined;

        if (typeof origWert === 'number' && typeof nachtWert === 'number') {
          isDifferent = Math.abs(origWert - nachtWert) > 0.0001;
          
          if (isDifferent && origWert !== 0) {
            prozentAenderung = ((nachtWert - origWert) / origWert) * 100;
          }
        } else {
          const origStr = String(origWert || "").trim();
          const nachtStr = String(nachtWert || "").trim();
          isDifferent = origStr !== nachtStr;
        }

        if (isDifferent) {
          const schweregrad = 
            prozentAenderung && Math.abs(prozentAenderung) > 20 ? "kritisch" :
            prozentAenderung && Math.abs(prozentAenderung) > 10 ? "warnung" : "info";

          gefundeneUnterschiede.push({
            position: pos,
            feldname: feldname,
            originalWert: origWert,
            nachtragWert: nachtWert,
            aenderung: prozentAenderung,
            schweregrad: schweregrad
          });
        }
      }
    });

    console.log("Gefunden:", gefundeneUnterschiede.length, "Unterschiede");
    setErgebnisse(gefundeneUnterschiede);
  };

  const exportieren = () => {
    const exportData = ergebnisse.map(e => ({
      Position: e.position,
      Feld: e.feldname,
      Original: String(e.originalWert),
      Nachtrag: String(e.nachtragWert),
      "Änderung (%)": e.aenderung ? e.aenderung.toFixed(2) + "%" : "-",
      Schweregrad: e.schweregrad
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unterschiede");
    XLSX.writeFile(wb, `Vergleich_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getFilteredErgebnisse = () => {
    if (filter === "alle") return ergebnisse;
    return ergebnisse.filter(e => e.schweregrad === filter);
  };

  const countBySchweregrad = (schweregrad: string) => {
    return ergebnisse.filter(e => e.schweregrad === schweregrad).length;
  };

  const filteredErgebnisse = getFilteredErgebnisse();

  const getSchwergradColor = (schweregrad: string) => {
    switch (schweregrad) {
      case "kritisch": return "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600";
      case "warnung": return "bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600";
      default: return "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600";
    }
  };

  const formatWert = (wert: any) => {
    if (typeof wert === 'number') {
      return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(wert || "(leer)");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Excel Vergleich</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
          Zeilen-basierter Vergleich mit Änderungsanalyse
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {["original", "nachtrag"].map(type => (
          <div key={type} className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8">
            <h3 className="font-semibold text-lg mb-4 capitalize text-zinc-900 dark:text-zinc-50">{type}</h3>
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
              <span className="mt-2 block text-sm text-zinc-900 dark:text-zinc-100">
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
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
      >
        Vergleichen
      </button>

      {ergebnisse.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {ergebnisse.length} Änderungen gefunden
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Zeige {filteredErgebnisse.length} von {ergebnisse.length} Ergebnissen
              </p>
            </div>
            <button 
              onClick={exportieren} 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel Export
            </button>
          </div>

          {/* FILTER BUTTONS */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("alle")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "alle"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              Alle ({ergebnisse.length})
            </button>
            <button
              onClick={() => setFilter("kritisch")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "kritisch"
                  ? "bg-red-600 text-white shadow-lg"
                  : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
              }`}
            >
              Kritisch ({countBySchweregrad("kritisch")})
            </button>
            <button
              onClick={() => setFilter("warnung")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "warnung"
                  ? "bg-yellow-600 text-white shadow-lg"
                  : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800"
              }`}
            >
              Warnung ({countBySchweregrad("warnung")})
            </button>
            <button
              onClick={() => setFilter("info")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "info"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
              }`}
            >
              Info ({countBySchweregrad("info")})
            </button>
          </div>

          <div className="space-y-3">
            {filteredErgebnisse.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Keine Ergebnisse für Filter "{filter}"
                </p>
              </div>
            ) : (
              filteredErgebnisse.map((erg, idx) => (
                <div key={idx} className={`p-5 rounded-xl ${getSchwergradColor(erg.schweregrad)}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                          {erg.position}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {erg.feldname}
                        </span>
                        {erg.aenderung !== undefined && (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            erg.aenderung > 0 ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : 
                            "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                          }`}>
                            {erg.aenderung > 0 ? "+" : ""}{erg.aenderung.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Original</p>
                          <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {formatWert(erg.originalWert)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Nachtrag</p>
                          <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {formatWert(erg.nachtragWert)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <span className={`text-xs uppercase font-bold px-3 py-1 rounded-full ${
                      erg.schweregrad === "kritisch" ? "bg-red-600 text-white" :
                      erg.schweregrad === "warnung" ? "bg-yellow-600 text-white" :
                      "bg-blue-600 text-white"
                    }`}>
                      {erg.schweregrad}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}