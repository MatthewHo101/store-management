import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, Inbox, LoaderCircle, X } from 'lucide-react';

export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{value.replaceAll('_', ' ')}</span>;
}
export function Empty({
  title = 'Nothing here yet',
  text,
  action,
}: {
  title?: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your workspace…
    </div>
  );
}
export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export interface Column<T> {
  title: string;
  render: (row: T) => ReactNode;
}
export function Table<T extends { id: string }>({
  rows,
  columns,
  empty = 'Records will appear here when you add them.',
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
}) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.title}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function OpenButton({
  onClick,
  label = 'View details',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="icon-button" onClick={onClick} aria-label={label} title={label}>
      <ArrowUpRight size={17} />
    </button>
  );
}
export function Dialog({
  title,
  subtitle,
  close,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  close: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={close} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
