import React from 'react';

/**
 * Open/Closed Principle (OCP): Extensible via variant and size props.
 * Liskov Substitution Principle (LSP): Fully supports standard button attributes.
 *
 * @param {'primary' | 'outline' | 'pill-nav' | 'ghost' | 'icon'} variant
 * @param {'sm' | 'md' | 'lg'} size
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  icon: IconComponent,
  ...props
}) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {IconComponent && <IconComponent className="btn-icon" />}
      {children}
    </button>
  );
};
