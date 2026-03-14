export default function LibraryShelfIcon({ strokeWidth = 1.9, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="5" y="4" width="4" height="14" rx="1.2" />
      <rect x="10" y="3" width="4" height="15" rx="1.2" />
      <rect x="15" y="5" width="4" height="13" rx="1.2" />
      <path d="M4 20h16" />
    </svg>
  )
}
