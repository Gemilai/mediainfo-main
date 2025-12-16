import type { MetaFunction } from 'react-router';
import { Form } from 'react-router'; // Import Form for the logout action
import { motion } from 'motion/react';
import { LogOut } from 'lucide-react'; // Import Icon
import { MediaForm } from '../components/media-form';
import { requireUserSession } from '../services/session.server';
import type { Route } from './+types/_index';

export const meta: MetaFunction = () => {
  return [{ title: 'MediaInfo' }];
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserSession(request);
  return null;
}

// Animation variants
const floatAnimation = {
  initial: { x: 0, y: 0 },
  animate: {
    x: [0, 30, -20, 0],
    y: [0, -50, 20, 0],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export default function Index() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-black font-sans text-gray-200">
      
      {/* --- LOGOUT BUTTON (Top Right) --- */}
      <div className="absolute right-6 top-6 z-50">
        <Form action="/logout" method="post">
          <button
            type="submit"
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-400 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
          >
            <span>Logout</span>
            <LogOut className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
          </button>
        </Form>
      </div>

      {/* --- BACKGROUND LAYER --- */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Moving Grid */}
        <motion.div 
          initial={{ backgroundPosition: '0px 0px' }}
          animate={{ backgroundPosition: '0px 100px' }}
          transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '100px 100px',
            maskImage: 'linear-gradient(to bottom, transparent, 10%, black 40%, transparent 95%)',
            transform: 'perspective(500px) rotateX(60deg) scale(2)'
          }}
        />

        {/* Floating Nebulas */}
        <motion.div
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          className="absolute -left-[10%] top-[10%] h-[600px] w-[600px] rounded-full bg-blue-900/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -50, 0],
            transition: { duration: 25, repeat: Infinity, ease: 'linear' },
          }}
          className="absolute -right-[10%] bottom-[10%] h-[500px] w-[500px] rounded-full bg-indigo-900/20 blur-[120px]"
        />
      </div>

      {/* --- CONTENT LAYER --- */}
      <main className="relative z-10 mt-24 flex w-full max-w-6xl flex-col px-6 pb-20">
        
        {/* Header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]"
          >
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>

          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="text-5xl font-bold tracking-tight text-white sm:text-6xl"
          >
            MediaInfo
          </motion.h1>

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-6 max-w-lg text-lg text-gray-400"
          >
            Professional media analysis tool. Paste a URL to extract technical metadata instantly.
          </motion.p>
        </div>

        {/* The Form */}
        <motion.div
           initial={{ y: 30, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 0.3, duration: 0.8 }}
        >
          <MediaForm />
        </motion.div>
      </main>
    </div>
  );
}
