export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = {
  /** Visible button label. */
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onPress?: () => void;
};
