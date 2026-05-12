/* ============================================================
   Données pédagogiques · démo HF
   Toutes les données sont locales / mockées pour la maquette.
   ============================================================ */

export const DATA = {
  /* ----------- Galerie publique ----------- */
  gallery: [
    { kind: 'navy',       label: '// Sport · matin',       cat: 'sport',      svg: 'dots' },
    { kind: 'green',      label: '// Auto-école',          cat: 'formation',  svg: 'fluo' },
    { kind: 'navy',       label: '// Cérémonie calot',     cat: 'cérémonies', svg: 'dots' },
    { kind: 'green',      label: '// Atelier mécanique',   cat: 'formation',  svg: 'fluo' },
    { kind: 'lightblue',  label: '// Section S21',         cat: 'sport',      svg: 'dots' },
    { kind: 'navy',       label: '// Stage entreprise',    cat: 'stage',      svg: 'dots' },
    { kind: 'green',      label: '// Marche · Coubre',     cat: 'sport',      svg: 'fluo' },
    { kind: 'navy',       label: '// Cérémonie CAPI',      cat: 'cérémonies', svg: 'dots' },
  ],

  /* ----------- Planning section S21 (extrait jour) ----------- */
  schedule: {
    S21: [
      { time: '06:30', title: 'Réveil & sport',  sub: 'Stade · toute la section' },
      { time: '09:00', title: 'Auto-école · Code', sub: 'Salle 2 · Sgt Bertin', status: '● en cours' },
      { time: '10:00', title: 'Sport collectif',  sub: 'Stade · S21' },
      { time: '12:00', title: 'Repas',            sub: 'Mess' },
      { time: '14:00', title: 'Atelier insertion',sub: 'Salle 5 · cellule emploi' },
      { time: '17:00', title: 'Sport individuel', sub: 'Salle de muscu' },
      { time: '17:30', title: 'Quartier libre',   sub: 'Foyer' },
      { time: '19:00', title: 'Quartier libre',   sub: '' },
    ],
    S22: [
      { time: '06:30', title: 'Réveil & sport', sub: 'Stade' },
      { time: '08:00', title: 'Cours mécanique',sub: 'Atelier · M. Ledru' },
      { time: '12:00', title: 'Repas', sub: 'Mess' },
      { time: '14:00', title: 'Permis B · Conduite', sub: 'Auto-école · 6 places' },
    ],
    S11: [
      { time: '06:30', title: 'Réveil & sport', sub: 'Stade' },
      { time: '09:00', title: 'Citoyenneté · Module 1', sub: 'Salle 1 · Sgt Lefèvre' },
      { time: '14:00', title: 'Marche en groupe', sub: 'Forêt de Coubre' },
    ],
  },

  /* ----------- Actualités régiment ----------- */
  news: [
    { date: '11 mai', title: 'Cérémonie remise de calot · CAPI 2026', excerpt: 'Vendredi 16 mai, place d\'armes Beauregard.', kind: 'navy' },
    { date: '10 mai', title: 'Nouveau partenaire · Carrefour Logistique', excerpt: '4 contrats d\'apprentissage à pourvoir.', kind: 'green' },
    { date: '08 mai', title: 'Marche commémorative · 80 ans', excerpt: 'Avec les écoles de La Rochelle.', kind: 'lightblue' },
  ],

  /* ----------- Portfolio section (photos validées) ----------- */
  portfolio: [
    { kind: 'navy',      label: '// Cérémonie calot · 12/04', svg: 'dots',  badge: '🏅 12/04' },
    { kind: 'green',     label: '// Marche · forêt Coubre',   svg: 'fluo' },
    { kind: 'navy',      label: '// Atelier garage',          svg: 'dots' },
    { kind: 'lightblue', label: '// Visite La Pallice',       svg: 'dots' },
    { kind: 'green',     label: '// Sport collectif',         svg: 'fluo' },
    { kind: 'navy',      label: '// Cérémonie CAPI',          svg: 'dots' },
  ],

  /* ----------- Membres section ----------- */
  members: [
    { initials: 'TB', name: 'Bertin, T.',   title: 'Sergent · cadre de section', role: 'cadre', color: 'navy',   online: true  },
    { initials: 'CL', name: 'Costa, L.',    title: 'Caporal · adjoint',          role: 'cadre', color: 'navy',   online: false },
    { initials: 'LM', name: 'Morel, L.',    title: 'Volontaire',                 role: 'jeune', color: 'green',  online: true  },
    { initials: 'KB', name: 'Boucher, K.',  title: 'Volontaire',                 role: 'jeune', color: 'navy',   online: true  },
    { initials: 'IT', name: 'Tessier, I.',  title: 'Volontaire',                 role: 'jeune', color: 'orange', online: false },
    { initials: 'JB', name: 'Boutet, J.',   title: 'Volontaire',                 role: 'jeune', color: 'navy',   online: false },
    { initials: 'AM', name: 'Martin, A.',   title: 'Volontaire',                 role: 'jeune', color: 'green',  online: true  },
    { initials: 'SR', name: 'Renard, S.',   title: 'Volontaire',                 role: 'jeune', color: 'orange', online: false },
  ],

  /* ----------- Tchat section S21 ----------- */
  chat: [
    { name: 'Sgt Bertin', initials: 'SB', cadre: true,  text: 'Demain 14h00 : briefing visite entreprise. Tenue de service, calots.', time: '08:02', color: 'navy' },
    { mine: true, text: 'Reçu sergent 👍', time: '08:14' },
    { name: 'Karim B.',  initials: 'KB', text: 'Quelqu\'un a perdu un brassard rouge salle 3 hier ?', time: '08:21', color: 'navy' },
    { mine: true, text: 'Oui c\'est à moi merci !', time: '08:22' },
    { pinned: true, text: 'Sgt Bertin a épinglé l\'événement « Visite entreprise · 13 mai »' },
    { name: 'Inès T.',   initials: 'IT', text: 'Le code 47 c\'est lequel déjà ?', time: '09:01', color: 'orange' },
    { name: 'Léa M.',    initials: 'LM', text: 'Priorités à droite, je crois !', time: '09:02', color: 'green' },
  ],

  /* ----------- Question de code ----------- */
  codeQuestion: {
    theme: 'Priorités',
    text: 'Dans cette intersection, dans quel ordre passent les véhicules ?',
    options: [
      { letter: 'A', text: 'Rouge → Bleu → Vert' },
      { letter: 'B', text: 'Bleu → Vert → Rouge' },
      { letter: 'C', text: 'Vert → Rouge → Bleu' },
      { letter: 'D', text: 'Tous en même temps' },
    ],
  },

  /* ----------- Notes ----------- */
  notes: [
    { title: 'Cours code · 12/05', excerpt: 'Priorités à droite, sauf signalisation contraire. Stop = arrêt obligatoire 3s.', module: 'Module 3', date: '12/05' },
    { title: 'Mécanique · vidange', excerpt: 'Étapes : chauffer 5 min, dévisser bouchon, récupérer huile, remplacer joint, …', module: 'Atelier', date: '10/05' },
    { title: 'Atelier insertion', excerpt: 'CV : 1 page max. Lettre de motivation : 3 paragraphes. Pas de fautes.', module: 'Cellule emploi', date: '09/05' },
  ],

  /* ----------- Ressources pédagogiques ----------- */
  resources: [
    { icon: 'pdf',      title: 'Fiche code · Priorités', meta: 'PDF · 2 pages · Sgt Bertin · 11/05' },
    { icon: 'video',    title: 'Vidéo · Vidange moteur',  meta: 'Vidéo · 6 min · M. Ledru'},
    { icon: 'pdf',      title: 'Citoyenneté · institutions', meta: 'PDF · 8 pages · Sgt Lefèvre' },
    { icon: 'folder',   title: 'Banque exercices · français', meta: '12 fichiers · remise à niveau' },
    { icon: 'pdf',      title: 'CV type SMV', meta: 'PDF · 1 page · cellule emploi' },
    { icon: 'video',    title: 'Vidéo · Présentation orale', meta: 'Vidéo · 4 min · stage' },
  ],

  /* ----------- Offres d'emploi ----------- */
  jobs: [
    { id: 'mecano-cl',      type: 'Alternance',  posted: 'Il y a 2j', title: 'Mécanicien VL · alternance', company: 'Carrosserie Lemoine', city: 'La Rochelle (17)', tags: ['Permis B', 'Mécanique', 'CAP'] },
    { id: 'log-carrefour',  type: 'CDI',         posted: 'Il y a 1j', title: 'Préparateur de commandes', company: 'Carrefour Logistique',   city: 'Aytré (17)',       tags: ['Permis CACES', 'Équipe', '2x8'] },
    { id: 'cuisine-mess',   type: 'CDD',         posted: 'Il y a 5j', title: 'Commis de cuisine', company: 'Mess officiers Marine',  city: 'Rochefort (17)',     tags: ['Restauration', 'HACCP'] },
    { id: 'menuisier-pall', type: 'Apprentissage',posted: 'Il y a 3j', title: 'Apprenti menuisier', company: 'Bois Pallice',            city: 'La Pallice (17)',    tags: ['CAP', 'Manuel', 'Permis B'] },
    { id: 'sec-port',       type: 'CDI',         posted: 'Hier',      title: 'Agent de sécurité portuaire', company: 'Securitas Port', city: 'La Pallice (17)',    tags: ['SST', 'Permis B', 'Nuit'] },
  ],

  /* ----------- Modération : photos en attente ----------- */
  modPhotos: [
    { kind: 'navy',      label: '// Marche', svg: 'dots',  idx: 3 },
    { kind: 'green',     label: '// Marche', svg: 'fluo',  idx: 5 },
    { kind: 'lightblue', label: '// Marche', svg: 'dots',  idx: 7 },
    { kind: 'navy',      label: '// Marche', svg: 'dots',  idx: 9 },
  ],
};
