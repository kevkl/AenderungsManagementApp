"use client";

import { useState } from "react";
import ImportTab from "@/components/ImportTab";
import EditTab from "@/components/EditTab";
import ChatTab from "@/components/ChatTab";
import NachtragsPruefung from "@/components/NachtragsPruefung";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"import" | "edit" | "chat" | "nachtrag">("import");
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col py-8 px-4 bg-white dark:bg-zinc-900">
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("import")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "import"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "edit"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab("nachtrag")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "nachtrag"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Nachtragsprüfung
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "chat"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              AI Chat
            </button>
          </nav>
        </div>

        <div className="mt-8">
          {activeTab === "import" && <ImportTab onDataImported={setExcelData} />}
          {activeTab === "edit" && <EditTab data={excelData} onDataChange={setExcelData} />}
          {activeTab === "nachtrag" && <NachtragsPruefung />}
          {activeTab === "chat" && <ChatTab />}
        </div>
      </main>
    </div>
  );
}
