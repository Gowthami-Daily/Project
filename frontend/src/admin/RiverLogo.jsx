export default function RiverLogo({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 28c4-8 8-12 14-12s10 4 14 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M8 30c3-6 6-9 10-9s7 3 10 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M20 8c0-2.5 2-4.5 4-4.5 1.2 0 2.2.6 2.8 1.5-.6 1.8-2 3-3.8 3-1.7 0-3.1-1.1-3.8-2.7L20 8Z"
        fill="currentColor"
        opacity="0.95"
      />
      <ellipse cx="20" cy="10.5" rx="2.2" ry="2.8" fill="currentColor" opacity="0.35" />
    </svg>
  )
}
