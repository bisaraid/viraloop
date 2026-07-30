'use client';

import { ReactNode } from 'react';

interface StatusMessageProps {
  variant: 'error' | 'warning';
  children: ReactNode;
}

/**
 * StatusMessage — komponen seragam untuk menampilkan pesan error/warning.
 *
 * Keputusan warna:
 * - warning: border-yellow-800 (dipilih karena lebih konsisten dengan dark theme
 *   dan sudah dipakai di 2 dari 3 tempat sebelumnya; border-yellow-600 yang
 *   dipakai di failed segment warning di-unifikasi ke border-yellow-800).
 * - error: border-red-800 (konsisten dengan pemakaian sebelumnya).
 */
export default function StatusMessage({ variant, children }: StatusMessageProps) {
  const baseClass =
    variant === 'error'
      ? 'text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800 whitespace-pre-line'
      : 'text-sm text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-800';

  return (
    <div className={baseClass}>
      {variant === 'error' ? '❌ ' : ''}{children}
    </div>
  );
}