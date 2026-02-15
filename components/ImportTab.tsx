"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface ImportTabProps {
  onDataImported: (data: Record<string, unknown>[]) => void;
}

export default function ImportTab({ onDataImported }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let jsonData: Record<string, unknown>[] = [];

      if (fileExtension === 'csv') {
        // Parse CSV file
        const text = await file.text();
        const workbook = XLSX.read(text, { type: "string" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
      } else {
        // Parse Excel file (.xlsx, .xls)
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
      }
      
      onDataImported(jsonData);
      alert(`File "${file.name}" imported successfully with ${jsonData.length} rows!`);
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Please make sure it's a valid Excel or CSV file.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full justify-center min-h-[400px] space-y-6">
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Import Excel or CSV File
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Select an Excel file (.xlsx, .xls) or CSV file (.csv) to import and edit.
        </p>

        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center space-y-2"
          >
            <svg
              className="w-12 h-12 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {file ? file.name : "Click to upload or drag and drop"}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Excel or CSV files (.xlsx, .xls, .csv)
            </span>
          </label>
        </div>

        <button
          onClick={handleImport}
          disabled={!file || isLoading}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Importing..." : "Import File"}
        </button>
      </div>
    </div>
  );
}
