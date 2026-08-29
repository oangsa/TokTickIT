import { useEffect, useId, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  /* What the control reads when nothing is chosen, e.g. `Any Category`. */
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/*
 * Multi-select filter control (ui-spec Sections 14.2, 14.3).
 *
 * A dropdown of checkboxes rather than a `<select multiple>` list box. The list
 * box put four permanently open, internally scrolling panes in one modal, and
 * its selection model — ctrl/cmd-click to add, a plain click to replace
 * everything — is not discoverable and is hostile on touch. Checkboxes state
 * the model on their face and cannot silently drop a selection.
 *
 * The toggle borrows `.form-select` so it keeps the chevron and the exact
 * metrics of the editable controls around it (Section 7.2). Bootstrap's
 * dropdown JavaScript is not used, matching the rest of the client: open state,
 * outside dismissal, and focus return are React's.
 */
export function MultiSelect({ label, placeholder, options, selected, onChange }: MultiSelectProps) {
  const labelId = useId();
  const toggleId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    /*
     * `mousedown`, not `click`: a click that lands on the modal's dimmed area
     * dismisses the dialog on mousedown, so a click-based listener here would
     * never run and the menu would still be open on the next open.
     */
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  /*
   * Option order, not click order. A `<select multiple>` reported its selection
   * in DOM order, and the applied-filter chips and the URL query both render the
   * array as it arrives: appending here would make the same set of filters
   * produce a different chip order and a different URL depending on the sequence
   * the boxes happened to be ticked in.
   */
  function toggleValue(value: string): void {
    const next = selected.includes(value)
      ? selected.filter((current) => current !== value)
      : [...selected, value];

    onChange(options.filter((option) => next.includes(option.value)).map((option) => option.value));
  }

  /*
   * Escape closes the menu and nothing else. Without stopping it here, the same
   * key press reaches the dialog that contains this control and closes the whole
   * Filters modal, discarding the draft the user was still building.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      toggleRef.current?.focus();
    }
  }

  const summary =
    selected.length === 0
      ? placeholder
      : options
          .filter((option) => selected.includes(option.value))
          .map((option) => option.label)
          .join(", ");

  return (
    <div className="mb-3 dropdown" ref={rootRef} onKeyDown={handleKeyDown}>
      <label className="form-label fw-medium" id={labelId} htmlFor={toggleId}>
        {label}
      </label>

      {/*
        Both ids in `aria-labelledby`: the control is announced as its field name
        followed by its current selection, the way a `<select>` is.
      */}
      <button
        ref={toggleRef}
        type="button"
        id={toggleId}
        className={`form-select text-start tt-multiselect__toggle${selected.length === 0 ? " text-secondary" : ""}`}
        aria-expanded={open}
        aria-labelledby={`${labelId} ${toggleId}`}
        onClick={() => setOpen((current) => !current)}
      >
        {summary}
      </button>

      {open ? (
        <div className="dropdown-menu show w-100 tt-multiselect__menu" role="group" aria-labelledby={labelId}>
          {options.map((option) => (
            <label className="dropdown-item d-flex align-items-center gap-2" key={option.value}>
              <input
                type="checkbox"
                className="form-check-input flex-shrink-0 mt-0"
                checked={selected.includes(option.value)}
                onChange={() => toggleValue(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
