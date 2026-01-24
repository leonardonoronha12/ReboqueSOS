import Link from "next/link";

export function BrandLogo(props: { href?: string; size?: "sm" | "md"; tone?: "light" | "dark" }) {
  const href = props.href ?? "/";
  const size = props.size ?? "md";
  const tone = props.tone ?? "light";
  const height = size === "sm" ? 28 : 34;
  const icon = size === "sm" ? 24 : 28;
  const textColor = tone === "light" ? "text-brand-black" : "text-white";

  return (
    <Link className="inline-flex items-center gap-2" href={href} aria-label="ReboqueSOS">
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <path
          d="M12 38.5c0-1.7 1.3-3 3-3h19.6c1 0 1.9.5 2.4 1.4l4.7 8.1h7.3c1.7 0 3 1.3 3 3v2.5H12v-9z"
          fill="#FFC300"
        />
        <path
          d="M22 26c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v8H22v-8z"
          fill="#FFC300"
        />
        <path
          d="M46 28.5c0-.8.6-1.5 1.5-1.5h6c.8 0 1.5.7 1.5 1.5V33h-9v-4.5z"
          fill="#FFC300"
        />
        <path d="M45 33h13c1.7 0 3 1.3 3 3v2.5H45V33z" fill="#FFFFFF" opacity="0.14" />
        <path
          d="M50 20.5c0-1.4 1.1-2.5 2.5-2.5S55 19.1 55 20.5V22h-5v-1.5z"
          fill="#E10600"
        />
        <path
          d="M52.5 12c4.5 0 8.2 3.6 8.2 8.1 0 .7-.1 1.4-.3 2.1h-3.3c.3-.7.5-1.4.5-2.1 0-2.8-2.3-5-5.1-5s-5.1 2.2-5.1 5c0 .7.1 1.4.5 2.1h-3.3c-.2-.7-.3-1.4-.3-2.1 0-4.5 3.7-8.1 8.2-8.1z"
          fill="#E10600"
        />
        <path
          d="M20 52a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
          fill="#0B0B0D"
          stroke="#2A2A2E"
          strokeWidth="2"
        />
        <path
          d="M46 52a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
          fill="#0B0B0D"
          stroke="#2A2A2E"
          strokeWidth="2"
        />
        <path d="M20 48a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#FFFFFF" opacity="0.8" />
        <path d="M46 48a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#FFFFFF" opacity="0.8" />
        <path
          d="M43 26.5c.7 0 1.3.6 1.3 1.3v7.7c0 .7-.6 1.3-1.3 1.3H15.2c-.6 0-1.1-.3-1.3-.8l-3-7.7c-.3-.9.3-1.8 1.3-1.8H43z"
          fill="#FFFFFF"
          opacity="0.1"
        />
        <path
          d="M43 37h10.2c1.3 0 2.5-.5 3.5-1.4l2.6-2.3"
          stroke="#FFFFFF"
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div className="flex items-center" style={{ height }}>
        <span className={`text-xl font-extrabold tracking-tight ${textColor}`}>Reboque</span>
        <span className="text-xl font-extrabold tracking-tight text-brand-red">SOS</span>
        <span className="text-xl font-extrabold tracking-tight text-brand-red">+</span>
      </div>
    </Link>
  );
}
