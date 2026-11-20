import { useState, useEffect, type FormEvent } from 'react';
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
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

type TabId = 'live' | 'clips' | 'cheers' | 'profile';

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
  requester: string;
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

const CAMERAS = [
  { id: 'air', label: 'Plano Aéreo', tag: '4K · Zoom 4x', angle: 'Vista táctica superior en directo' },
  { id: 'north', label: 'Fondo Norte', tag: '1080p', angle: 'Portería y área norte' },
  { id: 'south', label: 'Fondo Sur', tag: '1080p', angle: 'Portería y área sur' },
  { id: 'east', label: 'Banda Este', tag: '1080p', angle: 'Seguimiento de banquillos y medio campo' },
  { id: 'var', label: 'VAR Técnico', tag: '60 fps', angle: 'Repetición instantánea de jugada' },
];

const INITIAL_EVENT: MatchEvent = {
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

const INITIAL_TURNS: DroneTurn[] = [
  { id: 't1', player_dorsal: '10', team_side: 'home', status: 'active', duration_seconds: 120, requester: 'Familia Etxebarria' },
  { id: 't2', player_dorsal: '7', team_side: 'away', status: 'queued', duration_seconds: 120, requester: 'Familia Agirre' },
];

const INITIAL_CLIPS: ClipItem[] = [
  { id: 'c1', title: 'Jugada de banda y centro al área', player_dorsal: '10', duration_seconds: 120, created_label: 'Min 18 · Hoy', camera: 'Plano Aéreo' },
  { id: 'c2', title: 'Gol de falta directa (Repetición VAR)', player_dorsal: '10', duration_seconds: 45, created_label: 'Min 34 · Hoy', camera: 'VAR Técnico' },
];

const INITIAL_CHEERS: CheerMessage[] = [
  { id: 'm1', author_name: 'Amaia G.', message: '¡Qué gran partido están haciendo todos hoy!', time_label: 'Hace 2 min' },
  { id: 'm2', author_name: 'Iñaki R.', message: '¡Ánimo equipo, a disfrutar de la segunda parte!', time_label: 'Hace 1 min' },
];

const QUICK_CHEERS = ['¡Vamos equipo!', '¡Gran jugada!', '¡A disfrutar!', '¡Buena defensa!'];

function validateDniNie(raw: string): boolean {
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])$/.test(clean);
}

export default function App() {
  const [isEntered, setIsEntered] = useState(false);
  const [accessCode, setAccessCode] = useState('MIX-2026');
  const [fullName, setFullName] = useState('');
  const [dniNie, setDniNie] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [activeEvent, setActiveEvent] = useState<MatchEvent>(INITIAL_EVENT);
  const [selectedCamera, setSelectedCamera] = useState('air');

  const [turns, setTurns] = useState<DroneTurn[]>(INITIAL_TURNS);
  const [dorsalInput, setDorsalInput] = useState('10');
  const [teamSide, setTeamSide] = useState<'home' | 'away'>('home');
  const [turnFeedback, setTurnFeedback] = useState('');

  const [clips] = useState<ClipItem[]>(INITIAL_CLIPS);
  const [playingClip, setPlayingClip] = useState<ClipItem | null>(null);

  const [cheers, setCheers] = useState<CheerMessage[]>(INITIAL_CHEERS);
  const [cheerInput, setCheerInput] = useState('');
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    if (!isEntered || !supabase) return;
    const code = accessCode.trim().toUpperCase();
    void supabase
      .from('events')
      .select('id, title, club_name, access_code, team_home, team_away, score_home, score_away, status')
      .eq('access_code', code)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveEvent(data as MatchEvent);
        }
      });
  }, [isEntered, accessCode]);

  const handleEnterMatch = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (accessCode.trim().length < 4) {
      setAuthError('Introduce un código de partido válido (ej. MIX-2026).');
      return;
    }
    if (fullName.trim().length < 3) {
      setAuthError('Escribe tu nombre y apellido para el registro familiar.');
      return;
    }
    if (!validateDniNie(dniNie)) {
      setAuthError('Formato de DNI/NIE no válido (ej. 12345678A o X1234567L).');
      return;
    }
    setIsEntered(true);
  };

  const handleRequestTurn = (e: FormEvent) => {
    e.preventDefault();
    const dorsal = dorsalInput.trim();
    if (!dorsal) return;

    const newTurn: DroneTurn = {
      id: `t-${Date.now()}`,
      player_dorsal: dorsal,
      team_side: teamSide,
      status: 'queued',
      duration_seconds: 120,
      requester: fullName.trim() || 'Familiar verificado',
    };
    setTurns((prev) => [...prev, newTurn]);
    setTurnFeedback(`Turno de 120s reservado para el dorsal #${dorsal}.`);
    window.setTimeout(() => setTurnFeedback(''), 3500);
  };

  const handleSendCheer = (preset?: string) => {
    const text = (preset ?? cheerInput).trim();
    if (!text) return;
    const msg: CheerMessage = {
      id: `m-${Date.now()}`,
      author_name: fullName.trim() || 'Familiar',
      message: text,
      time_label: 'Ahora',
    };
    setCheers((prev) => [msg, ...prev]);
    if (!preset) setCheerInput('');
  };

  const handleDownloadClip = (clip: ClipItem) => {
    setPlayingClip(clip);
  };

  const currentCam = CAMERAS.find((c) => c.id === selectedCamera) ?? CAMERAS[0];

  if (!isEntered) {
    return (
      <div className="min-h-screen bg-brand-canvas flex flex-col justify-between px-5 py-8 safe-top safe-bottom max-w-md mx-auto">
        <div className="space-y-6">
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

          <div className="bg-white rounded-3xl p-6 shadow-ios-card border border-slate-100 space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-brand-navy">Acceso al partido</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Verificamos tu identidad para proteger la privacidad de los jugadores y las familias.
              </p>
            </div>

            <form onSubmit={handleEnterMatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Código del partido (QR)
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="MIX-2026"
                  className="w-full px-4 py-3.5 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nombre y apellido
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Carlos Navarro"
                  className="w-full px-4 py-3.5 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  DNI o NIE (Verificación de seguridad)
                </label>
                <input
                  type="text"
                  value={dniNie}
                  onChange={(e) => setDniNie(e.target.value.toUpperCase())}
                  placeholder="Ej. Y1234567L o 12345678A"
                  className="w-full px-4 py-3.5 rounded-2xl bg-brand-canvas border border-slate-200 text-brand-navy uppercase focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-medium text-brand-live">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-brand-sport hover:bg-emerald-600 active:scale-[0.99] transition text-white font-semibold text-base shadow-lg shadow-emerald-500/20"
              >
                Entrar al directo
              </button>
            </form>
          </div>
        </div>

        <div className="pt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-brand-blue" />
            <span>Entorno cifrado · Cumplimiento RGPD deporte base</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-canvas pb-24 max-w-md mx-auto relative">
      {/* Cabecera superior estilo iOS */}
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
        {/* PESTAÑA 1: EN DIRECTO */}
        {activeTab === 'live' && (
          <>
            {/* Marcador limpio */}
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

            {/* Reproductor principal */}
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

            {/* Selector de angulos */}
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

            {/* Reserva de seguimiento aereo de 120s */}
            <div className="bg-white rounded-3xl p-5 shadow-ios-card border border-slate-100 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-brand-navy flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-brand-gold" />
                    Seguimiento personalizado (120s)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Solicita 2 minutos de enfoque continuo al dorsal de tu jugador y guarda el clip en HD.
                  </p>
                </div>
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
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className="flex items-center justify-between py-2 px-3 rounded-2xl bg-brand-canvas text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-brand-navy text-white font-bold">
                        #{turn.player_dorsal}
                      </span>
                      <span className="font-medium text-brand-navy">{turn.requester}</span>
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
                ))}
              </div>
            </div>
          </>
        )}

        {/* PESTAÑA 2: MIS CLIPS */}
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
                <div className="flex items-start justify-between gap-3">
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
                    onClick={() => handleDownloadClip(clip)}
                    className="flex-1 py-2.5 rounded-2xl bg-brand-blue text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PESTAÑA 3: GRADA */}
        {activeTab === 'cheers' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 shadow-ios-card border border-slate-100 space-y-3">
              <h2 className="text-base font-bold text-brand-navy">Grada familiar</h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHEERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSendCheer(q)}
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
                  onClick={() => handleSendCheer()}
                  aria-label="Enviar mensaje"
                  className="w-12 h-12 rounded-2xl bg-brand-sport text-white flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {cheers.map((c) => (
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
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: PERFIL */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-ios-card border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-sky text-brand-blue flex items-center justify-center font-bold text-lg">
                  {(fullName.trim()[0] || 'M').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-navy">{fullName}</h2>
                  <p className="text-xs text-slate-500">Documento: {dniNie}</p>
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
                  {isSupabaseConfigured ? 'Supabase conectado' : 'Modo vista previa local'}
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
                onClick={() => setIsEntered(false)}
                className="w-full py-3 px-3 rounded-2xl text-left text-sm font-semibold text-brand-live hover:bg-red-50 transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Salir del partido actual
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal vista previa de clip */}
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
                Clip privado Dorsal #{playingClip.player_dorsal} · {playingClip.duration_seconds}s listo para guardar en tu galería.
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

      {/* Modal legal obligatorio para tiendas */}
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

      {/* Barra de navegacion inferior estilo iPhone */}
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