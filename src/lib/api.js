// lib/api.js
// ─────────────────────────────────────────────────────────────────
// All Supabase operations the app needs. Pure functions returning
// promises — easy to swap for mocks in tests.
// ─────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

// ── Auth ─────────────────────────────────────────────────────────

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp({ email, password, name, handle }) {
  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');

  // Pre-check uniqueness (the DB also enforces it, but this gives a clean error)
  const { data: existing } = await supabase
    .from('profiles')
    .select('handle')
    .eq('handle', cleanHandle)
    .maybeSingle();
  if (existing) throw new Error('That username is already taken.');

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name.trim(), handle: cleanHandle },
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email OR handle.
 * If the user types a handle, we look up their email first.
 */
export async function signIn({ identifier, password }) {
  const id = identifier.trim();
  let email = id;

  if (!id.includes('@')) {
    const handle = id.replace(/^@/, '').toLowerCase();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('handle', handle)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.email) throw new Error("We couldn't find that account.");
    email = profile.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes('invalid')) {
      throw new Error('Incorrect email/handle or password.');
    }
    throw error;
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, handle, color, verified, email, avatar_url')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Profile updates ──────────────────────────────────────────────

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id);
  if (updErr) throw updErr;

  return url;
}

export async function updateProfile({ name, handle }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const cleanName = (name || '').trim();
  const cleanHandle = (handle || '').trim().toLowerCase().replace(/^@/, '');
  if (!cleanName) throw new Error('Name is required.');
  if (cleanHandle.length < 3) throw new Error('Username must be at least 3 characters.');
  if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
    throw new Error('Username can only contain letters, numbers, underscores.');
  }

  const { data: existing, error: lookupErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', cleanHandle)
    .neq('id', user.id)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (existing) throw new Error('That username is already taken.');

  const { error } = await supabase
    .from('profiles')
    .update({ name: cleanName, handle: cleanHandle })
    .eq('id', user.id);
  if (error) throw error;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Not signed in.');

  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyErr) throw new Error('Current password is incorrect.');

  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updErr) throw updErr;
}

// ── Tweets ───────────────────────────────────────────────────────

/**
 * Returns tweets with author, media, and comments embedded.
 * Most recent first.
 */
export async function getTweets() {
  const { data, error } = await supabase
    .from('tweets')
    .select(`
      *,
      author:profiles!tweets_author_id_fkey (id, name, handle, color, verified),
      media:tweet_media (id, url, type, position),
      comments:tweet_comments (
        id, text, created_at,
        author:profiles!tweet_comments_author_id_fkey (id, name, handle)
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Sort embedded arrays for stable rendering
  return (data || []).map(t => ({
    ...t,
    media: (t.media || []).sort((a, b) => a.position - b.position),
    comments: (t.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));
}

/**
 * Posts a tweet. `mediaFiles` is an array of File objects (from <input type=file>).
 * Uploads to storage first, then inserts the tweet + media rows.
 */
export async function postTweet({ content, urgent, mediaFiles = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  // 1. Insert tweet first (so we have an id for media)
  const { data: tweet, error: tweetErr } = await supabase
    .from('tweets')
    .insert({
      author_id: user.id,
      content,
      urgent: !!urgent,
      status: 'pending',
    })
    .select()
    .single();
  if (tweetErr) throw tweetErr;

  // 2. Upload each file to storage, then insert tweet_media rows.
  //    `mediaFiles` may be Blobs (cropped output) without a `.name` — fall back
  //    to a generated filename so the path still has an extension.
  if (mediaFiles.length > 0) {
    const mediaRows = [];
    for (const [i, file] of mediaFiles.entries()) {
      const isVideo = (file.type || '').startsWith('video/');
      const fallbackName = isVideo ? `clip-${i}.mp4` : `cropped-${i}.jpg`;
      const name = file.name || fallbackName;
      const ext = (name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const path = `${user.id}/${tweet.id}/${i}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('tweet-media')
        .upload(path, file, { contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'), upsert: false });
      if (uploadErr) {
        // Roll back the tweet on upload failure
        await supabase.from('tweets').delete().eq('id', tweet.id);
        throw uploadErr;
      }

      const { data: publicUrlData } = supabase.storage
        .from('tweet-media')
        .getPublicUrl(path);

      mediaRows.push({
        tweet_id: tweet.id,
        url: publicUrlData.publicUrl,
        type: isVideo ? 'video' : 'image',
        position: i,
      });
    }

    const { error: mediaErr } = await supabase.from('tweet_media').insert(mediaRows);
    if (mediaErr) throw mediaErr;
  }

  return tweet;
}

export async function approveTweet(id) {
  const { error } = await supabase
    .from('tweets')
    .update({ status: 'approved', rejection_note: null })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectTweet(id, note = null) {
  const { error } = await supabase
    .from('tweets')
    .update({ status: 'rejected', rejection_note: note })
    .eq('id', id);
  if (error) throw error;
}

export async function undoDecision(id) {
  const { error } = await supabase
    .from('tweets')
    .update({ status: 'pending', rejection_note: null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTweet(id) {
  const { error } = await supabase.from('tweets').delete().eq('id', id);
  if (error) throw error;
}

// ── Articles ─────────────────────────────────────────────────────

export async function getArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      author:profiles!articles_author_id_fkey (id, name, handle, color, verified, avatar_url)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getArticle(id) {
  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      author:profiles!articles_author_id_fkey (id, name, handle, color, verified, avatar_url)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function postArticle({ title, subtitle, coverImageFile, content, urgent, status = 'pending' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  let coverUrl = null;
  if (coverImageFile) {
    const ext = (coverImageFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/article-cover-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('tweet-media')
      .upload(path, coverImageFile, { contentType: coverImageFile.type, upsert: false });
    if (uploadErr) throw uploadErr;
    const { data: pub } = supabase.storage.from('tweet-media').getPublicUrl(path);
    coverUrl = pub.publicUrl;
  }

  const { data, error } = await supabase
    .from('articles')
    .insert({
      author_id: user.id,
      title: (title || '').trim(),
      subtitle: subtitle ? subtitle.trim() : null,
      cover_image_url: coverUrl,
      content: content || '',
      urgent: !!urgent,
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateArticle(id, fields) {
  const { error } = await supabase.from('articles').update(fields).eq('id', id);
  if (error) throw error;
}

export async function approveArticle(id) {
  const { error } = await supabase
    .from('articles')
    .update({ status: 'approved', rejection_note: null })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectArticle(id, note = null) {
  const { error } = await supabase
    .from('articles')
    .update({ status: 'rejected', rejection_note: note })
    .eq('id', id);
  if (error) throw error;
}

export async function undoArticleDecision(id) {
  const { error } = await supabase
    .from('articles')
    .update({ status: 'pending', rejection_note: null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteArticle(id) {
  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) throw error;
}

// ── Comments ─────────────────────────────────────────────────────

export async function addComment({ tweetId, text }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('tweet_comments')
    .insert({ tweet_id: tweetId, author_id: user.id, text: text.trim() })
    .select(`*, author:profiles!tweet_comments_author_id_fkey (id, name, handle)`)
    .single();
  if (error) throw error;
  return data;
}

// ── Bookmarks ────────────────────────────────────────────────────

export async function getBookmarks() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('bookmarks')
    .select('tweet_id')
    .eq('user_id', user.id);
  if (error) throw error;
  return data.map(b => b.tweet_id);
}

export async function toggleBookmark(tweetId, isCurrentlyBookmarked) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  if (isCurrentlyBookmarked) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('tweet_id', tweetId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('bookmarks')
      .insert({ user_id: user.id, tweet_id: tweetId });
    if (error && error.code !== '23505') throw error; // ignore "already bookmarked"
  }
}

// ── Realtime ─────────────────────────────────────────────────────

/**
 * Subscribes to changes on tweets / comments / media.
 * `onChange` is called whenever something changes — pair with refetch.
 * Returns an unsubscribe function.
 */
export function subscribeToFeed(onChange) {
  const channel = supabase
    .channel('feed-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tweets'         }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tweet_comments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tweet_media'    }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'articles'       }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
