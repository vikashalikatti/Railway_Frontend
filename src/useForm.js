import { useCallback, useRef, useState } from 'react';
import { check, focusFirstError } from './validate.js';

/**
 * Small form helper.
 *  - Fields are checked when you leave them, and again as you type once they've shown an error.
 *  - On submit every field is checked; the first bad one gets focus and nothing is sent.
 *
 * schema(values) returns { field: rule | [rules] } so rules can depend on other fields.
 */
export default function useForm(initial, schema) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({}); // from the backend; cleared when that field is edited
  const formRef = useRef(null);

  const validateField = useCallback(
    (name, nextValues) => {
      const s = schema(nextValues);
      if (!s[name]) return '';
      return check(nextValues, { [name]: s[name] })[name] || '';
    },
    [schema]
  );

  const setValue = useCallback(
    (name, value) => {
      setServerErrors((se) => (se[name] ? { ...se, [name]: '' } : se));
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // Re-check every field already looked at, so "repeat password" updates when the password changes
        const recheck = Object.keys(touched).filter((k) => touched[k]);
        if (recheck.length) {
          setErrors((e) => {
            const out = { ...e };
            recheck.forEach((k) => (out[k] = validateField(k, next)));
            return out;
          });
        }
        return next;
      });
    },
    [touched, validateField]
  );

  // native: true leaves out "error", for plain <input>/<textarea> elements
  const bind = (name, { transform, native } = {}) => ({
    name,
    value: values[name] ?? '',
    ...(native
      ? { 'aria-invalid': serverErrors[name] || errors[name] ? 'true' : undefined }
      : { error: serverErrors[name] || errors[name] }),
    onChange: (e) => {
      let v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
      if (transform) v = transform(v);
      setValue(name, v);
    },
    onBlur: () => {
      setTouched((t) => ({ ...t, [name]: true }));
      setErrors((e) => ({ ...e, [name]: validateField(name, values) }));
    },
  });

  const submit = (onValid) => (e) => {
    e?.preventDefault();
    const all = check(values, schema(values));
    setErrors(all);
    setTouched(Object.fromEntries(Object.keys(schema(values)).map((k) => [k, true])));
    if (Object.keys(all).length) {
      // wait for the error attributes to render, then focus the first bad field
      setTimeout(() => focusFirstError(formRef.current), 0);
      return;
    }
    onValid(values);
  };

  /** Put a backend error on a specific field */
  const setFieldError = (name, message) => {
    setServerErrors((e) => ({ ...e, [name]: message }));
    setTimeout(() => focusFirstError(formRef.current), 0);
  };

  const shownErrors = { ...errors };
  Object.entries(serverErrors).forEach(([k, v]) => v && (shownErrors[k] = v));

  return { values, setValues, setValue, errors: shownErrors, bind, submit, setFieldError, formRef };
}

/** Keep only digits, up to `max` characters */
export const digits = (max) => (v) => String(v).replace(/\D/g, '').slice(0, max);
