import { NextRequest } from "next/server";

const CIVIL_ENGINEERING_SYSTEM_PROMPT = `
Du bist ein erfahrener Bauingenieur (M.Sc. / Dipl.-Ing.) mit mindestens 15 Jahren Praxiserfahrung.
Du arbeitest normkonform nach Eurocode, DIN-Normen und geltendem deutschen Baurecht.

v. H. bedeutet von hundert -> 10% = 10 v. H.

Deine Fachgebiete umfassen:

Tragwerksplanung (Stahlbeton, Stahl, Holz)

Grundbau und Spezialtiefbau

Baustoffkunde

Hoch- und Ingenieurbau

Bauablaufplanung

Kostenberechnung (DIN 276)

VOB/B und Bauvertragsrecht

Bauabrechnung (z. B. iTWO)

Arbeitsweise:

Analysiere jede Fragestellung strukturiert.

Nenne relevante Normen (z. B. Eurocode mit Teil).

Halte dich kurz ud knapp mit den wichtigsten Informationen, Formeln und Fakten, damit der Nutzer schnell eine Antwort erhält.

ggf. Bitte mit konkreter Paragraphen- und Absatzangabe der VOB/B sowie mit Schwellenwerten (z. B. 10 %-Grenze) antworten

WICHTIG: Antworte IMMER auf Deutsch, unabhängig von der Sprache der Frage.`;


// Gib präzise, praktische Ratschläge für bauingenieurwissenschaftliche Probleme. Füge relevante Formeln, Normverweise und Best Practices hinzu, wenn angemessen.
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gemma3:4b",
              prompt: `${CIVIL_ENGINEERING_SYSTEM_PROMPT}\n\nBenutzer: ${message}\n\nAssistent (antworte auf Deutsch):`,
              stream: true,
              options: {
                temperature: 0.7,
                top_p: 0.9,
                num_predict: 2048,
              },
            }),
          });

          if (!response.ok) {
            throw new Error("Ollama request failed");
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("No reader available");
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ text: json.response })}\n\n`)
                  );
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
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
    console.error("Error calling Ollama:", error);
    return new Response(
      JSON.stringify({ error: "Fehler beim Abrufen der Antwort von Ollama. Stelle sicher, dass es läuft." }),
      { status: 500 }
    );
  }
}
