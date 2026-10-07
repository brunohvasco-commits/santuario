import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase, useSession } from '../supabase';
import { Brand } from './Lobby';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const translate = (m: string) => {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (/valid email/i.test(m) || /invalid format/i.test(m)) return 'Digite um e-mail válido.';
  return m;
};

export function AuthPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const invited = next.startsWith('/jogo/');
  const [mode, setMode] = useState<Mode>(invited ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === 'PASSWORD_RECOVERY') setMode('reset');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session && mode !== 'reset') return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const redirect = `${window.location.origin}${next}`;
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Diga como quer ser chamado no tabuleiro.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim().slice(0, 24) }, emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (!data.session) setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, você volta direto para cá.');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/entrar` });
        if (error) throw error;
        setInfo('Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode('login');
        window.location.assign(next);
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art" aria-hidden="true" />
      <main className="auth-panel">
        <Brand />
        {invited && mode !== 'reset' && (
          <p className="invite-note">Você foi desafiado para um duelo. Entre ou crie sua conta para aceitar.</p>
        )}
        {mode !== 'forgot' && mode !== 'reset' && (
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Entrar</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Criar conta</button>
          </div>
        )}
        {mode === 'forgot' && <h2 className="auth-title">Recuperar senha</h2>}
        {mode === 'reset' && <h2 className="auth-title">Nova senha</h2>}
        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <label>
              Nome no tabuleiro
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="Ex.: Mestre Bruno" required />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              {mode === 'reset' ? 'Nova senha' : 'Senha'}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {info && <p className="info" role="status">{info}</p>}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link' : 'Salvar senha'}
          </button>
        </form>
        {mode === 'login' && <button className="link" onClick={() => setMode('forgot')}>Esqueci minha senha</button>}
        {mode === 'forgot' && <button className="link" onClick={() => setMode('login')}>Voltar</button>}
      </main>
    </div>
  );
}
