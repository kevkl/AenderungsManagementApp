import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { originalLV, nachtragLV } = await request.json();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("=== POSITIONS-VERGLEICH ===");
          console.log("Original:", originalLV.length, "Zeilen");
          console.log("Nachtrag:", nachtragLV.length, "Zeilen");
          
          const results = compareByPosition(originalLV, nachtragLV);
          
          console.log("Ergebnisse:", results.length);
          
          // Sende Ergebnisse
          for (const result of results) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ ergebnis: result })}\n\n`
              )
            );
          }

          controller.close();
        } catch (error) {
          console.error("Fehler:", error);
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                ergebnis: {
                  position: "FEHLER",
                  kategorie: "Systemfehler",
                  befund: String(error),
                  schweregrad: "kritisch",
                  details: "Siehe Console"
                }
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Fehler bei der Prüfung" }),
      { status: 500 }
    );
  }
}

interface LVRow {
  [key: string]: string | number | null;
}

function compareByPosition(original: LVRow[], nachtrag: LVRow[]): LVRow[] {
  const results: Array<{
    position: string;
    kategorie: string;
    befund: string;
    schweregrad: string;
    details: string;
  }> = [];
  
  if (!original.length || !nachtrag.length) {
    results.push({
      position: "FEHLER",
      kategorie: "Keine Daten",
      befund: "Leere Eingabe",
      schweregrad: "kritisch",
      details: `Original: ${original.length}, Nachtrag: ${nachtrag.length}`,
    });
    return results;
  }
  
  // Erste Spalte = Position/Identifier (z.B. "Bauleiter", "Polier")
  const columns = Object.keys(original[0]);
  const idCol = columns[0]; // z.B. "Berechnung Baustellengemeinkosten"
  
  console.log("ID-Spalte:", idCol);
  console.log("Alle Spalten:", columns);
  
  // Erstelle Maps: ID → Zeile
  const originalMap = new Map<string, LVRow>();
  original.forEach((row, idx) => {
    const id = String(row[idCol] || "").trim();
    if (id && id !== "" && idx > 1) { // Skip erste 2 Zeilen (Überschriften)
      originalMap.set(id, row);
    }
  });
  
  const nachtragMap = new Map<string, LVRow>();
  nachtrag.forEach((row, idx) => {
    const id = String(row[idCol] || "").trim();
    if (id && id !== "" && idx > 1) {
      nachtragMap.set(id, row);
    }
  });
  
  console.log("Original IDs:", Array.from(originalMap.keys()));
  console.log("Nachtrag IDs:", Array.from(nachtragMap.keys()));
  
  // Sammle alle IDs
  const allIDs = new Set([...originalMap.keys(), ...nachtragMap.keys()]);
  
  let changeCount = 0;
  
  // Vergleiche Position für Position
  allIDs.forEach(id => {
    const origRow = originalMap.get(id);
    const nachtRow = nachtragMap.get(id);
    
    if (!origRow && nachtRow) {
      // Neue Position
      results.push({
        position: id,
        kategorie: "Neue Position",
        befund: "Neu hinzugefügt",
        schweregrad: "info",
        details: "Im Original nicht vorhanden",
      });
      changeCount++;
    } else if (origRow && !nachtRow) {
      // Position entfernt
      results.push({
        position: id,
        kategorie: "Position entfernt",
        befund: "Entfernt",
        schweregrad: "warnung",
        details: "War im Original vorhanden",
      });
      changeCount++;
    } else if (origRow && nachtRow) {
      // Vergleiche alle Spalten dieser Position
      columns.forEach((col, colIdx) => {
        if (colIdx === 0) return; // Skip ID-Spalte
        
        const origValue = String(origRow[col] || "").trim();
        const nachtValue = String(nachtRow[col] || "").trim();
        
        // Wenn unterschiedlich
        if (origValue !== nachtValue) {
          results.push({
            position: id,
            kategorie: col,
            befund: `"${origValue}" → "${nachtValue}"`,
            schweregrad: "info",
            details: `Spalte: ${col}`,
          });
          changeCount++;
        }
      });
    }
  });
  
  // Gesamtübersicht
  if (results.length > 0) {
    results.unshift({
      position: "ÜBERSICHT",
      kategorie: "Vergleich",
      befund: `${changeCount} Änderungen in ${allIDs.size} Positionen`,
      schweregrad: "info",
      details: `Original: ${originalMap.size} Positionen, Nachtrag: ${nachtragMap.size} Positionen`,
    });
  } else {
    results.push({
      position: "INFO",
      kategorie: "Identisch",
      befund: "Keine Unterschiede",
      schweregrad: "info",
      details: `${allIDs.size} Positionen verglichen`,
    });
  }
  
  return results;
}
