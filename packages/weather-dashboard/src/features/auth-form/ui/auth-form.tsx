import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/auth-provider';

type Mode = 'sign-in' | 'sign-up' | 'confirm';

export const AuthForm = () => {
  const navigate = useNavigate();
  const { signInWithPassword, register, confirmRegistration } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    try {
      if (mode === 'sign-in') {
        await signInWithPassword({ email, password });
        navigate('/');
        return;
      }

      if (mode === 'sign-up') {
        await register({ email, password });
        setMode('confirm');
        setStatus('Confirmation code sent. Check your email and enter it below.');
        return;
      }

      await confirmRegistration({ email, confirmationCode });
      setMode('sign-in');
      setStatus('Account confirmed. You can sign in now.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication request failed');
    }
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="button-row">
        <button className="button-primary" type="button" onClick={() => setMode('sign-in')}>Sign in</button>
        <button className="button-secondary" type="button" onClick={() => setMode('sign-up')}>Sign up</button>
      </div>

      <label className="auth-row">
        <span>Email</span>
        <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} required />
      </label>

      {mode !== 'confirm' ? (
        <label className="auth-row">
          <span>Password</span>
          <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} required />
        </label>
      ) : (
        <label className="auth-row">
          <span>Confirmation code</span>
          <input value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value)} required />
        </label>
      )}

      {status ? <div className="status-banner">{status}</div> : null}
      {error ? <div className="status-banner error-banner">{error}</div> : null}

      <button className="button-primary" type="submit">
        {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Confirm account'}
      </button>
    </form>
  );
};
