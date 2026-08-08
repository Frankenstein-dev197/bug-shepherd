import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", children, variant = "primary", size = "md", ...props }, ref) => {
    // Basic styling class calculation (without clsx/tailwind-merge dependency for lower footprint, or using simple strings)
    const baseClass = "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 active:scale-95";

    const variantClasses = {
      primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-sm",
      secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-gray-500 shadow-sm border border-gray-200",
      danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
      outline: "bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 focus:ring-gray-500"
    };

    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-5 py-2.5 text-base"
    };

    const finalClassName = `${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    return (
      <button
        ref={ref}
        className={finalClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
