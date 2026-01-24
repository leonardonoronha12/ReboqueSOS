"use client";

export function RequestCtaButton(props: { className?: string; children: React.ReactNode }) {
  return (
    <button
      className={props.className}
      type="button"
      onClick={() => {
        const el = document.getElementById("solicitar");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.dispatchEvent(new Event("reboquesos:open-request-sheet"));
      }}
    >
      {props.children}
    </button>
  );
}

