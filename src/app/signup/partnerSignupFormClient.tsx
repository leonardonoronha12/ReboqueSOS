"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type SelectedImage = { file: File; previewUrl: string };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  return `${val.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function formatCpf(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  if (digits.length <= 3) return p1;
  if (digits.length <= 6) return `${p1}.${p2}`;
  if (digits.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchCity(input: string, options: string[]) {
  const needle = normalizeText(input);
  for (const c of options) {
    if (normalizeText(c) === needle) return c;
  }
  return null;
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function safeRevoke(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    return;
  }
}

function Icon(props: { name: "user" | "id" | "truck" | "mail" | "lock" | "camera"; className?: string }) {
  const cls = props.className ?? "h-5 w-5";
  if (props.name === "user") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "id") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0v12h12V6H6Zm2 3h5v2H8V9Zm0 4h8v2H8v-2Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "truck") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3h2.6a2 2 0 0 1 1.6.8l1.8 2.4A2 2 0 0 1 24 15.4V18a2 2 0 0 1-2 2h-1.2a2.8 2.8 0 0 1-5.6 0H9.8a2.8 2.8 0 0 1-5.6 0H3a2 2 0 0 1-2-2V6Zm2 0v12h1.2a2.8 2.8 0 0 1 5.6 0H14V6H5Zm11 7v5h1.2a2.8 2.8 0 0 1 5.6 0H22v-2.6L20.2 13H16Zm-8.4 7a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm11 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "mail") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0 6 5 6-5H6Zm12 2.3-6 5-6-5V18h12V8.3Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (props.name === "lock") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a2 2 0 0 0-1 3.732V19h2v-1.268A2 2 0 0 0 12 14Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h1V8a3 3 0 0 1 3-3Zm-1 4h2V8a1 1 0 1 0-2 0v1Zm4 2H8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FileDropField(props: {
  name: string;
  title: string;
  hint: string;
  required?: boolean;
  value: SelectedImage | null;
  onChange: (next: SelectedImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const meta = useMemo(() => {
    if (!props.value) return null;
    return { name: props.value.file.name, size: formatBytes(props.value.file.size) };
  }, [props.value]);

  function pickFile(file: File | null) {
    if (!file) return;
    if (!isImage(file)) return;
    const url = URL.createObjectURL(file);
    props.onChange({ file, previewUrl: url });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (props.value) safeRevoke(props.value.previewUrl);
    pickFile(file);
  }

  function clear() {
    if (props.value) safeRevoke(props.value.previewUrl);
    props.onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    if (props.value) safeRevoke(props.value.previewUrl);
    pickFile(file);

    if (inputRef.current && file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-brand-black">{props.title}</div>
        {props.required ? (
          <span className="rounded-full border border-brand-border/20 bg-white px-2 py-0.5 text-xs font-semibold text-brand-black/70">
            Obrigatório
          </span>
        ) : null}
      </div>

      <div
        className={[
          "rounded-2xl border bg-white p-3",
          isDragging ? "border-brand-yellow/60 ring-4 ring-brand-yellow/20" : "border-brand-border/20",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-brand-border/20 bg-brand-yellow/10 p-2 text-brand-black">
            <Icon name="camera" className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-brand-black">
              Arraste e solte ou clique para escolher
            </div>
            <div className="mt-1 text-xs text-brand-text2">{props.hint}</div>
            <div className="mt-2 text-xs text-brand-black/60">PNG/JPG/WEBP • até 8MB</div>
          </div>
        </div>

        {props.value ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3">
            <Image
              src={props.value.previewUrl}
              alt="Preview"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-xl border border-brand-border/20 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-brand-black">{meta?.name}</div>
              <div className="mt-0.5 text-xs text-brand-black/60">{meta?.size}</div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-brand-border/20 bg-white px-3 py-2 text-xs font-semibold text-brand-black hover:bg-brand-yellow/10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }}
            >
              Remover
            </button>
          </div>
        ) : null}

        <input
          ref={inputRef}
          className="hidden"
          name={props.name}
          type="file"
          accept="image/*"
          required={props.required}
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}

function TextField(props: {
  name: string;
  label: string;
  placeholder?: string;
  icon?: React.ComponentProps<typeof Icon>["name"];
  required?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  value?: string;
  onChange?: (next: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-brand-black">{props.label}</span>
      <div className="relative">
        {props.icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand-black/60">
            <Icon name={props.icon} className="h-5 w-5" />
          </div>
        ) : null}
        <input
          className={[
            "w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20",
            props.icon ? "pl-11" : "",
          ].join(" ")}
          name={props.name}
          placeholder={props.placeholder}
          required={props.required}
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          value={props.value}
          onChange={(e) => props.onChange?.(e.target.value)}
        />
      </div>
    </label>
  );
}

export function PartnerSignupFormClient(props: { cidades: string[]; initialError?: string | null }) {
  const [cpfMasked, setCpfMasked] = useState("");
  const [fotoParceiro, setFotoParceiro] = useState<SelectedImage | null>(null);
  const [fotoCaminhao, setFotoCaminhao] = useState<SelectedImage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cidade, setCidade] = useState<string>(props.cidades[0] ?? "");
  const [cidadeStatus, setCidadeStatus] = useState<"idle" | "detecting" | "detected" | "manual" | "error">("idle");
  const [cidadeHint, setCidadeHint] = useState<string | null>(null);

  const cpfDigits = useMemo(() => cpfMasked.replace(/\D/g, ""), [cpfMasked]);
  const cpfIsValid = cpfDigits.length === 0 || cpfDigits.length === 11;

  useEffect(() => {
    let alive = true;

    async function detect() {
      if (!navigator.geolocation) {
        if (!alive) return;
        setCidadeStatus("error");
        setCidadeHint("Seu navegador não suporta GPS.");
        return;
      }

      setCidadeStatus("detecting");
      setCidadeHint("Detectando sua cidade pelo GPS...");

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch("/api/reverse-geocode", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            });
            const json = (await res.json()) as { cidade?: string | null; error?: string };
            if (!alive) return;

            const rawCity = String(json.cidade ?? "").trim();
            const matched = rawCity ? matchCity(rawCity, props.cidades) : null;

            if (matched) {
              setCidade(matched);
              setCidadeStatus("detected");
              setCidadeHint(`Cidade detectada: ${matched}`);
              return;
            }

            setCidadeStatus("manual");
            setCidadeHint(rawCity ? `Cidade detectada fora da lista: ${rawCity}` : "Não consegui detectar sua cidade.");
          } catch {
            if (!alive) return;
            setCidadeStatus("manual");
            setCidadeHint("Não consegui detectar sua cidade. Selecione manualmente.");
          }
        },
        () => {
          if (!alive) return;
          setCidadeStatus("manual");
          setCidadeHint("Permissão de localização negada. Selecione sua cidade.");
        },
        { enableHighAccuracy: true, timeout: 12000 },
      );
    }

    void detect();
    return () => {
      alive = false;
    };
  }, [props.cidades]);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-brand-black">
          <Icon name="truck" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-brand-black">Cadastro de parceiro reboque</h1>
          <p className="mt-1 text-sm text-brand-black/70">
            Complete seus dados para receber chamados e enviar propostas pelo painel.
          </p>
        </div>
      </div>

      {props.initialError ? (
        <div className="mt-4 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
          {props.initialError}
        </div>
      ) : null}

      <form
        className="mt-5 space-y-5"
        action="/auth/signup"
        method="post"
        encType="multipart/form-data"
        onSubmit={() => setIsSubmitting(true)}
      >
        <input type="hidden" name="role" value="reboque" />

        <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
          <div className="text-sm font-extrabold text-brand-black">Seus dados</div>
          <div className="mt-3 grid gap-4">
            <TextField name="nome" label="Nome" icon="user" placeholder="Seu nome completo" required />
            <TextField
              name="telefone"
              label="Telefone (WhatsApp)"
              icon="user"
              placeholder="(DDD) 99999-9999"
              inputMode="tel"
              required
            />
            <div className="space-y-2">
              <TextField
                name="cpf"
                label="CPF"
                icon="id"
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
                value={cpfMasked}
                onChange={(v) => setCpfMasked(formatCpf(v))}
              />
              {!cpfIsValid ? (
                <div className="text-xs font-semibold text-brand-red">CPF precisa ter 11 dígitos.</div>
              ) : (
                <div className="text-xs text-brand-text2">Use o CPF do responsável pelo cadastro.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
          <div className="text-sm font-extrabold text-brand-black">Acesso ao painel</div>
          <div className="mt-3 grid gap-4">
            <TextField name="email" label="Email" icon="mail" placeholder="voce@empresa.com" type="email" required />
            <TextField name="password" label="Senha" icon="lock" placeholder="Crie uma senha forte" type="password" required />
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
          <div className="text-sm font-extrabold text-brand-black">Dados do reboque</div>
          <div className="mt-1 text-xs text-brand-text2">
            Essas informações ajudam a confirmar o tipo de atendimento e reduzem cancelamentos.
          </div>

          <div className="mt-3 grid gap-4">
            <TextField name="empresa_nome" label="Empresa" icon="user" placeholder="Nome da empresa" required />
            <TextField name="caminhao_modelo" label="Modelo do caminhão" icon="truck" placeholder="Ex: VW Delivery / Iveco Daily" required />
            <TextField name="caminhao_placa" label="Placa" icon="truck" placeholder="ABC1D23" required />
            <label className="block space-y-2">
              <span className="text-sm font-bold text-brand-black">Tipo do caminhão</span>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brand-black/60">
                  <Icon name="truck" className="h-5 w-5" />
                </div>
                <select
                  className="w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 pl-11 text-brand-black focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
                  name="caminhao_tipo"
                  defaultValue="plataforma"
                >
                  <option value="plataforma">Plataforma</option>
                  <option value="guincho">Guincho</option>
                  <option value="munk">Munck</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="text-xs text-brand-text2">Se for “Outro”, descreva no modelo do caminhão.</div>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-bold text-brand-black">Cidade de atendimento</span>
              {cidadeStatus === "detected" ? (
                <>
                  <select
                    className="w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
                    name="cidade"
                    value={cidade}
                    disabled
                    onChange={(e) => setCidade(e.target.value)}
                  >
                    <option value={cidade}>{cidade}</option>
                  </select>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-brand-text2">{cidadeHint ?? "Cidade definida pelo GPS."}</span>
                    <button
                      type="button"
                      className="font-semibold text-brand-black underline"
                      onClick={() => {
                        setCidadeStatus("manual");
                        setCidadeHint("Selecione sua cidade.");
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <select
                    className="w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
                    name="cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    disabled={cidadeStatus === "detecting"}
                  >
                    {props.cidades.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-brand-text2">
                      {cidadeHint ?? "Você recebe chamados dessa cidade e arredores."}
                    </span>
                    {cidadeStatus === "detecting" ? (
                      <span className="rounded-full border border-brand-border/20 bg-brand-yellow/10 px-2 py-0.5 font-semibold text-brand-black/70">
                        Detectando...
                      </span>
                    ) : null}
                    {cidadeStatus !== "detecting" ? (
                      <button
                        type="button"
                        className="font-semibold text-brand-black underline"
                        onClick={() => {
                          setCidadeStatus("detecting");
                          setCidadeHint("Detectando sua cidade pelo GPS...");
                          navigator.geolocation?.getCurrentPosition(
                            async (pos) => {
                              try {
                                const res = await fetch("/api/reverse-geocode", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                });
                                const json = (await res.json()) as { cidade?: string | null; error?: string };
                                const rawCity = String(json.cidade ?? "").trim();
                                const matched = rawCity ? matchCity(rawCity, props.cidades) : null;
                                if (matched) {
                                  setCidade(matched);
                                  setCidadeStatus("detected");
                                  setCidadeHint(`Cidade detectada: ${matched}`);
                                } else {
                                  setCidadeStatus("manual");
                                  setCidadeHint(rawCity ? `Cidade detectada fora da lista: ${rawCity}` : "Não consegui detectar sua cidade.");
                                }
                              } catch {
                                setCidadeStatus("manual");
                                setCidadeHint("Não consegui detectar sua cidade. Selecione manualmente.");
                              }
                            },
                            () => {
                              setCidadeStatus("manual");
                              setCidadeHint("Permissão de localização negada. Selecione sua cidade.");
                            },
                            { enableHighAccuracy: true, timeout: 12000 },
                          );
                        }}
                      >
                        Tentar GPS
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </label>
            <TextField
              name="whatsapp_number"
              label="WhatsApp para receber alertas"
              icon="user"
              placeholder="(DDD) 99999-9999"
              inputMode="tel"
              required
            />
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
          <div className="text-sm font-extrabold text-brand-black">Fotos</div>
          <div className="mt-1 text-xs text-brand-text2">
            Envie fotos nítidas. Evite baixa luz e imagens borradas.
          </div>

          <div className="mt-4 grid gap-4">
            <FileDropField
              name="foto_parceiro"
              title="Foto do parceiro"
              hint="Uma selfie com o rosto bem visível."
              required
              value={fotoParceiro}
              onChange={setFotoParceiro}
            />
            <FileDropField
              name="foto_caminhao"
              title="Foto do caminhão"
              hint="Foto de perfil/lateral mostrando o caminhão inteiro."
              required
              value={fotoCaminhao}
              onChange={setFotoCaminhao}
            />
          </div>
        </div>

        <button
          className="btn-primary w-full disabled:opacity-50"
          type="submit"
          disabled={isSubmitting || !cpfIsValid}
        >
          {isSubmitting ? "Enviando..." : "Criar conta"}
        </button>

        <div className="text-center text-xs text-brand-black/60">
          Ao cadastrar, você concorda em manter os dados atualizados e responder rapidamente aos chamados.
        </div>
      </form>
    </div>
  );
}
