/* ============================================================
   Mon SMV · Réseau social
   - Feed photos/vidéos
   - Stories 24h
   - Posts : like, commentaires
   - DMs 1:1
   - Profils utilisateurs (publics ou privés)
   - Recherche
   - BeReal (manual trigger par admin/cadre)
   - Modération
   ============================================================ */
import { ICONS } from './icons.js';
import { db } from './db.js';
import { supabase } from './supabase-client.js';
import { currentUser, ROLES_LABELS } from './auth.js';

/* ---------- Helpers ---------- */
function escapeHtml(s) { return (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function initials(f = '', l = '') { return ((f[0] || '') + (l[0] || '')).toUpperCase(); }
function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + ' h';
  if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' j';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/* ---------- Avatar (image OU initiales) ---------- */
export function userAvatar(user, size = 40) {
  if (!user) return `<div class="avatar avatar--ph" style="width:${size}px;height:${size}px;">?</div>`;
  if (user.avatarUrl) {
    return `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.username || '')}" style="width:${size}px;height:${size}px;border-radius:999px;object-fit:cover;" />`;
  }
  const isSection = user.accountType === 'section' || user.accountType === 'com';
  const cls = isSection ? 'avatar--section' : '';
  return `<div class="avatar ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.max(10, size / 3)}px;">${initials(user.firstName, user.lastName)}</div>`;
}

export function userDisplayName(user) {
  if (!user) return 'Inconnu';
  if (user.accountType === 'section') return `Section ${user.section || user.lastName}`;
  if (user.accountType === 'com') return user.firstName || 'Cellule COM';
  if (user.accountType === 'official') return user.firstName + ' ' + user.lastName;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

/* ============================================================
   FEED · #/feed
   ============================================================ */
export function feedScreen() {
  const me = currentUser();
  if (!me) return '';

  // Posts visibles : non hidden, ordonnés
  const posts = db.filter('posts', (p) => !p.hidden)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Stories non expirées, groupées par auteur
  const now = new Date().toISOString();
  const storiesByAuthor = {};
  db.filter('stories', (s) => (s.expiresAt || '') > now).forEach((s) => {
    if (!storiesByAuthor[s.authorId]) storiesByAuthor[s.authorId] = [];
    storiesByAuthor[s.authorId].push(s);
  });

  // BeReal en cours ?
  const activeBereal = db.find('berealRounds', (r) => new Date(r.endsAt).getTime() > Date.now());
  const myBerealPost = activeBereal ? db.find('posts', (p) => p.berealRoundId === activeBereal.id && p.authorId === me.id) : null;

  return `
    <section class="screen screen--white">
      ${statusbar()}
      <header class="feed-topbar">
        <div class="feed-topbar__brand">${escapeHtml(db.getSettings().applicationName || 'Mon SMV')}</div>
        <div class="feed-topbar__actions">
          <button class="feed-topbar__btn" data-link="#/dm" aria-label="Messages">${ICONS.send}</button>
        </div>
      </header>

      ${activeBereal ? berealBanner(activeBereal, myBerealPost) : ''}

      <div class="stories-bar">
        <button class="story-ring story-ring--mine" data-link="#/story/nouvelle">
          ${userAvatar(me, 60)}
          <div class="story-ring__plus">+</div>
          <span>Ta story</span>
        </button>
        ${Object.entries(storiesByAuthor).filter(([id]) => id !== me.id).map(([authorId, list]) => {
          const a = db.byId('users', authorId);
          if (!a) return '';
          return `<button class="story-ring" data-link="#/story/${a.username}">
            ${userAvatar(a, 60)}
            <span>${escapeHtml(a.firstName || a.username)}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="feed">
        ${posts.length === 0 ? `
          <div class="empty" style="padding: 60px 24px;">
            <div class="empty__icon">${ICONS.image}</div>
            <h3 class="h3">Pas encore de post</h3>
            <p class="muted">Sois le premier à partager une photo !</p>
            <button class="btn btn--fluo" data-link="#/composer">${ICONS.plus}<span>Publier</span></button>
          </div>` : posts.map((p) => postCard(p, me)).join('')}
      </div>

      ${bottomNavSocial(me.role, 'feed')}
    </section>`;
}

function berealBanner(round, myPost) {
  const remainingMs = new Date(round.endsAt).getTime() - Date.now();
  const remaining = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  return `
    <div class="bereal-banner ${myPost ? 'bereal-banner--done' : ''}">
      <div class="bereal-banner__title">⏱ ${myPost ? 'BeReal posté ✓' : "C'est l'heure du BeReal !"}</div>
      <div class="bereal-banner__sub">${myPost ? 'Découvre les BeReal des autres 👇' : `Tu as ${mm}:${ss} pour poster une photo`}</div>
      ${!myPost ? `<button class="btn btn--fluo btn--sm" data-link="#/composer/bereal">${ICONS.image}<span>Poster maintenant</span></button>` : ''}
    </div>`;
}

function postCard(p, me) {
  const author = db.byId('users', p.authorId);
  if (!author) return '';
  const myReact = db.find('reactions', (r) => r.postId === p.id && r.userId === me.id);
  const likes = db.filter('reactions', (r) => r.postId === p.id).length;
  const comments = db.filter('comments', (c) => c.postId === p.id && !c.hidden);
  return `
    <article class="post">
      <header class="post__head">
        <a class="post__author" href="#/profil/${escapeHtml(author.username)}">
          ${userAvatar(author, 36)}
          <div>
            <div class="post__name">${escapeHtml(userDisplayName(author))} ${author.accountType === 'section' ? '<span class="tag tag--fluo" style="margin-left:6px">Section</span>' : ''}</div>
            <div class="post__meta">${relTime(p.createdAt)} ${p.section ? '· ' + escapeHtml(p.section) : ''}</div>
          </div>
        </a>
        <button class="post__more" data-action="post-menu" data-id="${p.id}">⋯</button>
      </header>
      ${p.mediaKind === 'video' ? `
        <video class="post__media" src="${escapeHtml(p.mediaUrl)}" controls playsinline preload="metadata"></video>
      ` : `
        <img class="post__media" src="${escapeHtml(p.mediaUrl)}" alt="${escapeHtml(p.caption || '')}" loading="lazy" />
      `}
      <div class="post__actions">
        <button class="post__btn ${myReact ? 'is-on' : ''}" data-action="like" data-id="${p.id}" aria-label="J'aime">
          ${myReact ? '❤️' : '🤍'}
        </button>
        <button class="post__btn" data-link="#/post/${p.id}" aria-label="Commenter">${ICONS.chat}</button>
      </div>
      <div class="post__stats">
        ${likes > 0 ? `<strong>${likes}</strong> j'aime` : 'Sois le premier à aimer'}
      </div>
      ${p.caption ? `<div class="post__caption"><strong>${escapeHtml(author.username)}</strong> ${escapeHtml(p.caption)}</div>` : ''}
      ${comments.length > 0 ? `<a class="post__comments-link" href="#/post/${p.id}">Voir les ${comments.length} commentaire${comments.length > 1 ? 's' : ''}</a>` : ''}
    </article>`;
}

/* ============================================================
   COMPOSER · #/composer
   ============================================================ */
export function composerScreen(isBereal = false) {
  const me = currentUser();
  if (!me) return '';
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: isBereal ? 'BeReal' : 'Nouveau post' })}
      <form class="composer-form" data-form="post-create" data-bereal="${isBereal ? '1' : ''}">
        <label class="composer-drop" for="composer-file">
          <input type="file" id="composer-file" name="media" accept="image/*,video/*" capture="${isBereal ? 'environment' : ''}" required />
          <div class="composer-drop__preview" id="composer-preview">
            <div class="composer-drop__icon">${ICONS.image}</div>
            <div class="composer-drop__hint">${isBereal ? 'Prends ta photo (caméra arrière)' : 'Choisis une photo ou une vidéo'}</div>
            <div class="composer-drop__sub">Max 20 Mo · jpg, png, mp4, webm</div>
          </div>
        </label>
        <div class="field">
          <label class="field__label">Légende ${isBereal ? '(optionnelle)' : ''}</label>
          <textarea class="field__textarea" name="caption" placeholder="Dis quelque chose..." maxlength="500"></textarea>
        </div>
        <button class="btn btn--fluo btn--block" type="submit">${ICONS.send}<span>Publier</span></button>
      </form>
    </section>`;
}

/* ============================================================
   POST DETAIL · #/post/:id
   ============================================================ */
export function postDetailScreen(id) {
  const me = currentUser();
  const p = db.byId('posts', id);
  if (!p) return notFound();
  const author = db.byId('users', p.authorId);
  const comments = db.filter('comments', (c) => c.postId === p.id && !c.hidden)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const likes = db.filter('reactions', (r) => r.postId === p.id).length;
  const myReact = db.find('reactions', (r) => r.postId === p.id && r.userId === me.id);
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: 'Publication' })}
      <div class="screen__scroll" style="padding-bottom: 130px;">
        <article class="post">
          <header class="post__head">
            <a class="post__author" href="#/profil/${escapeHtml(author?.username || '')}">
              ${userAvatar(author, 36)}
              <div>
                <div class="post__name">${escapeHtml(userDisplayName(author))}</div>
                <div class="post__meta">${relTime(p.createdAt)}</div>
              </div>
            </a>
          </header>
          ${p.mediaKind === 'video'
            ? `<video class="post__media" src="${escapeHtml(p.mediaUrl)}" controls playsinline></video>`
            : `<img class="post__media" src="${escapeHtml(p.mediaUrl)}" alt="" />`}
          <div class="post__actions">
            <button class="post__btn ${myReact ? 'is-on' : ''}" data-action="like" data-id="${p.id}">${myReact ? '❤️' : '🤍'}</button>
          </div>
          <div class="post__stats"><strong>${likes}</strong> j'aime</div>
          ${p.caption ? `<div class="post__caption"><strong>${escapeHtml(author?.username || '')}</strong> ${escapeHtml(p.caption)}</div>` : ''}
        </article>

        <div class="comments">
          ${comments.length === 0 ? `<p class="muted" style="text-align:center; padding: 16px;">Aucun commentaire. Sois le premier !</p>` : ''}
          ${comments.map((c) => {
            const a = db.byId('users', c.authorId);
            return `<div class="comment">
              ${userAvatar(a, 32)}
              <div class="comment__body">
                <div><strong>${escapeHtml(a?.username || 'inconnu')}</strong> <span class="comment__time">${relTime(c.createdAt)}</span></div>
                <div>${escapeHtml(c.text)}</div>
              </div>
              ${(c.authorId === me.id || ['admin','moderateur','cadre'].includes(me.role)) ? `<button class="comment__del" data-action="comment-delete" data-id="${c.id}" aria-label="Supprimer">${ICONS.trash}</button>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
      <form class="composer-bar" data-form="comment-create" data-post="${p.id}">
        ${userAvatar(me, 32)}
        <input class="composer-bar__input" name="text" placeholder="Ajoute un commentaire..." required />
        <button class="composer-bar__send" type="submit">${ICONS.send}</button>
      </form>
    </section>`;
}

/* ============================================================
   PROFIL · #/profil/:username
   ============================================================ */
export function profileScreen(username) {
  const me = currentUser();
  const u = db.find('users', (x) => x.username === username);
  if (!u) return notFound();
  const isMe = u.id === me.id;
  const canSeePosts = !u.isPrivate || isMe || ['admin','moderateur','cadre'].includes(me.role) ||
                       (me.family && me.family.of === u.id);
  const posts = canSeePosts ? db.filter('posts', (p) => p.authorId === u.id && !p.hidden)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) : [];
  const isSection = u.accountType === 'section' || u.accountType === 'com';

  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: escapeHtml(u.username) })}
      <div class="screen__scroll">
        <div class="profile-head">
          ${userAvatar(u, 84)}
          <div class="profile-head__info">
            <div class="profile-head__name">${escapeHtml(userDisplayName(u))}</div>
            <div class="profile-head__sub">${ROLES_LABELS[u.role] || u.role}${u.section ? ' · ' + u.section : ''}${u.isPrivate ? ' · 🔒 Privé' : ''}</div>
            ${isSection ? `<span class="tag tag--fluo" style="margin-top:8px">Compte officiel</span>` : ''}
          </div>
        </div>
        ${u.bio ? `<div class="profile-bio">${escapeHtml(u.bio)}</div>` : ''}
        <div class="profile-stats">
          <div><strong>${posts.length}</strong><span>publications</span></div>
          <div><strong>${db.filter('reactions', (r) => posts.some((p) => p.id === r.postId)).length}</strong><span>j'aime reçus</span></div>
        </div>
        <div class="profile-actions">
          ${isMe
            ? `<button class="btn btn--ghost-ink btn--sm" data-link="#/moi/edit">${ICONS.edit}<span>Modifier le profil</span></button>
               <button class="btn btn--ghost-ink btn--sm" data-action="toggle-privacy">${u.isPrivate ? ICONS.eye : ICONS.lock}<span>${u.isPrivate ? 'Rendre public' : 'Rendre privé'}</span></button>`
            : `<a class="btn btn--navy btn--sm" href="#/dm/${u.id}">${ICONS.chat}<span>Message</span></a>`}
        </div>

        ${canSeePosts ? `
          <div class="profile-grid">
            ${posts.length === 0 ? `<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 30px;">Pas encore de publication.</p>` : ''}
            ${posts.map((p) => `
              <a class="profile-grid__cell" href="#/post/${p.id}">
                ${p.mediaKind === 'video'
                  ? `<video src="${escapeHtml(p.mediaUrl)}" muted playsinline></video><div class="profile-grid__icon">▶</div>`
                  : `<img src="${escapeHtml(p.mediaUrl)}" alt="" loading="lazy" />`}
              </a>`).join('')}
          </div>` : `
          <div class="empty" style="padding: 40px 20px;">
            <div class="empty__icon">${ICONS.lock}</div>
            <h3 class="h3">Profil privé</h3>
            <p class="muted">Les publications de ${escapeHtml(u.firstName)} ne sont visibles que par sa famille et son encadrement.</p>
          </div>`}
      </div>
      ${bottomNavSocial(me.role, 'profil')}
    </section>`;
}

/* ============================================================
   STORY VIEWER · #/story/:username (ou nouvelle)
   ============================================================ */
export function storyScreen(usernameOrNouvelle) {
  const me = currentUser();
  if (usernameOrNouvelle === 'nouvelle') return composerStoryScreen();
  const u = db.find('users', (x) => x.username === usernameOrNouvelle);
  if (!u) return notFound();
  const now = new Date().toISOString();
  const list = db.filter('stories', (s) => s.authorId === u.id && (s.expiresAt || '') > now)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  if (list.length === 0) return notFound();
  // On affiche la première (l'utilisateur peut tapper pour les suivantes — v2)
  const s = list[0];
  return `
    <section class="screen story-viewer">
      <div class="story-viewer__head">
        <div class="story-viewer__author">${userAvatar(u, 32)} <span>${escapeHtml(u.username)}</span> <span class="story-viewer__time">${relTime(s.createdAt)}</span></div>
        <button class="story-viewer__close" data-action="back">${ICONS.close}</button>
      </div>
      ${s.mediaKind === 'video'
        ? `<video class="story-viewer__media" src="${escapeHtml(s.mediaUrl)}" autoplay playsinline loop></video>`
        : `<img class="story-viewer__media" src="${escapeHtml(s.mediaUrl)}" alt="" />`}
      ${list.length > 1 ? `<div class="story-viewer__count">1 / ${list.length}</div>` : ''}
    </section>`;
}

export function composerStoryScreen() {
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: 'Nouvelle story' })}
      <form class="composer-form" data-form="story-create">
        <label class="composer-drop" for="story-file">
          <input type="file" id="story-file" name="media" accept="image/*,video/*" required />
          <div class="composer-drop__preview" id="composer-preview">
            <div class="composer-drop__icon">${ICONS.image}</div>
            <div class="composer-drop__hint">Photo ou vidéo (24h)</div>
            <div class="composer-drop__sub">Max 20 Mo</div>
          </div>
        </label>
        <button class="btn btn--fluo btn--block" type="submit">${ICONS.send}<span>Publier ma story</span></button>
      </form>
    </section>`;
}

/* ============================================================
   DM LIST + CONVERSATION
   ============================================================ */
export function dmListScreen() {
  const me = currentUser();
  if (!me) return '';
  // Regroupe les messages avec channel commençant par "dm:" par autre utilisateur
  const mine = db.filter('messages', (m) => (m.channel || '').startsWith('dm:'));
  const conversations = {};
  mine.forEach((m) => {
    const parts = (m.channel || '').slice(3).split('_');
    const other = parts[0] === me.id ? parts[1] : parts[0];
    if (!other || other === me.id) return;
    if (!conversations[other] || (m.at || '') > (conversations[other].at || '')) {
      conversations[other] = m;
    }
  });
  const sorted = Object.entries(conversations).sort((a, b) => (b[1].at || '').localeCompare(a[1].at || ''));
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: 'Messages', right: `<button class="topbar__btn" data-link="#/recherche" aria-label="Nouveau message">${ICONS.plus}</button>` })}
      <div class="dm-list">
        ${sorted.length === 0 ? `
          <div class="empty">
            <div class="empty__icon">${ICONS.chat}</div>
            <h3 class="h3">Aucune conversation</h3>
            <p class="muted">Trouve quelqu'un dans Recherche pour démarrer.</p>
          </div>` : sorted.map(([otherId, lastMsg]) => {
            const o = db.byId('users', otherId);
            if (!o) return '';
            return `<a class="dm-item" href="#/dm/${otherId}">
              ${userAvatar(o, 48)}
              <div class="dm-item__body">
                <div class="dm-item__name">${escapeHtml(userDisplayName(o))}</div>
                <div class="dm-item__preview">${escapeHtml((lastMsg.text || '').slice(0, 60))}</div>
              </div>
              <div class="dm-item__time">${relTime(lastMsg.at)}</div>
            </a>`;
          }).join('')}
      </div>
      ${bottomNavSocial(me.role, 'dm')}
    </section>`;
}

export function dmConvScreen(otherId) {
  const me = currentUser();
  const other = db.byId('users', otherId);
  if (!other) return notFound();
  const channel = 'dm:' + [me.id, other.id].sort().join('_');
  const messages = db.filter('messages', (m) => m.channel === channel)
    .sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: escapeHtml(userDisplayName(other)) })}
      <div class="dm-conv">
        ${messages.length === 0 ? `<p class="muted" style="text-align:center; padding: 24px;">Démarre la conversation 👋</p>` : messages.map((m) => {
          const mine = m.userId === me.id;
          return `<div class="dm-msg ${mine ? 'dm-msg--mine' : ''}">
            ${!mine ? userAvatar(other, 28) : ''}
            <div class="dm-msg__bubble">${escapeHtml(m.text)}</div>
          </div>`;
        }).join('')}
      </div>
      <form class="composer-bar" data-form="dm-send" data-channel="${channel}">
        <input class="composer-bar__input" name="text" placeholder="Message..." required />
        <button class="composer-bar__send" type="submit">${ICONS.send}</button>
      </form>
    </section>`;
}

/* ============================================================
   RECHERCHE · #/recherche
   ============================================================ */
export function searchScreen(query = '') {
  const me = currentUser();
  const q = (query || '').toLowerCase().trim();
  const users = !q ? [] : db.filter('users', (u) =>
    u.id !== me.id && (
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q)
    )
  ).slice(0, 30);
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: 'Recherche' })}
      <div class="search-box">
        <input class="search-box__input" placeholder="Chercher un nom, un identifiant..." data-search-input value="${escapeHtml(query)}" autofocus />
      </div>
      <div class="search-results">
        ${users.length === 0 && q ? `<p class="muted" style="text-align:center; padding: 16px;">Aucun résultat pour « ${escapeHtml(q)} »</p>` : ''}
        ${users.map((u) => `
          <a class="search-result" href="#/profil/${escapeHtml(u.username)}">
            ${userAvatar(u, 44)}
            <div>
              <div class="search-result__name">${escapeHtml(userDisplayName(u))}</div>
              <div class="search-result__sub">@${escapeHtml(u.username)} · ${ROLES_LABELS[u.role] || u.role}${u.section ? ' · ' + u.section : ''}</div>
            </div>
          </a>`).join('')}
      </div>
      ${bottomNavSocial(me.role, 'recherche')}
    </section>`;
}

/* ============================================================
   MOI · profil édition simple
   ============================================================ */
export function moiEditScreen() {
  const me = currentUser();
  return `
    <section class="screen screen--white">
      ${statusbar()}
      ${topbarSimple({ back: true, title: 'Modifier le profil' })}
      <form class="form" data-form="profile-edit">
        <div class="field">
          <label class="field__label">Bio (max 200 caractères)</label>
          <textarea class="field__textarea" name="bio" maxlength="200" placeholder="Quelques mots sur toi...">${escapeHtml(me.bio || '')}</textarea>
        </div>
        <div class="field">
          <label class="field__label">Avatar</label>
          <input class="field__input" type="file" name="avatar" accept="image/*" />
          <div class="field__hint">JPG/PNG, max 1 Mo</div>
        </div>
        <label class="checkbox">
          <input type="checkbox" name="isPrivate" ${me.isPrivate ? 'checked' : ''} />
          <span>Profil privé — seuls ta famille et ton encadrement voient tes posts</span>
        </label>
        <button class="btn btn--fluo btn--block mt-4" type="submit">Enregistrer</button>
      </form>
    </section>`;
}

/* ============================================================
   BOTTOM NAV social (jeune/cadre/famille/admin)
   ============================================================ */
function bottomNavSocial(role, active) {
  let items;
  if (role === 'famille') items = [
    ['feed',      'Feed',     ICONS.home],
    ['dm',        'Messages', ICONS.chat],
    ['moi',       'Moi',      ICONS.user],
  ];
  else items = [
    ['feed',      'Feed',      ICONS.home],
    ['recherche', 'Recherche', ICONS.search],
    ['composer',  'Publier',   ICONS.plus],
    ['dm',        'Messages',  ICONS.chat],
    ['moi',       'Moi',       ICONS.user],
  ];
  return `<nav class="bottom-nav">
    ${items.map(([slug, label, icon]) => `
      <button class="bottom-nav__item ${active === slug ? 'bottom-nav__item--active' : ''}" data-link="#/${slug}">${icon}<span>${label}</span></button>
    `).join('')}
  </nav>`;
}

/* ---------- Topbars simples ---------- */
function statusbar() {
  return `<div class="statusbar">
    <span>9:41</span>
    <span class="statusbar__right">${ICONS.signal}${ICONS.wifi}${ICONS.battery}</span>
  </div>`;
}
function topbarSimple({ back = false, title = '', right = '' }) {
  const left = back
    ? `<button class="topbar__btn" data-action="back" aria-label="Retour">${ICONS.chevronLeft}</button>`
    : `<div class="topbar__spacer"></div>`;
  return `<div class="topbar">${left}<div class="topbar__center">${escapeHtml(title)}</div>${right || '<div class="topbar__spacer"></div>'}</div>`;
}

function notFound() {
  return `<section class="screen screen--cream">
    ${statusbar()}
    ${topbarSimple({ back: true, title: '404' })}
    <div class="empty">
      <div class="empty__icon">${ICONS.compass}</div>
      <h3 class="h3">Introuvable</h3>
      <button class="btn btn--navy" data-link="#/feed">Retour au feed</button>
    </div>
  </section>`;
}

/* ============================================================
   ACTIONS · upload, post-create, like, comment, story, DM, BeReal
   ============================================================ */

/* Upload helper : Supabase Storage. Renvoie {url, kind}. */
export async function uploadMedia(file, bucket = 'media') {
  if (!file) throw new Error('Aucun fichier');
  const MAX = 20 * 1024 * 1024;
  if (file.size > MAX) throw new Error('Fichier trop grand (max 20 Mo)');
  const kind = file.type.startsWith('video') ? 'video' : 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg');
  const me = currentUser();
  const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pub.publicUrl, kind, path };
}

export async function createPost({ file, caption, isBereal = false }) {
  const me = currentUser();
  const { url, kind } = await uploadMedia(file, 'media');
  let berealRoundId = null;
  if (isBereal) {
    const active = db.find('berealRounds', (r) => new Date(r.endsAt).getTime() > Date.now());
    if (active) berealRoundId = active.id;
  }
  return db.insert('posts', {
    authorId: me.id,
    mediaUrl: url,
    mediaKind: kind,
    caption: caption || null,
    section: me.section || null,
    isBereal: !!berealRoundId,
    berealRoundId,
  });
}

export async function createStory({ file }) {
  const me = currentUser();
  const { url, kind } = await uploadMedia(file, 'media');
  return db.insert('stories', {
    authorId: me.id,
    mediaUrl: url,
    mediaKind: kind,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
}

export async function toggleLike(postId) {
  const me = currentUser();
  const existing = db.find('reactions', (r) => r.postId === postId && r.userId === me.id);
  if (existing) {
    // Suppression de reaction : delete via supabase (clé composite)
    await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', me.id);
    // Refresh cache
    const i = db.all('reactions').findIndex((r) => r.postId === postId && r.userId === me.id);
    return { liked: false };
  } else {
    await db.insert('reactions', { postId, userId: me.id, emoji: '❤️' });
    return { liked: true };
  }
}

export async function createComment(postId, text) {
  const me = currentUser();
  if (!text || !text.trim()) return null;
  return db.insert('comments', { postId, authorId: me.id, text: text.trim() });
}

export async function sendDM(channel, text) {
  const me = currentUser();
  if (!text || !text.trim()) return null;
  return db.insert('messages', { channel, userId: me.id, text: text.trim(), at: new Date().toISOString() });
}

export async function triggerBereal(durationMin = 2) {
  const me = currentUser();
  return db.insert('berealRounds', {
    triggeredBy: me.id,
    endsAt: new Date(Date.now() + durationMin * 60 * 1000).toISOString(),
  });
}
