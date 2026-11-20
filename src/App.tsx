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

const FALLBACK_EVENT: MatchEvent = {
  id: 'local-mix-2026',
  title: 'Torneo Base Donostia · Jornada 1',
  club_name: 'Club Deportivo Gipuzkoa',
  access_code: 'MIX-2026',
  team_home: 'Donostia Azul',
  team_away: 'Gipuzkoa Verde',
  score_home: 2,
  score_away: 1,
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
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

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

  const loadEventData = useCallback(async (codeRaw: string, userId: string) => {
    if (!supabase) return;
    const code = codeRaw.trim().toUpperCase();

    const { data: ev } = await supabase
      .from('events')
      .select('id, title, club_name, access_code, team_home, team_away, score_home, score_away, status')
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
      if (!session?.user) return;
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
        if (data.user) {
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-canvas flex flex-col justify-between px-5 py-6 safe-top safe-bottom max-w-md mx-auto">
        <div className="space-y-5">
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-navy flex items-center justify-center shadow-ios-card">
                <Radio className="w-5 h-5 text-brand-sport" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-brand-navy">MixViewAir</h1>
                <p className="text-xs text-slate-500">Retransmisión deportiva inteligente</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-sky text-brand-blue text-xs font-semibold">
              <Lock className="w-3 h-3" /> Privado
            </span>
          </div>

          {/* Selector estilo iOS: Registro / Iniciar sesion */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70">
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                authMode === 'register'
                  ? 'bg-white text-brand-navy shadow-sm'
                  : 'text-slate-600'
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
                  ? 'bg-white text-brand-navy shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Iniciar sesión
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-ios-card border border-slate-100 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-brand-navy">
                {authMode === 'register' ? 'Registro familiar verificado' : 'Acceder a tu cuenta'}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {authMode === 'register'
                  ? 'Crea tu acceso seguro con DNI/NIE para proteger la privacidad de los menores.'
                  : 'Inicia sesión con tu correo para entrar al partido y ver tus clips.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Código del partido (QR)
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="MIX-2026"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Nombre y apellido
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. Carlos Navarro"
                      className="w-full px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      DNI o NIE (Seguridad)
                    </label>
                    <input
                      type="text"
                      value={dniNie}
                      onChange={(e) => setDniNie(e.target.value.toUpperCase())}
                      placeholder="Ej. Y1234567L o 12345678A"
                      className="w-full px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy uppercase focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Contraseña (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-medium text-brand-live">
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
              className="w-full text-center text-xs font-semibold text-brand-blue pt-1"
            >
              {authMode === 'register'
                ? '¿Ya tienes cuenta? Inicia sesión aquí'
                : '¿Primera vez? Regístrate gratis aquí'}
            </button>
          </div>
        </div>

        <div className="pt-5 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-brand-blue" />
            <span>
              {isSupabaseConfigured
                ? 'Base de datos cifrada conectada · RGPD'
                : 'Entorno cifrado · Cumplimiento RGPD deporte base'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-canvas pb-24 max-w-md mx-auto relative">
      <header className="sticky top-0 z-20 ios-glass border-b border-slate-200/70 px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-blue">
              {activeEvent.club_name}
            </p>
            <h1 className="text-base font-bold text-brand-navy leading-tight">{activeEvent.title}</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-brand-live text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
            EN DIRECTO
          </span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {activeTab === 'live' && (
          <>
            <div className="bg-white rounded-3xl p-4 shadow-ios-card border border-slate-100 flex items-center justify-between">
              <div className="flex-1 text-center">
                <p className="text-xs font-medium text-slate-500 truncate">{activeEvent.team_home}</p>
                <p className="text-2xl font-extrabold text-brand-navy">{activeEvent.score_home}</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-canvas text-xs font-bold text-slate-500">
                42&apos; · 2ª P
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs font-medium text-slate-500 truncate">{activeEvent.team_away}</p>
                <p className="text-2xl font-extrabold text-brand-navy">{activeEvent.score_away}</p>
              </div>
            </div>

            <div className="relative rounded-3xl overflow-hidden bg-brand-navy aspect-video shadow-ios-card flex flex-col justify-between p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-semibold">
                  <Video className="w-3.5 h-3.5 text-brand-sport" />
                  {currentCam.label}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-medium">
                  {currentCam.tag}
                </span>
              </div>

              <div className="text-center space-y-1 my-auto">
                <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                <p className="text-xs font-medium text-slate-200">{currentCam.angle}</p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Código: {activeEvent.access_code}</span>
                <span>Latencia &lt; 0.2s</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
                Cambiar ángulo en vivo
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CAMERAS.map((cam) => {
                  const selected = cam.id === selectedCamera;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => setSelectedCamera(cam.id)}
                      className={`shrink-0 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                        selected
                          ? 'bg-brand-blue text-white shadow-md shadow-blue-500/20'
                          : 'bg-white text-brand-navy border border-slate-200/80'
                      }`}
                    >
                      {cam.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-ios-card border border-slate-100 space-y-4">
              <div>
                <h2 className="text-base font-bold text-brand-navy flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-brand-gold" />
                  Seguimiento personalizado (120s)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solicita 2 minutos de enfoque continuo al dorsal de tu jugador y guarda el clip en HD.
                </p>
              </div>

              <form onSubmit={handleRequestTurn} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTeamSide('home')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      teamSide === 'home'
                        ? 'bg-brand-sky border-brand-blue text-brand-blue'
                        : 'bg-brand-canvas border-transparent text-slate-600'
                    }`}
                  >
                    {activeEvent.team_home}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamSide('away')}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      teamSide === 'away'
                        ? 'bg-brand-sky border-brand-blue text-brand-blue'
                        : 'bg-brand-canvas border-transparent text-slate-600'
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
                    className="w-28 px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-2xl bg-brand-navy hover:bg-slate-800 active:scale-[0.99] transition text-white text-sm font-semibold"
                  >
                    Reservar turno (2 min)
                  </button>
                </div>
              </form>

              {turnFeedback && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 text-brand-sport text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{turnFeedback}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cola de seguimiento en pista ({turns.length})
                </p>
                {turns.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">No hay turnos en cola. Sé el primero en reservar.</p>
                ) : (
                  turns.map((turn) => (
                    <div
                      key={turn.id}
                      className="flex items-center justify-between py-2 px-3 rounded-2xl bg-brand-canvas text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-brand-navy text-white font-bold">
                          #{turn.player_dorsal}
                        </span>
                        <span className="font-medium text-brand-navy">{turn.requester_name}</span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
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
          </>
        )}

        {activeTab === 'clips' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold text-brand-navy">Mis clips privados</h2>
              <span className="text-xs font-semibold text-brand-blue">{clips.length} vídeos</span>
            </div>

            {clips.map((clip) => (
              <div
                key={clip.id}
                className="bg-white rounded-3xl p-4 shadow-ios-card border border-slate-100 space-y-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-lg bg-brand-sky text-brand-blue text-[11px] font-bold">
                      Dorsal #{clip.player_dorsal}
                    </span>
                    <span className="text-[11px] text-slate-400">{clip.camera}</span>
                  </div>
                  <h3 className="text-sm font-bold text-brand-navy">{clip.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {clip.created_label} · {clip.duration_seconds}s · HD 1080p
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlayingClip(clip)}
                    className="flex-1 py-2.5 rounded-2xl bg-brand-canvas text-brand-navy text-xs font-semibold flex items-center justify-center gap-1.5"
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
        )}

        {activeTab === 'cheers' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 shadow-ios-card border border-slate-100 space-y-3">
              <h2 className="text-base font-bold text-brand-navy">Grada familiar</h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHEERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void handleSendCheer(q)}
                    className="px-3 py-1.5 rounded-full bg-brand-sky text-brand-blue text-xs font-semibold active:scale-95 transition"
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
                  className="flex-1 px-4 py-3 rounded-2xl bg-brand-canvas border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
                <button
                  type="button"
                  onClick={() => void handleSendCheer()}
                  aria-label="Enviar mensaje"
                  className="w-12 h-12 rounded-2xl bg-brand-sport text-white flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {cheers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">Aún no hay mensajes en la grada. ¡Envía el primero!</p>
              ) : (
                cheers.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl p-3.5 shadow-ios-card border border-slate-100 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-brand-navy">{c.author_name}</span>
                      <span className="text-slate-400">{c.time_label}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-ios-card border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-sky text-brand-blue flex items-center justify-center font-bold text-lg">
                  {(profile.full_name[0] || 'M').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-navy">{profile.full_name}</h2>
                  <p className="text-xs text-slate-500">{profile.email}</p>
                  <p className="text-xs text-slate-400">Documento: {profile.dni_nie}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 text-brand-sport text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Identidad verificada (DNI/NIE)
                </span>
                <span>Activo</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-brand-canvas text-xs">
                <span className="text-slate-500">Estado de base de datos</span>
                <span className="font-bold text-brand-navy">
                  {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local (añade tus claves)'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-ios-card border border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => setShowLegal(true)}
                className="w-full py-3 px-3 rounded-2xl text-left text-sm font-semibold text-brand-navy hover:bg-brand-canvas transition"
              >
                Privacidad y protección de menores (RGPD)
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full py-3 px-3 rounded-2xl text-left text-sm font-semibold text-brand-live hover:bg-red-50 transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </main>

      {playingClip && (
        <div className="fixed inset-0 z-40 bg-brand-navy/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-navy">{playingClip.title}</h3>
              <button
                type="button"
                onClick={() => setPlayingClip(null)}
                aria-label="Cerrar"
                className="p-1.5 rounded-full bg-brand-canvas text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-video rounded-2xl bg-brand-navy text-white flex flex-col items-center justify-center p-4 text-center space-y-2">
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

      {showLegal && (
        <div className="fixed inset-0 z-40 bg-brand-navy/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand-navy">Privacidad y Seguridad</h3>
              <button
                type="button"
                onClick={() => setShowLegal(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-full bg-brand-canvas text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              MixViewAir restringe el acceso a las retransmisiones de deporte base mediante código de evento y verificación de DNI/NIE. Los vídeos y clips privados se almacenan cifrados y solo son visibles por los familiares autorizados.
            </p>
            <button
              type="button"
              onClick={() => setShowLegal(false)}
              className="w-full py-3 rounded-2xl bg-brand-navy text-white text-sm font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto ios-glass border-t border-slate-200/80 shadow-ios-nav safe-bottom">
        <div className="grid grid-cols-4 px-2 py-2">
          {[
            { id: 'live' as TabId, label: 'Directo', icon: Radio },
            { id: 'clips' as TabId, label: 'Clips', icon: Film },
            { id: 'cheers' as TabId, label: 'Grada', icon: MessageCircle },
            { id: 'profile' as TabId, label: 'Perfil', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-2xl transition ${
                  active ? 'text-brand-blue' : 'text-slate-400'
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