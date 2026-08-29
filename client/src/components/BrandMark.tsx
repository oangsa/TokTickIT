/* The TokTickIT identity mark (ui-spec Sections 5.1, 5.2, 6.2). */
export function BrandMark() {
  /* A ticket stub, perforation and all: the artifact the application is about. */
  return (
    <svg
      className="tt-brand__mark"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.75 5.5A1.75 1.75 0 0 1 4.5 3.75h11A1.75 1.75 0 0 1 17.25 5.5v2a2.5 2.5 0 0 0 0 5v2a1.75 1.75 0 0 1-1.75 1.75h-11A1.75 1.75 0 0 1 2.75 14.5v-2a2.5 2.5 0 0 0 0-5v-2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M10 6.75v6.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.6 1.8" />
    </svg>
  );
}
