export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true">
        <circle cx="16" cy="16" r="16" className="fill-coral" />
        <path
          d="M16 24.2c-.3 0-.6-.1-.8-.3C10.9 20.2 8 17.6 8 14.3 8 11.9 9.9 10 12.2 10c1.5 0 2.9.8 3.8 2 .9-1.2 2.3-2 3.8-2 2.3 0 4.2 1.9 4.2 4.3 0 3.3-2.9 5.9-7.2 9.6-.2.2-.5.3-.8.3Z"
          fill="#fff"
        />
        <path d="M16 12.2c.4-2.6 2-4.2 4.6-4.6-.3 2.5-1.9 4.1-4.6 4.6Z" fill="#fff" opacity=".85" />
      </svg>
      <span className="font-serif text-[1.15rem] font-semibold tracking-tight text-tinta sm:text-[1.35rem]">
        Negócio <span className="italic text-coral">do</span> Bem
      </span>
    </span>
  );
}
