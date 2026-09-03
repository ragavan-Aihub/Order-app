import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4EEE3] p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[#d7e3c8] bg-[#FCFAF5] shadow-[0_20px_50px_rgba(27,77,46,0.12)] md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col items-center justify-center bg-[#1B4D2E] px-8 py-10 text-center text-[#FCFAF5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/farm2flavours-label.jpg"
            alt="Farm 2 Flavours"
            className="h-56 w-56 rounded-full border-[6px] border-[#C8A44A] object-cover shadow-lg md:h-72 md:w-72"
          />
          <p className="mt-6 text-sm tracking-wide text-[#D7E3C8]">Fresh &amp; Pure</p>
          <p className="mt-2 max-w-xs text-base text-[#FCFAF5]/90">
            Pure Nature. Pure Taste. Pure Trust.
          </p>
        </div>
        <div className="flex flex-col justify-center px-8 py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1B4D2E]">
            Business panel
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1B4D2E]">Welcome back</h1>
          <p className="mb-8 mt-2 text-stone-600">
            Sign in with the email and password shared by the developer.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
