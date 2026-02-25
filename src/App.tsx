import { useEffect, useMemo, useState } from 'react';

import { useMiniAppStore } from './store/useMiniAppStore';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export default function App() {
  const {
    telegramUser,
    sessionUserId,
    workspaceId,
    workouts,
    loading,
    authLoading,
    email,
    otpCode,
    message,
    error,
    init,
    setWorkspaceId,
    setEmail,
    setOtpCode,
    requestOtp,
    verifyOtp,
    signOut,
    loadWorkouts,
    createWorkout,
    deleteWorkout,
  } = useMiniAppStore();

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayIso);

  useEffect(() => {
    void init();
  }, [init]);

  const telegramLabel = useMemo(() => {
    if (!telegramUser) {
      return 'Not in Telegram context';
    }
    return [telegramUser.firstName, telegramUser.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || telegramUser.username || `id:${telegramUser.id}`;
  }, [telegramUser]);

  return (
    <main className="app-shell">
      <header className="card">
        <p className="eyebrow">Gym Tracker</p>
        <h1>Telegram Mini App Starter</h1>
        <p className="muted">Telegram user: {telegramLabel}</p>
        <p className="muted">Supabase session: {sessionUserId ?? 'none'}</p>
      </header>

      <section className="card">
        <h2>Auth (OTP fallback)</h2>
        <p className="muted">
          Пока Telegram auth bridge не подключен, используйте email OTP для теста RLS.
        </p>
        <label className="field-label" htmlFor="email-input">
          Email
        </label>
        <input
          id="email-input"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <div className="row">
          <button className="button ghost" onClick={() => void requestOtp()} disabled={authLoading}>
            Send code
          </button>
          <button className="button ghost" onClick={() => void signOut()} disabled={authLoading}>
            Sign out
          </button>
        </div>
        <label className="field-label" htmlFor="otp-input">
          OTP code
        </label>
        <input
          id="otp-input"
          className="input"
          value={otpCode}
          onChange={(event) => setOtpCode(event.target.value)}
          placeholder="123456"
        />
        <button className="button" onClick={() => void verifyOtp()} disabled={authLoading}>
          Verify code
        </button>
      </section>

      <section className="card">
        <h2>Workspace</h2>
        <label className="field-label" htmlFor="workspace-input">
          Active workspace id
        </label>
        <input
          id="workspace-input"
          className="input"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          placeholder="uuid"
        />
        <button className="button" onClick={() => void loadWorkouts()} disabled={loading}>
          Load workouts
        </button>
      </section>

      <section className="card">
        <h2>Create workout</h2>
        <label className="field-label" htmlFor="title-input">
          Title
        </label>
        <input
          id="title-input"
          className="input"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Upper body day"
        />
        <label className="field-label" htmlFor="date-input">
          Date
        </label>
        <input
          id="date-input"
          className="input"
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          placeholder="YYYY-MM-DD"
        />
        <button
          className="button"
          disabled={loading || !newTitle.trim()}
          onClick={() => {
            void createWorkout(newTitle.trim(), newDate.trim());
            setNewTitle('');
          }}
        >
          Create
        </button>
      </section>

      <section className="card">
        <div className="row row-between">
          <h2>Workouts</h2>
          <button className="button ghost" onClick={() => void loadWorkouts()} disabled={loading}>
            Refresh
          </button>
        </div>
        {workouts.length === 0 ? <p className="muted">No workouts</p> : null}
        <ul className="list">
          {workouts.map((workout) => (
            <li key={workout.id} className="list-item">
              <div>
                <p className="item-title">{workout.title}</p>
                <p className="muted">{workout.workout_date}</p>
              </div>
              <button
                className="button danger"
                onClick={() => void deleteWorkout(workout.id)}
                disabled={loading}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </main>
  );
}
