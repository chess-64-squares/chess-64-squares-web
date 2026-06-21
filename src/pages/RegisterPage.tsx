import type { FormEvent } from 'react'
import { AuthPanel } from '../component/AuthPanel'

export function RegisterPage({ authBusy, onRegister }: { authBusy: boolean; onRegister: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <AuthPanel title="Create account" caption="Join the board and start with the default Elo rating.">
      <form className="form" onSubmit={onRegister}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Username
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <button className="button primary" disabled={authBusy}>
          {authBusy ? 'Working...' : 'Register'}
        </button>
      </form>
    </AuthPanel>
  )
}
