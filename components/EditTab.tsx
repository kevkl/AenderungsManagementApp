"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";

interface EditTabProps<T extends Record<string, unknown>> {
  data: T[];
  onDataChange: (data: T[]) => void;
  fileName?: string;
}

export default function EditTab<T extends Record<string, unknown>>({ 
  data, 
  onDataChange,
  fileName = "edited_file"
}: EditTabProps<T>) {
  const [editedData, setEditedData] = useState<T[]>(() => data);
  const [hasChanges, setHasChanges] = useState(() => false);
  const [recordingRow, setRecordingRow] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
  const displayColumns = columns.includes('Notiz') ? columns : [...columns, 'Notiz'];

  const handleCellEdit = (rowIndex: number, key: string, value: string) => {
    const newData = [...editedData];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [key]: value
    };
    setEditedData(newData);
    setHasChanges(true);
  };

  const startRecording = async (rowIndex: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob, rowIndex);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingRow(rowIndex);
    } catch (error) {
      console.error('Mikrofon-Zugriff fehlgeschlagen:', error);
      alert('Mikrofon-Zugriff verweigert. Bitte Berechtigung erteilen.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob, rowIndex: number) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      // Use local nodejs-whisper API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transkription fehlgeschlagen');
      }

      const data = await response.json();
      const transcript = data.text.trim();

      // Add to notes field
      const currentNote = String((editedData[rowIndex] as Record<string, unknown>)['Notiz'] || "");
      const newNote = currentNote ? `${currentNote} ${transcript}` : transcript;
      handleCellEdit(rowIndex, 'Notiz', newNote);
    } catch (error) {
      console.error('Transkription Fehler:', error);
      alert(`Fehler bei der Spracherkennung:\n${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n\nBitte sicherstellen, dass:\n1. nodejs-whisper installiert ist\n2. Whisper-Modell heruntergeladen ist`);
    } finally {
      setIsProcessing(false);
      setRecordingRow(null);
    }
  };

  const handleStartRecording = (rowIndex: number) => {
    if (isRecording && recordingRow === rowIndex) {
      stopRecording();
    } else {
      startRecording(rowIndex);
    }
  };

  const handleSave = () => {
    onDataChange(editedData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setEditedData(data);
    setHasChanges(false);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(editedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(editedData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddRow = () => {
    const newRow = columns.reduce((acc, key) => {
      acc[key] = "";
      return acc;
    }, {} as Record<string, unknown>) as T;
    
    if (!columns.includes('Notiz')) {
      (newRow as Record<string, unknown>)['Notiz'] = "";
    }
    
    setEditedData([...editedData, newRow]);
    setHasChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const newData = editedData.filter((_, idx) => idx !== rowIndex);
    setEditedData(newData);
    setHasChanges(true);
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <svg
          className="w-16 h-16 text-zinc-300 dark:text-zinc-600"
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
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          No file imported yet. Please import an Excel file first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Edit Excel Data
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {editedData.length} rows • {displayColumns.length} columns • Click cells to edit
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAddRow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>

          {hasChanges && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </button>
            </>
          )}

          <div className="relative group">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-t-lg"
              >
                Export as Excel (.xlsx)
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-b-lg"
              >
                Export as CSV (.csv)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-16">
                #
              </th>
              {displayColumns.map((columnName) => (
                <th
                  key={columnName}
                  className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
                >
                  {columnName}
                  {columnName === 'Notiz' && (
                    <svg className="inline-block w-4 h-4 ml-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
            {editedData.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <td className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                  {rowIdx + 1}
                </td>
                {displayColumns.map((columnName) => (
                  <td key={columnName} className="px-2 py-2">
                    {columnName === 'Notiz' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={String((row as Record<string, unknown>)[columnName] ?? "")}
                          onChange={(e) => handleCellEdit(rowIdx, columnName, e.target.value)}
                          placeholder={
                            isProcessing && recordingRow === rowIdx 
                              ? "Transkribiere..." 
                              : isRecording && recordingRow === rowIdx
                              ? "Aufnahme läuft..."
                              : "Notiz oder Mikrofon nutzen..."
                          }
                          disabled={isProcessing && recordingRow === rowIdx}
                          className="flex-1 px-3 py-1.5 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 rounded text-zinc-900 dark:text-zinc-100 outline-none transition-colors disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleStartRecording(rowIdx)}
                          disabled={isProcessing}
                          className={`p-2 rounded-lg transition-all ${
                            isRecording && recordingRow === rowIdx
                              ? "bg-red-600 text-white animate-pulse"
                              : isProcessing && recordingRow === rowIdx
                              ? "bg-yellow-600 text-white"
                              : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
                          }`}
                          title={
                            isRecording && recordingRow === rowIdx 
                              ? "Aufnahme stoppen" 
                              : isProcessing && recordingRow === rowIdx
                              ? "Wird verarbeitet..."
                              : "Sprachaufnahme starten"
                          }
                        >
                          {isProcessing && recordingRow === rowIdx ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={String(row[columnName] ?? "")}
                        onChange={(e) => handleCellEdit(rowIdx, columnName, e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 rounded text-zinc-900 dark:text-zinc-100 outline-none transition-colors"
                      />
                    )}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDeleteRow(rowIdx)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="Delete row"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
