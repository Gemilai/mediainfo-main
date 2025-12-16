import { Form, useActionState, useNavigation } from 'react-router';
import { motion } from 'motion/react';
import { Loader2, Lock, User } from 'lucide-react';
import type { Route } from './+types/login';
import { createUserSession } from '../services/session.server';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Login - MediaPeek' }];
};

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  // Load from Cloudflare Variables
  // If variables aren't set, default to admin/password for safety/testing
  const validUser = context.cloudflare.env.AUTH_USER || 'admin';
  const validPass = context.cloudflare.env.AUTH_PASS || 'password';

  if (username === validUser && password === validPass) {
    return createUserSession('/');
  }

  return { error: 'Invalid credentials' };
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-gray-100">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md p-6"
      >
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
          <div className="p-8">
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20"
              >
                <Lock className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
              <p className="mt-2 text-sm text-gray-400">
                Enter your credentials to access MediaPeek
              </p>
            </div>

            <Form method="post" className="space-y-5">
              <div className="space-y-1">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500/50 focus:bg-black/60 focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500/50 focus:bg-black/60 focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {actionData?.error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-center text-sm font-medium text-red-400"
                >
                  {actionData.error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full overflow-hidden rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition-transform active:scale-95 disabled:opacity-70"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </span>
                <div className="absolute inset-0 -z-0 bg-gradient-to-r from-blue-100 to-white opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </Form>
          </div>
          
          <div className="bg-black/20 p-4 text-center">
            <p className="text-xs text-gray-500">
              MediaPeek Protected Area
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
