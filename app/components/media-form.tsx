import { Input } from '@base-ui/react/input';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Search, Terminal, AlertCircle, ArrowRight, Copy, Check } from 'lucide-react';

import { analyzeMedia } from '../services/mediainfo';
import { FormatMenu } from './format-menu';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-black shadow-lg shadow-white/5 transition-all hover:bg-gray-200 hover:shadow-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
      ) : (
        <>
          <span>Analyze</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-400" />
          <span className="text-green-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function MediaForm() {
  const [realtimeStatus, setRealtimeStatus] = useState<string>('');
  const [format, setFormat] = useState<string>('text');

  const [state, formAction] = useActionState(
    async (_prevState: any, formData: FormData) => {
      const url = formData.get('url') as string;
      if (!url) return { error: 'Please enter a valid URL' };

      try {
        setRealtimeStatus('Initializing...');
        const result = await analyzeMedia(
          url,
          () => {}, 
          (status) => setRealtimeStatus(status),
          format,
        );
        return { result, error: null };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : 'Unknown error occurred',
          result: null,
        };
      }
    },
    { result: null, error: null },
  );

  return (
    <div className="w-full">
      <form action={formAction} className="relative z-20">
        <div className="relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#0A0A0A] p-2 shadow-2xl ring-1 ring-white/5 transition-all focus-within:ring-blue-500/50 sm:flex-row sm:items-center sm:gap-0 sm:pr-2">
          
          <div className="relative z-20 sm:border-r sm:border-white/10">
             <FormatMenu value={format} onChange={setFormat} />
          </div>

          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <Input
              name="url"
              type="url"
              placeholder="Paste media URL (e.g., https://example.com/video.mp4)"
              autoComplete="off"
              className="h-12 w-full bg-transparent pl-11 pr-4 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors"
            />
          </div>

          <div className="mt-2 sm:mt-0">
            <SubmitButton />
          </div>
        </div>
      </form>

      {/* Status Bar */}
      <AnimatePresence mode="wait">
        {(realtimeStatus || state.error) && !state.result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex justify-center overflow-hidden"
          >
            <div className={clsx(
              "flex items-center gap-3 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur-md",
              state.error 
                ? "border-red-500/20 bg-red-500/10 text-red-400" 
                : "border-blue-500/20 bg-blue-500/10 text-blue-400"
            )}>
              {state.error ? <AlertCircle className="h-3 w-3" /> : <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
              {state.error || realtimeStatus}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Terminal */}
      <AnimatePresence>
        {state.result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-[#0F0F0F] shadow-2xl"
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-white/5 bg-[#141414] px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#333]" />
                </div>
                <div className="h-4 w-[1px] bg-white/10" />
                <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 font-mono">
                  <Terminal className="h-3 w-3" />
                  <span>Output</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                  {format}
                </span>
                <div className="h-4 w-[1px] bg-white/10" />
                <CopyButton text={state.result} />
              </div>
            </div>

            {/* Terminal Body */}
            <div className="relative group bg-[#0A0A0A]">
               <pre className="max-h-[60vh] w-full overflow-auto p-6 text-[13px] font-mono leading-relaxed text-gray-300">
                {state.result}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
