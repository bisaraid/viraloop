'use client';

import { AffiliateInput, AffiliateProductBasic } from '@/lib/types';

interface AffiliateFormProps {
  affiliateInput: AffiliateInput;
  isComparisonMode: boolean;
  comparisonProducts: AffiliateProductBasic[];
  hasResult: boolean;
  onAffiliateInputChange: (input: AffiliateInput) => void;
  onAddComparisonProduct: () => void;
  onRemoveComparisonProduct: (index: number) => void;
  onComparisonProductChange: (index: number, field: keyof AffiliateProductBasic, value: string | number | undefined) => void;
}

function ComparisonProductItem({
  prod,
  idx,
  onRemove,
  onChange,
}: {
  prod: AffiliateProductBasic;
  idx: number;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof AffiliateProductBasic, value: string | number | undefined) => void;
}) {
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] space-y-2 relative">
      <button
        className="absolute top-2 right-2 text-xs text-red-400 hover:text-red-300 p-1.5"
        onClick={() => onRemove(idx)}>
        ✕ Hapus
      </button>
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">Produk {idx + 2}</p>
      <input className="input-field text-sm" placeholder="Nama produk"
        value={prod.productName}
        onChange={(e) => onChange(idx, 'productName', e.target.value)} />
      <textarea className="textarea-field text-sm" rows={2} placeholder="Fitur / Deskripsi utama"
        value={prod.productDescription}
        onChange={(e) => onChange(idx, 'productDescription', e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className="input-field text-sm" placeholder="Harga (opsional)"
          value={prod.productPrice || ''}
          onChange={(e) => onChange(idx, 'productPrice', e.target.value)} />
        <input className="input-field text-sm" type="number" min="0" max="5" step="0.1" placeholder="Rating (opsional)"
          value={prod.productRating || ''}
          onChange={(e) => onChange(idx, 'productRating', e.target.value ? parseFloat(e.target.value) : undefined)} />
      </div>
    </div>
  );
}

export default function AffiliateForm({
  affiliateInput,
  isComparisonMode,
  comparisonProducts,
  hasResult,
  onAffiliateInputChange,
  onAddComparisonProduct,
  onRemoveComparisonProduct,
  onComparisonProductChange,
}: AffiliateFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Nama Produk <span className="text-red-400">*</span></label>
        <input className="input-field" placeholder="Contoh: Scarlett Whitening Serum"
          value={affiliateInput.productName}
          onChange={(e) => onAffiliateInputChange({ ...affiliateInput, productName: e.target.value })} />
      </div>
      <div>
        <label className="label">Fitur / Deskripsi Utama <span className="text-red-400">*</span></label>
        <textarea className="textarea-field" rows={3}
          placeholder="Contoh: Skincare serum vitamin C, tekstur ringan, cocok kulit berminyak, kemasan 30ml"
          value={affiliateInput.productDescription}
          onChange={(e) => onAffiliateInputChange({ ...affiliateInput, productDescription: e.target.value })} />
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Jelaskan fitur utama produk. Semakin detail, semakin baik hasil review-nya.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Harga (opsional)</label>
          <input className="input-field" placeholder="Contoh: Rp 150.000"
            value={affiliateInput.productPrice || ''}
            onChange={(e) => onAffiliateInputChange({ ...affiliateInput, productPrice: e.target.value })} />
        </div>
        <div>
          <label className="label">Rating (opsional)</label>
          <input className="input-field" type="number" min="0" max="5" step="0.1" placeholder="Contoh: 4.5"
            value={affiliateInput.productRating || ''}
            onChange={(e) => onAffiliateInputChange({ ...affiliateInput, productRating: e.target.value ? parseFloat(e.target.value) : undefined })} />
        </div>
      </div>

      {/* Mode perbandingan (long/3 menit) — tambah produk kedua/ketiga */}
      {isComparisonMode && (
        <div className="space-y-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Produk Pembanding (opsional, maks. 3 total)</label>
            {comparisonProducts.length < 2 && (
              <button className="btn-secondary text-xs py-1 px-3" onClick={onAddComparisonProduct}>
                + Tambah Produk
              </button>
            )}
          </div>

          {comparisonProducts.map((prod, idx) => (
            <ComparisonProductItem
              key={idx}
              prod={prod}
              idx={idx}
              onRemove={onRemoveComparisonProduct}
              onChange={onComparisonProductChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}