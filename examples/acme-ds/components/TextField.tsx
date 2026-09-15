export type TextFieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
};

export function TextField({ label, value, placeholder, required }: TextFieldProps) {
  return (
    <label>
      {label}
      <input value={value} placeholder={placeholder} required={required} />
    </label>
  );
}
