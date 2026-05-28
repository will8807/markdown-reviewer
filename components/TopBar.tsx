"use client";

import Link from "next/link";
import { useState } from "react";
import NewSourceModal from "./NewSourceModal";
import ThemeSelector from "./ThemeSelector";

export default function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="h-11 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight hover:text-blue-600 dark:hover:text-blue-400"
        >
          Markdown Reviewer
        </Link>
        <div className="flex-1" />
        <ThemeSelector />
        <button
          data-testid="new-source-btn"
          onClick={() => setOpen(true)}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + New Source
        </button>
      </header>
      {open && <NewSourceModal onClose={() => setOpen(false)} />}
    </>
  );
}
