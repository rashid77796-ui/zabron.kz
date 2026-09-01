import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/utils";

export type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "value" | "type"
> & {
  value: string;
  /** Получает уже отформатированное значение (например "+7 777 123 4567"). */
  onChange: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "+7 777 123 4567", ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
