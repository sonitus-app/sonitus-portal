import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, addDoc, updateDoc,
         collection, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ── Estado global ──────────────────────────────────────────────────────────
const S = {
  user:          null,
  view:          'loading',
  toolSessionId: null,
  toolStart:     null,
  heartbeat:     null,
  timerInterval: null,
  currentTool:   null,
  dailyChallenge: null,
  lang:          'es',
};

// ── Gamificación (client-side) ─────────────────────────────────────────────
const LEVELS = [
  { name: 'Aprendiz',   icon: '🌱', min: 0,    nextMin: 200  },
  { name: 'Estudiante', icon: '🎵', min: 200,  nextMin: 600  },
  { name: 'Músico',     icon: '🎸', min: 600,  nextMin: 1200 },
  { name: 'Avanzado',   icon: '🎼', min: 1200, nextMin: 2400 },
  { name: 'Maestro',    icon: '🏆', min: 2400, nextMin: null },
];

const ACHIEVEMENTS = [
  { key: 'primera_sesion', name: 'Primera Sesión', icon: '🎯', description: 'Completa tu primera sesión', xp: 20 },
  { key: 'madrugador',     name: 'Madrugador',     icon: '🌅', description: 'Practica antes de las 9am',  xp: 30 },
  { key: 'racha_7',        name: 'Racha de 7 días', icon: '🔥', description: '7 días seguidos practicando', xp: 70 },
  { key: 'intervalos_100', name: 'Centenario',      icon: '💯', description: '100 intervalos correctos',  xp: 50 },
  { key: 'precision_90',   name: 'Precisión 90%',   icon: '🎯', description: '90% de precisión en intervalos', xp: 40 },
  { key: 'maestro_nivel',  name: 'Maestro',         icon: '🏆', description: 'Alcanzar el nivel Maestro', xp: 0  },
];

const CHALLENGE_POOL = [
  { tool: 'intervaltrainer', description: 'Identifica correctamente 5 intervalos en el Entrenador', target: 5,  xp: 50 },
  { tool: 'intervaltrainer', description: 'Acierta 8 intervalos seguidos en el Entrenador',          target: 8,  xp: 70 },
  { tool: 'intervaltrainer', description: 'Responde correctamente 10 intervalos hoy',                target: 10, xp: 80 },
  { tool: 'studio',          description: 'Completa una sesión de Lectura de Ritmo hoy',             target: 1,  xp: 40 },
  { tool: 'studio',          description: 'Practica Lectura de Ritmo por al menos 5 minutos',        target: 1,  xp: 45 },
  { tool: 'academia',        description: 'Practica Lectura de Notas hoy',                           target: 1,  xp: 40 },
  { tool: 'academia',        description: 'Completa una sesión de Lectura de Notas de 10 minutos',   target: 1,  xp: 55 },
  { tool: 'rhythmtrainer',  description: 'Identifica correctamente 5 ritmos en el Dictado Rítmico',  target: 5,  xp: 45 },
  { tool: 'rhythmtrainer',  description: 'Completa 10 ejercicios de Dictado Rítmico hoy',            target: 10, xp: 60 },
];

// ── Traducciones ───────────────────────────────────────────────────────────
const T = {
  es: {
    subtitle:     'Herramientas Educativas',
    logout:       'Salir',
    helpBtn:      'Ayuda',
    langBtn:      '🇺🇸 English',
    greeting:     n => `¡Hola, ${n}!`,
    greetingSub:  'Elige tu herramienta para comenzar a practicar',
    open:         'Abrir →',
    never:        'Nunca',
    sessions:     'ses.',
    noData:       'Sin datos',
    attempts:     'intentos',
    dailyTitle:   '🎯 Desafío del Día',
    dailyDone:    '✅ ¡Completado hoy!',
    streakDays:   n => `😊 ${n} días`,
    back:         '← Volver',
    time:         'Tiempo:',
    loginSubtitle:  'Herramientas Educativas de Música',
    loginUser:      'Usuario', loginUserPh:  'tu nombre de usuario',
    loginPass:      'Contraseña', loginPassPh: '••••••',
    loginBtn:       'Iniciar Sesión',
    loginNoAcc:     '¿Sin cuenta?', loginRegLink: 'Regístrate aquí',
    loginErrEmpty:  'Por favor completa todos los campos.',
    loginErrCred:   'Usuario o contraseña incorrectos',
    loginErrGen:    'Error al iniciar sesión. Intenta de nuevo.',
    regSubtitle:    'Crear cuenta de alumno',
    regName:        'Nombre completo', regNamePh: 'Tu nombre',
    regUser:        'Usuario', regUserPh: 'sin espacios, ej: juan123',
    regPass:        'Contraseña', regPassPh: 'Mínimo 6 caracteres',
    regBtn:         'Crear Cuenta',
    regHasAcc:      '¿Ya tienes cuenta?', regLoginLink: 'Inicia sesión',
    regErrEmpty:    'Por favor completa todos los campos.',
    regErrShort:    'La contraseña debe tener mínimo 6 caracteres.',
    regErrReserved: 'Ese nombre de usuario está reservado.',
    regErrExists:   'Ese nombre de usuario ya está en uso.',
    regErrGen:      'Error al crear la cuenta. Intenta de nuevo.',
    regSuccess:     '¡Cuenta creada! Ahora puedes iniciar sesión.',
    tools: {
      studio:          { name: 'Lectura de Ritmo',   badge: 'Práctica', desc: 'Genera ejercicios de lectura rítmica a primera vista con retroalimentación de audio instantánea.' },
      academia:        { name: 'Lectura de Notas',   badge: 'Teoría',   desc: 'Lectura musical a primera vista con teoría, entrenamiento auditivo y ejercicios progresivos.' },
      intervaltrainer: { name: 'Intervalos',         badge: 'Oído',     desc: 'Entrena tu oído identificando intervalos musicales: desde el unísono hasta la octava.' },
      rhythmtrainer:   { name: 'Dictado Rítmico',    badge: 'Ritmo',    desc: 'Escucha patrones rítmicos y reprodúcelos. Entrena tu oído rítmico con compases de 2/4, 3/4 y 4/4.' },
    },
    toolLabels: { studio: '🥁 Lectura de Ritmo', academia: '🎼 Lectura de Notas', intervaltrainer: '🎧 Entrenador de Intervalos', rhythmtrainer: '🥁 Dictado Rítmico' },
    help: {
      title:   'Ayuda · Sonitus Portal',
      intro:   'Sonitus Portal es una plataforma de educación musical. Cada herramienta entrena una habilidad distinta usando audio, notación y gamificación.',
      toolsH:  'Herramientas',
      xpH:     'Sistema de XP y Niveles',
      xpText:  'Ganas XP completando sesiones, acertando ejercicios y cumpliendo el Desafío del Día. Al acumular XP subes de nivel: Aprendiz → Estudiante → Músico → Avanzado → Maestro.',
      dcH:     'Desafío del Día',
      dcText:  'Cada día se genera un reto personalizado. Complétalo para ganar XP extra. Se reinicia a medianoche.',
      faqH:    'Preguntas frecuentes',
      faq: [
        ['¿Necesito cuenta para usar el portal?', 'Sí. La cuenta guarda tu progreso, XP y rachas entre sesiones.'],
        ['¿Funciona en móvil?', 'Sí, el portal es responsive y funciona en cualquier dispositivo moderno.'],
        ['¿Por qué no escucho audio?', 'Haz clic en cualquier botón primero — los navegadores requieren una interacción para activar el audio.'],
        ['¿Qué significa BETA?', 'Las funciones marcadas con BETA están en prueba activa. Funcionan pero pueden cambiar.'],
        ['¿Cómo reinicio mi progreso?', 'Actualmente no hay opción de reinicio. Contacta al administrador si lo necesitas.'],
      ],
      close: '← Volver al inicio',
    },
  },
  en: {
    subtitle:     'Music Education Tools',
    logout:       'Log out',
    helpBtn:      'Help',
    langBtn:      '🇲🇽 Español',
    greeting:     n => `Hello, ${n}!`,
    greetingSub:  'Choose a tool to start practicing',
    open:         'Open →',
    never:        'Never',
    sessions:     'sess.',
    noData:       'No data',
    attempts:     'attempts',
    dailyTitle:   '🎯 Daily Challenge',
    dailyDone:    '✅ Completed today!',
    streakDays:   n => `😊 ${n} days`,
    back:         '← Back',
    time:         'Time:',
    loginSubtitle:  'Music Education Tools',
    loginUser:      'Username', loginUserPh:  'your username',
    loginPass:      'Password', loginPassPh:  '••••••',
    loginBtn:       'Log In',
    loginNoAcc:     "Don't have an account?", loginRegLink: 'Sign up',
    loginErrEmpty:  'Please fill in all fields.',
    loginErrCred:   'Invalid username or password',
    loginErrGen:    'Login error. Please try again.',
    regSubtitle:    'Create student account',
    regName:        'Full name', regNamePh: 'Your name',
    regUser:        'Username', regUserPh: 'no spaces, e.g. juan123',
    regPass:        'Password', regPassPh: 'At least 6 characters',
    regBtn:         'Create Account',
    regHasAcc:      'Already have an account?', regLoginLink: 'Log in',
    regErrEmpty:    'Please fill in all fields.',
    regErrShort:    'Password must be at least 6 characters.',
    regErrReserved: 'That username is reserved.',
    regErrExists:   'That username is already taken.',
    regErrGen:      'Error creating account. Please try again.',
    regSuccess:     'Account created! You can now log in.',
    tools: {
      studio:          { name: 'Rhythm Reading',     badge: 'Practice', desc: 'Generate sight-reading rhythm exercises with instant audio feedback.' },
      academia:        { name: 'Note Reading',       badge: 'Theory',   desc: 'Musical sight-reading with theory, ear training, and progressive exercises.' },
      intervaltrainer: { name: 'Intervals',          badge: 'Ear',      desc: 'Train your ear identifying musical intervals: from unison to the octave.' },
      rhythmtrainer:   { name: 'Rhythm Dictation',   badge: 'Rhythm',   desc: 'Listen to rhythmic patterns and identify them. Train your rhythmic ear with 2/4, 3/4 and 4/4 time.' },
    },
    toolLabels: { studio: '🥁 Rhythm Reading', academia: '🎼 Note Reading', intervaltrainer: '🎧 Interval Trainer', rhythmtrainer: '🥁 Rhythm Dictation' },
    help: {
      title:   'Help · Sonitus Portal',
      intro:   'Sonitus Portal is a music education platform. Each tool trains a different skill using audio, notation, and gamification.',
      toolsH:  'Tools',
      xpH:     'XP & Levels System',
      xpText:  'Earn XP by completing sessions, answering exercises correctly, and finishing the Daily Challenge. As you accumulate XP you level up: Learner → Student → Musician → Advanced → Master.',
      dcH:     'Daily Challenge',
      dcText:  'A personalized challenge is generated each day. Complete it to earn bonus XP. Resets at midnight.',
      faqH:    'Frequently Asked Questions',
      faq: [
        ['Do I need an account?', 'Yes. Your account saves your progress, XP, and streaks between sessions.'],
        ['Does it work on mobile?', 'Yes, the portal is responsive and works on any modern device.'],
        ['Why can\'t I hear audio?', 'Click any button first — browsers require a user interaction to enable audio.'],
        ['What does BETA mean?', 'Features marked BETA are in active testing. They work but may change.'],
        ['How do I reset my progress?', 'There is currently no self-service reset. Contact the administrator if needed.'],
      ],
      close: '← Back to dashboard',
    },
  },
};
function t(key) { return T[S.lang][key]; }

function getLevelInfo(xp) {
  const idx = LEVELS.reduce((best, l, i) => (xp >= l.min ? i : best), 0);
  const level = LEVELS[idx];
  const progress = level.nextMin
    ? Math.min(100, Math.round(((xp - level.min) / (level.nextMin - level.min)) * 100))
    : 100;
  return { name: level.name, icon: level.icon, xp, nextLevelXp: level.nextMin, progress };
}


// ── Utilidades ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtDuration(s) {
  if (!s || s < 1) return '—';
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
function timeAgo(ts) {
  if (!ts) return 'Nunca';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d === 1 ? 'Ayer' : `Hace ${d} días`;
  if (h > 0) return h === 1 ? 'Hace 1 hora' : `Hace ${h}h`;
  if (m > 0) return m === 1 ? 'Hace 1 min' : `Hace ${m} min`;
  return 'Hace un momento';
}
function fmtTimer(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Firestore helpers ──────────────────────────────────────────────────────
const userRef    = uid => doc(db, 'users', uid);
const sessionsCol   = uid => collection(db, 'users', uid, 'sessions');
const attemptsCol   = uid => collection(db, 'users', uid, 'intervalAttempts');
const achievCol     = uid => collection(db, 'users', uid, 'achievements');
const chalCol       = uid => collection(db, 'users', uid, 'challengeCompletions');

async function getUserData(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function getTodayChallenge(uid) {
  const today = getLocalDate();
  const dateHash = today.replace(/-/g,'').split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const ch = CHALLENGE_POOL[dateHash % CHALLENGE_POOL.length];
  const compSnap = await getDoc(doc(chalCol(uid), today));
  return { id: today, tool: ch.tool, xp_reward: ch.xp, config: { description: ch.description }, completed: compSnap.exists() };
}

async function awardXpDirect(uid, amount) {
  if (!amount) return;
  const snap = await getDoc(userRef(uid));
  const xp = (snap.data()?.xp || 0) + amount;
  await updateDoc(userRef(uid), { xp, level: getLevelInfo(xp).name });
}

async function grantAchievement(uid, key) {
  const ach = ACHIEVEMENTS.find(a => a.key === key);
  if (!ach) return;
  const ref = doc(achievCol(uid), key);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { ...ach, earnedAt: serverTimestamp() });
  await awardXpDirect(uid, ach.xp);
}

async function awardXp(uid, amount, reason) {
  const snap = await getDoc(userRef(uid));
  const data = snap.data() || {};
  const xp   = (data.xp || 0) + amount;
  const lvl  = getLevelInfo(xp);
  const today = getLocalDate();
  const lastDate = data.lastActivity?.toDate ? data.lastActivity.toDate().toISOString().slice(0,10) : null;
  const yest = new Date(); yest.setDate(yest.getDate()-1);
  const yStr = yest.toISOString().slice(0,10);

  let streak = data.streak || 0;
  if (lastDate !== today) streak = lastDate === yStr ? streak + 1 : 1;

  await updateDoc(userRef(uid), { xp, level: lvl.name, streak, lastActivity: serverTimestamp() });

  if (reason === 'session_complete') {
    const sessSnap = await getDocs(sessionsCol(uid));
    if (sessSnap.size === 1) await grantAchievement(uid, 'primera_sesion');
    if (lvl.name === 'Maestro') await grantAchievement(uid, 'maestro_nivel');
    if (streak >= 7) await grantAchievement(uid, 'racha_7');
    const hr = new Date().getHours();
    if (hr < 9) await grantAchievement(uid, 'madrugador');
  }
  if (reason === 'interval_correct') {
    const attSnap = await getDocs(attemptsCol(uid));
    const correct = attSnap.docs.filter(d => d.data().isCorrect).length;
    if (correct >= 100) await grantAchievement(uid, 'intervalos_100');
    if (attSnap.size >= 10 && correct / attSnap.size >= 0.9) await grantAchievement(uid, 'precision_90');
  }
}

const appEl = document.getElementById('app');

// ── Vista: Loading ─────────────────────────────────────────────────────────
function showLoading() {
  appEl.innerHTML = `
    <div id="view-loading">
      <div class="spinner"></div>
      <p style="color:var(--g400);font-size:.875rem;">Cargando...</p>
    </div>`;
}

// ── Vista: Login ───────────────────────────────────────────────────────────
function showLogin(msg = '', isSuccess = false) {
  S.view = 'login';
  appEl.innerHTML = `
    <div id="view-login" style="position:relative;">
      <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:10;">
        <button id="help-btn-guest" class="btn-out" style="background:rgba(16,185,129,.1);color:#065f46;border-color:#a7f3d0;font-size:.8125rem;">${t('helpBtn')}</button>
        <button id="lang-btn-guest" class="btn-out" style="background:rgba(16,185,129,.1);color:#065f46;border-color:#a7f3d0;font-size:.8125rem;">${t('langBtn')}</button>
      </div>
      <div class="login-box">
        <div class="login-logo"><img src="logo.jpeg" style="width:42px;height:42px;object-fit:contain;filter:invert(1) brightness(2);" alt="Sonitus" /></div>
        <h1 class="login-title">Sonitus Portal</h1>
        <p class="login-subtitle">${t('loginSubtitle')}</p>

        ${msg ? `<div class="alert ${isSuccess ? 'alert-ok' : 'alert-err'}">${msg}</div>` : ''}

        <form id="login-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="f-group">
            <label class="f-label">${t('loginUser')}</label>
            <input id="f-user" type="text" class="f-input" placeholder="${t('loginUserPh')}" autocomplete="username" />
          </div>
          <div class="f-group">
            <label class="f-label">${t('loginPass')}</label>
            <input id="f-pass" type="password" class="f-input" placeholder="${t('loginPassPh')}" autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-blue btn-full" style="margin-top:4px;">${t('loginBtn')}</button>
        </form>

        <p style="text-align:center;color:var(--g400);font-size:.875rem;margin-top:20px;">
          ${t('loginNoAcc')}
          <a href="#" id="go-reg" style="color:var(--blue);font-weight:600;text-decoration:none;">${t('loginRegLink')}</a>
        </p>
      </div>
    </div>`;

  document.getElementById('help-btn-guest').addEventListener('click', showHelp);
  document.getElementById('lang-btn-guest').addEventListener('click', () => {
    S.lang = S.lang === 'es' ? 'en' : 'es';
    showLogin(msg, isSuccess);
  });
  document.getElementById('f-user').focus();
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('f-user').value.trim().toLowerCase();
    const password = document.getElementById('f-pass').value;
    if (!username || !password) return showLogin(t('loginErrEmpty'));
    try {
      const cred = await signInWithEmailAndPassword(auth, `${username}@sonitus.portal`, password);
      const userData = await getUserData(cred.user.uid);
      if (!userData) { await signOut(auth); return showLogin(t('loginErrCred')); }
      S.user = { id: cred.user.uid, username: userData.username, fullName: userData.fullName, role: userData.role };
      if (userData.role === 'teacher') { window.location.href = 'admin.html'; return; }
      loadDashboard();
    } catch (err) {
      const code = err.code ?? '';
      const errMsg = (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential')
        ? t('loginErrCred') : t('loginErrGen');
      showLogin(errMsg);
    }
  });
  document.getElementById('go-reg').addEventListener('click', e => { e.preventDefault(); showRegister(); });
}

// ── Vista: Registro ────────────────────────────────────────────────────────
function showRegister(msg = '') {
  S.view = 'register';
  appEl.innerHTML = `
    <div id="view-register" style="position:relative;">
      <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:10;">
        <button id="help-btn-guest" class="btn-out" style="background:rgba(16,185,129,.1);color:#065f46;border-color:#a7f3d0;font-size:.8125rem;">${t('helpBtn')}</button>
        <button id="lang-btn-guest" class="btn-out" style="background:rgba(16,185,129,.1);color:#065f46;border-color:#a7f3d0;font-size:.8125rem;">${t('langBtn')}</button>
      </div>
      <div class="login-box">
        <div class="login-logo"><img src="logo.jpeg" style="width:42px;height:42px;object-fit:contain;filter:invert(1) brightness(2);" alt="Sonitus" /></div>
        <h1 class="login-title">Sonitus Portal</h1>
        <p class="login-subtitle">${t('regSubtitle')}</p>

        ${msg ? `<div class="alert alert-err">${msg}</div>` : ''}

        <form id="reg-form" style="display:flex;flex-direction:column;gap:14px;">
          <div class="f-group">
            <label class="f-label">${t('regName')}</label>
            <input id="r-name" type="text" class="f-input" placeholder="${t('regNamePh')}" autocomplete="name" />
          </div>
          <div class="f-group">
            <label class="f-label">${t('regUser')}</label>
            <input id="r-user" type="text" class="f-input" placeholder="${t('regUserPh')}" autocomplete="username" />
          </div>
          <div class="f-group">
            <label class="f-label">${t('regPass')}</label>
            <input id="r-pass" type="password" class="f-input" placeholder="${t('regPassPh')}" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-blue btn-full" style="margin-top:4px;">${t('regBtn')}</button>
        </form>

        <p style="text-align:center;color:var(--g400);font-size:.875rem;margin-top:20px;">
          ${t('regHasAcc')}
          <a href="#" id="go-login" style="color:var(--blue);font-weight:600;text-decoration:none;">${t('regLoginLink')}</a>
        </p>
      </div>
    </div>`;

  document.getElementById('help-btn-guest').addEventListener('click', showHelp);
  document.getElementById('lang-btn-guest').addEventListener('click', () => {
    S.lang = S.lang === 'es' ? 'en' : 'es';
    showRegister(msg);
  });
  document.getElementById('r-name').focus();
  document.getElementById('reg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fullName = document.getElementById('r-name').value.trim();
    const username = document.getElementById('r-user').value.trim().toLowerCase();
    const password = document.getElementById('r-pass').value;
    if (!fullName || !username || !password) return showRegister(t('regErrEmpty'));
    if (password.length < 6) return showRegister(t('regErrShort'));
    if (username === 'profesor') return showRegister(t('regErrReserved'));

    try {
      const cred = await createUserWithEmailAndPassword(auth, `${username}@sonitus.portal`, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        username, fullName, role: 'student',
        xp: 0, level: 'Aprendiz', streak: 0,
        createdAt: serverTimestamp(), lastActivity: serverTimestamp(),
      });
      await signOut(auth);
      showLogin(t('regSuccess'), true);
    } catch (err) {
      const errMsg = err.code === 'auth/email-already-in-use' ? t('regErrExists') : t('regErrGen');
      showRegister(errMsg);
    }
  });
  document.getElementById('go-login').addEventListener('click', e => { e.preventDefault(); showLogin(); });
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  showLoading();
  try {
    const uid = S.user.id;
    const [userSnap, sessSnap, attSnap, achievSnap] = await Promise.all([
      getDoc(userRef(uid)),
      getDocs(sessionsCol(uid)),
      getDocs(attemptsCol(uid)),
      getDocs(achievCol(uid)),
    ]);

    const userData  = userSnap.data() || {};
    const sessions  = sessSnap.docs.map(d => d.data());
    const attempts  = attSnap.docs.map(d => d.data());
    const earnedKeys = new Set(achievSnap.docs.map(d => d.id));

    const actStats = {
      intervalAttempts: { total: attempts.length, correct: attempts.filter(a => a.isCorrect).length },
    };
    ['studio','academia','intervaltrainer','rhythmtrainer'].forEach(tool => {
      const ts = sessions.filter(s => s.tool === tool);
      if (!ts.length) { actStats[tool] = null; return; }
      const last = ts.reduce((m,s) => (s.startTime?.seconds||0) > (m?.startTime?.seconds||0) ? s : m, null);
      actStats[tool] = { sessions: ts.length, total_seconds: ts.reduce((a,s) => a+(s.durationSeconds||0), 0), last_used: last?.startTime ?? null };
    });

    const xp = userData.xp || 0;
    const dc = await getTodayChallenge(uid);
    const gami = {
      xp,
      level: getLevelInfo(xp),
      streak: userData.streak || 0,
      badges: ACHIEVEMENTS.filter(a => earnedKeys.has(a.key)).map(a => ({ ...a, earned_at: null })),
      dailyChallenge: dc,
    };

    S.dailyChallenge = dc;
    showDashboard(actStats, gami);
  } catch (err) {
    console.error('Dashboard error:', err);
    showLogin(t('loginErrGen'));
  }
}

function renderXpPanel(gami) {
  if (!gami?.level) return '';
  const { level, badges = [], streak } = gami;
  const xpText = level.nextLevelXp
    ? `${level.xp} / ${level.nextLevelXp} XP`
    : `${level.xp} XP`;
  const badgesHtml = badges.length > 0
    ? `<div class="badges-row">${badges.map(b =>
        `<span class="badge-icon" data-tip="${escHtml(b.name)}: ${escHtml(b.description)}">${escHtml(b.icon)}</span>`
      ).join('')}</div>`
    : '';
  const streakHtml = streak >= 2 ? `<span class="streak-tag">😊 ${streak} días</span>` : '';
  return `
    <div class="xp-panel">
      <div class="xp-level">
        <span class="xp-level-icon">${level.icon}</span>
        <span class="xp-level-name">${level.name}</span>
        <span class="xp-points">${xpText}</span>
        ${streakHtml}
      </div>
      <div class="xp-bar-bg"><div class="xp-bar-fill" style="width:${level.progress}%"></div></div>
      ${badgesHtml}
    </div>`;
}

function renderDailyCard(gami) {
  if (!gami?.dailyChallenge) return '';
  const { dailyChallenge: ch } = gami;
  const action = ch.completed
    ? `<div class="dc-done">${t('dailyDone')}</div>`
    : `<button class="btn-open rhythm open-tool" data-tool="${ch.tool}">${t('open')}</button>`;
  return `
    <div class="daily-card">
      <div class="dc-header">
        <span>${t('dailyTitle')}</span>
        <span class="dc-xp">+${ch.xp_reward} XP</span>
      </div>
      <p class="dc-desc">${escHtml(ch.config.description)}</p>
      ${action}
    </div>`;
}

function showDashboard(stats, gami) {
  S.view = 'dashboard';
  const st  = stats.studio;
  const ac  = stats.academia;
  const iv  = stats.intervaltrainer;
  const rt  = stats.rhythmtrainer;
  const ia  = stats.intervalAttempts ?? { total: 0, correct: 0 };
  const ivAcc = ia.total > 0 ? Math.round((ia.correct / ia.total) * 100) : null;
  const firstName = escHtml(S.user.fullName.split(' ')[0]);
  const initials  = escHtml(S.user.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase());
  const fullName  = escHtml(S.user.fullName);

  appEl.innerHTML = `
    <div id="view-dashboard">
      <div class="dash-hd">
        <div class="hd-inner">
          <div class="brand">
            <img src="logo.jpeg" class="ico" style="width:auto;height:1.5rem;object-fit:contain;filter:invert(1) brightness(2);" alt="" />
            <div>
              <div class="name">Sonitus Portal</div>
              <div class="sub">${t('subtitle')}</div>
            </div>
          </div>
          <div class="hd-user">
            <button class="btn-out" id="help-btn" style="background:transparent;color:#a7f3d0;border-color:#a7f3d0">${t('helpBtn')}</button>
            <button class="btn-out" id="lang-btn" style="background:transparent;color:#a7f3d0;border-color:#a7f3d0">${t('langBtn')}</button>
            <div class="avatar">${initials}</div>
            <span class="hd-uname">${fullName}</span>
            <button class="btn-out" id="logout-btn">${t('logout')}</button>
          </div>
        </div>
      </div>

      <div class="dash-body">
        <div class="dash-greeting">
          <h2>${t('greeting')(firstName)}</h2>
          <p>${t('greetingSub')}</p>
        </div>

        ${renderXpPanel(gami)}
        ${renderDailyCard(gami)}

        <div class="tool-grid">
          ${['studio','academia','intervaltrainer','rhythmtrainer'].map(tool => {
            const ti = t('tools')[tool];
            const icoMap   = { studio:'🥁', academia:'🎼', intervaltrainer:'🎧', rhythmtrainer:'🥁' };
            const clsMap   = { studio:'rhythm', academia:'notes', intervaltrainer:'intervals', rhythmtrainer:'rhythm' };
            const goldStyle = tool === 'rhythmtrainer' ? 'style="background:#fef3c7;border-color:#fde68a"' : '';
            const badgeGold = tool === 'rhythmtrainer' ? 'style="background:#fef3c7;color:#92400e;border-color:#fde68a"' : '';
            const openStyle = tool === 'rhythmtrainer' ? 'style="background:#d97706"' : '';
            const statsHtml = tool === 'intervaltrainer'
              ? `<span>⏱ ${iv ? fmtDuration(iv.total_seconds) : '—'}</span>
                 <span>🎯 ${ia.total > 0 ? `${ivAcc}%` : t('noData')}</span>
                 <span>📝 ${ia.total} ${t('attempts')}</span>`
              : (() => {
                  const s = { studio: st, academia: ac, rhythmtrainer: rt }[tool];
                  return `<span>⏱ ${s ? fmtDuration(s.total_seconds) : '—'}</span>
                          <span>📅 ${s ? timeAgo(s.last_used) : t('never')}</span>
                          <span>🎯 ${s ? s.sessions : 0} ${t('sessions')}</span>`;
                })();
            return `
              <div class="tool-card">
                <div class="tool-icon ${clsMap[tool]}" ${goldStyle}>${icoMap[tool]}</div>
                <span class="tool-badge ${clsMap[tool]}" ${badgeGold}>${ti.badge}</span>
                <div class="tool-name">${ti.name}</div>
                <div class="tool-desc">${ti.desc}</div>
                <div class="tool-meta">${statsHtml}</div>
                <button class="btn-open ${clsMap[tool]} open-tool" data-tool="${tool}" ${openStyle}>${t('open')}</button>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', doLogout);
  document.getElementById('lang-btn').addEventListener('click', () => {
    S.lang = S.lang === 'es' ? 'en' : 'es';
    loadDashboard();
  });
  document.getElementById('help-btn').addEventListener('click', showHelp);
  document.querySelectorAll('.open-tool').forEach(btn => {
    btn.addEventListener('click', () => openTool(btn.dataset.tool));
  });
}

// ── Ayuda / Help ────────────────────────────────────────────────────────────
function showHelp() {
  const h = T[S.lang].help;
  const tools = T[S.lang].tools;
  const toolIcons = { studio:'🥁', academia:'🎼', intervaltrainer:'🎧', rhythmtrainer:'🥁' };
  appEl.innerHTML = `
    <div id="view-help" style="max-width:680px;margin:0 auto;padding:24px 16px 48px;font-family:inherit">
      <button id="help-back" style="background:none;border:1px solid #d1d5db;border-radius:8px;padding:6px 14px;font-size:.875rem;font-weight:600;color:#6b7280;cursor:pointer;margin-bottom:24px">${h.close}</button>
      <h1 style="font-size:1.75rem;font-weight:800;color:#111827;margin-bottom:8px">${h.title}</h1>
      <p style="color:#6b7280;margin-bottom:32px;line-height:1.7">${h.intro}</p>

      <h2 style="font-size:1.125rem;font-weight:700;color:#111827;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">${h.toolsH}</h2>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
        ${Object.entries(tools).map(([key, tool]) => `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;display:flex;gap:14px;align-items:flex-start">
            <span style="font-size:2rem;flex-shrink:0">${toolIcons[key]}</span>
            <div>
              <div style="font-weight:700;color:#111827;margin-bottom:4px">${tool.name}</div>
              <div style="font-size:.875rem;color:#6b7280;line-height:1.6">${tool.desc}</div>
            </div>
          </div>`).join('')}
      </div>

      <h2 style="font-size:1.125rem;font-weight:700;color:#111827;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">${h.xpH}</h2>
      <p style="color:#6b7280;line-height:1.7;margin-bottom:32px">${h.xpText}</p>

      <h2 style="font-size:1.125rem;font-weight:700;color:#111827;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">${h.dcH}</h2>
      <p style="color:#6b7280;line-height:1.7;margin-bottom:32px">${h.dcText}</p>

      <h2 style="font-size:1.125rem;font-weight:700;color:#111827;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">${h.faqH}</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${h.faq.map(([q, a]) => `
          <details style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
            <summary style="font-weight:700;color:#111827;cursor:pointer;list-style:none;display:flex;justify-content:space-between">
              ${q} <span style="color:#9ca3af">﹢</span>
            </summary>
            <p style="margin-top:10px;color:#6b7280;line-height:1.6;font-size:.9rem">${a}</p>
          </details>`).join('')}
      </div>
    </div>`;

  document.getElementById('help-back').addEventListener('click', () => {
    S.user ? loadDashboard() : showLogin();
  });
}

// ── Abrir herramienta ──────────────────────────────────────────────────────
async function openTool(tool) {
  showLoading();
  const ref = await addDoc(sessionsCol(S.user.id), {
    tool, startTime: serverTimestamp(), endTime: null, durationSeconds: 0,
  });
  S.toolSessionId = ref.id;
  S.toolStart     = Date.now();
  S.currentTool   = tool;
  showToolView(tool);
}

function showToolView(tool) {
  S.view = 'tool';
  const label = t('toolLabels')[tool] ?? tool;
  const src   = `tools/sonitus-${tool}.html?tsid=${S.toolSessionId}&lang=${S.lang}`;

  appEl.innerHTML = `
    <div id="view-tool">
      <div class="tool-hd">
        <div class="tool-hd-left">
          <button class="btn-back" id="back-btn">${t('back')}</button>
          <span class="tool-hd-name">${label}</span>
        </div>
        <div class="tool-hd-right">
          <span style="font-size:.75rem;opacity:.7;">${t('time')}</span>
          <span class="tool-timer" id="tool-timer">00:00:00</span>
        </div>
      </div>
      <iframe id="tool-frame"
        src="${src}"
        allow="autoplay; microphone; midi; web-midi-api; camera"></iframe>
    </div>`;

  let elapsed = 0;
  S.timerInterval = setInterval(() => {
    elapsed = Math.round((Date.now() - S.toolStart) / 1000);
    const el = document.getElementById('tool-timer');
    if (el) el.textContent = fmtTimer(elapsed);
  }, 1000);

  S.heartbeat = setInterval(() => saveSessionDuration(), 60000);
  document.getElementById('back-btn').addEventListener('click', closeTool);
}

async function saveSessionDuration() {
  if (!S.toolSessionId) return;
  const dur = Math.round((Date.now() - S.toolStart) / 1000);
  await updateDoc(doc(sessionsCol(S.user.id), S.toolSessionId), {
    endTime: serverTimestamp(), durationSeconds: dur,
  });
}

async function closeTool() {
  clearInterval(S.timerInterval);
  clearInterval(S.heartbeat);
  await saveSessionDuration();

  const uid = S.user.id;
  await awardXp(uid, 3, 'session_complete');

  const dc = S.dailyChallenge;
  if (dc && !dc.completed && dc.tool === S.currentTool) {
    const today = getLocalDate();
    const chalRef = doc(chalCol(uid), today);
    if (!(await getDoc(chalRef)).exists()) {
      await setDoc(chalRef, { completedAt: serverTimestamp(), xp: dc.xp_reward, tool: dc.tool });
      await awardXp(uid, dc.xp_reward, 'challenge_complete');
    }
  }

  S.toolSessionId = null;
  S.toolStart     = null;
  S.currentTool   = null;
  await loadDashboard();
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function doLogout() {
  clearInterval(S.timerInterval);
  clearInterval(S.heartbeat);
  await signOut(auth);
  S.user = null;
  showLogin();
}

// ── Eventos desde iframe (interval attempts) ───────────────────────────────
window.addEventListener('message', async e => {
  if (!S.user || !e.data?.type) return;
  const { type, data } = e.data;
  if (type === 'INTERVAL_ATTEMPT' && data) {
    await addDoc(attemptsCol(S.user.id), {
      intervalName: data.intervalName,
      userAnswer:   data.userAnswer,
      isCorrect:    !!data.isCorrect,
      responseMs:   data.responseMs ?? null,
      createdAt:    serverTimestamp(),
    });
    if (data.isCorrect) await awardXp(S.user.id, 1, 'interval_correct');
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async fbUser => {
  try {
    if (fbUser) {
      const userData = await getUserData(fbUser.uid);
      if (!userData) { await signOut(auth); showLogin(); return; }
      S.user = { id: fbUser.uid, username: userData.username, fullName: userData.fullName, role: userData.role };
      if (userData.role === 'teacher') { window.location.href = 'admin.html'; return; }
      loadDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Auth init error:', err);
    showLogin('Error de conexión. Por favor recarga la página.');
  } finally {
    window.hideSplash?.();
  }
});
