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

export interface RudraNetraLogoProps {
  size?: number;
  variant?: 'original' | 'transparent' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

export const RudraNetraLogo: React.FC<RudraNetraLogoProps> = ({
  size = 36,
  variant = 'original',
  className,
  style,
}) => {
  const filename =
    variant === 'dark'
      ? 'RudraNetraLogo_darkmode.png'
      : variant === 'transparent'
      ? 'RudraNetraLogo_transparent.png'
      : 'RudraNetraLogo.png';

  return (
    <img
      src={`/${filename}`}
      alt="RudraNetra"
      className={className}
      style={{
        height: `${size}px`,
        width: 'auto',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
};
