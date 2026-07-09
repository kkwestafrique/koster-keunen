import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ebf6ff]" data-testid="login-page">
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-[5px] overflow-hidden shadow-xl">
        <div className="hidden md:flex flex-col justify-center items-center bg-[#0f48aa] p-12 text-white">
          <div className="h-16 w-16 rounded-md bg-white flex items-center justify-center text-[#0f48aa] font-black text-2xl mb-6">
            B
          </div>
          <h1 className="text-3xl font-black mb-3 text-center">BeezTrace</h1>
          <p className="text-center text-white/80 text-sm">
            Supply chain traceability for beeswax and honey — connecting beekeepers, aggregators
            and buyers.
          </p>
        </div>

        <div className="bg-white p-10 flex flex-col justify-center">
          <h2 className="text-2xl font-black text-[#032b71] mb-1">Welcome back</h2>
          <p className="text-sm text-[#7089b4] mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[#032b71]">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border-[#cfd8e6] focus-visible:ring-[#0f48aa]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-[#032b71]">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-[#cfd8e6] focus-visible:ring-[#0f48aa]"
              />
            </div>

            {error && (
              <p className="text-sm text-[#ba550c]" data-testid="login-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="bg-[#0f48aa] hover:bg-[#0d3d91] text-white mt-2"
            >
              {loading ? 'Signing in...' : 'Log In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
