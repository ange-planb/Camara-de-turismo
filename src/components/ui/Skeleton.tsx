import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export function Skeleton({ className = '', variant = 'rect', ...props }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-surface-container-high';
  const variantClasses = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    text: 'h-4 rounded-md w-full',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props} />
  );
}
