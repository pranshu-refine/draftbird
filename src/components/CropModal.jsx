// src/components/CropModal.jsx
// X-style image crop modal: sticky header with back-arrow + "Crop media" + Save,
// tab strip (Crop / ALT / Flag), full-bleed cropper, bottom toolbar with shape
// buttons + zoom slider.

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Cropper from 'react-easy-crop';
import {
  ArrowLeft, Crop as CropIcon, Flag,
  Square, RectangleHorizontal, RectangleVertical, ZoomIn,
} from 'lucide-react';

const ASPECT_MODES = {
  square:   { ratio: 1 },
  wide:     { ratio: 16 / 9 },
  tall:     { ratio: 3 / 4 },
  original: { ratio: null },
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}

async function cropToBlob(imageUrl, pixelCrop, mimeType = 'image/jpeg', quality = 0.92) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas is empty')),
      mimeType,
      quality
    );
  });
}

export default function CropModal({ file, initialAlt = '', initialAspectMode, onApply, onCancel }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [naturalAr, setNaturalAr] = useState(1);
  const [aspectMode, setAspectMode] = useState(initialAspectMode || 'original');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState(null);
  const [activeTab, setActiveTab] = useState('crop'); // crop | alt | flag
  const [altText, setAltText] = useState(initialAlt);
  const [busy, setBusy] = useState(false);
  const zoomRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file, onCancel]);

  const onMediaLoaded = useCallback((mediaSize) => {
    const ar = mediaSize.naturalWidth / mediaSize.naturalHeight;
    setNaturalAr(ar);
  }, []);

  const aspect = useMemo(() => {
    if (aspectMode === 'original') return naturalAr;
    return ASPECT_MODES[aspectMode]?.ratio || naturalAr;
  }, [aspectMode, naturalAr]);

  const onCropComplete = useCallback((_area, pixels) => setPixelCrop(pixels), []);

  const handleSave = async () => {
    if (!imageUrl || !pixelCrop) return;
    setBusy(true);
    try {
      const mime = file?.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await cropToBlob(imageUrl, pixelCrop, mime, 0.92);
      onApply({ blob, aspectRatio: aspect, aspectMode, altText });
    } catch (err) {
      console.error('Crop failed', err);
      setBusy(false);
    }
  };

  const focusZoomSlider = () => {
    setActiveTab('crop');
    requestAnimationFrame(() => zoomRef.current?.focus());
  };

  if (!file) return null;

  const tabs = [
    { key: 'crop', icon: CropIcon, label: null },
    { key: 'alt',  icon: null,     label: 'ALT' },
    { key: 'flag', icon: Flag,     label: null },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: '#000' }}>
      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-4"
              style={{ height: 56, background: '#000' }}>
        <button onClick={onCancel}
                className="p-2 -ml-2 rounded-full"
                style={{ color: '#fff' }} title="Discard">
          <ArrowLeft size={22} />
        </button>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 19 }}>Crop media</div>
        <button onClick={handleSave} disabled={busy || !pixelCrop}
                className="rounded-full"
                style={{
                  background: '#fff',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 15,
                  padding: '7px 16px',
                  opacity: (busy || !pixelCrop) ? 0.5 : 1,
                }}>
          Save
        </button>
      </header>

      {/* TAB STRIP */}
      <div className="shrink-0 flex" style={{ height: 50, background: '#000' }}>
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className="flex-1 flex items-center justify-center relative transition-colors"
                    style={{ color: '#fff' }}>
              {t.icon ? <t.icon size={20} /> : (
                <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.5px' }}>{t.label}</span>
              )}
              <span style={{
                position: 'absolute',
                left: 0, right: 0, bottom: 0,
                height: 3,
                background: active ? '#1d9bf0' : 'transparent',
              }} />
            </button>
          );
        })}
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 relative" style={{ background: '#000' }}>
        {activeTab === 'crop' && imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            showGrid={false}
            zoomSpeed={0.5}
            minZoom={1}
            maxZoom={3}
            cropShape="rect"
            style={{
              containerStyle: { background: '#000' },
              cropAreaStyle: {
                border: '3px solid #1d9bf0',
                color: 'rgba(0,0,0,0.55)',
              },
            }}
          />
        )}
        {activeTab === 'alt' && (
          <div className="p-6 max-w-2xl mx-auto" style={{ color: '#fff' }}>
            <label className="block mb-2 text-sm font-bold" style={{ color: '#e7e9ea' }}>
              Image description
            </label>
            <textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Add alt text description for accessibility (optional)"
              maxLength={1000}
              rows={6}
              className="w-full bg-transparent outline-none rounded-lg p-3"
              style={{ border: '1px solid #2f3336', color: '#e7e9ea', fontSize: 16 }}
            />
            <div className="text-xs mt-2" style={{ color: '#71767b' }}>
              {altText.length} / 1000
            </div>
          </div>
        )}
        {activeTab === 'flag' && (
          <div className="p-6 flex flex-col items-center justify-center h-full" style={{ color: '#71767b' }}>
            <Flag size={32} className="mb-3" />
            <div className="text-sm">Report this media</div>
            <div className="text-xs mt-1">(coming soon)</div>
          </div>
        )}
      </div>

      {/* BOTTOM TOOLBAR */}
      <footer className="shrink-0 flex items-center px-4"
              style={{ height: 64, background: '#000', gap: 16 }}>
        <ShapeButton icon={Square} active={aspectMode === 'square'}
                     onClick={() => { setActiveTab('crop'); setAspectMode('square'); }}
                     title="Square 1:1" />
        <ShapeButton icon={RectangleHorizontal} active={aspectMode === 'wide'}
                     onClick={() => { setActiveTab('crop'); setAspectMode('wide'); }}
                     title="Wide 16:9" />
        <ShapeButton icon={RectangleVertical} active={aspectMode === 'tall'}
                     onClick={() => { setActiveTab('crop'); setAspectMode('tall'); }}
                     title="Tall 3:4" />
        <ShapeButton icon={ZoomIn} active={false} onClick={focusZoomSlider} title="Zoom" />
        <div className="flex-1 flex items-center" style={{ minWidth: 0 }}>
          <input
            ref={zoomRef}
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full crop-zoom"
          />
        </div>
        <style>{`
          .crop-zoom { appearance: none; height: 4px; border-radius: 2px;
            background: linear-gradient(to right, #1d9bf0 0%, #1d9bf0 ${((zoom - 1) / 2) * 100}%, #536471 ${((zoom - 1) / 2) * 100}%, #536471 100%);
            outline: none;
          }
          .crop-zoom::-webkit-slider-thumb { appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
          .crop-zoom::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; cursor: pointer; border: none; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        `}</style>
      </footer>
    </div>
  );
}

function ShapeButton({ icon: Icon, active, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
            className="rounded transition-colors"
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: active ? '1.5px solid #1d9bf0' : '1.5px solid transparent',
              color: active ? '#1d9bf0' : '#fff',
              borderRadius: 8,
            }}>
      <Icon size={24} />
    </button>
  );
}
