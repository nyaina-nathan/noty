"use client";

import { useState, type FormEvent, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { postJson, type ApiFailure } from "@/lib/api/client";
import type { PublicUser } from "@/types/auth.types";

const DASHBOARD_PATH = "/dashboard";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "login" | "register";
type FieldName = "identifier" | "username" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;
type Values = Record<FieldName, string>;

const EMPTY_VALUES: Values = {
  identifier: "",
  username: "",
  email: "",
  password: "",
};

const FIELD_ORDER: readonly FieldName[] = [
  "username",
  "identifier",
  "email",
  "password",
];

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors aria-invalid:border-danger";

function validate(mode: Mode, values: Values): FieldErrors {
  const errors: FieldErrors = {};

  if (mode === "login") {
    if (!values.identifier.trim()) {
      errors.identifier = "Enter your username or email.";
    }
  } else {
    if (!values.username.trim()) {
      errors.username = "Enter a username.";
    }

    if (!values.email.trim()) {
      errors.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(values.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
  }

  if (!values.password) {
    errors.password = "Enter your password.";
  } else if (mode === "register" && values.password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }

  return errors;
}

function friendlyMessage(failure: ApiFailure): string {
  switch (failure.code) {
    case "INVALID_CREDENTIALS":
      return "That username or password doesn’t match. Try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a moment, then try again.";
    default:
      return failure.message;
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const nextErrors = validate(mode, values);
    const firstError = FIELD_ORDER.find((field) => nextErrors[field]);

    if (firstError) {
      setErrors(nextErrors);
      setFormError(null);
      document.getElementById(`${mode}-${firstError}`)?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegister
      ? {
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        }
      : {
          identifier: values.identifier.trim(),
          password: values.password,
        };

    const result = await postJson<PublicUser>(endpoint, payload, {
      allowRefresh: false,
    });

    if (!result.ok) {
      const fieldErrors: FieldErrors = {};

      for (const detail of result.details) {
        if (
          detail.field &&
          FIELD_ORDER.includes(detail.field as FieldName) &&
          !fieldErrors[detail.field as FieldName]
        ) {
          fieldErrors[detail.field as FieldName] = detail.message;
        }
      }

      setErrors(fieldErrors);

      if (Object.keys(fieldErrors).length === 0) {
        setFormError(friendlyMessage(result));
      }

      setSubmitting(false);
      return;
    }

    router.replace(DASHBOARD_PATH);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="space-y-5">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm leading-6 text-danger-strong"
        >
          {formError}
        </div>
      ) : null}

      {isRegister ? (
        <div>
          <label
            htmlFor="register-username"
            className="block text-sm font-medium text-ink"
          >
            Username
          </label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={(event) => updateField("username", event.target.value)}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={
              errors.username ? "register-username-error" : undefined
            }
            className={inputClass}
          />
          {errors.username ? (
            <p id="register-username-error" className="mt-1.5 text-sm text-danger-strong">
              {errors.username}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <label
            htmlFor="login-identifier"
            className="block text-sm font-medium text-ink"
          >
            Username or email
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.identifier}
            onChange={(event) => updateField("identifier", event.target.value)}
            aria-invalid={errors.identifier ? true : undefined}
            aria-describedby={
              errors.identifier ? "login-identifier-error" : undefined
            }
            className={inputClass}
          />
          {errors.identifier ? (
            <p
              id="login-identifier-error"
              className="mt-1.5 text-sm text-danger-strong"
            >
              {errors.identifier}
            </p>
          ) : null}
        </div>
      )}

      {isRegister ? (
        <div>
          <label
            htmlFor="register-email"
            className="block text-sm font-medium text-ink"
          >
            Email
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            className={inputClass}
          />
          {errors.email ? (
            <p id="register-email-error" className="mt-1.5 text-sm text-danger-strong">
              {errors.email}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={`${mode}-password`}
          className="block text-sm font-medium text-ink"
        >
          Password
        </label>
        <div className="relative">
          <input
            id={`${mode}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password
                ? `${mode}-password-error`
                : isRegister
                  ? "register-password-hint"
                  : undefined
            }
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted transition-colors hover:text-ink"
          >
            {showPassword ? (
              <EyeOffIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p id={`${mode}-password-error`} className="mt-1.5 text-sm text-danger-strong">
            {errors.password}
          </p>
        ) : isRegister ? (
          <p id="register-password-hint" className="mt-1.5 text-sm text-muted">
            At least 8 characters.
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full"
      >
        {submitting
          ? isRegister
            ? "Creating account…"
            : "Logging in…"
          : isRegister
            ? "Create account"
            : "Log in"}
      </button>
    </form>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function EyeIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function EyeOffIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m4 4 16 16" />
      <path d="M9.9 5.8A10.9 10.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-3 3.7" />
      <path d="M6.2 8.2A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5c1 0 2-.2 2.9-.5" />
      <path d="M10 10a3 3 0 0 0 4 4" />
    </svg>
  );
}
