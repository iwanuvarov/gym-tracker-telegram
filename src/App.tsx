import { useEffect, useMemo, useState } from 'react';

import { useMiniAppStore } from './store/useMiniAppStore';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

type MainSection = 'workouts' | 'templates';

const runSafely = (promise: Promise<unknown>): void => {
  void promise.catch(() => undefined);
};

export default function App() {
  const {
    telegramUser,
    sessionUserId,
    workspaceId,
    workspaces,
    workspaceSelectionRequired,
    workouts,
    exercisesByWorkout,
    setsByExercise,
    exerciseSummaryById,
    templates,
    templateExercisesByTemplateId,
    loading,
    authLoading,
    email,
    otpCode,
    message,
    error,
    init,
    setEmail,
    setOtpCode,
    requestOtp,
    verifyOtp,
    signOut,
    refreshWorkspaces,
    selectWorkspace,
    loadWorkouts,
    createWorkout,
    renameWorkout,
    deleteWorkout,
    loadExercises,
    createExercise,
    deleteExercise,
    loadSets,
    createSet,
    deleteSet,
    loadTemplates,
    createTemplate,
    renameTemplate,
    deleteTemplate,
    loadTemplateExercises,
    addTemplateExercise,
    deleteTemplateExercise,
    createWorkoutFromTemplate,
  } = useMiniAppStore();

  const [section, setSection] = useState<MainSection>('workouts');
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const [newWorkoutTitle, setNewWorkoutTitle] = useState('');
  const [newWorkoutDate, setNewWorkoutDate] = useState(todayIso);

  const [editWorkoutTitle, setEditWorkoutTitle] = useState('');
  const [editWorkoutDate, setEditWorkoutDate] = useState(todayIso);
  const [newExerciseName, setNewExerciseName] = useState('');

  const [setRepsInput, setSetRepsInput] = useState('10');
  const [setWeightInput, setSetWeightInput] = useState('60');
  const [setNoteInput, setSetNoteInput] = useState('');

  const [newTemplateName, setNewTemplateName] = useState('');
  const [editTemplateName, setEditTemplateName] = useState('');
  const [newTemplateExerciseName, setNewTemplateExerciseName] = useState('');
  const [templateWorkoutDate, setTemplateWorkoutDate] = useState(todayIso);
  const [templateWorkoutTitle, setTemplateWorkoutTitle] = useState('');

  useEffect(() => {
    runSafely(init());
  }, [init]);

  useEffect(() => {
    setActiveWorkoutId(null);
    setActiveExerciseId(null);
    setActiveTemplateId(null);
  }, [workspaceId]);

  const telegramLabel = useMemo(() => {
    if (!telegramUser) {
      return 'вне Telegram-контекста';
    }

    return (
      [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(' ').trim() ||
      telegramUser.username ||
      `id:${telegramUser.id}`
    );
  }, [telegramUser]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaces, workspaceId],
  );

  const activeWorkout = useMemo(
    () => workouts.find((workout) => workout.id === activeWorkoutId) ?? null,
    [workouts, activeWorkoutId],
  );

  useEffect(() => {
    if (!activeWorkout) {
      return;
    }

    setEditWorkoutTitle(activeWorkout.title);
    setEditWorkoutDate(activeWorkout.workout_date);
  }, [activeWorkout]);

  const activeExercises = useMemo(
    () => (activeWorkoutId ? exercisesByWorkout[activeWorkoutId] ?? [] : []),
    [activeWorkoutId, exercisesByWorkout],
  );

  const activeExercise = useMemo(
    () => activeExercises.find((exercise) => exercise.id === activeExerciseId) ?? null,
    [activeExercises, activeExerciseId],
  );

  const activeSets = useMemo(
    () => (activeExerciseId ? setsByExercise[activeExerciseId] ?? [] : []),
    [activeExerciseId, setsByExercise],
  );

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }

    setEditTemplateName(activeTemplate.name);
    setTemplateWorkoutTitle(activeTemplate.name);
  }, [activeTemplate]);

  const activeTemplateExercises = useMemo(
    () => (activeTemplateId ? templateExercisesByTemplateId[activeTemplateId] ?? [] : []),
    [activeTemplateId, templateExercisesByTemplateId],
  );

  const canManageData = Boolean(sessionUserId && workspaceId);

  const openWorkout = (workoutId: string): void => {
    setSection('workouts');
    setActiveWorkoutId(workoutId);
    setActiveExerciseId(null);
    runSafely(loadExercises(workoutId));
  };

  const openExercise = (exerciseId: string): void => {
    if (!activeWorkoutId) {
      return;
    }

    setActiveExerciseId(exerciseId);
    runSafely(loadSets({ workoutId: activeWorkoutId, exerciseId }));
  };

  const openTemplate = (templateId: string): void => {
    setSection('templates');
    setActiveTemplateId(templateId);
    runSafely(loadTemplateExercises(templateId));
  };

  return (
    <main className="app-shell">
      <header className="card">
        <p className="eyebrow">Gym Tracker</p>
        <h1>Telegram Mini App</h1>
        <p className="muted">Пользователь Telegram: {telegramLabel}</p>
        <p className="muted">Сессия Supabase: {sessionUserId ?? 'нет'}</p>
      </header>

      <section className="card">
        <h2>Вход (OTP fallback)</h2>
        <p className="muted">
          Пока Telegram auth bridge не подключен, используйте вход по email-коду.
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
        <div className="row wrap">
          <button className="button ghost" onClick={() => runSafely(requestOtp())} disabled={authLoading}>
            Отправить код
          </button>
          <button className="button ghost" onClick={() => runSafely(signOut())} disabled={authLoading}>
            Выйти
          </button>
        </div>
        <label className="field-label" htmlFor="otp-input">
          Код
        </label>
        <input
          id="otp-input"
          className="input"
          value={otpCode}
          onChange={(event) => setOtpCode(event.target.value)}
          placeholder="123456"
        />
        <button className="button" onClick={() => runSafely(verifyOtp())} disabled={authLoading}>
          Подтвердить код
        </button>
      </section>

      <section className="card">
        <div className="row row-between">
          <h2>Пространства</h2>
          <button
            className="button ghost"
            onClick={() => runSafely(refreshWorkspaces())}
            disabled={loading || !sessionUserId}
          >
            Обновить
          </button>
        </div>

        {!sessionUserId ? <p className="muted">Сначала выполните вход.</p> : null}

        {workspaceSelectionRequired ? (
          <p className="notice info">Выберите пространство, с которым хотите работать.</p>
        ) : null}

        {sessionUserId && workspaces.length === 0 ? (
          <p className="muted">Пространства не найдены. При первом входе оно создается автоматически.</p>
        ) : null}

        <ul className="workspace-grid">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === workspaceId;

            return (
              <li key={workspace.id}>
                <button
                  className={`workspace-button ${isActive ? 'active' : ''}`}
                  onClick={() => runSafely(selectWorkspace(workspace.id))}
                  disabled={loading}
                >
                  <span className="workspace-name">{workspace.name}</span>
                  <span className="workspace-meta">{workspace.id}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="muted">
          Активное пространство: {activeWorkspace?.name ?? 'не выбрано'}
          {activeWorkspace ? ` (${activeWorkspace.id})` : ''}
        </p>
      </section>

      {canManageData ? (
        <section className="card">
          <div className="section-nav">
            <button
              className={`nav-button ${section === 'workouts' ? 'active' : ''}`}
              onClick={() => {
                setSection('workouts');
                setActiveTemplateId(null);
              }}
            >
              Тренировки
            </button>
            <button
              className={`nav-button ${section === 'templates' ? 'active' : ''}`}
              onClick={() => {
                setSection('templates');
                setActiveWorkoutId(null);
                setActiveExerciseId(null);
                runSafely(loadTemplates());
              }}
            >
              Шаблоны
            </button>
          </div>
        </section>
      ) : null}

      {section === 'workouts' ? (
        activeExerciseId && activeWorkout && activeExercise ? (
          <section className="card">
            <div className="stack-header">
              <button
                className="button ghost"
                onClick={() => {
                  setActiveExerciseId(null);
                }}
              >
                ← Назад к упражнениям
              </button>
              <h2>{activeExercise.name}</h2>
              <p className="muted">Тренировка: {activeWorkout.title}</p>
            </div>

            <label className="field-label" htmlFor="set-reps-input">
              Повторения
            </label>
            <input
              id="set-reps-input"
              className="input"
              value={setRepsInput}
              onChange={(event) => setSetRepsInput(event.target.value)}
              placeholder="10"
            />

            <label className="field-label" htmlFor="set-weight-input">
              Вес
            </label>
            <input
              id="set-weight-input"
              className="input"
              value={setWeightInput}
              onChange={(event) => setSetWeightInput(event.target.value)}
              placeholder="60"
            />

            <label className="field-label" htmlFor="set-note-input">
              Комментарий (опционально)
            </label>
            <input
              id="set-note-input"
              className="input"
              value={setNoteInput}
              onChange={(event) => setSetNoteInput(event.target.value)}
              placeholder="RPE, темп, техника"
            />

            <button
              className="button"
              disabled={loading}
              onClick={() => {
                const reps = Number(setRepsInput);
                const weight = Number(setWeightInput);
                runSafely(
                  createSet({
                    workoutId: activeWorkout.id,
                    exerciseId: activeExercise.id,
                    reps,
                    weight,
                    note: setNoteInput,
                  }).then(() => {
                    setSetNoteInput('');
                  }),
                );
              }}
            >
              Добавить подход
            </button>

            <div className="row row-between">
              <h3>Подходы</h3>
              <button
                className="button ghost"
                onClick={() => runSafely(loadSets({ workoutId: activeWorkout.id, exerciseId: activeExercise.id }))}
                disabled={loading}
              >
                Обновить
              </button>
            </div>

            {activeSets.length === 0 ? <p className="muted">Подходов пока нет.</p> : null}

            <ul className="list">
              {activeSets.map((setRow, index) => (
                <li key={setRow.id} className="list-item">
                  <div className="list-item-main">
                    <p className="item-title">Подход {index + 1}</p>
                    <p className="item-subtitle">
                      {setRow.weight} x {setRow.reps}
                    </p>
                    {setRow.note ? <p className="muted">{setRow.note}</p> : null}
                  </div>
                  <button
                    className="button danger"
                    onClick={() =>
                      runSafely(
                        deleteSet({
                          workoutId: activeWorkout.id,
                          exerciseId: activeExercise.id,
                          setId: setRow.id,
                        }),
                      )
                    }
                    disabled={loading}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : activeWorkout ? (
          <section className="card">
            <div className="stack-header">
              <button
                className="button ghost"
                onClick={() => {
                  setActiveWorkoutId(null);
                  setActiveExerciseId(null);
                }}
              >
                ← Назад к тренировкам
              </button>
              <h2>{activeWorkout.title}</h2>
              <p className="muted">{activeWorkout.workout_date}</p>
            </div>

            <label className="field-label" htmlFor="edit-workout-title">
              Название тренировки
            </label>
            <input
              id="edit-workout-title"
              className="input"
              value={editWorkoutTitle}
              onChange={(event) => setEditWorkoutTitle(event.target.value)}
              placeholder="Верх тела"
            />

            <label className="field-label" htmlFor="edit-workout-date">
              Дата
            </label>
            <input
              id="edit-workout-date"
              className="input"
              value={editWorkoutDate}
              onChange={(event) => setEditWorkoutDate(event.target.value)}
              placeholder="YYYY-MM-DD"
            />

            <div className="row wrap">
              <button
                className="button"
                disabled={loading}
                onClick={() =>
                  runSafely(
                    renameWorkout({
                      workoutId: activeWorkout.id,
                      title: editWorkoutTitle,
                      workoutDate: editWorkoutDate,
                    }),
                  )
                }
              >
                Сохранить тренировку
              </button>
              <button
                className="button ghost"
                onClick={() => runSafely(loadExercises(activeWorkout.id))}
                disabled={loading}
              >
                Обновить упражнения
              </button>
            </div>

            <label className="field-label" htmlFor="new-exercise-input">
              Новое упражнение
            </label>
            <input
              id="new-exercise-input"
              className="input"
              value={newExerciseName}
              onChange={(event) => setNewExerciseName(event.target.value)}
              placeholder="Жим лежа"
            />
            <button
              className="button"
              disabled={loading || !newExerciseName.trim()}
              onClick={() =>
                runSafely(
                  createExercise({
                    workoutId: activeWorkout.id,
                    name: newExerciseName,
                  }).then(() => {
                    setNewExerciseName('');
                  }),
                )
              }
            >
              Добавить упражнение
            </button>

            {activeExercises.length === 0 ? <p className="muted">Упражнений пока нет.</p> : null}

            <ul className="list">
              {activeExercises.map((exercise) => (
                <li key={exercise.id} className="list-item">
                  <div className="list-item-main">
                    <p className="item-title">{exercise.name}</p>
                    <p className="item-subtitle">
                      {exerciseSummaryById[exercise.id] ?? 'Нет подходов'}
                    </p>
                  </div>
                  <div className="row wrap">
                    <button className="button ghost" onClick={() => openExercise(exercise.id)}>
                      Открыть
                    </button>
                    <button
                      className="button danger"
                      onClick={() =>
                        runSafely(
                          deleteExercise({
                            workoutId: activeWorkout.id,
                            exerciseId: exercise.id,
                          }),
                        )
                      }
                      disabled={loading}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>Создать тренировку</h2>

              <label className="field-label" htmlFor="new-workout-title-input">
                Название
              </label>
              <input
                id="new-workout-title-input"
                className="input"
                value={newWorkoutTitle}
                onChange={(event) => setNewWorkoutTitle(event.target.value)}
                placeholder="Верх тела"
              />

              <label className="field-label" htmlFor="new-workout-date-input">
                Дата
              </label>
              <input
                id="new-workout-date-input"
                className="input"
                value={newWorkoutDate}
                onChange={(event) => setNewWorkoutDate(event.target.value)}
                placeholder="YYYY-MM-DD"
              />

              <button
                className="button"
                disabled={loading || !newWorkoutTitle.trim() || !canManageData}
                onClick={() =>
                  runSafely(
                    createWorkout(newWorkoutTitle, newWorkoutDate).then(() => {
                      setNewWorkoutTitle('');
                    }),
                  )
                }
              >
                Создать
              </button>
            </section>

            <section className="card">
              <div className="row row-between">
                <h2>Тренировки</h2>
                <button
                  className="button ghost"
                  onClick={() => runSafely(loadWorkouts())}
                  disabled={loading || !canManageData}
                >
                  Обновить
                </button>
              </div>

              {!canManageData ? (
                <p className="muted">Выберите пространство, чтобы увидеть тренировки.</p>
              ) : null}
              {canManageData && workouts.length === 0 ? <p className="muted">Тренировок пока нет.</p> : null}

              <ul className="list">
                {workouts.map((workout) => (
                  <li key={workout.id} className="list-item">
                    <div className="list-item-main">
                      <p className="item-title">{workout.title}</p>
                      <p className="item-subtitle">{workout.workout_date}</p>
                    </div>
                    <div className="row wrap">
                      <button className="button ghost" onClick={() => openWorkout(workout.id)}>
                        Открыть
                      </button>
                      <button
                        className="button danger"
                        onClick={() => runSafely(deleteWorkout(workout.id))}
                        disabled={loading}
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )
      ) : activeTemplate ? (
        <section className="card">
          <div className="stack-header">
            <button
              className="button ghost"
              onClick={() => {
                setActiveTemplateId(null);
              }}
            >
              ← Назад к шаблонам
            </button>
            <h2>{activeTemplate.name}</h2>
            <p className="muted">Редактирование шаблона</p>
          </div>

          <label className="field-label" htmlFor="edit-template-name-input">
            Название шаблона
          </label>
          <input
            id="edit-template-name-input"
            className="input"
            value={editTemplateName}
            onChange={(event) => setEditTemplateName(event.target.value)}
            placeholder="Ноги"
          />
          <button
            className="button"
            disabled={loading || !editTemplateName.trim()}
            onClick={() =>
              runSafely(
                renameTemplate({
                  templateId: activeTemplate.id,
                  name: editTemplateName,
                }),
              )
            }
          >
            Переименовать шаблон
          </button>

          <label className="field-label" htmlFor="template-workout-date-input">
            Дата тренировки по шаблону
          </label>
          <input
            id="template-workout-date-input"
            className="input"
            value={templateWorkoutDate}
            onChange={(event) => setTemplateWorkoutDate(event.target.value)}
            placeholder="YYYY-MM-DD"
          />

          <label className="field-label" htmlFor="template-workout-title-input">
            Название тренировки (опционально)
          </label>
          <input
            id="template-workout-title-input"
            className="input"
            value={templateWorkoutTitle}
            onChange={(event) => setTemplateWorkoutTitle(event.target.value)}
            placeholder="Оставьте пустым для названия шаблона"
          />

          <button
            className="button"
            disabled={loading}
            onClick={() =>
              runSafely(
                createWorkoutFromTemplate({
                  templateId: activeTemplate.id,
                  workoutDate: templateWorkoutDate,
                  titleOverride: templateWorkoutTitle,
                }).then((createdWorkout) => {
                  setSection('workouts');
                  setActiveTemplateId(null);
                  setActiveWorkoutId(createdWorkout.id);
                  setActiveExerciseId(null);
                  return loadExercises(createdWorkout.id);
                }),
              )
            }
          >
            Создать тренировку из шаблона
          </button>

          <div className="row row-between">
            <h3>Упражнения шаблона</h3>
            <button
              className="button ghost"
              onClick={() => runSafely(loadTemplateExercises(activeTemplate.id))}
              disabled={loading}
            >
              Обновить
            </button>
          </div>

          <label className="field-label" htmlFor="new-template-exercise-input">
            Новое упражнение
          </label>
          <input
            id="new-template-exercise-input"
            className="input"
            value={newTemplateExerciseName}
            onChange={(event) => setNewTemplateExerciseName(event.target.value)}
            placeholder="Присед"
          />
          <button
            className="button"
            disabled={loading || !newTemplateExerciseName.trim()}
            onClick={() =>
              runSafely(
                addTemplateExercise({
                  templateId: activeTemplate.id,
                  name: newTemplateExerciseName,
                }).then(() => {
                  setNewTemplateExerciseName('');
                }),
              )
            }
          >
            Добавить упражнение в шаблон
          </button>

          {activeTemplateExercises.length === 0 ? (
            <p className="muted">В этом шаблоне пока нет упражнений.</p>
          ) : null}

          <ul className="list">
            {activeTemplateExercises.map((templateExercise) => (
              <li key={templateExercise.id} className="list-item">
                <div className="list-item-main">
                  <p className="item-title">{templateExercise.name}</p>
                  <p className="item-subtitle">Порядок: {templateExercise.sort_order + 1}</p>
                </div>
                <button
                  className="button danger"
                  onClick={() =>
                    runSafely(
                      deleteTemplateExercise({
                        templateId: activeTemplate.id,
                        templateExerciseId: templateExercise.id,
                      }),
                    )
                  }
                  disabled={loading}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Создать шаблон</h2>
            <label className="field-label" htmlFor="new-template-name-input">
              Название шаблона
            </label>
            <input
              id="new-template-name-input"
              className="input"
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              placeholder="Ноги"
            />
            <button
              className="button"
              disabled={loading || !newTemplateName.trim()}
              onClick={() =>
                runSafely(
                  createTemplate(newTemplateName).then(() => {
                    setNewTemplateName('');
                  }),
                )
              }
            >
              Создать шаблон
            </button>
          </section>

          <section className="card">
            <div className="row row-between">
              <h2>Шаблоны тренировок</h2>
              <button className="button ghost" onClick={() => runSafely(loadTemplates())} disabled={loading}>
                Обновить
              </button>
            </div>

            {templates.length === 0 ? <p className="muted">Шаблонов пока нет.</p> : null}

            <ul className="list">
              {templates.map((template) => (
                <li key={template.id} className="list-item">
                  <div className="list-item-main">
                    <p className="item-title">{template.name}</p>
                    <p className="item-subtitle">Создан: {template.created_at.slice(0, 10)}</p>
                  </div>
                  <div className="row wrap">
                    <button className="button ghost" onClick={() => openTemplate(template.id)}>
                      Открыть
                    </button>
                    <button
                      className="button danger"
                      onClick={() => runSafely(deleteTemplate(template.id))}
                      disabled={loading}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </main>
  );
}
