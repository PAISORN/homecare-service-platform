import type { AdminDashboardScaffold } from '@/data/admin-dashboard-scaffold';
import type { AdminDashboardCopy } from '@/locales/th';

export function AdminDashboard({
  copy,
  model,
}: Readonly<{
  copy: AdminDashboardCopy;
  model: AdminDashboardScaffold;
}>) {
  const reviewQueue = copy.reviewQueue[model.reviewQueueStatus];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.brand}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.description}</p>
        </div>
        <span className="environment-badge">{copy.environmentLabel}</span>
      </header>

      <section aria-labelledby="readiness-title">
        <div className="section-heading">
          <div>
            <h2 id="readiness-title">{copy.readinessTitle}</h2>
            <p>{copy.readinessDescription}</p>
          </div>
          <button type="button">{copy.reviewCatalogAction}</button>
        </div>

        <div className="readiness-grid">
          {model.readinessItems.map((item) => (
            <article className="readiness-card" key={item.id}>
              <p>{copy.readinessLabels[item.id]}</p>
              <strong>{copy.readinessValues[item.value]}</strong>
              <span>{copy.readinessStatuses[item.status]}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="empty-state" aria-labelledby="queue-title">
        <p className="empty-kicker">{copy.reviewQueueLabel}</p>
        <h2 id="queue-title">{reviewQueue.title}</h2>
        <p>{reviewQueue.description}</p>
      </section>
    </main>
  );
}
