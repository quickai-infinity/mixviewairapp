import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Radio,
  Film,
  MessageCircle,
  User,
  ShieldCheck,
  Video,
  Crosshair,
  Download,
  Send,
  CheckCircle2,
  Clock,
  LogOut,
  Lock,
  Play,
  X,
  UserPlus,
  LogIn,
  Sun,
  Moon,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

type TabId = 'live' | 'clips' | 'cheers' | 'profile';
type AuthMode = 'login' | 'register';

interface MatchEvent {
  id: string;
  title: string;
  club_name: string;
  access_code: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  stream_url?: string | null;
  status: string;
}

interface DroneTurn {
  id: string;
  player_dorsal: string;
  team_side: 'home' | 'away';
  status: string;
  duration_seconds: number;
  requester_name: string;
}

interface ClipItem {
  id: string;
  title: string;
  player_dorsal: string;
  duration_seconds: number;
  created_label: string;
  camera: string;
}

interface CheerMessage {
  id: string;
  author_name: string;
  message: string;
  time_label: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  dni_nie: string;
}

const CAMERAS = [
  { id: 'air', label: 'Plano Aéreo', tag: '4K · Zoom 4x', angle: 'Vista táctica superior en directo' },
  { id: 'north', label: 'Fondo Norte', tag: '1080p', angle: 'Portería y área norte' },
  { id: 'south', label: 'Fondo Sur', tag: '1080p', angle: 'Portería y área sur' },
  { id: 'east', label: 'Banda Este', tag: '1080p', angle: 'Seguimiento de banquillos y medio campo' },
  { id: 'var', label: 'VAR Técnico', tag: '60 fps', angle: 'Repetición instantánea de jugada' },
];

const NAV_TABS: { id: TabId; label: string; icon: typeof Radio }[] = [
  { id: 'live', label: 'Directo', icon: Radio },
  { id: 'clips', label: 'Clips', icon: Film },
  { id: 'cheers', label: 'Grada', icon: MessageCircle },
  { id: 'profile', label: 'Perfil', icon: User },
];

const FALLBACK_EVENT: MatchEvent = {
  id: 'local-mix-2026',
  title: 'Torneo Base Donostia · Jornada 1',
  club_name: 'Club Deportivo Gipuzkoa',
  access_code: 'MIX-2026',
  team_home: 'Donostia Azul',
  team_away: 'Gipuzkoa Verde',
  score_home: 2,
  score_away: 1,
  stream_url: null,
  status: 'live',
};

const SAMPLE_CLIPS: ClipItem[] = [
  { id: 'c1', title: 'Jugada de banda y centro al área', player_dorsal: '10', duration_seconds: 120, created_label: 'Min 18 · Hoy', camera: 'Plano Aéreo' },
  { id: 'c2', title: 'Gol de falta directa (Repetición VAR)', player_dorsal: '10', duration_seconds: 45, created_label: 'Min 34 · Hoy', camera: 'VAR Técnico' },
];

const QUICK_CHEERS = ['¡Vamos equipo!', '¡Gran jugada!', '¡A disfrutar!', '¡Buena defensa!'];

function validateDniNie(raw: string): boolean {
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])$/.test(clean);
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('mixviewair_theme');
    return saved === 'dark';
  });

  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  const [accessCode, setAccessCode] = useState('MIX-2026');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dniNie, setDniNie] = useState('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [activeEvent, setActiveEvent] = useState<MatchEvent>(FALLBACK_EVENT);
  const [selectedCamera, setSelectedCamera] = useState('air');

  const [turns, setTurns] = useState<DroneTurn[]>([]);
  const [dorsalInput, setDorsalInput] = useState('10');
  const [teamSide, setTeamSide] = useState<'home' | 'away'>('home');
  const [turnFeedback, setTurnFeedback] = useState('');

  const [clips, setClips] = useState<ClipItem[]>(SAMPLE_CLIPS);
  const [playingClip, setPlayingClip] = useState<ClipItem | null>(null);

  const [cheers, setCheers] = useState<CheerMessage[]>([]);
  const [cheerInput, setCheerInput] = useState('');
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    window.localStorage.setItem('mixviewair_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadEventData = useCallback(async (codeRaw: string, userId: string) => {
    if (!supabase) return;
    const code = codeRaw.trim().toUpperCase();

    const { data: ev } = await supabase
      .from('events')
      .select('id, title, club_name, access_code, team_home, team_away, score_home, score_away, status, stream_url')
      .eq('access_code', code)
      .maybeSingle();

    const currentEvent = (ev as MatchEvent | null) ?? FALLBACK_EVENT;
    setActiveEvent(currentEvent);

    if (!ev) return;

    const [{ data: turnsData }, { data: cheersData }, { data: clipsData }] = await Promise.all([
      supabase
        .from('drone_turns')
        .select('id, player_dorsal, team_side, status, duration_seconds, requester_name')
        .eq('event_id', currentEvent.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('cheers')
        .select('id, author_name, message, created_at')
        .eq('event_id', currentEvent.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('clips')
        .select('id, title, player_dorsal, duration_seconds, camera, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (turnsData) setTurns(turnsData as DroneTurn[]);
    if (cheersData) {
      setCheers(
        cheersData.map((row) => ({
          id: row.id as string,
          author_name: row.author_name as string,
          message: row.message as string,
          time_label: new Date(row.created_at as string).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }))
      );
    }
    if (clipsData && clipsData.length > 0) {
      setClips(
        clipsData.map((c) => ({
          id: c.id as string,
          title: c.title as string,
          player_dorsal: c.player_dorsal as string,
          duration_seconds: c.duration_seconds as number,
          camera: (c.camera as string) || 'Plano Aéreo',
          created_label: new Date(c.created_at as string).toLocaleDateString('es-ES'),
        }))
      );
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || !supabase) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, email, full_name, dni_nie')
        .eq('id', session.user.id)
        .maybeSingle();

      const loadedProfile: UserProfile = {
        id: session.user.id,
        email: session.user.email ?? '',
        full_name: (prof?.full_name as string) || (session.user.user_metadata?.full_name as string) || 'Familiar',
        dni_nie: (prof?.dni_nie as string) || (session.user.user_metadata?.dni_nie as string) || '',
      };
      setProfile(loadedProfile);
      await loadEventData(accessCode, session.user.id);
    });
  }, [accessCode, loadEventData]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');

    if (accessCode.trim().length < 4) {
      setAuthError('Introduce el código del partido (ej. MIX-2026).');
      return;
    }
    if (!email.includes('@')) {
      setAuthError('Introduce un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (authMode === 'register') {
      if (fullName.trim().length < 3) {
        setAuthError('Escribe tu nombre y apellido.');
        return;
      }
      if (!validateDniNie(dniNie)) {
        setAuthError('Formato de DNI/NIE no válido (ej. 12345678A o Y1234567L).');
        return;
      }
    }

    if (!supabase) {
      setProfile({
        id: 'local-user',
        email: email.trim(),
        full_name: fullName.trim() || 'Familiar MixViewAir',
        dni_nie: dniNie.trim().toUpperCase() || 'VERIFICADO',
      });
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const cleanDni = dniNie.trim().toUpperCase().replace(/[\s-]/g, '');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname,
            data: {
              full_name: fullName.trim(),
              dni_nie: cleanDni,
            },
          },
        });
        if (error) {
          setAuthError(error.message);
          return;
        }
        if (data.user && !data.session) {
          setAuthNotice('Te enviamos un correo de verificación. Abre el enlace en tu bandeja para activar tu cuenta y entrar.');
          setAuthMode('login');
          return;
        }
        if (data.user && data.session) {
          setProfile({
            id: data.user.id,
            email: data.user.email ?? email.trim(),
            full_name: fullName.trim(),
            dni_nie: cleanDni,
          });
          await loadEventData(accessCode, data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          setAuthError('Correo o contraseña incorrectos. Si es tu primera vez, pulsa "Crear cuenta".');
          return;
        }
        if (data.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, dni_nie')
            .eq('id', data.user.id)
            .maybeSingle();

          setProfile({
            id: data.user.id,
            email: data.user.email ?? email.trim(),
            full_name: (prof?.full_name as string) || 'Familiar',
            dni_nie: (prof?.dni_nie as string) || 'VERIFICADO',
          });
          await loadEventData(accessCode, data.user.id);
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestTurn = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const dorsal = dorsalInput.trim();
    if (!dorsal) return;

    if (supabase && activeEvent.id !== 'local-mix-2026') {
      const { data, error } = await supabase
        .from('drone_turns')
        .insert({
          event_id: activeEvent.id,
          user_id: profile.id,
          requester_name: profile.full_name,
          player_dorsal: dorsal,
          team_side: teamSide,
          status: 'queued',
          duration_seconds: 120,
        })
        .select('id, player_dorsal, team_side, status, duration_seconds, requester_name')
        .single();

      if (!error && data) {
        setTurns((prev) => [...prev, data as DroneTurn]);
      }
    } else {
      setTurns((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          player_dorsal: dorsal,
          team_side: teamSide,
          status: 'queued',
          duration_seconds: 120,
          requester_name: profile.full_name,
        },
      ]);
    }

    setTurnFeedback(`Turno de 120s guardado para el dorsal #${dorsal}.`);
    window.setTimeout(() => setTurnFeedback(''), 3500);
  };

  const handleSendCheer = async (preset?: string) => {
    if (!profile) return;
    const text = (preset ?? cheerInput).trim();
    if (!text) return;

    if (supabase && activeEvent.id !== 'local-mix-2026') {
      const { data, error } = await supabase
        .from('cheers')
        .insert({
          event_id: activeEvent.id,
          user_id: profile.id,
          author_name: profile.full_name,
          message: text,
        })
        .select('id, author_name, message, created_at')
        .single();

      if (!error && data) {
        setCheers((prev) => [
          {
            id: data.id as string,
            author_name: data.author_name as string,
            message: data.message as string,
            time_label: 'Ahora',
          },
          ...prev,
        ]);
      }
    } else {
      setCheers((prev) => [
        { id: `m-${Date.now()}`, author_name: profile.full_name, message: text, time_label: 'Ahora' },
        ...prev,
      ]);
    }

    if (!preset) setCheerInput('');
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setTurns([]);
    setCheers([]);
  };

  const currentCam = CAMERAS.find((c) => c.id === selectedCamera) ?? CAMERAS[0];

  const themeToggleButton = (
    <button
      type="button"
      onClick={() => setDarkMode((prev) => !prev)}
      aria-label={darkMode ? 'Cambiar a fondo claro' : 'Cambiar a fondo negro'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-brand-navy dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition shadow-sm"
    >
      {darkMode ? (
        <>
          <Sun className="w-3.5 h-3.5 text-brand-gold" />
          <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-brand-blue" />
          <span className="hidden sm:inline">Negro</span>
        </>
      )}
    </button>
  );

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-canvas dark:bg-black text-brand-navy dark:text-slate-100 flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-6 safe-top safe-bottom transition-colors">
        <header className="w-full max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-navy dark:bg-zinc-900 dark:border dark:border-zinc-800 flex items-center justify-center shadow-ios-card">
              <Radio className="w-5 h-5 text-brand-sport" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brand-navy dark:text-white">MixViewAir</h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Retransmisión deportiva inteligente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {themeToggleButton}
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-semibold">
              <Lock className="w-3 h-3" /> Privado
            </span>
          </div>
        </header>

        <div className="w-full max-w-6xl mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Panel informativo exclusivo para escritorio y tablet horizontal */}
          <section className="hidden lg:flex lg:col-span-6 flex-col space-y-6 pr-4">
            <span className="inline-flex items-center gap-2 w-fit px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-brand-sport text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-brand-sport animate-pulse" />
              Plataforma multicámara para deporte base
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-brand-navy dark:text-white leading-tight">
              Sigue cada jugada en directo desde el ángulo que tú elijas.
            </h2>
            <p className="text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
              Acceso privado por código de partido y verificación de identidad para disfrutar del partido con total seguridad desde móvil, tablet u ordenador.
            </p>

            <div className="grid grid-cols-1 gap-3.5 pt-2">
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800 shadow-ios-card">
                <div className="w-10 h-10 rounded-xl bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy dark:text-white">5 ángulos de cámara en tiempo real</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Cambia al instante entre plano aéreo táctico, fondos, banda y repetición VAR.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800 shadow-ios-card">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-brand-gold flex items-center justify-center shrink-0">
                  <Crosshair className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy dark:text-white">Seguimiento de dorsal (120 segundos)</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Reserva turnos personalizados con lectura OCR de dorsales y guarda clips privados en HD.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800 shadow-ios-card">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-brand-sport flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy dark:text-white">Privacidad certificada RGPD</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Sin acceso público abierto: cada sala exige código del evento y titular verificado con DNI/NIE.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Tarjeta de acceso responsive */}
          <section className="lg:col-span-6 w-full max-w-md md:max-w-lg mx-auto space-y-4">
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 dark:bg-zinc-900 border border-transparent dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> Iniciar sesión
              </button>
            </div>

            <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 sm:p-7 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-brand-navy dark:text-white">
                  {authMode === 'register' ? 'Registro familiar verificado' : 'Acceder a tu cuenta'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {authMode === 'register'
                    ? 'Crea tu acceso seguro con DNI/NIE para proteger la privacidad de los menores.'
                    : 'Inicia sesión con tu correo para entrar al partido y ver tus clips.'}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Código del partido (QR)
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="MIX-2026"
                    className="w-full px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>

                {authMode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                        Nombre y apellido
                      </label>
                      <input
                        type="text"
                        name="full_name"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej. Carlos Navarro"
                        className="w-full px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                        DNI o NIE (Seguridad)
                      </label>
                      <input
                        type="text"
                        name="dni_nie_doc"
                        autoComplete="off"
                        value={dniNie}
                        onChange={(e) => setDniNie(e.target.value.toUpperCase())}
                        placeholder="Ej. Y1234567L"
                        className="w-full px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Contraseña (mín. 6 caracteres)
                  </label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>

                {authNotice && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs font-medium text-brand-sport">
                    {authNotice}
                  </div>
                )}

                {authError && (
                  <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 text-xs font-medium text-brand-live">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 rounded-2xl bg-brand-sport hover:bg-emerald-600 active:scale-[0.99] transition text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-60"
                >
                  {authLoading
                    ? 'Conectando...'
                    : authMode === 'register'
                    ? 'Registrarme y entrar al directo'
                    : 'Iniciar sesión y entrar'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' ? 'login' : 'register');
                  setAuthError('');
                }}
                className="w-full text-center text-xs font-semibold text-brand-blue dark:text-blue-400 pt-1"
              >
                {authMode === 'register'
                  ? '¿Ya tienes cuenta? Inicia sesión aquí'
                  : '¿Primera vez? Regístrate gratis aquí'}
              </button>
            </div>
          </section>
        </div>

        <footer className="w-full max-w-6xl mx-auto pt-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-brand-blue dark:text-blue-400" />
            <span>
              {isSupabaseConfigured
                ? 'Base de datos cifrada conectada · RGPD'
                : 'Entorno cifrado · Cumplimiento RGPD deporte base'}
            </span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-canvas dark:bg-black text-brand-navy dark:text-slate-100 pb-24 md:pb-10 relative transition-colors">
      {/* Cabecera superior adaptativa (PC / Tablet / Movil) */}
      <header className="sticky top-0 z-20 ios-glass border-b border-slate-200/70 dark:border-zinc-800 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-brand-navy dark:bg-zinc-900 dark:border dark:border-zinc-800 items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-brand-sport" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue dark:text-blue-400 truncate">
                {activeEvent.club_name}
              </p>
              <h1 className="text-sm sm:text-base font-bold text-brand-navy dark:text-white leading-tight truncate">
                {activeEvent.title}
              </h1>
            </div>
          </div>

          {/* Navegacion superior en Tablet y Escritorio */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-slate-200/60 dark:bg-zinc-900 border border-transparent dark:border-zinc-800">
            {NAV_TABS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-white dark:bg-zinc-800 text-brand-blue dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-brand-navy dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {themeToggleButton}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 text-brand-live text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
              <span className="hidden sm:inline">EN DIRECTO</span>
              <span className="sm:hidden">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* PESTAÑA 1: EN DIRECTO */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Columna principal: Marcador + Reproductor + Selector de camaras */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-zinc-950 rounded-3xl p-4 sm:p-5 shadow-ios-card border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex-1 text-center">
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400 truncate">
                    {activeEvent.team_home}
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white">
                    {activeEvent.score_home}
                  </p>
                </div>
                <div className="px-3.5 py-1.5 rounded-full bg-brand-canvas dark:bg-zinc-900 text-xs font-bold text-slate-500 dark:text-zinc-300">
                  42&apos; · 2ª P
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400 truncate">
                    {activeEvent.team_away}
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white">
                    {activeEvent.score_away}
                  </p>
                </div>
              </div>

              <div className="relative rounded-3xl overflow-hidden bg-brand-navy dark:bg-zinc-950 border border-transparent dark:border-zinc-800 aspect-video shadow-ios-card flex flex-col justify-between p-4 sm:p-5 text-white">
                {activeEvent.stream_url && (
                  <img
                    src={activeEvent.stream_url}
                    alt="Señal en directo MixViewAir"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-xs font-semibold">
                    <Video className="w-3.5 h-3.5 text-brand-sport" />
                    {currentCam.label}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-xs font-medium">
                    {activeEvent.stream_url ? 'Cámara IA Activa' : currentCam.tag}
                  </span>
                </div>

                {!activeEvent.stream_url && (
                  <div className="relative z-10 text-center space-y-2 my-auto">
                    <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-slate-200">{currentCam.angle}</p>
                  </div>
                )}

                <div className="relative z-10 flex items-center justify-between text-xs text-slate-200 bg-black/50 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-2.5 backdrop-blur-sm">
                  <span>Código: {activeEvent.access_code}</span>
                  <span>{activeEvent.stream_url ? 'EN VIVO · IA OCR' : 'Latencia < 0.2s'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-1">
                  Cambiar ángulo en vivo
                </p>
                <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1">
                  {CAMERAS.map((cam) => {
                    const selected = cam.id === selectedCamera;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => setSelectedCamera(cam.id)}
                        className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-semibold transition ${
                          selected
                            ? 'bg-brand-blue text-white shadow-md shadow-blue-500/20'
                            : 'bg-white dark:bg-zinc-950 text-brand-navy dark:text-slate-200 border border-slate-200/80 dark:border-zinc-800 hover:border-brand-blue/50'
                        }`}
                      >
                        {cam.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha en escritorio: Reserva de seguimiento aereo de 120s */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-white dark:bg-zinc-950 rounded-3xl p-5 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-brand-navy dark:text-white flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-brand-gold" />
                    Seguimiento personalizado (120s)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Solicita 2 minutos de enfoque continuo al dorsal de tu jugador y guarda el clip en HD.
                  </p>
                </div>

                <form onSubmit={handleRequestTurn} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTeamSide('home')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition truncate ${
                        teamSide === 'home'
                          ? 'bg-brand-sky dark:bg-blue-950/60 border-brand-blue text-brand-blue dark:text-blue-400'
                          : 'bg-brand-canvas dark:bg-zinc-900 border-transparent text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {activeEvent.team_home}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamSide('away')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition truncate ${
                        teamSide === 'away'
                          ? 'bg-brand-sky dark:bg-blue-950/60 border-brand-blue text-brand-blue dark:text-blue-400'
                          : 'bg-brand-canvas dark:bg-zinc-900 border-transparent text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {activeEvent.team_away}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={dorsalInput}
                      onChange={(e) => setDorsalInput(e.target.value)}
                      placeholder="Dorsal"
                      className="w-24 px-3 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 rounded-2xl bg-brand-navy dark:bg-brand-blue hover:opacity-95 active:scale-[0.99] transition text-white text-sm font-semibold"
                    >
                      Reservar turno (2 min)
                    </button>
                  </div>
                </form>

                {turnFeedback && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-brand-sport text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{turnFeedback}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Cola de seguimiento en pista ({turns.length})
                  </p>
                  {turns.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 py-1">
                      No hay turnos en cola. Sé el primero en reservar.
                    </p>
                  ) : (
                    turns.map((turn) => (
                      <div
                        key={turn.id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-lg bg-brand-navy dark:bg-zinc-800 text-white font-bold">
                            #{turn.player_dorsal}
                          </span>
                          <span className="font-medium text-brand-navy dark:text-slate-200 truncate">
                            {turn.requester_name}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                            turn.status === 'active' ? 'text-brand-sport' : 'text-brand-gold'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {turn.status === 'active' ? 'Grabando' : 'En cola'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* PESTAÑA 2: MIS CLIPS */}
        {activeTab === 'clips' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-bold text-brand-navy dark:text-white">Mis clips privados</h2>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400">
                {clips.length} vídeos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className="bg-white dark:bg-zinc-950 rounded-3xl p-5 shadow-ios-card border border-slate-100 dark:border-zinc-800 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-[11px] font-bold">
                        Dorsal #{clip.player_dorsal}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">{clip.camera}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-brand-navy dark:text-white">{clip.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      {clip.created_label} · {clip.duration_seconds}s · HD 1080p
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPlayingClip(clip)}
                      className="flex-1 py-2.5 rounded-2xl bg-brand-canvas dark:bg-zinc-900 text-brand-navy dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Ver clip
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayingClip(clip)}
                      className="flex-1 py-2.5 rounded-2xl bg-brand-blue text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: GRADA */}
        {activeTab === 'cheers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white dark:bg-zinc-950 rounded-3xl p-5 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-brand-navy dark:text-white">Grada familiar</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Envía mensajes de apoyo respetuosos en tiempo real durante el encuentro.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHEERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void handleSendCheer(q)}
                    className="px-3 py-1.5 rounded-full bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-semibold active:scale-95 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cheerInput}
                  onChange={(e) => setCheerInput(e.target.value)}
                  placeholder="Escribe un mensaje de ánimo..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-brand-canvas dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-brand-navy dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <button
                  type="button"
                  onClick={() => void handleSendCheer()}
                  aria-label="Enviar mensaje"
                  className="w-12 h-12 rounded-2xl bg-brand-sport text-white flex items-center justify-center shrink-0 hover:bg-emerald-600 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {cheers.length === 0 ? (
                <div className="bg-white dark:bg-zinc-950 rounded-3xl p-8 text-center border border-slate-100 dark:border-zinc-800">
                  <p className="text-sm text-slate-400 dark:text-zinc-500">
                    Aún no hay mensajes en la grada. ¡Envía el primero!
                  </p>
                </div>
              ) : (
                cheers.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-zinc-950 rounded-2xl p-4 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-brand-navy dark:text-white">{c.author_name}</span>
                      <span className="text-slate-400 dark:text-zinc-500">{c.time_label}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-300">{c.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: PERFIL */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-sky dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                  {(profile.full_name[0] || 'M').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-brand-navy dark:text-white truncate">{profile.full_name}</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{profile.email}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Documento: {profile.dni_nie}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-brand-sport text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Identidad verificada (DNI/NIE)
                </span>
                <span>Activo</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-brand-canvas dark:bg-zinc-900 text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Base de datos</span>
                <span className="font-bold text-brand-navy dark:text-white">
                  {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local'}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-ios-card border border-slate-100 dark:border-zinc-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-brand-canvas dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-semibold text-brand-navy dark:text-white">Apariencia visual</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {darkMode ? 'Fondo negro activo' : 'Fondo claro estilo iOS'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDarkMode((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-brand-blue text-white text-xs font-semibold"
                  >
                    {darkMode ? 'Cambiar a claro' : 'Cambiar a negro'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLegal(true)}
                  className="w-full py-3.5 px-4 rounded-2xl text-left text-sm font-semibold text-brand-navy dark:text-white bg-brand-canvas/60 dark:bg-zinc-900 hover:bg-brand-canvas dark:hover:bg-zinc-800 transition"
                >
                  Privacidad y protección de menores (RGPD)
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full py-3.5 px-4 rounded-2xl text-left text-sm font-semibold text-brand-live bg-red-50/70 dark:bg-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/50 transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal vista previa de clip */}
      {playingClip && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-navy dark:text-white">{playingClip.title}</h3>
              <button
                type="button"
                onClick={() => setPlayingClip(null)}
                aria-label="Cerrar"
                className="p-1.5 rounded-full bg-brand-canvas dark:bg-zinc-900 text-slate-500 dark:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video rounded-2xl bg-brand-navy dark:bg-black border border-transparent dark:border-zinc-800 text-white flex flex-col items-center justify-center p-4 text-center space-y-2">
              <Play className="w-10 h-10 text-brand-sport" />
              <p className="text-xs text-slate-300">
                Clip privado Dorsal #{playingClip.player_dorsal} · {playingClip.duration_seconds}s listo para descargar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlayingClip(null)}
              className="w-full py-3.5 rounded-2xl bg-brand-blue text-white font-semibold text-sm"
            >
              Cerrar vista previa
            </button>
          </div>
        </div>
      )}

      {/* Modal legal RGPD */}
      {showLegal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-navy dark:text-white">Privacidad y Seguridad</h3>
              <button
                type="button"
                onClick={() => setShowLegal(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-full bg-brand-canvas dark:bg-zinc-900 text-slate-500 dark:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              MixViewAir restringe el acceso a las retransmisiones de deporte base mediante código de evento y verificación de DNI/NIE. Los vídeos y clips privados se almacenan cifrados y solo son visibles por los familiares autorizados.
            </p>
            <button
              type="button"
              onClick={() => setShowLegal(false)}
              className="w-full py-3 rounded-2xl bg-brand-navy dark:bg-brand-blue text-white text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Barra de navegacion inferior SOLO para movil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 ios-glass border-t border-slate-200/80 dark:border-zinc-800 shadow-ios-nav safe-bottom">
        <div className="grid grid-cols-4 px-2 py-2">
          {NAV_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-2xl transition ${
                  active ? 'text-brand-blue dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}