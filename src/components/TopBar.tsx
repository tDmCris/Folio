import React from 'react';

export type DrawerView = 'documents' | 'sources' | 'history' | 'export' | null;

interface TopBarProps {
  activeDrawer: DrawerView;
  onSelectDrawer: (drawer: DrawerView) => void;
  onOpenNewDraft: () => void;
  focusMode: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeDrawer,
  onSelectDrawer,
  onOpenNewDraft,
  focusMode,
}) => {
  const navItems: Array<{ id: Exclude<DrawerView, null>; label: string }> = [
    { id: 'documents', label: 'Documents' },
    { id: 'sources', label: 'Sources' },
    { id: 'history', label: 'History' },
    { id: 'export', label: 'Export' },
  ];

  return (
    <header
      className={`sticky top-0 z-30 h-14 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-[#FAFAFA]/92 dark:bg-[#0C0C0E]/92 backdrop-blur-md transition-opacity duration-200 ${
        focusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="max-w-[1380px] mx-auto h-full px-6 md:px-10 flex items-center justify-between gap-8">
        {/* Zone 1: Single text wordmark */}
        <button
          type="button"
          onClick={() => onSelectDrawer(null)}
          className="manuscript-prose text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Folio
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Workspace navigation"
          className="flex items-center gap-6 md:gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-400 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = activeDrawer === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectDrawer(isActive ? null : item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  isActive
                    ? 'text-zinc-950 dark:text-zinc-50'
                    : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[17px] h-[1.5px] bg-blue-600 dark:bg-blue-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenNewDraft}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 rounded-lg hover:bg-zinc-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0C0C0E]"
          >
            New Draft
          </button>
        </div>
      </div>
    </header>
  );
};
