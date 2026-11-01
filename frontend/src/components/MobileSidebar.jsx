import Sidebar from './Sidebar.jsx'

/**
 * Mobile sidebar toggle button
 */
export function MobileMenuButton({ isOpen, onToggle }) {
  return (
    <button
      className="tip lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors touch-target"
      onClick={onToggle}
      aria-label={isOpen ? 'Close question list' : 'Open question list'}
      data-tip={isOpen ? 'Close question list' : 'Open question list'}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  )
}

/**
 * Mobile sidebar overlay - fixed positioned, content pushed by spacer in App
 */
export function MobileSidebar({ isOpen, onClose, ...sidebarProps }) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - closes on click */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Fixed sidebar - overlays but content pushed by spacer in App */}
      <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-slate-950 shadow-xl lg:hidden transform transition-transform duration-300 ease-out translate-x-0">
        <Sidebar {...sidebarProps} isMobile={true} />
      </aside>
    </>
  )
}
