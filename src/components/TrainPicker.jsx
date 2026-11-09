import { useEffect, useId, useRef, useState } from 'react';
import { adminApi } from '../api.js';
import { useSession } from '../session.jsx';

/**
 * Pick a train by typing its number or name. Searches the server as you type (there can be
 * thousands of trains), so the page never loads every train.
 * value: the chosen train number as a string; onChange(number, train)
 */
export default function TrainPicker({ label = 'Train', value, onChange, autoPickFirst = true }) {
  const { session } = useSession();
  const id = useId();
  const [text, setText] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [total, setTotal] = useState(null);
  const timer = useRef(null);
  const first = useRef(true);

  const search = (q) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await adminApi.trains(session.token, q, 12, true);
        const list = (res.data2 || []).filter((t) => t && typeof t === 'object');
        setOptions(list);
        setTotal(Number(res.data) || list.length);
        setActive(-1);
        if (first.current && autoPickFirst && !value && list[0]) {
          choose(list[0]);
        }
        first.current = false;
      } catch {
        setOptions([]);
      }
    }, q ? 250 : 0);
  };

  useEffect(() => {
    search('');
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (t) => {
    setText(`${t.trainNumber} ${t.trainName}`);
    setOpen(false);
    onChange(String(t.trainNumber), t);
  };

  const keyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) setOpen(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && open && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="mb-0 position-relative">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="form-control"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        maxLength={60}
        placeholder="Train number or name"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          search(e.target.value.trim());
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={keyDown}
      />
      {open && (
        <ul className="train-picker list-unstyled" id={`${id}-list`} role="listbox">
          {options.length === 0 ? (
            <li className="text-secondary small px-3 py-2">No train matches.</li>
          ) : (
            options.map((t, i) => (
              <li
                key={t.trainNumber}
                id={`${id}-${i}`}
                role="option"
                aria-selected={String(t.trainNumber) === value}
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(t);
                }}
              >
                <strong>{t.trainNumber}</strong> {t.trainName}
                <span className="d-block small text-secondary">
                  {t.sourceStation} to {t.destinationStation}
                </span>
              </li>
            ))
          )}
          {total > options.length && <li className="text-secondary small px-3 py-2">Showing {options.length} of {total}. Keep typing to narrow it down.</li>}
        </ul>
      )}
    </div>
  );
}
