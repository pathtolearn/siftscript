import { useState } from 'react';
import { X, Mail, Lock, Loader2, BookOpen } from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../../lib/auth/supabase';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
  /** Optional message shown above the form, e.g. "Sign in to use AI features" */
  reason?: string;
}

type Mode = 'signin' | 'signup';

export function LoginModal({ onClose, onSuccess, reason }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onSuccess();
      } else {
        await signUpWithEmail(email, password);
        setSignupDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-8 py-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">VidSage</span>
          </div>

          {signupDone ? (
            <SignupConfirmation email={email} onClose={onClose} />
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </h2>

              {reason && (
                <p className="text-sm text-indigo-600 mb-4 bg-indigo-50 px-3 py-2 rounded-lg">
                  {reason}
                </p>
              )}

              {!reason && (
                <p className="text-sm text-gray-500 mb-4">
                  {mode === 'signin'
                    ? 'Welcome back to your research library.'
                    : 'Start building your YouTube knowledge base.'}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                      minLength={mode === 'signup' ? 8 : undefined}
                      required
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-4">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                  className="text-indigo-600 font-medium hover:underline"
                >
                  {mode === 'signin' ? 'Sign up free' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SignupConfirmation({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Mail className="w-7 h-7 text-green-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">Check your email</h3>
      <p className="text-sm text-gray-500 mb-6">
        We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
      </p>
      <button
        onClick={onClose}
        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
