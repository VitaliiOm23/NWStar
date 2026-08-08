import Link from "next/link";
import { signIn } from "./actions";

export const metadata = {
  title: "Owner Login",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">Owner operations</div>
        <h1>Secure login.</h1>
        <p className="section-copy">
          Authorized access only. Customer and vehicle information is protected by
          Supabase authentication and database policies.
        </p>

        {error ? <div className="form-error">{error}</div> : null}

        <form action={signIn} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>

        <Link className="auth-back" href="/">
          ← Return to public website
        </Link>
      </section>
    </main>
  );
}
