"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface PruefErgebnis {
  kategorie: string;
  befund: string;
  schweregrad: "info" | "warnung" | "kritisch";
  details?: string;
  position?: string;
}

interface LVPosition {
  position: string;
  kurztext: string;
  menge: number;
  einheit: string;
  ep: number;
  gp: number;
}

export default function NachtragsPruefung() {
  const [originalLV, setOriginalLV] = useState<LVPosition[]>([]);
  const [nachtragLV, setNachtragLV] = useState<LVPosition[]>([]);
  const [isPruefing, setIsPruefing] = useState(false);
  const [ergebnisse, setErgebnisse] = useState<PruefErgebnis[]>([]);
  const [filter, setFilter] = useState<"alle" | "info" | "warnung" | "kritisch">("alle");

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "original" | "nachtrag"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Lese als Array von Arrays (rohe Daten)
      const rawData = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1, // Array von Arrays
        raw: false,
        defval: "",
      }) as any[][];

      console.log(`${type} - Geladen:`, rawData.length, "Zeilen");
      console.log(`${type} - Erste 5 Zeilen:`, rawData.slice(0, 5));

      if (rawData.length === 0) {
        alert(`Keine Daten in ${type}-Datei gefunden`);
        return;
      }

      // Finde wo die echten Daten beginnen
      let dataStartIndex = 0;
      
      for (let i = 0; i < Math.min(15, rawData.length); i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        const firstCell = String(row[0] || "").trim();
        
        // Prüfe ob erste Zelle eine Positionsnummer sein könnte
        // (Zahl, mit oder ohne Punkt, z.B. "1", "1.1", "01.00")
        if (/^\d+\.?\d*$/.test(firstCell) && firstCell !== "") {
          dataStartIndex = i;
          console.log(`${type} - Daten starten bei Zeile ${i + 1}`);
          break;
        }
      }

      // Parse die Daten
      const parsedData: LVPosition[] = [];
      
      for (let i = dataStartIndex; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Skip leere Zeilen
        if (!row || row.every(cell => !cell || String(cell).trim() === "")) continue;

        const pos = String(row[0] || "").trim();
        
        // Skip wenn keine gültige Position
        if (!pos || pos === "" || !/\d/.test(pos)) continue;

        // Parse Zahlen (ersetze Komma durch Punkt für deutsche Zahlen)
        const parseNumber = (val: any): number => {
          if (!val) return 0;
          const str = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
          return parseFloat(str) || 0;
        };

        const position: LVPosition = {
          position: pos,
          kurztext: String(row[1] || "").trim(),
          menge: parseNumber(row[2]),
          einheit: String(row[3] || "").trim(),
          ep: parseNumber(row[4]),
          gp: parseNumber(row[5]),
        };

        // Berechne GP falls nicht vorhanden
        if (position.gp === 0 && position.menge > 0 && position.ep > 0) {
          position.gp = position.menge * position.ep;
        }

        parsedData.push(position);
      }

      console.log(`${type} - Geparst:`, parsedData.length, "Positionen");
      console.log(`${type} - Erste 3 Positionen:`, parsedData.slice(0, 3));

      if (parsedData.length === 0) {
        alert(`Keine LV-Positionen gefunden!\n\nStellen Sie sicher, dass:\n• Spalte A Positionsnummern enthält (z.B. 1, 1.1, 01)\n• Die Daten strukturiert sind (Position, Text, Menge, Einheit, EP, GP)`);
        return;
      }

      if (type === "original") {
        setOriginalLV(parsedData);
      } else {
        setNachtragLV(parsedData);
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert(`Fehler beim Laden der ${type}-Datei: ${error}`);
    }
  };

  const pruefenNachtrag = async () => {
    if (!originalLV.length || !nachtragLV.length) {
      alert("Bitte beide Leistungsverzeichnisse hochladen");
      return;
    }

    setIsPruefing(true);
    setErgebnisse([]);

    await new Promise(resolve => setTimeout(resolve, 500));

    const neueErgebnisse: PruefErgebnis[] = [];

    // 1. Neue Positionen
    for (const nPos of nachtragLV) {
      const origPos = originalLV.find(o => o.position === nPos.position);
      
      if (!origPos) {
        neueErgebnisse.push({
          kategorie: "Neue Position",
          befund: `Position "${nPos.position}" ist neu im Nachtrag`,
          schweregrad: "info",
          details: `${nPos.kurztext} - Menge: ${nPos.menge} ${nPos.einheit}, EP: ${nPos.ep.toFixed(2)} €, GP: ${nPos.gp.toFixed(2)} €`,
          position: nPos.position
        });
      }
    }

    // 2. Gelöschte Positionen
    for (const oPos of originalLV) {
      const nachtPos = nachtragLV.find(n => n.position === oPos.position);
      
      if (!nachtPos) {
        neueErgebnisse.push({
          kategorie: "Gelöschte Position",
          befund: `Position "${oPos.position}" wurde entfernt`,
          schweregrad: "warnung",
          details: `Ursprünglich: ${oPos.kurztext} - GP: ${oPos.gp.toFixed(2)} €`,
          position: oPos.position
        });
      }
    }

    // 3. Änderungen bei bestehenden Positionen
    for (const nPos of nachtragLV) {
      const origPos = originalLV.find(o => o.position === nPos.position);
      
      if (origPos) {
        // Mengenänderung
        if (Math.abs(nPos.menge - origPos.menge) > 0.001) {
          const diff = nPos.menge - origPos.menge;
          const diffPercent = origPos.menge !== 0 ? ((diff / origPos.menge) * 100).toFixed(1) : "∞";
          const absDiffPercent = diffPercent === "∞" ? 100 : Math.abs(parseFloat(diffPercent));
          
          neueErgebnisse.push({
            kategorie: "Mengenänderung",
            befund: `Menge von ${origPos.menge} auf ${nPos.menge} ${nPos.einheit} geändert (${diffPercent}%)`,
            schweregrad: absDiffPercent > 50 ? "kritisch" : absDiffPercent > 20 ? "warnung" : "info",
            details: `${nPos.kurztext}`,
            position: nPos.position
          });
        }

        // Preisänderung
        if (Math.abs(nPos.ep - origPos.ep) > 0.01) {
          const diff = nPos.ep - origPos.ep;
          const diffPercent = origPos.ep !== 0 ? ((diff / origPos.ep) * 100).toFixed(1) : "∞";
          const absDiffPercent = diffPercent === "∞" ? 100 : Math.abs(parseFloat(diffPercent));
          
          neueErgebnisse.push({
            kategorie: "Preisänderung",
            befund: `Einheitspreis von ${origPos.ep.toFixed(2)} € auf ${nPos.ep.toFixed(2)} € geändert (${diffPercent}%)`,
            schweregrad: absDiffPercent > 30 ? "kritisch" : absDiffPercent > 10 ? "warnung" : "info",
            details: `${nPos.kurztext} - Neue GP: ${nPos.gp.toFixed(2)} €`,
            position: nPos.position
          });
        }

        // Gesamtpreisänderung (nur wenn nicht durch Menge/Preis erklärt)
        if (Math.abs(nPos.gp - origPos.gp) > 0.01) {
          const mengeGleich = Math.abs(nPos.menge - origPos.menge) < 0.001;
          const epGleich = Math.abs(nPos.ep - origPos.ep) < 0.01;
          
          if (mengeGleich && epGleich) {
            const diff = nPos.gp - origPos.gp;
            const diffPercent = origPos.gp !== 0 ? ((diff / origPos.gp) * 100).toFixed(1) : "∞";
            const absDiffPercent = diffPercent === "∞" ? 100 : Math.abs(parseFloat(diffPercent));
            
            neueErgebnisse.push({
              kategorie: "Gesamtpreisänderung",
              befund: `Gesamtpreis von ${origPos.gp.toFixed(2)} € auf ${nPos.gp.toFixed(2)} € geändert (${diffPercent}%)`,
              schweregrad: absDiffPercent > 30 ? "kritisch" : absDiffPercent > 10 ? "warnung" : "info",
              details: `${nPos.kurztext}`,
              position: nPos.position
            });
          }
        }

        // Textänderung
        if (nPos.kurztext !== origPos.kurztext && origPos.kurztext && nPos.kurztext) {
          neueErgebnisse.push({
            kategorie: "Textänderung",
            befund: `Kurztext wurde geändert`,
            schweregrad: "info",
            details: `Alt: "${origPos.kurztext}" → Neu: "${nPos.kurztext}"`,
            position: nPos.position
          });
        }
      }
    }

    // 4. Gesamtkostenvergleich
    const origSumme = originalLV.reduce((sum, pos) => sum + pos.gp, 0);
    const nachtragSumme = nachtragLV.reduce((sum, pos) => sum + pos.gp, 0);
    const diff = nachtragSumme - origSumme;
    const diffPercent = origSumme !== 0 ? ((diff / origSumme) * 100).toFixed(2) : "∞";

    if (Math.abs(diff) > 0.01) {
      neueErgebnisse.push({
        kategorie: "Gesamtkostenänderung",
        befund: `Gesamtkosten ${diff > 0 ? 'gestiegen' : 'gesunken'} um ${Math.abs(diff).toFixed(2)} € (${diffPercent}%)`,
        schweregrad: Math.abs(parseFloat(diffPercent === "∞" ? "100" : diffPercent)) > 20 ? "kritisch" : Math.abs(parseFloat(diffPercent === "∞" ? "100" : diffPercent)) > 10 ? "warnung" : "info",
        details: `Original: ${origSumme.toFixed(2)} € → Nachtrag: ${nachtragSumme.toFixed(2)} €`
      });
    }

    // Sortiere
    neueErgebnisse.sort((a, b) => {
      const order = { kritisch: 0, warnung: 1, info: 2 };
      return order[a.schweregrad] - order[b.schweregrad];
    });

    setErgebnisse(neueErgebnisse);
    setIsPruefing(false);
  };

  const getFilteredErgebnisse = () => {
    if (filter === "alle") return ergebnisse;
    return ergebnisse.filter((erg) => erg.schweregrad === filter);
  };

  const filteredErgebnisse = getFilteredErgebnisse();

  const countBySchweregrad = (schweregrad: string) => {
    return ergebnisse.filter((erg) => erg.schweregrad === schweregrad).length;
  };

  const getSchwergradColor = (schweregrad: string) => {
    switch (schweregrad) {
      case "info":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "warnung":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      case "kritisch":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      default:
        return "bg-zinc-100 dark:bg-zinc-800";
    }
  };

  const getSchwergradIcon = (schweregrad: string) => {
    switch (schweregrad) {
      case "info":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case "warnung":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case "kritisch":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const exportErgebnisse = () => {
    const exportData = ergebnisse.map(erg => ({
      Position: erg.position || "-",
      Kategorie: erg.kategorie,
      Schweregrad: erg.schweregrad,
      Befund: erg.befund,
      Details: erg.details || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prüfergebnisse");
    XLSX.writeFile(wb, `Nachtragspruefung_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Leistungsverzeichnis-Vergleich
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
          Automatische Analyse und Vergleich von Original-LV und Nachtrags-LV
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original LV */}
        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 mb-4">
            Original-LV
          </h3>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e, "original")}
            className="hidden"
            id="original-lv"
          />
          <label
            htmlFor="original-lv"
            className="cursor-pointer flex flex-col items-center space-y-3 text-center"
          >
            <svg
              className="w-16 h-16 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {originalLV.length > 0 ? (
              <div className="space-y-1">
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  ✓ {originalLV.length} Positionen geladen
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gesamtwert: {originalLV.reduce((sum, pos) => sum + pos.gp, 0).toFixed(2)} €
                </p>
              </div>
            ) : (
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Excel-Datei hier hochladen oder klicken
              </span>
            )}
          </label>
        </div>

        {/* Nachtrags-LV */}
        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-50 mb-4">
            Nachtrags-LV
          </h3>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e, "nachtrag")}
            className="hidden"
            id="nachtrag-lv"
          />
          <label
            htmlFor="nachtrag-lv"
            className="cursor-pointer flex flex-col items-center space-y-3 text-center"
          >
            <svg
              className="w-16 h-16 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {nachtragLV.length > 0 ? (
              <div className="space-y-1">
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  ✓ {nachtragLV.length} Positionen geladen
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gesamtwert: {nachtragLV.reduce((sum, pos) => sum + pos.gp, 0).toFixed(2)} €
                </p>
              </div>
            ) : (
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Excel-Datei hier hochladen oder klicken
              </span>
            )}
          </label>
        </div>
      </div>

      <button
        onClick={pruefenNachtrag}
        disabled={isPruefing || originalLV.length === 0 || nachtragLV.length === 0}
        className="w-full py-4 px-6 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {isPruefing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Vergleich läuft...
          </span>
        ) : (
          "Leistungsverzeichnisse vergleichen"
        )}
      </button>

      {/* Debug Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
        <strong>Debug:</strong> Original={originalLV.length} Positionen | Nachtrag={nachtragLV.length} Positionen | 
        Button {(isPruefing || originalLV.length === 0 || nachtragLV.length === 0) ? "DEAKTIVIERT" : "AKTIVIERT"}
      </div>

      {/* Ergebnisse */}
      {ergebnisse.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Prüfergebnisse
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {filteredErgebnisse.length} von {ergebnisse.length} Ergebnissen angezeigt
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={exportErgebnisse}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportieren
              </button>
            </div>
          </div>

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
            {filteredErgebnisse.map((erg, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-xl ${getSchwergradColor(erg.schweregrad)} border-l-4 ${
                  erg.schweregrad === "kritisch" ? "border-red-600" :
                  erg.schweregrad === "warnung" ? "border-yellow-600" :
                  "border-blue-600"
                } shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSchwergradIcon(erg.schweregrad)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {erg.position && (
                        <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-zinc-900 bg-opacity-70 shadow-sm">
                          Pos. {erg.position}
                        </span>
                      )}
                      <span className="font-bold text-base">{erg.kategorie}</span>
                      <span className="text-xs font-semibold uppercase px-2 py-1 rounded bg-white dark:bg-zinc-900 bg-opacity-50">
                        {erg.schweregrad}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{erg.befund}</p>
                    {erg.details && (
                      <p className="text-xs mt-2 opacity-80 bg-white dark:bg-zinc-900 bg-opacity-30 rounded px-3 py-2">
                        {erg.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredErgebnisse.length === 0 && (
              <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Keine Ergebnisse für Filter "{filter}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isPruefing && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">
            Vergleiche Leistungsverzeichnisse...
          </p>
        </div>
      )}
    </div>
  );
}