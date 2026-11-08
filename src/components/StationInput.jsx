import { useEffect, useId, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { customerApi } from '../api.js';

/**
 * Station box with live search. Type a code (SBC), part of a name (KSR) or a city (Beng).
 *
 * Props
 *  value        text shown in the box
 *  onChange     (text) when the user types: the choice is cleared
 *  onSelect     (suggestion) when a suggestion is picked: { type, value, code, name, city, label }
 *  cities       show "City (all stations)" rows (search: yes, admin stops: no)
 *  onCreate     (text) if given, shows "Add … as a new station" at the end of the list
 *  error        message under the box (turns it red)
 */
export default function StationInput({
  label,
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder,
  error,
  size,
  cities = true,
  onCreate,
  inputClassName = '',
  labelClassName = '',
  hideLabel = false,
  ariaLabel,
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [failed, setFailed] = useState(false);
  const typed = useRef(false); // only search after the user types, not when a value is set from outside
  const reqId = useRef(0);
  const box = useRef(null);

  useEffect(() => {
    if (!typed.current) return;
    const q = (value || '').trim();
    if (!q) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const my = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await customerApi.stations(q);
        if (my !== reqId.current) return; // a newer search started
        const list = (res.data2 || []).filter((s) => cities || s.type !== 'CITY');
        setItems(list);
        setFailed(false);
        setActive(list.length ? 0 : -1);
      } catch {
        if (my === reqId.current) {
          setItems([]);
          setFailed(true);
        }
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value, cities]);

  const rows = [...items];
  const q = (value || '').trim();
  const canCreate = onCreate && q.length > 0 && !loading;
  const total = rows.length + (canCreate ? 1 : 0);

  const choose = (i) => {
    if (i < rows.length) {
      const s = rows[i];
      typed.current = false;
      onSelect?.(s);
    } else if (canCreate) {
      onCreate(q);
    }
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (total ? (a + 1) % total : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (total ? (a - 1 + total) % total : -1));
    } else if (e.key === 'Enter' && open && active >= 0 && active < total) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showMenu = open && q.length > 0 && (loading || total > 0 || failed || items.length === 0);

  return (
    <Form.Group className="field position-relative" ref={box}>
      {!hideLabel && (
        <Form.Label htmlFor={`${id}-in`} className={labelClassName}>
          {label}
        </Form.Label>
      )}
      <Form.Control
        id={`${id}-in`}
        type="text"
        size={size}
        className={inputClassName}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={hideLabel ? ariaLabel || label : undefined}
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showMenu && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? 'true' : undefined}
        isInvalid={!!error}
        onChange={(e) => {
          typed.current = true;
          setOpen(true);
          onChange?.(e.target.value);
        }}
        onFocus={() => q && typed.current && setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // let a click on a suggestion land first
          setTimeout(() => setOpen(false), 150);
          onBlur?.(e);
        }}
      />
      {error && (
        <div className="invalid-feedback d-block" role="alert">
          {error}
        </div>
      )}
      {showMenu && (
        <ul id={listId} role="listbox" className="dropdown-menu show w-100 shadow station-menu" aria-label={`${label || 'Station'} suggestions`}>
          {loading && rows.length === 0 && (
            <li className="dropdown-item-text small text-secondary d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" aria-hidden="true" /> Searching stations…
            </li>
          )}
          {!loading && failed && <li className="dropdown-item-text small text-danger">Couldn’t load stations. Keep typing to try again.</li>}
          {!loading && !failed && rows.length === 0 && !canCreate && (
            <li className="dropdown-item-text small text-secondary">No station matches “{q}”.</li>
          )}
          {rows.map((s, i) => (
            <li key={`${s.type}-${s.value}`} role="option" id={`${listId}-${i}`} aria-selected={active === i}>
              <button
                type="button"
                className={`dropdown-item d-flex align-items-center gap-2 ${active === i ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {s.type === 'CITY' ? (
                  <i className="bi bi-buildings station-icon" aria-hidden="true" />
                ) : s.code ? (
                  <span className="badge text-bg-primary station-code">{s.code}</span>
                ) : (
                  <i className="bi bi-geo-alt station-icon" aria-hidden="true" />
                )}
                <span className="text-truncate">
                  <span className="fw-semibold">{s.type === 'CITY' ? s.city : s.name}</span>
                  <small className="d-block text-truncate opacity-75">
                    {s.type === 'CITY' ? s.label.replace(s.city, '').replace(/[()]/g, '').trim() : s.city || 'Stop on an existing train'}
                  </small>
                </span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li role="option" id={`${listId}-${rows.length}`} aria-selected={active === rows.length}>
              {rows.length > 0 && <hr className="dropdown-divider" />}
              <button
                type="button"
                className={`dropdown-item text-primary ${active === rows.length ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(rows.length)}
                onClick={() => choose(rows.length)}
              >
                <i className="bi bi-plus-circle me-2" aria-hidden="true" />
                Add “{q}” as a new station
              </button>
            </li>
          )}
        </ul>
      )}
    </Form.Group>
  );
}
