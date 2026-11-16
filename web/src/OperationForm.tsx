import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { errorMessage, request } from './api.js';
import { Dialog, ErrorNotice } from './components.js';
import { s, type Field, type Operation, type Row, type Values } from './operations.js';

function initial(fields: Field[]): Values {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.type === 'repeat'
        ? Array.from({ length: f.initialRows ?? 1 }, () =>
            Object.fromEntries((f.children ?? []).map((c) => [c.name, c.value ?? ''])),
          )
        : (f.value ?? ''),
    ]),
  );
}
function Control({
  field,
  value,
  set,
  id,
}: {
  field: Field;
  value: string;
  set: (value: string) => void;
  id: string;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>
        {field.label}
        {field.optional && <small>Optional</small>}
      </span>
      {field.type === 'select' ? (
        <select
          id={id}
          required={!field.optional}
          value={value}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">Choose…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type ?? 'text'}
          required={!field.optional}
          value={value}
          min={field.min}
          step={field.step}
          maxLength={field.type === 'text' || !field.type ? 120 : undefined}
          onChange={(e) => set(e.target.value)}
        />
      )}
      {field.hint && <small className="field-hint">{field.hint}</small>}
    </label>
  );
}
export function OperationForm({
  operation,
  close,
  saved,
}: {
  operation: Operation;
  close: () => void;
  saved: (message: string) => void;
}) {
  const [values, setValues] = useState<Values>(() => initial(operation.fields));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const lock = useRef(false);
  function set(name: string, value: string | Row[]) {
    setValues((v) => ({ ...v, [name]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await request(operation.endpoint, { body: operation.body(values, key.current) });
      saved(`${operation.title} completed.`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={operation.title}
      subtitle={operation.description}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="operation-form"
      >
        {error && <ErrorNotice message={error} />}
        {operation.fields.map((field) =>
          field.type === 'repeat' ? (
            <fieldset className="repeat-field" key={field.name}>
              <legend>{field.label}</legend>
              {(values[field.name] as Row[]).map((row, index) => (
                <div className="repeat-row" key={index}>
                  {field.children?.map((child) => (
                    <Control
                      key={child.name}
                      field={child}
                      value={row[child.name] ?? ''}
                      id={`${field.name}-${index}-${child.name}`}
                      set={(value) =>
                        set(
                          field.name,
                          (values[field.name] as Row[]).map((r, i) =>
                            i === index ? { ...r, [child.name]: value } : r,
                          ),
                        )
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="icon-button remove-row"
                    aria-label={`Remove ${field.label.toLowerCase()} row ${index + 1}`}
                    disabled={(values[field.name] as Row[]).length === 1 || busy}
                    onClick={() =>
                      set(
                        field.name,
                        (values[field.name] as Row[]).filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  set(field.name, [
                    ...(values[field.name] as Row[]),
                    Object.fromEntries((field.children ?? []).map((f) => [f.name, f.value ?? ''])),
                  ])
                }
              >
                <Plus size={15} /> Add row
              </button>
            </fieldset>
          ) : (
            <Control
              key={field.name}
              field={field}
              value={s(values, field.name)}
              set={(value) => set(field.name, value)}
              id={`field-${field.name}`}
            />
          ),
        )}
        <div className="form-footer">
          <button className="button secondary" type="button" disabled={busy} onClick={close}>
            Back
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {busy ? 'Saving…' : (operation.submit ?? 'Save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
