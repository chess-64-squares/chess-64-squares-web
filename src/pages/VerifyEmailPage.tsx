import { AuthPanel } from '../component/AuthPanel'

export function VerifyEmailPage({
  state,
  message,
  onGoToLogin,
}: {
  state: 'pending' | 'success' | 'error'
  message: string
  onGoToLogin: () => void
}) {
  return (
    <AuthPanel title={state === 'success' ? 'Email verified' : state === 'error' ? 'Verification failed' : 'Verifying email'} caption={message}>
      <button className="button primary" onClick={onGoToLogin}>Go to sign in</button>
    </AuthPanel>
  )
}
