import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, TextInput } from "../components/ui/Field";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch {
      setError(t("auth.invalidCredentials"));
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900">
          {t("auth.heading", { appName: t("app.name") })}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t("auth.usernameLabel")} required>
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={submitting}
            />
          </Field>
          <Field label={t("auth.passwordLabel")} required error={error ?? undefined}>
            <TextInput
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            {t("auth.loginButton")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
