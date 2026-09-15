import type { ButtonProps } from "./Button.types.js";

/** Primary call-to-action and secondary buttons. */
export function Button({ label, variant = "primary", disabled, onPress }: ButtonProps) {
  return (
    <button data-variant={variant} disabled={disabled} onClick={onPress}>
      {label}
    </button>
  );
}
