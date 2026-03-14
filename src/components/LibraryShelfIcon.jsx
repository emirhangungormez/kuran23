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
      <path d="M4.5 7.5 9.25 5.2v13.2L4.5 20.7z" />
      <path d="M9.25 5.2 14 7.5v13.2l-4.75-2.3z" />
      <path d="M14 7.5 19.5 5v13.2L14 20.7z" />
      <path d="M6.3 6.5 11 4.2" />
      <path d="M10.8 8.7 15.7 6.4" />
      <path d="M15.8 6.3 20 4.4" />
    </svg>
  )
}
