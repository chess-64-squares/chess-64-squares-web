import type { FormEvent } from 'react'
import { AuthPanel } from '../component/AuthPanel'

export function LoginPage({ authBusy, onLogin }: { authBusy: boolean; onLogin: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <AuthPanel title="Welcome back" caption="Sign in to find a match and continue your run.">
      <form className="form" onSubmit={onLogin}>
        <label>
          Username or email
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="button primary" disabled={authBusy}>
          {authBusy ? 'Working...' : 'Sign in'}
        </button>
      </form>
    </AuthPanel>
  )
}
