import type { NextConfig } from "next";

const desenvolvimento = process.env.NODE_ENV === "development";
const ANALYTICS = "https://*.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";
const dominioFotos = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ? ` ${new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).origin}` : "";

const politicaDeConteudo = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com${desenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // O Vercel Blob fica até as fotos antigas saírem de vez do banco (ehFotoDoSite, src/lib/fotos.ts).
  `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com${dominioFotos} ${ANALYTICS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${ANALYTICS}${desenvolvimento ? " ws:" : ""}`,
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(desenvolvimento ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const cabecalhosDeSeguranca = [
  { key: "Content-Security-Policy", value: politicaDeConteudo },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // pg carrega pg-cloudflare por require dinâmico; inclua a implementação
  // Workerd no trace do Next para o bundle OpenNext poder resolvê-la.
  outputFileTracingIncludes: {
    "**/*": ["./node_modules/pg-cloudflare/dist/**", "./node_modules/pg-cloudflare/esm/**"],
  },
  async headers() {
    return [{ source: "/:caminho*", headers: cabecalhosDeSeguranca }];
  },
  async redirects() {
    // O cadastro tem uma entrada só (/participar). A busca vai junto: ?instagram=<@>&dono=sim.
    return [{ source: "/indicar", destination: "/participar", permanent: false }];
  },
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Fotos chegam reduzidas pelo navegador, mas o padrão de 1 MB é apertado.
    serverActions: { bodySizeLimit: "4mb" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
