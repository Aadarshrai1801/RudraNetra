import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, style, ...props }) => {
  return (
    <button
      style={{
        padding: '8px 16px',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.1)' : 'none',
        background: variant === 'primary' ? '#0284c7' : 'rgba(255,255,255,0.05)',
        color: '#fff',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};
