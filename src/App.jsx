// App.jsx
// ─────────────────────────────────────────────────────────────────
// DraftBird — Twitter/X-style content approval feed, backed by Supabase.
// ─────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Check, X, MessageCircle, Bookmark, Image as ImageIcon,
  MoreHorizontal, Search, Home,
  PenSquare, BarChart3, Send, ArrowLeft,
  Zap, Clock, CheckCircle2, XCircle,
  Sparkles, LogOut, Loader2,
  User as UserIcon, Eye, EyeOff, Undo2, AlertCircle, Lock, Camera,
  TrendingUp, Users, ChevronRight, MoreHorizontal as More,
  Newspaper, Bold, Italic, Heading1, Heading2, Quote, List, ListOrdered, Code, ImagePlus,
  Pencil, ChevronLeft
} from 'lucide-react';

import * as api from './lib/api';
import { Logo } from './components/Logo';
import CropModal from './components/CropModal';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapImage from '@tiptap/extension-image';

// Shared hook: bind Escape key to a close handler while `active` is true.
function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}

// ════════════════════════════════════════════════════════════════
//  Atoms
// ════════════════════════════════════════════════════════════════

function Avatar({ person, size = 40 }) {
  if (!person) return <div className="rounded-full shrink-0" style={{ width: size, height: size, background: '#2f3336' }} />;
  if (person.avatar_url) {
    return (
      <img src={person.avatar_url} alt=""
           className="rounded-full shrink-0 object-cover"
           style={{ width: size, height: size, background: person.color || '#2f3336' }} />
    );
  }
  const initials = (person.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2);
  return (
    <div className="rounded-full flex items-center justify-center font-semibold shrink-0 select-none"
         style={{ width: size, height: size, backgroundColor: person.color || '#1d9bf0', fontSize: size * 0.4, color: 'white' }}>
      {initials}
    </div>
  );
}

function VerifiedBadge({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ color: '#1d9bf0', flexShrink: 0 }}>
      <path fill="currentColor" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
    </svg>
  );
}

// X-style media grid. `items` can be feed rows ({ url, type, aspect_ratio })
// or composer items ({ previewUrl, type, aspectRatio }). `renderOverlay` lets
// the composer paint edit/remove buttons on each cell. `onItemClick` opens the
// lightbox in feed mode.
function MediaCell({ m, className, onClick }) {
  const src = m.url || m.previewUrl;
  if (m.type === 'video') {
    return (
      <video src={src} controls playsInline preload="metadata"
             className={className} onClick={onClick}
             style={onClick ? { cursor: 'pointer' } : undefined} />
    );
  }
  return (
    <img src={src} alt="" className={className} onClick={onClick}
         style={onClick ? { cursor: 'zoom-in' } : undefined} />
  );
}

function MediaGrid({ items, context = 'feed', renderOverlay, onItemClick }) {
  const list = items || [];
  const [naturalAr, setNaturalAr] = useState(null);
  if (list.length === 0) return null;

  const maxH = context === 'composer' ? 350 : 510;
  const cellCls = 'w-full h-full object-cover';
  const wrapBase = 'mt-3 rounded-2xl overflow-hidden relative';
  const wrapStyle = { border: '1px solid #2f3336', background: '#000' };

  if (list.length === 1) {
    const m = list[0];
    const ar = m.aspectRatio || m.aspect_ratio || naturalAr;
    return (
      <div className={wrapBase}
           style={{
             ...wrapStyle,
             ...(ar ? { aspectRatio: ar, maxHeight: maxH, maxWidth: maxH * ar } : { maxHeight: maxH }),
             margin: '12px auto 0',
             background: '#16181c',
           }}>
        {m.type === 'video' ? (
          <video src={m.url || m.previewUrl} controls playsInline preload="metadata"
                 className={cellCls}
                 onLoadedMetadata={(e) => {
                   const w = e.target.videoWidth, h = e.target.videoHeight;
                   if (w && h) setNaturalAr(w / h);
                 }} />
        ) : (
          <img src={m.url || m.previewUrl} alt="" className={cellCls}
               onLoad={(e) => {
                 const w = e.target.naturalWidth, h = e.target.naturalHeight;
                 if (w && h) setNaturalAr(w / h);
               }}
               onClick={onItemClick ? () => onItemClick(0) : undefined}
               style={onItemClick ? { cursor: 'zoom-in' } : undefined} />
        )}
        {renderOverlay && renderOverlay(m, 0)}
      </div>
    );
  }

  if (list.length === 2) {
    return (
      <div className={`${wrapBase} grid`}
           style={{ ...wrapStyle, gridTemplateColumns: '1fr 1fr', gap: '2px', height: 290 }}>
        {list.map((m, i) => (
          <div key={i} className="relative overflow-hidden" style={{ background: '#16181c' }}>
            <MediaCell m={m} className={cellCls}
                       onClick={onItemClick ? () => onItemClick(i) : undefined} />
            {renderOverlay && renderOverlay(m, i)}
          </div>
        ))}
      </div>
    );
  }

  if (list.length === 3) {
    return (
      <div className={`${wrapBase} grid`}
           style={{
             ...wrapStyle,
             gridTemplateColumns: '1fr 1fr',
             gridTemplateRows: '1fr 1fr',
             gap: '2px',
             height: 290,
           }}>
        <div className="relative overflow-hidden" style={{ gridRow: 'span 2', background: '#16181c' }}>
          <MediaCell m={list[0]} className={cellCls}
                     onClick={onItemClick ? () => onItemClick(0) : undefined} />
          {renderOverlay && renderOverlay(list[0], 0)}
        </div>
        <div className="relative overflow-hidden" style={{ background: '#16181c' }}>
          <MediaCell m={list[1]} className={cellCls}
                     onClick={onItemClick ? () => onItemClick(1) : undefined} />
          {renderOverlay && renderOverlay(list[1], 1)}
        </div>
        <div className="relative overflow-hidden" style={{ background: '#16181c' }}>
          <MediaCell m={list[2]} className={cellCls}
                     onClick={onItemClick ? () => onItemClick(2) : undefined} />
          {renderOverlay && renderOverlay(list[2], 2)}
        </div>
      </div>
    );
  }

  // 4+ : use 2x2 of first four
  return (
    <div className={`${wrapBase} grid`}
         style={{
           ...wrapStyle,
           gridTemplateColumns: '1fr 1fr',
           gridTemplateRows: '1fr 1fr',
           gap: '2px',
           height: 290,
         }}>
      {list.slice(0, 4).map((m, i) => (
        <div key={i} className="relative overflow-hidden" style={{ background: '#16181c' }}>
          <MediaCell m={m} className={cellCls}
                     onClick={onItemClick ? () => onItemClick(i) : undefined} />
          {renderOverlay && renderOverlay(m, i)}
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ════════════════════════════════════════════════════════════════
//  Tweet Card
// ════════════════════════════════════════════════════════════════

function TweetCard({ tweet, me, isDecided, onApprove, onReject, onSave, onUndo, savedIds, onOpenComments, onOpenLightbox }) {
  const [swipeX, setSwipeX] = useState(0);
  const [exiting, setExiting] = useState(null);
  const touchStart = useRef(null);
  const isSaved = savedIds.has(tweet.id);
  const canAct = !isDecided;
  const author = tweet.author || { name: 'Unknown', handle: 'unknown', color: '#71767b' };

  const handleTouchStart = (e) => { if (!canAct) return; touchStart.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => {
    if (!canAct || touchStart.current == null) return;
    const dx = e.touches[0].clientX - touchStart.current;
    setSwipeX(Math.max(-200, Math.min(200, dx)));
  };
  const handleTouchEnd = () => {
    if (!canAct) return;
    if (swipeX > 100) { setExiting('right'); setTimeout(() => onApprove(tweet.id), 200); }
    else if (swipeX < -100) { setExiting('left'); setTimeout(() => onReject(tweet.id), 200); }
    else setSwipeX(0);
    touchStart.current = null;
  };

  const opacity = Math.min(Math.abs(swipeX) / 100, 1);
  const swipeBg = swipeX > 0 ? `rgba(0,186,124,${opacity * 0.25})` : `rgba(244,33,46,${opacity * 0.25})`;
  const transform = exiting === 'right' ? 'translateX(120%)' : exiting === 'left' ? 'translateX(-120%)' : `translateX(${swipeX}px)`;

  return (
    <div className="relative" style={{ background: swipeBg, transition: 'background 0.15s' }}>
      {canAct && Math.abs(swipeX) > 20 && (
        <>
          <div className="absolute left-6 top-1/2 -translate-y-1/2" style={{ opacity: swipeX > 0 ? opacity : 0, color: '#00ba7c' }}><Check size={32} strokeWidth={3} /></div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2" style={{ opacity: swipeX < 0 ? opacity : 0, color: '#f4212e' }}><X size={32} strokeWidth={3} /></div>
        </>
      )}
      <article
        className="px-4 py-3 cursor-pointer transition-colors"
        style={{
          transform, transition: touchStart.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y', borderBottom: '1px solid #2f3336',
          background: tweet.urgent && !isDecided ? 'rgba(168,85,247,0.04)' : 'transparent',
        }}
        onMouseEnter={(e) => { if (!touchStart.current) e.currentTarget.style.background = 'rgba(231,233,234,0.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = tweet.urgent && !isDecided ? 'rgba(168,85,247,0.04)' : 'transparent'; }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="flex gap-3">
          <Avatar person={author} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[15px]">
              <span className="font-bold truncate hover:underline" style={{ color: '#e7e9ea' }}>{author.name}</span>
              {author.verified && <VerifiedBadge />}
              <span className="truncate" style={{ color: '#71767b' }}>@{author.handle}</span>
              <span style={{ color: '#71767b' }}>·</span>
              <span className="hover:underline" style={{ color: '#71767b' }}>{timeAgo(tweet.created_at)}</span>
            </div>

            {tweet.urgent && !isDecided && (
              <div className="mb-1 flex items-center gap-1 text-xs font-bold w-fit" style={{ color: '#c084fc' }}>
                <Zap size={12} fill="currentColor" /> URGENT
              </div>
            )}

            <div className="text-[15px] whitespace-pre-wrap leading-snug" style={{ color: '#e7e9ea' }}>{tweet.content}</div>
            <MediaGrid items={tweet.media} context="feed"
                       onItemClick={onOpenLightbox ? (i) => onOpenLightbox(tweet.media, i) : undefined} />

            {tweet.status === 'rejected' && tweet.rejection_note && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm"
                   style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)', color: '#ff8e95' }}>
                <span className="font-semibold">Rejected: </span>{tweet.rejection_note}
              </div>
            )}

            {tweet.comments?.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); onOpenComments(tweet); }}
                      className="mt-3 w-full px-3 py-2 rounded-lg text-left text-sm transition"
                      style={{ background: 'rgba(255,212,0,0.08)', border: '1px solid rgba(255,212,0,0.2)' }}>
                <div className="font-semibold mb-0.5 flex items-center gap-1.5" style={{ color: '#ffd400' }}>
                  <MessageCircle size={12} />
                  {tweet.comments.length} note{tweet.comments.length > 1 ? 's' : ''}{!isDecided && ' — in review'}
                </div>
                <div className="line-clamp-1" style={{ color: '#e7e9ea' }}>
                  "{tweet.comments[tweet.comments.length - 1].text}"
                </div>
              </button>
            )}

            <div className="mt-3 flex items-center justify-between max-w-md -ml-2">
              {canAct ? (
                <>
                  <ActionButton icon={Check} label="Approve" hex="#00ba7c"
                                onClick={() => { setExiting('right'); setTimeout(() => onApprove(tweet.id), 200); }} />
                  <ActionButton icon={X} label="Reject" hex="#f4212e"
                                onClick={() => { setExiting('left'); setTimeout(() => onReject(tweet.id), 200); }} />
                  <ActionButton icon={MessageCircle} label={tweet.comments?.length || ''} hex="#1d9bf0"
                                onClick={() => onOpenComments(tweet)} />
                  <ActionButton icon={Bookmark} hex="#ffd400" active={isSaved}
                                onClick={() => onSave(tweet.id)} />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm pl-2"
                       style={{ color: tweet.status === 'approved' ? '#00ba7c' : '#f4212e' }}>
                    {tweet.status === 'approved' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span className="font-semibold">{tweet.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onUndo(tweet.id); }}
                          className="text-sm font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full transition"
                          style={{ color: '#1d9bf0' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(29,155,240,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <Undo2 size={14} /> Undo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function ActionButton({ icon: Icon, label, hex, onClick, active }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className="group flex items-center gap-0.5 text-[13px] transition-colors"
            style={{ color: hover || active ? hex : '#71767b' }}>
      <span className="p-2 rounded-full transition-colors" style={{ background: hover ? `${hex}26` : 'transparent' }}>
        <Icon size={18.75} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
      </span>
      {label !== undefined && label !== '' && <span className="px-1">{label}</span>}
    </button>
  );
}

function ComposerPill({ icon: Icon, label, onClick, active, activeColor = '#a855f7', disabled, title }) {
  const [hover, setHover] = useState(false);
  const tinted = active;
  const bg = tinted
    ? `${activeColor}22`
    : hover && !disabled
      ? 'rgba(29,155,240,0.1)'
      : 'transparent';
  const border = tinted ? `${activeColor}55` : '#2f3336';
  const color = tinted ? activeColor : '#1d9bf0';
  return (
    <button onClick={onClick} disabled={disabled} title={title}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 text-sm font-semibold"
            style={{ background: bg, border: `1px solid ${border}`, color, height: 32 }}>
      <Icon size={16} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
//  Composer (inline + modal)
// ════════════════════════════════════════════════════════════════

function InlineComposer({ me, onSubmit }) {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  // each media item: { file (current blob), originalFile (uncropped), previewUrl, type, aspectRatio, altText, aspectMode? }
  const [media, setMedia] = useState([]);
  const [focused, setFocused] = useState(false);
  const [posting, setPosting] = useState(false);
  const [cropping, setCropping] = useState(null); // { file, editIndex, initialAlt, initialAspectMode }
  const fileInputRef = useRef(null);
  const MAX = 280;
  const remaining = MAX - text.length;
  const canPost = (text.trim().length > 0 || media.length > 0) && !posting;

  useEffect(() => () => media.forEach(m => URL.revokeObjectURL(m.previewUrl)), []); // cleanup on unmount

  const handleFiles = (files) => {
    const incoming = Array.from(files).slice(0, 4 - media.length).filter(file => {
      if (file.size > 25 * 1024 * 1024) { alert(`${file.name} is too large (max 25 MB).`); return false; }
      return true;
    });
    setMedia(prev => [
      ...prev,
      ...incoming.map(file => ({
        file,
        originalFile: file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        aspectRatio: null,  // detected from natural dimensions in MediaGrid
        altText: '',
        aspectMode: null,
      })),
    ]);
  };

  const handleCropApply = ({ blob, aspectRatio, aspectMode, altText }) => {
    const idx = cropping?.editIndex;
    if (idx == null) { setCropping(null); return; }
    setMedia(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      URL.revokeObjectURL(item.previewUrl);
      return {
        ...item,
        file: blob,
        previewUrl: URL.createObjectURL(blob),
        aspectRatio,
        aspectMode,
        altText: altText ?? item.altText,
      };
    }));
    setCropping(null);
  };

  const handleCropCancel = () => setCropping(null);

  const removeMedia = (i) => {
    URL.revokeObjectURL(media[i].previewUrl);
    setMedia(media.filter((_, j) => j !== i));
  };

  const editMedia = (i) => {
    if (media[i].type === 'video') return;
    setCropping({
      file: media[i].originalFile,
      editIndex: i,
      initialAlt: media[i].altText || '',
      initialAspectMode: media[i].aspectMode || null,
    });
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await onSubmit({ text: text.trim(), urgent, mediaFiles: media.map(m => m.file) });
      media.forEach(m => URL.revokeObjectURL(m.previewUrl));
      setText(''); setUrgent(false); setMedia([]); setFocused(false);
    } finally {
      setPosting(false);
    }
  };

  const composerMediaOverlay = (m, i) => (
    <>
      {m.type !== 'video' && (
        <button onClick={(e) => { e.stopPropagation(); editMedia(i); }}
                className="absolute top-2 left-2 z-10 rounded-full text-white font-bold text-[13px]"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  padding: '6px 14px',
                  height: 32,
                  lineHeight: '20px',
                }}
                title="Edit">
          Edit
        </button>
      )}
      <button onClick={(e) => { e.stopPropagation(); removeMedia(i); }}
              className="absolute top-2 right-2 p-1.5 rounded-full text-white z-10"
              style={{ background: 'rgba(0,0,0,0.7)' }} title="Remove">
        <X size={14} />
      </button>
      {m.type === 'video' && (
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white z-10"
             style={{ background: 'rgba(0,0,0,0.7)' }}>VIDEO</div>
      )}
    </>
  );

  return (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid #2f3336' }}>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
             onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      <div className="flex gap-3">
        <Avatar person={me} size={40} />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            onFocus={() => setFocused(true)}
            placeholder="What's happening?"
            className="w-full bg-transparent text-xl outline-none resize-none placeholder-[#71767b]"
            style={{ color: '#e7e9ea', minHeight: focused || text ? 60 : 28, transition: 'min-height 0.2s' }}
            rows={1}
          />

          {media.length > 0 && (
            <MediaGrid items={media} context="composer" renderOverlay={composerMediaOverlay} />
          )}

          {urgent && (
            <div className="mb-3 mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs w-fit"
                 style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>
              <Zap size={12} fill="currentColor" /> Marked urgent — founders pinged immediately
            </div>
          )}

          {(focused || text || media.length > 0) && (
            <button className="text-[15px] font-bold flex items-center gap-1 mb-2 hover:underline" style={{ color: '#1d9bf0' }}>
              <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#1d9bf0' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </span>
              Everyone can reply
            </button>
          )}

          <div className="flex items-center justify-between pt-1"
               style={{ borderTop: focused || text || media.length > 0 ? '1px solid #2f3336' : 'none' }}>
            <div className="flex items-center gap-2">
              <ComposerPill icon={ImageIcon} label="Image"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={media.length >= 4} title="Add image or video" />
              <ComposerPill icon={Zap} label="Urgent"
                            onClick={() => setUrgent(!urgent)} active={urgent} title="Mark urgent" />
            </div>
            <div className="flex items-center gap-3">
              {(focused || text) && (
                <>
                  <div className="text-sm" style={{ color: remaining < 20 ? '#f4212e' : '#71767b' }}>
                    {remaining < 20 ? remaining : ''}
                  </div>
                  {text && <div className="h-6 w-px" style={{ background: '#2f3336' }} />}
                </>
              )}
              <button onClick={submit} disabled={!canPost}
                      className="px-4 py-1.5 rounded-full font-bold text-[15px] transition flex items-center gap-2"
                      style={{ background: canPost ? '#eff3f4' : '#787a7a', color: '#0f1419', opacity: canPost ? 1 : 0.5 }}>
                {posting && <Loader2 size={14} className="animate-spin" />}
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
      {cropping && (
        <CropModal file={cropping.file}
                   initialAlt={cropping.initialAlt}
                   initialAspectMode={cropping.initialAspectMode}
                   onApply={handleCropApply}
                   onCancel={handleCropCancel} />
      )}
    </div>
  );
}

function ComposerModal({ open, onClose, onSubmit, me }) {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [media, setMedia] = useState([]);
  const [posting, setPosting] = useState(false);
  const [cropping, setCropping] = useState(null);
  const fileInputRef = useRef(null);
  const MAX = 280;
  const remaining = MAX - text.length;
  const canPost = (text.trim().length > 0 || media.length > 0) && !posting;

  const handleFiles = (files) => {
    const incoming = Array.from(files).slice(0, 4 - media.length).filter(file => {
      if (file.size > 25 * 1024 * 1024) { alert(`${file.name} is too large (max 25 MB).`); return false; }
      return true;
    });
    setMedia(prev => [
      ...prev,
      ...incoming.map(file => ({
        file,
        originalFile: file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        aspectRatio: null,
        altText: '',
        aspectMode: null,
      })),
    ]);
  };

  const handleCropApply = ({ blob, aspectRatio, aspectMode, altText }) => {
    const idx = cropping?.editIndex;
    if (idx == null) { setCropping(null); return; }
    setMedia(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      URL.revokeObjectURL(item.previewUrl);
      return {
        ...item,
        file: blob,
        previewUrl: URL.createObjectURL(blob),
        aspectRatio,
        aspectMode,
        altText: altText ?? item.altText,
      };
    }));
    setCropping(null);
  };

  const handleCropCancel = () => setCropping(null);

  const removeMedia = (i) => { URL.revokeObjectURL(media[i].previewUrl); setMedia(media.filter((_, j) => j !== i)); };
  const editMedia = (i) => {
    if (media[i].type === 'video') return;
    setCropping({
      file: media[i].originalFile,
      editIndex: i,
      initialAlt: media[i].altText || '',
      initialAspectMode: media[i].aspectMode || null,
    });
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await onSubmit({ text: text.trim(), urgent, mediaFiles: media.map(m => m.file) });
      media.forEach(m => URL.revokeObjectURL(m.previewUrl));
      setText(''); setUrgent(false); setMedia([]);
      onClose();
    } finally { setPosting(false); }
  };

  const hasUnsaved = text.trim().length > 0 || media.length > 0 || urgent;
  const safeClose = () => { if (!hasUnsaved && !posting) onClose(); };
  useEscapeKey(open && !cropping, safeClose);

  const composerMediaOverlay = (m, i) => (
    <>
      {m.type !== 'video' && (
        <button onClick={(e) => { e.stopPropagation(); editMedia(i); }}
                className="absolute top-2 left-2 z-10 rounded-full text-white font-bold text-[13px]"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  padding: '6px 14px',
                  height: 32,
                  lineHeight: '20px',
                }}
                title="Edit">
          Edit
        </button>
      )}
      <button onClick={(e) => { e.stopPropagation(); removeMedia(i); }}
              className="absolute top-2 right-2 p-1.5 rounded-full text-white z-10"
              style={{ background: 'rgba(0,0,0,0.7)' }} title="Remove">
        <X size={14} />
      </button>
      {m.type === 'video' && (
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white z-10"
             style={{ background: 'rgba(0,0,0,0.7)' }}>VIDEO</div>
      )}
    </>
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(91,112,131,0.4)' }} onClick={safeClose}>
      <div className="w-full sm:max-w-xl sm:rounded-2xl sm:min-h-0 min-h-screen flex flex-col"
           style={{ background: '#000', border: '1px solid #2f3336' }} onClick={(e) => e.stopPropagation()}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
               onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
          <button onClick={onClose} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}><X size={20} /></button>
          <button onClick={submit} disabled={!canPost}
                  className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#eff3f4', color: '#0f1419', opacity: canPost ? 1 : 0.5 }}>
            {posting && <Loader2 size={14} className="animate-spin" />}
            Post
          </button>
        </div>
        <div className="p-4 flex gap-3 flex-1">
          <Avatar person={me} />
          <div className="flex-1">
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} placeholder="What's happening?"
                      className="w-full bg-transparent text-xl outline-none resize-none min-h-[120px] placeholder-[#71767b]"
                      style={{ color: '#e7e9ea' }} autoFocus />
            {media.length > 0 && (
              <MediaGrid items={media} context="composer" renderOverlay={composerMediaOverlay} />
            )}
            {urgent && (
              <div className="mb-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-full text-sm w-fit"
                   style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>
                <Zap size={14} fill="currentColor" /> Marked as urgent
              </div>
            )}
          </div>
        </div>
        <div className="p-3 flex items-center justify-between" style={{ borderTop: '1px solid #2f3336' }}>
          <div className="flex items-center gap-2">
            <ComposerPill icon={ImageIcon} label="Image"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={media.length >= 4} title="Add image or video" />
            <ComposerPill icon={Zap} label="Urgent"
                          onClick={() => setUrgent(!urgent)} active={urgent} title="Mark urgent" />
          </div>
          <div className="text-sm" style={{ color: remaining < 20 ? '#f4212e' : '#71767b' }}>{remaining}</div>
        </div>
      </div>
      {cropping && (
        <CropModal file={cropping.file}
                   initialAlt={cropping.initialAlt}
                   initialAspectMode={cropping.initialAspectMode}
                   onApply={handleCropApply}
                   onCancel={handleCropCancel} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Comment Modal
// ════════════════════════════════════════════════════════════════

function CommentModal({ tweet, onClose, onAddComment }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const quickNotes = ['change hook', 'too long', 'remove emoji', 'add chart', 'need stronger CTA', 'tighten the opening'];

  const hasUnsaved = text.trim().length > 0;
  const safeClose = () => { if (!hasUnsaved && !sending) onClose(); };
  useEscapeKey(!!tweet, safeClose);

  if (!tweet) return null;

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await onAddComment(tweet.id, text.trim()); setText(''); onClose(); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(91,112,131,0.4)' }} onClick={safeClose}>
      <div className="w-full sm:max-w-lg sm:rounded-2xl max-h-[90vh] flex flex-col"
           style={{ background: '#000', border: '1px solid #2f3336' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
          <h3 className="font-bold text-xl" style={{ color: '#e7e9ea' }}>Leave a note</h3>
          <button onClick={onClose} className="p-2 rounded-full" style={{ color: '#e7e9ea' }}><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          <div className="text-sm mb-3 line-clamp-3" style={{ color: '#71767b' }}>{tweet.content}</div>
          {tweet.comments?.length > 0 && (
            <div className="space-y-2 mb-4">
              {tweet.comments.map((c) => (
                <div key={c.id} className="px-3 py-2 rounded-lg" style={{ background: '#16181c', border: '1px solid #2f3336' }}>
                  <div className="text-xs mb-0.5" style={{ color: '#71767b' }}>
                    {c.author?.name || 'Unknown'} · {timeAgo(c.created_at)}
                  </div>
                  <div className="text-sm" style={{ color: '#e7e9ea' }}>{c.text}</div>
                </div>
              ))}
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs to change?"
                    className="w-full bg-transparent rounded-xl p-3 outline-none resize-none"
                    style={{ border: '1px solid #2f3336', color: '#e7e9ea' }} rows={3} autoFocus />
          <div className="mt-3">
            <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: '#71767b' }}>Quick notes</div>
            <div className="flex flex-wrap gap-2">
              {quickNotes.map(q => (
                <button key={q} onClick={() => setText(t => t ? `${t}, ${q}` : q)}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{ background: '#16181c', border: '1px solid #2f3336', color: '#e7e9ea' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 flex items-center gap-2" style={{ borderTop: '1px solid #2f3336' }}>
          <button onClick={submit} disabled={!text.trim() || sending}
                  className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: '#1d9bf0', color: 'white', opacity: (text.trim() && !sending) ? 1 : 0.4 }}>
            {sending && <Loader2 size={14} className="animate-spin" />}
            Send note
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Toast
// ════════════════════════════════════════════════════════════════

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.error ? '#f4212e' : toast.variant === 'urgent' ? '#a855f7' : '#1d9bf0';
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-full font-semibold text-sm shadow-2xl flex items-center gap-2 max-w-[90vw]"
         style={{ background: bg, color: 'white', animation: 'slideUp 0.3s ease-out' }}>
      {toast.icon}<span className="truncate">{toast.text}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Login flow (real Supabase auth)
// ════════════════════════════════════════════════════════════════

function FloatingInput({ label, value, onChange, type = 'text', maxLength, autoFocus, suffix }) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const showLabelTop = focused || value.length > 0;
  const isPassword = type === 'password';
  const inputType = isPassword && shown ? 'text' : type;
  return (
    <div className="mb-4">
      <div className="relative rounded transition-colors"
           style={{ border: `1px solid ${focused ? '#1d9bf0' : '#333639'}`, borderRadius: 4 }}>
        <label className="absolute left-3 pointer-events-none transition-all"
               style={{
                 top: showLabelTop ? 6 : '50%',
                 transform: showLabelTop ? 'none' : 'translateY(-50%)',
                 fontSize: showLabelTop ? 13 : 17,
                 color: focused ? '#1d9bf0' : '#71767b',
               }}>
          {label}
        </label>
        <input type={inputType} value={value} onChange={(e) => onChange(e.target.value)}
               onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
               maxLength={maxLength} autoFocus={autoFocus}
               className="w-full bg-transparent px-3 outline-none text-[17px]"
               style={{ color: '#e7e9ea', paddingTop: 26, paddingBottom: 8 }} />
        {isPassword && value.length > 0 && (
          <button onClick={() => setShown(!shown)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full" style={{ color: '#71767b' }}>
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#71767b' }}>{suffix}</div>}
      </div>
    </div>
  );
}

function LoginScreen() {
  const [mode, setMode] = useState('landing');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const goto = (m) => {
    setMode(m); setError(''); setInfo('');
    if (m !== mode) { setPassword(''); setSignupPassword(''); }
  };

  const trySignin = async () => {
    setError(''); setInfo('');
    if (!identifier.trim()) { setError('Enter your email or handle.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    try { await api.signIn({ identifier, password }); }
    catch (e) { setError(e.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  const trySignup = async () => {
    setError(''); setInfo('');
    const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
    if (!name.trim())                              { setError('Name is required.'); return; }
    if (cleanHandle.length < 3)                    { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/i.test(cleanHandle))        { setError('Username can only contain letters, numbers, underscores.'); return; }
    if (!email.includes('@') || !email.includes('.')) { setError('Enter a valid email.'); return; }
    if (signupPassword.length < 6)                 { setError('Password must be at least 6 characters.'); return; }

    setBusy(true);
    try {
      const result = await api.signUp({ email, password: signupPassword, name, handle: cleanHandle });
      if (result?.session) {
        // Already signed in — App will react to auth state change
      } else {
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signin');
        setIdentifier(email);
      }
    } catch (e) { setError(e.message || 'Sign-up failed.'); }
    finally { setBusy(false); }
  };

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );

  const ErrorBanner = () => error && (
    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg"
         style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)' }}>
      <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f4212e' }} />
      <div className="text-sm" style={{ color: '#ff8e95' }}>{error}</div>
    </div>
  );
  const InfoBanner = () => info && (
    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg"
         style={{ background: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.2)' }}>
      <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#1d9bf0' }} />
      <div className="text-sm" style={{ color: '#e7e9ea' }}>{info}</div>
    </div>
  );

  if (mode === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#000' }}>
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8"><Logo size={64} /></div>
          <h1 className="text-4xl font-black text-center mb-3" style={{ color: '#e7e9ea' }}>Happening now</h1>
          <p className="text-center mb-8 text-2xl font-bold" style={{ color: '#e7e9ea' }}>Join DraftBird today.</p>
          <button className="w-full py-3 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 mb-3"
                  style={{ background: 'white', color: '#0f1419' }}>
            <GoogleIcon /> Sign up with Google
          </button>
          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#2f3336' }} />
            <span className="text-sm" style={{ color: '#71767b' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#2f3336' }} />
          </div>
          <button onClick={() => goto('signup')} className="w-full py-3 rounded-full font-bold text-[15px] mb-3"
                  style={{ background: '#1d9bf0', color: 'white' }}>Create account</button>
          <p className="text-xs mb-6 leading-relaxed" style={{ color: '#71767b' }}>
            By signing up, you agree to the <span style={{ color: '#1d9bf0' }}>Terms</span> and <span style={{ color: '#1d9bf0' }}>Privacy Policy</span>.
          </p>
          <p className="text-[15px] font-bold mb-3" style={{ color: '#e7e9ea' }}>Already have an account?</p>
          <button onClick={() => goto('signin')} className="w-full py-3 rounded-full font-bold text-[15px]"
                  style={{ background: 'transparent', border: '1px solid #536471', color: '#1d9bf0' }}>Sign in</button>
        </div>
      </div>
    );
  }

  if (mode === 'signin') {
    return (
      <div className="min-h-screen flex flex-col items-center p-6" style={{ background: '#000' }}>
        <div className="w-full max-w-md flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8 mt-2">
            <button onClick={() => goto('landing')} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}>
              <ArrowLeft size={20} />
            </button>
            <Logo size={64} />
            <div className="w-9" />
          </div>
          <h2 className="text-3xl font-black mb-8" style={{ color: '#e7e9ea' }}>Sign in to DraftBird</h2>
          <InfoBanner />
          <FloatingInput label="Email or handle" value={identifier} onChange={setIdentifier} autoFocus />
          <FloatingInput label="Password" type="password" value={password} onChange={setPassword} />
          <ErrorBanner />
          <button onClick={trySignin} disabled={busy}
                  className="w-full py-3 rounded-full font-bold text-[15px] mt-2 flex items-center justify-center gap-2"
                  style={{ background: '#eff3f4', color: '#0f1419', opacity: busy ? 0.7 : 1 }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Log in
          </button>
          <button className="w-full py-3 rounded-full font-bold text-[15px] mt-3"
                  style={{ background: 'transparent', border: '1px solid #536471', color: '#e7e9ea' }}>
            Forgot password?
          </button>
          <div className="mt-8 text-[15px]" style={{ color: '#71767b' }}>
            Don't have an account?{' '}
            <button onClick={() => goto('signup')} className="font-medium hover:underline" style={{ color: '#1d9bf0' }}>Sign up</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <div className="min-h-screen flex flex-col items-center p-6" style={{ background: '#000' }}>
        <div className="w-full max-w-md flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6 mt-2">
            <button onClick={() => goto('landing')} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}>
              <ArrowLeft size={20} />
            </button>
            <Logo size={64} />
            <div className="w-9" />
          </div>
          <h2 className="text-3xl font-black mb-6" style={{ color: '#e7e9ea' }}>Create your account</h2>
          <FloatingInput label="Name" value={name} onChange={setName} maxLength={50} autoFocus />
          <FloatingInput label="Username" value={handle} onChange={(v) => setHandle(v.replace(/[^a-zA-Z0-9_]/g, ''))} maxLength={15} suffix={handle ? `@${handle}` : null} />
          <FloatingInput label="Email" type="email" value={email} onChange={setEmail} />
          <FloatingInput label="Password (6+ chars)" type="password" value={signupPassword} onChange={setSignupPassword} />
          <ErrorBanner />
          <p className="text-xs mb-4 mt-1 leading-relaxed" style={{ color: '#71767b' }}>
            By signing up, you agree to the <span style={{ color: '#1d9bf0' }}>Terms</span> and <span style={{ color: '#1d9bf0' }}>Privacy Policy</span>.
          </p>
          <button onClick={trySignup} disabled={busy}
                  className="w-full py-3.5 rounded-full font-bold text-[15px] flex items-center justify-center gap-2"
                  style={{ background: '#eff3f4', color: '#0f1419', opacity: busy ? 0.7 : 1 }}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Sign up
          </button>
          <div className="mt-6 text-[15px]" style={{ color: '#71767b' }}>
            Already have an account?{' '}
            <button onClick={() => goto('signin')} className="font-medium hover:underline" style={{ color: '#1d9bf0' }}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
//  Main App
// ════════════════════════════════════════════════════════════════

export default function App() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [tweets, setTweets] = useState([]);
  const [articles, setArticles] = useState([]);
  const [articleTab, setArticleTab] = useState('all');
  const [articleComposerOpen, setArticleComposerOpen] = useState(false);
  const [articleReaderId, setArticleReaderId] = useState(null);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [view, setView] = useState('home');
  const [feedTab, setFeedTab] = useState('foryou');
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { items, index }
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);

  // Refs so realtime handler always sees latest me/profiles without re-subscribing
  const meRef = useRef(me);
  const profilesRef = useRef(profiles);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  // Profile dropdown close-on-outside / Escape
  const profileMenuRef = useRef(null);
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const showToast = (text, icon, error = false, variant = 'default') => {
    setToast({ text, icon, error, variant });
    setTimeout(() => setToast(null), 2200);
  };

  // ── Auth bootstrap & subscription
  useEffect(() => {
    api.getSession().then((s) => { setSession(s); setBootLoading(false); });
    return api.onAuthChange(setSession);
  }, []);

  // ── Load profile + initial data after sign-in
  useEffect(() => {
    if (!session?.user) {
      setMe(null); setTweets([]); setArticles([]); setBookmarks(new Set()); setProfiles([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [p, ts, bm, ps, as] = await Promise.all([
          api.getProfile(session.user.id),
          api.getTweets(),
          api.getBookmarks(),
          api.getAllProfiles(),
          api.getArticles(),
        ]);
        if (cancelled) return;
        setMe(p); setTweets(ts); setBookmarks(new Set(bm)); setProfiles(ps); setArticles(as);
      } catch (e) {
        if (!cancelled) showToast(e.message || 'Failed to load', <AlertCircle size={16} />, true);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // ── Realtime: urgent INSERTs get a notification; everything else just refetches.
  useEffect(() => {
    if (!session) return;
    let timer;
    const debouncedRefetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        api.getTweets().then(setTweets).catch(() => {});
        api.getArticles().then(setArticles).catch(() => {});
      }, 300);
    };
    const onEvent = (payload) => {
      const me = meRef.current;
      const profiles = profilesRef.current;
      if (
        payload?.table === 'tweets' &&
        payload?.eventType === 'INSERT' &&
        payload.new?.urgent === true &&
        payload.new?.author_id !== me?.id
      ) {
        const author = profiles.find(p => p.id === payload.new.author_id);
        const handle = author?.handle || 'someone';
        const snippet = (payload.new.content || '').slice(0, 60);
        const ellipsis = (payload.new.content || '').length > 60 ? '…' : '';
        showToast(
          `🚨 Urgent from @${handle}: ${snippet}${ellipsis}`,
          <Zap size={14} fill="currentColor" />,
          false,
          'urgent'
        );
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const n = new Notification(`Urgent post — @${handle}`, {
              body: payload.new.content,
              icon: '/vite.svg',
              tag: `urgent-${payload.new.id}`,
            });
            n.onclick = () => { window.focus(); setView('urgent'); };
          } catch { /* notification API can throw on some browsers */ }
        }
      }
      debouncedRefetch();
    };
    const unsub = api.subscribeToFeed(onEvent);
    return () => { clearTimeout(timer); unsub(); };
  }, [session]);

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      setNotifBannerDismissed(true);
    } catch {
      setNotifBannerDismissed(true);
    }
  };

  const refreshMe = async () => {
    if (!session?.user) return;
    try {
      const p = await api.getProfile(session.user.id);
      setMe(p);
      const ps = await api.getAllProfiles();
      setProfiles(ps);
    } catch (e) {
      showToast(e.message || 'Failed to refresh profile', <AlertCircle size={16} />, true);
    }
  };

  // ── Mutations (optimistic where it makes sense)
  const handleApprove = async (id) => {
    const prev = tweets;
    setTweets(ts => ts.map(t => t.id === id ? { ...t, status: 'approved' } : t));
    try { await api.approveTweet(id); }
    catch (e) { setTweets(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleReject = async (id) => {
    const prev = tweets;
    setTweets(ts => ts.map(t => t.id === id ? { ...t, status: 'rejected' } : t));
    try { await api.rejectTweet(id); }
    catch (e) { setTweets(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleUndo = async (id) => {
    const prev = tweets;
    setTweets(ts => ts.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    try { await api.undoDecision(id); showToast('Restored', <Undo2 size={16} />); }
    catch (e) { setTweets(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleSave = async (id) => {
    const wasSaved = bookmarks.has(id);
    setBookmarks(prev => { const next = new Set(prev); if (wasSaved) next.delete(id); else next.add(id); return next; });
    try {
      await api.toggleBookmark(id, wasSaved);
      showToast(wasSaved ? 'Removed from saved' : 'Saved', <Bookmark size={16} />);
    } catch (e) {
      setBookmarks(prev => { const next = new Set(prev); if (wasSaved) next.add(id); else next.delete(id); return next; });
      showToast(e.message, <AlertCircle size={16} />, true);
    }
  };
  const handleAddComment = async (id, text) => {
    try {
      await api.addComment({ tweetId: id, text });
      const fresh = await api.getTweets();
      setTweets(fresh);
      showToast('Note sent', <MessageCircle size={16} />);
    } catch (e) { showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleSubmit = async ({ text, urgent, mediaFiles }) => {
    try {
      await api.postTweet({ content: text, urgent, mediaFiles });
      const fresh = await api.getTweets();
      setTweets(fresh);
      showToast('Posted', <Send size={16} />);
    } catch (e) {
      showToast(e.message, <AlertCircle size={16} />, true);
      throw e; // let composer keep its content
    }
  };
  const handleLogout = async () => {
    try { await api.signOut(); }
    catch (e) { showToast(e.message, <AlertCircle size={16} />, true); }
  };

  // ── Article handlers
  const handleArticleSubmit = async ({ title, subtitle, coverImageFile, content, urgent, status }) => {
    try {
      await api.postArticle({ title, subtitle, coverImageFile, content, urgent, status });
      const fresh = await api.getArticles();
      setArticles(fresh);
      showToast(status === 'draft' ? 'Draft saved' : 'Published for review', <Send size={16} />);
    } catch (e) {
      showToast(e.message, <AlertCircle size={16} />, true);
      throw e;
    }
  };
  const handleApproveArticle = async (id) => {
    const prev = articles;
    setArticles(as => as.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    try { await api.approveArticle(id); }
    catch (e) { setArticles(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleRejectArticle = async (id) => {
    const prev = articles;
    setArticles(as => as.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    try { await api.rejectArticle(id); }
    catch (e) { setArticles(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };
  const handleUndoArticle = async (id) => {
    const prev = articles;
    setArticles(as => as.map(a => a.id === id ? { ...a, status: 'pending' } : a));
    try { await api.undoArticleDecision(id); }
    catch (e) { setArticles(prev); showToast(e.message, <AlertCircle size={16} />, true); }
  };

  // ── Derived
  const inFeed         = tweets.filter(t => t.status === 'pending');
  const urgentTweets   = inFeed.filter(t => t.urgent);
  const regularPending = inFeed.filter(t => !t.urgent);
  const approvedTweets = tweets.filter(t => t.status === 'approved');
  const rejectedTweets = tweets.filter(t => t.status === 'rejected');
  const commentedPending = inFeed.filter(t => t.comments?.length > 0);

  // ── Early states
  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#1d9bf0' }} />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-3" style={{ background: '#000' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#1d9bf0' }} />
        <div className="text-sm" style={{ color: '#71767b' }}>Loading profile…</div>
      </div>
    );
  }

  // ── Focus Mode
  if (focusMode) {
    const queue = [...urgentTweets, ...regularPending];
    const current = queue[0];
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#000', color: '#e7e9ea' }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
          <button onClick={() => setFocusMode(false)} className="flex items-center gap-2 text-sm" style={{ color: '#71767b' }}>
            <ArrowLeft size={18} /> Exit Focus Mode
          </button>
          <div className="text-sm" style={{ color: '#71767b' }}>{queue.length} left</div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          {current ? (
            <div className="w-full max-w-xl" style={{ border: '1px solid #2f3336', borderRadius: 16, overflow: 'hidden' }}>
              <TweetCard tweet={current} me={me} onApprove={handleApprove} onReject={handleReject}
                         onSave={handleSave} onUndo={handleUndo} savedIds={bookmarks}
                         onOpenComments={setCommentTarget}
                         onOpenLightbox={(items, index) => setLightbox({ items, index })} />
              <div className="mt-6 mb-4 text-center text-sm" style={{ color: '#71767b' }}>Swipe right to approve · Swipe left to reject</div>
            </div>
          ) : (
            <div className="text-center" style={{ color: '#71767b' }}>
              <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: '#00ba7c' }} />
              <div className="text-xl font-bold" style={{ color: '#e7e9ea' }}>Inbox zero</div>
              <div className="text-sm">Nothing waiting</div>
            </div>
          )}
        </div>
        <CommentModal tweet={commentTarget} onClose={() => setCommentTarget(null)} onAddComment={handleAddComment} />
        <Toast toast={toast} />
      </div>
    );
  }

  // ── Sidebar nav
  const nav = [
    { key: 'home',      icon: Home,         label: 'Home',      badge: 0,                       filled: true, indicator: inFeed.length > 0 },
    { key: 'urgent',    icon: Zap,          label: 'Urgent',    badge: urgentTweets.length,     filled: true, badgeColor: '#a855f7' },
    { key: 'approved',  icon: CheckCircle2, label: 'Approved',  badge: approvedTweets.length,   filled: true, badgeColor: '#00ba7c' },
    { key: 'rejected',  icon: XCircle,      label: 'Rejected',  badge: rejectedTweets.length,   filled: true, badgeColor: '#f4212e' },
    { key: 'saved',     icon: Bookmark,     label: 'Bookmarks', badge: bookmarks.size,          filled: true },
    { key: 'analytics', icon: BarChart3,    label: 'Analytics', badge: 0 },
    { key: 'articles',  icon: Newspaper,    label: 'Articles',  badge: 0 },
    { key: 'profile',   icon: UserIcon,     label: 'Profile',   badge: 0 },
  ];

  // ── Feed filtering
  const filteredFeed = (() => {
    if (view === 'home')     return feedTab === 'urgent' ? urgentTweets : inFeed;
    if (view === 'urgent')   return urgentTweets;
    if (view === 'approved') return approvedTweets;
    if (view === 'rejected') return rejectedTweets;
    if (view === 'saved')    return tweets.filter(t => bookmarks.has(t.id));
    return [];
  })();

  const viewTitles = { home: 'Home', urgent: 'Urgent', approved: 'Approved', rejected: 'Rejected', saved: 'Bookmarks', analytics: 'Analytics', articles: 'Articles', profile: 'Profile' };

  return (
    <div className="min-h-screen" style={{ background: '#000', color: '#e7e9ea', fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, Roboto, Helvetica, Arial, sans-serif' }}>
      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes pulse-urgent { 0%, 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.5); } 50% { box-shadow: 0 0 0 6px rgba(168,85,247,0); } }
        .urgent-pulse { animation: pulse-urgent 2s infinite; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #2f3336; border-radius: 3px; }
        .nav-pill:hover { background: rgba(231,233,234,0.1) !important; }
      `}</style>

      <div className="max-w-[1290px] mx-auto flex">
        {/* LEFT SIDEBAR */}
        <aside className="hidden sm:flex flex-col items-stretch w-[260px] sticky top-0 h-screen px-2 py-1 shrink-0">
          <div className="p-3 mb-1">
            <Logo size={40} />
          </div>
          <nav className="flex flex-col gap-0.5 items-start">
            {nav.map(item => (
              <button key={item.key} onClick={() => setView(item.key)}
                      className="nav-pill flex items-center gap-5 py-3 px-3 rounded-full transition-colors text-xl"
                      style={{ color: '#e7e9ea', background: view === item.key ? 'rgba(231,233,234,0.1)' : 'transparent' }}>
                <div className="relative shrink-0">
                  <item.icon size={26.25} strokeWidth={view === item.key ? 2.75 : 2} fill={view === item.key && item.filled ? 'currentColor' : 'none'} />
                  {item.indicator && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full" style={{ background: '#1d9bf0', border: '2px solid #000' }} />
                  )}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] rounded-full text-[11px] font-bold flex items-center justify-center px-1"
                          style={{ background: item.badgeColor || '#1d9bf0', color: 'white' }}>{item.badge}</span>
                  )}
                </div>
                <span className="inline pr-4 whitespace-nowrap" style={{ fontWeight: view === item.key ? 700 : 400 }}>{item.label}</span>
              </button>
            ))}
            <button className="nav-pill flex items-center gap-5 py-3 px-3 rounded-full text-xl" style={{ color: '#e7e9ea', background: 'transparent' }}>
              <div className="w-[26.25px] h-[26.25px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#e7e9ea' }}>
                <More size={14} />
              </div>
              <span className="inline pr-4">More</span>
            </button>
            <button onClick={() => setComposerOpen(true)}
                    className="mt-3 w-[90%] h-[52px] rounded-full font-bold text-[17px] flex items-center justify-center transition"
                    style={{ background: '#eff3f4', color: '#0f1419' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#d7dbdc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#eff3f4'}>
              Post
            </button>
          </nav>

          <div ref={profileMenuRef} className="mt-auto mb-3 relative w-full">
            {profileOpen && (
              <div className="absolute bottom-full mb-2 left-0 right-0 w-[260px] rounded-2xl py-2"
                   style={{ background: '#000', border: '1px solid #2f3336', boxShadow: '0 0 15px rgba(255,255,255,0.1)' }}>
                <button onClick={() => { setFocusMode(true); setProfileOpen(false); }}
                        className="nav-pill w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3"
                        style={{ color: '#e7e9ea', background: 'transparent' }}>
                  <Eye size={18} /> Focus Mode
                </button>
                <button onClick={() => { setChangePasswordOpen(true); setProfileOpen(false); }}
                        className="nav-pill w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3"
                        style={{ color: '#e7e9ea', background: 'transparent' }}>
                  <Lock size={18} /> Change password
                </button>
                <div className="h-px mx-3 my-1" style={{ background: '#2f3336' }} />
                <button onClick={() => { handleLogout(); setProfileOpen(false); }}
                        className="nav-pill w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3"
                        style={{ color: '#f4212e', background: 'transparent' }}>
                  <LogOut size={18} /> Log out @{me.handle}
                </button>
              </div>
            )}
            <button onClick={() => setProfileOpen(!profileOpen)}
                    className="nav-pill flex items-center gap-2 p-3 rounded-full w-full" style={{ background: 'transparent' }}>
              <Avatar person={me} size={40} />
              <div className="block flex-1 text-left min-w-0">
                <div className="flex items-center gap-1 font-bold text-[15px] truncate" style={{ color: '#e7e9ea' }}>
                  {me.name} {me.verified && <VerifiedBadge size={14} />}
                </div>
                <div className="flex items-center gap-1.5 text-[13px] truncate" style={{ color: '#71767b' }}>
                  <span className="truncate">@{me.handle}</span>
                  {urgentTweets.length > 0 && (
                    <span className="shrink-0 px-1.5 rounded text-[11px] font-bold leading-tight py-0.5" style={{ background: '#00ba7c33', color: '#00ba7c' }}>
                      {urgentTweets.length}
                    </span>
                  )}
                </div>
              </div>
              <MoreHorizontal size={18} className="block" style={{ color: '#e7e9ea' }} />
            </button>
          </div>
        </aside>

        {/* CENTER */}
        <main className="flex-1 min-w-0 min-h-screen pb-16 sm:pb-0"
              style={{ borderLeft: '1px solid #2f3336', borderRight: '1px solid #2f3336', maxWidth: 600 }}>
          <header className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.65)' }}>
            <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: view === 'home' ? 'none' : '1px solid #2f3336' }}>
              <h2 className="font-black text-xl" style={{ color: '#e7e9ea' }}>{viewTitles[view]}</h2>
              {view === 'home' && (
                <button className="p-2 rounded-full hover:bg-white/10" style={{ color: '#e7e9ea' }}>
                  <Sparkles size={20} />
                </button>
              )}
            </div>
            {view === 'home' && (
              <div className="flex" style={{ borderBottom: '1px solid #2f3336' }}>
                {[['foryou','For you'],['urgent','Urgent']].map(([k, label]) => (
                  <button key={k} onClick={() => setFeedTab(k)}
                          className="flex-1 px-4 py-4 text-[15px] font-bold whitespace-nowrap transition-colors relative flex items-center justify-center gap-2"
                          style={{ color: feedTab === k ? '#e7e9ea' : '#71767b' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231,233,234,0.03)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    {label}
                    {k === 'urgent' && urgentTweets.length > 0 && (
                      <span className="px-1.5 rounded-full text-[11px] font-bold leading-tight py-0.5" style={{ background: '#a855f7', color: 'white' }}>
                        {urgentTweets.length}
                      </span>
                    )}
                    {feedTab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-full" style={{ width: 56, background: '#1d9bf0' }} />}
                  </button>
                ))}
              </div>
            )}
          </header>

          {view === 'home' && notifPermission === 'default' && !notifBannerDismissed && (
            <div className="px-4 py-3 flex items-center gap-3"
                 style={{ borderBottom: '1px solid #2f3336', background: 'rgba(168,85,247,0.06)' }}>
              <Zap size={18} style={{ color: '#c084fc' }} />
              <div className="flex-1 text-sm" style={{ color: '#e7e9ea' }}>
                Enable notifications for urgent posts?
              </div>
              <button onClick={requestNotifPermission}
                      className="px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: '#a855f7', color: 'white' }}>
                Allow
              </button>
              <button onClick={() => setNotifBannerDismissed(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: 'transparent', border: '1px solid #536471', color: '#e7e9ea' }}>
                Not now
              </button>
            </div>
          )}

          {view === 'home' && <InlineComposer me={me} onSubmit={handleSubmit} />}

          {view === 'home' && feedTab === 'foryou' && urgentTweets.length > 0 && (
            <button onClick={() => setFeedTab('urgent')}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left urgent-pulse"
                    style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.15), rgba(168,85,247,0.05), transparent)', borderBottom: '1px solid rgba(168,85,247,0.2)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#a855f7' }}>
                <Zap size={16} fill="white" className="text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-[15px]" style={{ color: '#c084fc' }}>{urgentTweets.length} urgent waiting</div>
                <div className="text-[13px]" style={{ color: '#71767b' }}>time-sensitive — review first</div>
              </div>
              <ChevronRight size={20} style={{ color: '#c084fc' }} />
            </button>
          )}

          <div>
            {view === 'analytics' ? <AnalyticsView tweets={tweets} /> :
             view === 'articles'  ? <ArticlesView
                                       articles={articles}
                                       me={me}
                                       tab={articleTab}
                                       setTab={setArticleTab}
                                       onWrite={() => setArticleComposerOpen(true)}
                                       onOpen={(id) => setArticleReaderId(id)}
                                       onApprove={handleApproveArticle}
                                       onReject={handleRejectArticle} /> :
             view === 'profile'   ? <ProfileView me={me} onLogout={handleLogout} onEdit={() => setEditProfileOpen(true)} tweets={tweets.filter(t => t.author_id === me.id)} /> :
             filteredFeed.length > 0 ? (
               filteredFeed.map(t => (
                 <TweetCard key={t.id} tweet={t} me={me}
                            isDecided={t.status === 'approved' || t.status === 'rejected'}
                            onApprove={handleApprove} onReject={handleReject}
                            onSave={handleSave} onUndo={handleUndo}
                            savedIds={bookmarks} onOpenComments={setCommentTarget}
                            onOpenLightbox={(items, index) => setLightbox({ items, index })} />
               ))
             ) : (
               <EmptyState
                 icon={view === 'approved' ? CheckCircle2 : view === 'rejected' ? XCircle : view === 'saved' ? Bookmark : CheckCircle2}
                 title={view === 'home' ? "You're all caught up" :
                        view === 'urgent' ? "No urgent tweets" :
                        view === 'approved' ? "Nothing approved yet" :
                        view === 'rejected' ? "Nothing rejected" :
                        view === 'saved' ? "Nothing saved" : ""}
                 sub={view === 'home' ? "Be the first to post — what's happening?" :
                      view === 'urgent' ? "Time-sensitive content shows up here" :
                      view === 'approved' ? "Approved tweets land here once you green-light them" :
                      view === 'rejected' ? "Rejected drafts move here so the feed stays focused" :
                      view === 'saved' ? "Tap the bookmark on any tweet to save it" : ""} />
             )}
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden lg:block w-[350px] shrink-0 px-6 py-3">
          <div className="sticky top-0 pt-1 pb-3" style={{ background: '#000' }}>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-full" style={{ background: '#202327' }}>
              <Search size={18} style={{ color: '#71767b' }} />
              <input type="text" placeholder="Search" className="flex-1 bg-transparent outline-none text-[15px]" style={{ color: '#e7e9ea' }} />
            </div>
          </div>
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#16181c' }}>
            <h3 className="font-black text-xl mb-3" style={{ color: '#e7e9ea' }}>Queue overview</h3>
            <div className="space-y-3">
              <SnapshotRow label="In the feed" value={inFeed.length} dot="#71767b" onClick={() => setView('home')} />
              <SnapshotRow label="Urgent waiting" value={urgentTweets.length} dot="#a855f7" onClick={() => setView('urgent')} />
              <SnapshotRow label="With notes" value={commentedPending.length} dot="#ffd400" onClick={() => setView('home')} />
              <SnapshotRow label="Approved" value={approvedTweets.length} dot="#00ba7c" onClick={() => setView('approved')} />
              <SnapshotRow label="Rejected" value={rejectedTweets.length} dot="#f4212e" onClick={() => setView('rejected')} />
            </div>
            <button onClick={() => setView('analytics')} className="mt-3 text-[15px] font-medium hover:underline" style={{ color: '#1d9bf0' }}>
              Show full analytics
            </button>
          </div>
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#16181c' }}>
            <h3 className="font-black text-xl mb-3" style={{ color: '#e7e9ea' }}>Who to follow</h3>
            <div className="space-y-3">
              {profiles.filter(u => u.id !== me.id).slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar person={p} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 font-bold text-[15px] truncate" style={{ color: '#e7e9ea' }}>
                      {p.name} {p.verified && <VerifiedBadge size={14} />}
                    </div>
                    <div className="text-[13px] truncate" style={{ color: '#71767b' }}>@{p.handle}</div>
                  </div>
                  <button className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: '#eff3f4', color: '#0f1419' }}>Follow</button>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs px-4 leading-relaxed" style={{ color: '#71767b' }}>
            <span className="hover:underline cursor-pointer">Terms</span> · <span className="hover:underline cursor-pointer">Privacy</span> · <span className="hover:underline cursor-pointer">Cookies</span> · © 2026 DraftBird
          </div>
        </aside>
      </div>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around py-2"
           style={{ background: 'rgba(0,0,0,0.95)', borderTop: '1px solid #2f3336', backdropFilter: 'blur(12px)' }}>
        {[
          { key: 'home', icon: Home, filled: true, badge: 0 },
          { key: 'urgent', icon: Zap, filled: true, badge: urgentTweets.length, color: '#a855f7' },
          { key: 'approved', icon: CheckCircle2, filled: true, badge: approvedTweets.length, color: '#00ba7c' },
          { key: 'rejected', icon: XCircle, filled: true, badge: rejectedTweets.length, color: '#f4212e' },
        ].map(item => (
          <button key={item.key} onClick={() => setView(item.key)} className="relative p-3"
                  style={{ color: view === item.key ? '#e7e9ea' : '#71767b' }}>
            <item.icon size={24} strokeWidth={view === item.key ? 2.5 : 2} fill={view === item.key && item.filled ? 'currentColor' : 'none'} />
            {item.badge > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                    style={{ background: item.color || '#1d9bf0', color: 'white' }}>{item.badge}</span>
            )}
          </button>
        ))}
      </nav>
      <button onClick={() => setComposerOpen(true)}
              className="sm:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center z-40"
              style={{ background: '#1d9bf0', boxShadow: '0 8px 24px rgba(29,155,240,0.4)' }}>
        <PenSquare size={22} className="text-white" />
      </button>

      <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={handleSubmit} me={me} />
      <CommentModal tweet={commentTarget} onClose={() => setCommentTarget(null)} onAddComment={handleAddComment} />
      <EditProfileModal
        open={editProfileOpen}
        me={me}
        onClose={() => setEditProfileOpen(false)}
        onAvatarUploaded={refreshMe}
        onSaved={async () => {
          await refreshMe();
          showToast('Profile updated', <Check size={16} />);
        }}
        showToast={showToast}
      />
      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSaved={() => showToast('Password updated', <Check size={16} />)}
      />
      <ArticleComposer
        open={articleComposerOpen}
        me={me}
        onClose={() => setArticleComposerOpen(false)}
        onSubmit={handleArticleSubmit}
      />
      <ArticleReader
        articleId={articleReaderId}
        articles={articles}
        me={me}
        onClose={() => setArticleReaderId(null)}
        onApprove={handleApproveArticle}
        onReject={handleRejectArticle}
        onUndo={handleUndoArticle}
      />
      <Lightbox lightbox={lightbox}
                setIndex={(i) => setLightbox(lb => lb ? { ...lb, index: i } : lb)}
                onClose={() => setLightbox(null)} />
      <Toast toast={toast} />
    </div>
  );
}

function SnapshotRow({ label, value, dot, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full text-left rounded transition" style={{ background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231,233,234,0.03)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
        <span className="text-[15px]" style={{ color: '#e7e9ea' }}>{label}</span>
      </div>
      <span className="font-bold text-[15px]" style={{ color: '#e7e9ea' }}>{value}</span>
    </button>
  );
}

function AnalyticsView({ tweets }) {
  const stats = useMemo(() => {
    const total = tweets.length;
    const approved = tweets.filter(t => t.status === 'approved').length;
    const rejected = tweets.filter(t => t.status === 'rejected').length;
    const pending = tweets.filter(t => t.status === 'pending').length;
    const urgent = tweets.filter(t => t.urgent && t.status === 'pending').length;
    const rate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;
    return { total, approved, rejected, pending, urgent, rate };
  }, [tweets]);

  const cards = [
    { label: 'Pending review',  value: stats.pending,  icon: Clock,        hex: '#71767b' },
    { label: 'Urgent waiting',  value: stats.urgent,   icon: Zap,          hex: '#a855f7' },
    { label: 'Approved',        value: stats.approved, icon: CheckCircle2, hex: '#00ba7c' },
    { label: 'Rejected',        value: stats.rejected, icon: X,            hex: '#f4212e' },
    { label: 'Approval rate',   value: `${stats.rate}%`, icon: TrendingUp, hex: '#1d9bf0' },
    { label: 'Total posts',     value: stats.total,    icon: Users,        hex: '#e7e9ea' },
  ];
  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {cards.map(c => (
        <div key={c.label} className="p-4 rounded-2xl" style={{ background: '#16181c', border: '1px solid #2f3336' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: c.hex }}>
            <c.icon size={16} />
            <span className="text-xs uppercase tracking-wide">{c.label}</span>
          </div>
          <div className="text-3xl font-black" style={{ color: '#e7e9ea' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileView({ me, onLogout, onEdit, tweets }) {
  return (
    <div>
      <div className="h-48" style={{ background: `linear-gradient(135deg, ${me.color}, ${me.color}66)` }} />
      <div className="px-4 pb-4" style={{ borderBottom: '1px solid #2f3336' }}>
        <div className="flex items-end justify-between -mt-16 mb-3">
          <div className="rounded-full p-1" style={{ background: '#000' }}>
            <Avatar person={me} size={128} />
          </div>
          <div className="flex gap-2 mt-16">
            <button onClick={onEdit} className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                    style={{ background: 'transparent', border: '1px solid #536471', color: '#e7e9ea' }}>
              <PenSquare size={14} /> Edit profile
            </button>
            <button onClick={onLogout} className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                    style={{ background: 'transparent', border: '1px solid #536471', color: '#f4212e' }}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <h1 className="font-black text-xl" style={{ color: '#e7e9ea' }}>{me.name}</h1>
          {me.verified && <VerifiedBadge size={18} />}
        </div>
        <div className="text-[15px]" style={{ color: '#71767b' }}>@{me.handle}</div>
        <div className="flex items-center gap-4 mt-3 text-[15px]">
          <span style={{ color: '#e7e9ea' }}><b>{tweets.length}</b> <span style={{ color: '#71767b' }}>Posts</span></span>
          <span style={{ color: '#e7e9ea' }}><b>{tweets.filter(t => t.status === 'approved').length}</b> <span style={{ color: '#71767b' }}>Approved</span></span>
        </div>
      </div>
      <div className="p-6 text-center" style={{ color: '#71767b' }}>Showing posts by @{me.handle}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="py-20 px-6 text-center">
      <Icon size={48} className="mx-auto mb-4" style={{ color: '#2f3336' }} />
      <div className="text-xl font-bold mb-1" style={{ color: '#e7e9ea' }}>{title}</div>
      <div className="text-sm" style={{ color: '#71767b' }}>{sub}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Lightbox
// ════════════════════════════════════════════════════════════════

function Lightbox({ lightbox, setIndex, onClose }) {
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && lightbox.index > 0) setIndex(lightbox.index - 1);
      if (e.key === 'ArrowRight' && lightbox.index < lightbox.items.length - 1) setIndex(lightbox.index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, setIndex, onClose]);

  if (!lightbox) return null;
  const { items, index } = lightbox;
  const m = items[index];
  if (!m) return null;
  const src = m.url || m.previewUrl;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.95)' }}
         onClick={onClose}>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="absolute top-4 right-4 p-2 rounded-full text-white z-10"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
        <X size={22} />
      </button>

      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-semibold text-white z-10"
             style={{ background: 'rgba(0,0,0,0.55)' }}>
          {index + 1} / {items.length}
        </div>
      )}

      {hasPrev && (
        <button onClick={(e) => { e.stopPropagation(); setIndex(index - 1); }}
                className="absolute left-4 p-3 rounded-full text-white z-10"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
          <ChevronLeft size={26} />
        </button>
      )}
      {hasNext && (
        <button onClick={(e) => { e.stopPropagation(); setIndex(index + 1); }}
                className="absolute right-4 p-3 rounded-full text-white z-10"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
          <ChevronRight size={26} />
        </button>
      )}

      <div className="max-w-[95vw] max-h-[90vh] flex items-center justify-center"
           onClick={(e) => e.stopPropagation()}>
        {m.type === 'video' ? (
          <video src={src} controls playsInline
                 className="max-w-full max-h-[90vh]"
                 style={{ background: '#000' }} />
        ) : (
          <img src={src} alt=""
               className="max-w-full max-h-[90vh] object-contain" />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Edit Profile
// ════════════════════════════════════════════════════════════════

function EditProfileModal({ open, me, onClose, onSaved, onAvatarUploaded, showToast }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open && me) {
      setName(me.name || '');
      setHandle(me.handle || '');
      setPreview(me.avatar_url || null);
      setError('');
    }
  }, [open, me]);

  if (!open) return null;

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Avatar must be an image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Avatar must be under 5 MB.'); return; }
    setError('');
    setUploading(true);
    try {
      const url = await api.uploadAvatar(file);
      setPreview(url);
      // Refresh me immediately so the sidebar / rest of app reflect the new avatar
      // even if the user closes the modal without clicking Save.
      if (onAvatarUploaded) await onAvatarUploaded();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setError(err.message || 'Avatar upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await api.updateProfile({ name, handle });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const previewPerson = { ...(me || {}), name, handle, avatar_url: preview };
  const hasUnsaved = !!me && (name !== (me.name || '') || handle !== (me.handle || ''));
  const safeClose = () => { if (!hasUnsaved && !uploading && !saving) onClose(); };
  useEscapeKey(open, safeClose);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(91,112,131,0.4)' }} onClick={safeClose}>
      <div className="w-full sm:max-w-lg sm:rounded-2xl flex flex-col"
           style={{ background: '#000', border: '1px solid #2f3336', maxHeight: '95vh' }}
           onClick={(e) => e.stopPropagation()}>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}><X size={20} /></button>
            <h3 className="font-bold text-xl" style={{ color: '#e7e9ea' }}>Edit profile</h3>
          </div>
          <button onClick={save} disabled={saving || uploading}
                  className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#eff3f4', color: '#0f1419', opacity: (saving || uploading) ? 0.5 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          <div className="flex justify-center mb-6">
            <button onClick={() => fileInputRef.current?.click()}
                    className="relative group"
                    title="Change avatar"
                    style={{ borderRadius: '9999px' }}>
              <Avatar person={previewPerson} size={120} />
              <div className="absolute inset-0 flex items-center justify-center rounded-full"
                   style={{ background: 'rgba(0,0,0,0.55)', opacity: uploading ? 1 : 0.85 }}>
                {uploading
                  ? <Loader2 size={28} className="animate-spin text-white" />
                  : <Camera size={26} className="text-white" />}
              </div>
            </button>
          </div>
          <FloatingInput label="Name" value={name} onChange={setName} maxLength={50} />
          <FloatingInput label="Username" value={handle}
                         onChange={(v) => setHandle(v.replace(/[^a-zA-Z0-9_]/g, ''))}
                         maxLength={15}
                         suffix={handle ? `@${handle}` : null} />
          {error && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f4212e' }} />
              <div className="text-sm" style={{ color: '#ff8e95' }}>{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Change Password
// ════════════════════════════════════════════════════════════════

function ChangePasswordModal({ open, onClose, onSaved }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setCurrent(''); setNext(''); setConfirmPwd(''); setError(''); }
  }, [open]);

  const hasUnsaved = current.length > 0 || next.length > 0 || confirmPwd.length > 0;
  const safeClose = () => { if (!hasUnsaved && !saving) onClose(); };
  useEscapeKey(open, safeClose);

  if (!open) return null;

  const save = async () => {
    setError('');
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (next !== confirmPwd) { setError('New password and confirmation do not match.'); return; }
    if (next === current) { setError('New password must differ from the current one.'); return; }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(91,112,131,0.4)' }} onClick={safeClose}>
      <div className="w-full sm:max-w-md sm:rounded-2xl flex flex-col"
           style={{ background: '#000', border: '1px solid #2f3336', maxHeight: '95vh' }}
           onClick={(e) => e.stopPropagation()}>
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}><X size={20} /></button>
            <h3 className="font-bold text-xl" style={{ color: '#e7e9ea' }}>Change password</h3>
          </div>
          <button onClick={save} disabled={saving}
                  className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#eff3f4', color: '#0f1419', opacity: saving ? 0.5 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <FloatingInput label="Current password" type="password" value={current} onChange={setCurrent} autoFocus />
          <FloatingInput label="New password" type="password" value={next} onChange={setNext} />
          <FloatingInput label="Confirm new password" type="password" value={confirmPwd} onChange={setConfirmPwd} />
          {error && (
            <div className="flex items-start gap-2 mb-1 px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f4212e' }} />
              <div className="text-sm" style={{ color: '#ff8e95' }}>{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  Articles
// ════════════════════════════════════════════════════════════════

function readingTime(html) {
  const text = (html || '').replace(/<[^>]+>/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}

function ArticleStatusPill({ status }) {
  const colors = {
    pending:  { bg: 'rgba(113,118,123,0.15)', fg: '#a5acaf', label: 'Pending' },
    approved: { bg: 'rgba(0,186,124,0.15)',   fg: '#00ba7c', label: 'Approved' },
    rejected: { bg: 'rgba(244,33,46,0.15)',   fg: '#ff8e95', label: 'Rejected' },
    draft:    { bg: 'rgba(168,85,247,0.15)',  fg: '#c084fc', label: 'Draft' },
  }[status] || { bg: '#2f3336', fg: '#71767b', label: status };
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: colors.bg, color: colors.fg }}>{colors.label}</span>
  );
}

function ArticlesView({ articles, me, tab, setTab, onWrite, onOpen, onApprove, onReject }) {
  const filtered = articles.filter(a => {
    if (a.status === 'draft' && a.author_id !== me.id) return false;
    if (tab === 'all') return true;
    if (tab === 'pending')  return a.status === 'pending';
    if (tab === 'approved') return a.status === 'approved';
    if (tab === 'rejected') return a.status === 'rejected';
    return true;
  });

  return (
    <div>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #2f3336' }}>
        <div className="text-sm" style={{ color: '#71767b' }}>{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}</div>
        <button onClick={onWrite}
                className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                style={{ background: '#1d9bf0', color: 'white' }}>
          <PenSquare size={14} /> Write
        </button>
      </div>
      <div className="flex" style={{ borderBottom: '1px solid #2f3336' }}>
        {[['all','All'],['pending','Pending'],['approved','Approved'],['rejected','Rejected']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
                  className="flex-1 px-4 py-4 text-[15px] font-bold whitespace-nowrap transition-colors relative"
                  style={{ color: tab === k ? '#e7e9ea' : '#71767b' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231,233,234,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            {label}
            {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-full" style={{ width: 56, background: '#1d9bf0' }} />}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Newspaper} title="No articles here yet"
                    sub={tab === 'all' ? "Tap Write to start one" : `No ${tab} articles`} />
      ) : (
        filtered.map(a => (
          <ArticleCard key={a.id} article={a} me={me}
                       onOpen={() => onOpen(a.id)}
                       onApprove={() => onApprove(a.id)}
                       onReject={() => onReject(a.id)} />
        ))
      )}
    </div>
  );
}

function ArticleCard({ article, me, onOpen, onApprove, onReject }) {
  const author = article.author || { name: 'Unknown', handle: 'unknown', color: '#71767b' };
  const rt = readingTime(article.content);
  const isPending = article.status === 'pending';
  const canAct = isPending && article.author_id !== me.id;

  return (
    <article onClick={onOpen}
             className="px-4 py-4 cursor-pointer transition-colors flex gap-4"
             style={{ borderBottom: '1px solid #2f3336' }}
             onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231,233,234,0.03)'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0"
           style={{
             background: article.cover_image_url
               ? `url(${article.cover_image_url}) center/cover`
               : `linear-gradient(135deg, ${author.color || '#1d9bf0'}, ${author.color || '#1d9bf0'}66)`,
           }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] mb-1" style={{ color: '#71767b' }}>
          <Avatar person={author} size={20} />
          <span className="truncate font-semibold" style={{ color: '#e7e9ea' }}>{author.name}</span>
          {author.verified && <VerifiedBadge size={12} />}
          <span className="truncate">@{author.handle}</span>
          <span>·</span>
          <span>{timeAgo(article.created_at)}</span>
          <span>·</span>
          <span>{rt.minutes} min read</span>
        </div>
        <div className="font-bold text-[17px] leading-tight line-clamp-2 mb-1" style={{ color: '#e7e9ea' }}>
          {article.title || 'Untitled'}
        </div>
        {article.subtitle && (
          <div className="text-sm leading-snug line-clamp-2" style={{ color: '#71767b' }}>{article.subtitle}</div>
        )}
        <div className="mt-2 flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <ArticleStatusPill status={article.status} />
            {article.urgent && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                <Zap size={10} fill="currentColor" /> Urgent
              </span>
            )}
          </div>
          {canAct && (
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); onApprove(); }}
                      className="p-1.5 rounded-full transition"
                      style={{ color: '#00ba7c' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,186,124,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Approve">
                <Check size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onReject(); }}
                      className="p-1.5 rounded-full transition"
                      style={{ color: '#f4212e' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,33,46,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Reject">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function TipTapToolbarButton({ icon: Icon, active, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
            className="p-2 rounded-md transition-colors"
            style={{
              color: active ? '#1d9bf0' : '#e7e9ea',
              background: active ? 'rgba(29,155,240,0.15)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(231,233,234,0.08)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Icon size={16} />
    </button>
  );
}

function ArticleComposer({ open, me, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const coverInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Tell your story…' }),
      TiptapImage,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'article-body article-editor focus:outline-none',
      },
    },
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTitle(''); setSubtitle(''); setCoverFile(null);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
      setUrgent(false); setError(''); setSaving(null);
    }
  }, [open]);

  const hasUnsaved = title.trim().length > 0 || subtitle.trim().length > 0 || !!coverFile ||
                     (editor?.getText?.()?.trim().length || 0) > 0;
  const safeClose = () => { if (!hasUnsaved && !saving) onClose(); };
  useEscapeKey(open, safeClose);

  if (!open) return null;

  const onPickCover = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Cover must be an image.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Cover must be under 8 MB.'); return; }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError('');
  };

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const submit = async (status) => {
    setError('');
    if (!title.trim()) { setError('Add a title before saving.'); return; }
    setSaving(status);
    try {
      await onSubmit({
        title,
        subtitle,
        coverImageFile: coverFile,
        content: editor?.getHTML() || '',
        urgent,
        status,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save article.');
    } finally {
      setSaving(null);
    }
  };

  const insertImage = () => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const rt = readingTime(editor?.getHTML() || '');

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickCover} />
      <header className="px-4 py-3 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid #2f3336' }}>
        <button onClick={onClose}
                className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ color: '#e7e9ea' }}>Cancel</button>
        <div className="text-xs" style={{ color: '#71767b' }}>
          {rt.words} word{rt.words === 1 ? '' : 's'} · {rt.minutes} min read
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => submit('draft')} disabled={!!saving}
                  className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: 'transparent', border: '1px solid #536471', color: '#e7e9ea', opacity: saving ? 0.5 : 1 }}>
            {saving === 'draft' && <Loader2 size={14} className="animate-spin" />}
            Save draft
          </button>
          <button onClick={() => submit('pending')} disabled={!!saving}
                  className="px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-2"
                  style={{ background: '#1d9bf0', color: 'white', opacity: saving ? 0.6 : 1 }}>
            {saving === 'pending' && <Loader2 size={14} className="animate-spin" />}
            Publish for review
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {coverPreview || coverFile ? (
            <div className="relative w-full mb-6 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/7' }}>
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button onClick={removeCover}
                      className="absolute top-3 right-3 p-2 rounded-full text-white"
                      style={{ background: 'rgba(0,0,0,0.7)' }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => coverInputRef.current?.click()}
                    className="w-full mb-6 rounded-2xl flex flex-col items-center justify-center transition"
                    style={{
                      aspectRatio: '16/7',
                      border: '2px dashed #2f3336',
                      color: '#71767b',
                      background: 'rgba(231,233,234,0.02)',
                    }}>
              <ImagePlus size={32} className="mb-2" />
              <div className="text-sm font-semibold">Add a cover image</div>
              <div className="text-xs mt-1">Click to upload (max 8 MB)</div>
            </button>
          )}

          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            rows={1}
            className="w-full bg-transparent outline-none resize-none mb-3 article-title-input"
            style={{ color: '#e7e9ea', fontSize: 36, fontWeight: 800, lineHeight: 1.15, fontFamily: 'Georgia, serif' }} />
          <textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Add a subtitle..."
            rows={1}
            className="w-full bg-transparent outline-none resize-none mb-6 article-subtitle-input"
            style={{ color: '#71767b', fontSize: 20, fontFamily: 'Georgia, serif' }} />

          <div className="sticky top-0 z-10 -mx-2 px-2 py-2 mb-3 flex items-center gap-1 flex-wrap"
               style={{ background: '#000', borderBottom: '1px solid #2f3336' }}>
            <TipTapToolbarButton icon={Bold} title="Bold"
                                 active={editor?.isActive('bold')}
                                 onClick={() => editor?.chain().focus().toggleBold().run()} />
            <TipTapToolbarButton icon={Italic} title="Italic"
                                 active={editor?.isActive('italic')}
                                 onClick={() => editor?.chain().focus().toggleItalic().run()} />
            <span className="w-px h-5 mx-1" style={{ background: '#2f3336' }} />
            <TipTapToolbarButton icon={Heading1} title="Heading 1"
                                 active={editor?.isActive('heading', { level: 1 })}
                                 onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} />
            <TipTapToolbarButton icon={Heading2} title="Heading 2"
                                 active={editor?.isActive('heading', { level: 2 })}
                                 onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
            <span className="w-px h-5 mx-1" style={{ background: '#2f3336' }} />
            <TipTapToolbarButton icon={Quote} title="Quote"
                                 active={editor?.isActive('blockquote')}
                                 onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
            <TipTapToolbarButton icon={List} title="Bullet list"
                                 active={editor?.isActive('bulletList')}
                                 onClick={() => editor?.chain().focus().toggleBulletList().run()} />
            <TipTapToolbarButton icon={ListOrdered} title="Numbered list"
                                 active={editor?.isActive('orderedList')}
                                 onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
            <TipTapToolbarButton icon={Code} title="Code block"
                                 active={editor?.isActive('codeBlock')}
                                 onClick={() => editor?.chain().focus().toggleCodeBlock().run()} />
            <span className="w-px h-5 mx-1" style={{ background: '#2f3336' }} />
            <TipTapToolbarButton icon={ImagePlus} title="Insert image"
                                 onClick={insertImage} />
            <div className="ml-auto">
              <ComposerPill icon={Zap} label="Urgent" active={urgent}
                            onClick={() => setUrgent(!urgent)} title="Mark urgent" />
            </div>
          </div>

          <EditorContent editor={editor} />

          {error && (
            <div className="flex items-start gap-2 mt-4 px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f4212e' }} />
              <div className="text-sm" style={{ color: '#ff8e95' }}>{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleReader({ articleId, articles, me, onClose, onApprove, onReject, onUndo }) {
  const article = articleId ? articles.find(a => a.id === articleId) : null;
  useEscapeKey(!!article, onClose);
  if (!article) return null;

  const author = article.author || { name: 'Unknown', handle: 'unknown', color: '#71767b' };
  const rt = readingTime(article.content);
  const isDecided = article.status === 'approved' || article.status === 'rejected';
  const canAct = article.status === 'pending' && article.author_id !== me.id;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#000' }}>
      <header className="sticky top-0 z-30 backdrop-blur-xl flex items-center gap-2 px-4 py-3"
              style={{ background: 'rgba(0,0,0,0.65)', borderBottom: '1px solid #2f3336' }}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-full" style={{ color: '#e7e9ea' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="font-bold text-[17px] truncate" style={{ color: '#e7e9ea' }}>{article.title}</div>
        <div className="ml-auto"><ArticleStatusPill status={article.status} /></div>
      </header>

      {article.cover_image_url && (
        <div className="w-full" style={{ height: 400, background: `url(${article.cover_image_url}) center/cover` }} />
      )}

      <article className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-extrabold mb-3"
            style={{ color: '#e7e9ea', fontSize: 40, lineHeight: 1.15, fontFamily: 'Georgia, serif' }}>
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="mb-6" style={{ color: '#71767b', fontSize: 22, fontFamily: 'Georgia, serif' }}>
            {article.subtitle}
          </p>
        )}
        <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: '1px solid #2f3336' }}>
          <Avatar person={author} size={44} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 font-bold text-[15px]" style={{ color: '#e7e9ea' }}>
              {author.name} {author.verified && <VerifiedBadge size={14} />}
            </div>
            <div className="text-[13px]" style={{ color: '#71767b' }}>
              @{author.handle} · {new Date(article.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · {rt.minutes} min read
            </div>
          </div>
          {article.urgent && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
              <Zap size={10} fill="currentColor" /> Urgent
            </span>
          )}
        </div>

        {article.status === 'rejected' && article.rejection_note && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm"
               style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)', color: '#ff8e95' }}>
            <span className="font-semibold">Rejected: </span>{article.rejection_note}
          </div>
        )}

        <div className="article-body" dangerouslySetInnerHTML={{ __html: article.content || '<p><em>Empty article.</em></p>' }} />

        {(canAct || isDecided) && (
          <div className="mt-10 pt-6 flex items-center gap-2" style={{ borderTop: '1px solid #2f3336' }}>
            {canAct ? (
              <>
                <button onClick={() => { onApprove(article.id); onClose(); }}
                        className="px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                        style={{ background: '#00ba7c', color: 'white' }}>
                  <Check size={16} /> Approve
                </button>
                <button onClick={() => { onReject(article.id); onClose(); }}
                        className="px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                        style={{ background: 'transparent', border: '1px solid #f4212e', color: '#f4212e' }}>
                  <X size={16} /> Reject
                </button>
              </>
            ) : isDecided ? (
              <button onClick={() => { onUndo(article.id); }}
                      className="px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
                      style={{ background: 'transparent', border: '1px solid #536471', color: '#1d9bf0' }}>
                <Undo2 size={14} /> Undo decision
              </button>
            ) : null}
          </div>
        )}
      </article>
    </div>
  );
}
