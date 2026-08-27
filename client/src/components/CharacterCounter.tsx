interface CharacterCounterProps {
  id?: string;
  value: number;
  max: number;
}

/*
 * Always-visible counter shown as secondary helper text (ui-spec Section 9).
 * It is referenced through `aria-describedby` and is not a live region: an
 * announcement on every keystroke would be hostile.
 */
export function CharacterCounter({ id, value, max }: CharacterCounterProps) {
  return (
    <span id={id} className="form-text tt-counter">
      {value} / {max}
    </span>
  );
}
