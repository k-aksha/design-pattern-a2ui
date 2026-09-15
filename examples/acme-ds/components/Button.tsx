export type ButtonProps = {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onPress?: () => void;
};

/** Primary call-to-action and secondary buttons. */
export function Button({ label, variant = "primary", disabled }: ButtonProps) {
  return (
    <button data-variant={variant} disabled={disabled}>
      {label}
    </button>
  );
}
