// src/components/Logo.jsx
// DraftBird logo as a reusable React component.
// Usage:
//   <Logo size={36} />               // icon only
//   <Logo size={36} withWordmark />   // icon + "DraftBird" text

import React from 'react';

export function Logo({ size = 36, withWordmark = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 240 240"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="DraftBird"
      >
        <rect width="240" height="240" rx="54" fill="#0a0a0a" />
        <rect x="0.5" y="0.5" width="239" height="239" rx="54" fill="none" stroke="#1f1f1f" strokeWidth="1" />
        <path d="M 50 145 L 195 110 L 110 188 Z" fill="#ea580c" />
        <path d="M 75 55 L 200 112 L 130 130 Z" fill="#fb923c" />
        <circle cx="195" cy="111" r="3" fill="#ffffff" opacity="0.95" />
      </svg>
      {withWordmark && (
        <span
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            fontSize: size * 0.55,
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#e7e9ea' }}>Draft</span>
          <span style={{ color: '#ea580c' }}>Bird</span>
        </span>
      )}
    </div>
  );
}
