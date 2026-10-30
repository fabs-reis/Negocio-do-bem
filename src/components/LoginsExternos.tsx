import { useId } from "react";

/** Prévia visual dos provedores solicitados. Nenhuma autenticação está ativa. */
export function LoginsExternos() {
  const id = useId();
  return <section className="logins-externos" aria-label="Outras formas de acesso, em breve">
    <p className="logins-divisor"><span>Outras formas de entrar</span></p>
    <div className="logins-provedores">
      <button type="button" disabled aria-label="Google, em breve" title="Google: em breve" className="login-provedor provedor-google">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z" />
          <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59c.79-2.37 3-4.13 5.6-4.13Z" />
        </svg>
      </button>
      <button type="button" disabled aria-label="Facebook, em breve" title="Facebook: em breve" className="login-provedor provedor-facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 22v-9h3l.5-3.5H14V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.4A24 24 0 0 0 15 2c-2.8 0-4.7 1.7-4.7 4.9v2.6H7V13h3.3v9Z" /></svg>
      </button>
      <button type="button" disabled aria-label="Instagram, em breve" title="Instagram: em breve" className="login-provedor provedor-instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#ffdc80" /><stop offset=".45" stopColor="#f56040" /><stop offset="1" stopColor="#833ab4" /></linearGradient></defs><rect width="24" height="24" rx="7" fill={`url(#${id})`} /><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="white" strokeWidth="1.7" /><circle cx="12" cy="12" r="3.4" fill="none" stroke="white" strokeWidth="1.7" /><circle cx="16.7" cy="7.5" r="1" fill="white" /></svg>
      </button>
      <button type="button" disabled aria-label="gov.br, em breve, sujeito à autorização" title="gov.br: sujeito à autorização" className="login-provedor provedor-gov"><span aria-hidden="true">gov.br</span></button>
    </div>
    <p className="logins-em-breve">Em breve. Por enquanto, entre com e-mail e senha ou use o link por e-mail.</p>
  </section>;
}
