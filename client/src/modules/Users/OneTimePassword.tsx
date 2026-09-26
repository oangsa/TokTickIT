import { Button } from "../../components/Common/Button.js";
import { FormField } from "../../components/Common/Form/FormField.js";

interface OneTimePasswordProps {
  id: string;
  label: string;
  value: string;
  helpText: string;
  copied: boolean;
  onCopy: () => void | Promise<void>;
}

/** Shared presentation for the one-time credentials shown after user actions. */
export function OneTimePassword({
  id,
  label,
  value,
  helpText,
  copied,
  onCopy,
}: OneTimePasswordProps) {
  return (
    <FormField label={label} helpText={helpText} id={id}>
      {({ id: fieldId, describedBy }) => (
        <div className="input-group mb-2 tt-one-time-password">
          <input
            id={fieldId}
            type="text"
            readOnly
            className="form-control tt-readonly font-monospace"
            value={value}
            aria-label="One-time initial password"
            aria-describedby={describedBy}
          />
          <Button
            variant="secondary"
            onClick={onCopy}
            aria-label={copied ? "Password copied" : "Copy initial password"}
          >
            {copied ? "Password copied!" : "Copy"}
          </Button>
        </div>
      )}
    </FormField>
  );
}

export type { OneTimePasswordProps };

export default OneTimePassword;
