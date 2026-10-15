"use client";

import { useEffect, useRef, useState } from "react";
import { BatteryFull, CheckCheck, ChevronLeft, Mic, Phone, Signal, Store, Video, Wifi } from "lucide-react";
import type { ChatMessage } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { HydrationGate } from "@/components/common/gate";
import { IngredientLabel } from "@/components/common/ingredient";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { BoardCard } from "@/components/kopdes/commitment-board";
import { formatDate, formatNumber, formatTime, formatWeeks } from "@/engines/format";
import { useT } from "@/i18n";
import { actions, useAppData, useDerived, useLiveUser } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { cn } from "@/lib/utils";

/** Renders **bold** segments of a chat message. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function WhatsAppSimulator() {
  const { t } = useT();
  const user = useLiveUser();
  const own = user?.role === "farmer";
  return (
    <PageContainer className="village">
      <PageHeader title={own ? t.farmer.liveTitle : t.farmer.title} subtitle={own ? t.farmer.liveSubtitle : t.farmer.subtitle} />
      <HydrationGate rows={2}>
        <SimulatorBody />
      </HydrationGate>
    </PageContainer>
  );
}

function SimulatorBody() {
  const { t, lang } = useT();
  const user = useLiveUser();
  const own = user?.role === "farmer";
  const data = useAppData();
  const d = useDerived();
  const farmerId = data.ui.activeFarmerId;
  const farmer = d.farmersById.get(farmerId)!;
  const messages = data.chat.filter((m) => m.farmerId === farmerId);
  const latestOffer = [...messages].reverse().find((m) => m.commitmentId && (m.kind === "offer" || m.kind === "ask_partial" || m.kind === "confirm"));
  const liveCommitment = latestOffer ? data.commitments.find((c) => c.id === latestOffer.commitmentId) : undefined;
  const liveIngredient = liveCommitment?.ingredientId ?? farmer.commodities[0]?.ingredientId;
  const liveKopdes = liveCommitment?.kopdesId ?? farmer.kopdesId;
  const myOrders = data.commitments.filter((c) => c.farmerId === farmerId && c.status !== "declined").slice(-6).reverse();

  // The live board shows the ordering Kopdes of the latest offer.
  useEffect(() => {
    if (liveKopdes && data.ui.activeKopdesId !== liveKopdes) actions.setActiveKopdes(liveKopdes);
  }, [liveKopdes, data.ui.activeKopdesId]);

  const farmersWithChat = new Set(data.chat.map((m) => m.farmerId));
  const sortedFarmers = [...data.farmers].sort((a, b) => Number(farmersWithChat.has(b.id)) - Number(farmersWithChat.has(a.id)) || a.displayName.localeCompare(b.displayName));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className="grid grid-cols-1 gap-3">
        <div className={cn("grid gap-1.5", own && "hidden")}>
          <Label htmlFor="farmer-select">{t.farmer.chooseFarmer}</Label>
          <Select id="farmer-select" value={farmerId} onChange={(e) => actions.setActiveFarmer(e.target.value)} data-testid="farmer-select">
            {sortedFarmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName} · {f.village} · {shortKopdesName(d.kopdesById.get(f.kopdesId)?.name ?? "")}
              </option>
            ))}
          </Select>
        </div>
        <ChatPhone messages={messages} kopdesName={shortKopdesName(d.kopdesById.get(liveKopdes)?.name ?? "Kopdes")} />
        <p className="text-sm text-muted">{user ? t.farmer.liveNote : t.farmer.note}</p>
        <p className="text-sm text-muted">{t.farmer.privacy}</p>
      </div>
      <div className="grid grid-cols-1 gap-5">
        {liveIngredient ? (
          <section className="grid grid-cols-1 gap-3" aria-labelledby="live-board" data-tour="live-board">
            <div>
              <h2 id="live-board" className="flex items-center gap-2 text-lg font-bold">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
                  <span className="relative inline-flex size-3 rounded-full bg-ok" />
                </span>
                {t.farmer.liveBoard}
              </h2>
              <p className="text-sm text-muted">
                {d.kopdesById.get(liveKopdes)?.name} · {t.farmer.liveHint}
              </p>
            </div>
            <BoardCard ingredientId={liveIngredient} live />
          </section>
        ) : null}
        <section className="grid grid-cols-1 gap-2" aria-labelledby="my-orders">
          <h2 id="my-orders" className="text-lg font-bold">
            {t.farmer.myOrders} · {farmer.displayName}
          </h2>
          {myOrders.length === 0 ? <p className="text-muted">{t.farmer.noOrders}</p> : null}
          <ul className="grid grid-cols-1 gap-2">
            {myOrders.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                <IngredientLabel ingredient={d.ingredientsById.get(c.ingredientId)} className="font-semibold" />
                <span className="tabular-nums">
                  {formatNumber(c.kgPerWeek, lang)} kg{t.common.perWeek}
                </span>
                <span className="text-sm text-muted">{formatWeeks(c.weeks, lang)}</span>
                <Badge variant={c.status === "offered" ? "yellow" : "green"} className="ml-auto">
                  {c.status === "offered" ? t.status.pending : t.kopdes.board.committed}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ChatPhone({ messages, kopdesName }: { messages: ChatMessage[]; kopdesName: string }) {
  const { t, lang } = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialIds] = useState(() => new Set(messages.map((m) => m.id)));
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);
  const pending = [...messages].reverse().find((m) => m.buttons && !m.answered);
  const showDateFor = new Set(messages.filter((m, i) => i === 0 || m.at.slice(0, 10) !== messages[i - 1].at.slice(0, 10)).map((m) => m.id));
  return (
    <div className="mx-auto w-full max-w-[24rem] rounded-[2.6rem] border-[10px] border-[#1d2420] bg-[#1d2420] shadow-xl" data-tour="farmer-phone" data-testid="farmer-phone">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#efe8dc]">
        {/* status bar */}
        <div className="flex items-center justify-between bg-[#1f6f4a] px-5 pb-1 pt-2 text-xs font-semibold text-white">
          <span>09:41</span>
          <span className="absolute left-1/2 top-1.5 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1d2420]" aria-hidden />
          <span className="flex items-center gap-1" aria-hidden>
            <Signal className="size-3.5" />
            <Wifi className="size-3.5" />
            <BatteryFull className="size-4" />
          </span>
        </div>
        {/* chat header */}
        <div className="flex items-center gap-2 bg-[#1f6f4a] px-3 pb-2.5 pt-1 text-white">
          <ChevronLeft className="size-5" aria-hidden />
          <span className="flex size-10 items-center justify-center rounded-full bg-[#e3f0e8] text-[#1f6f4a]">
            <Store className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold leading-tight">{kopdesName}</span>
            <span className="block text-xs opacity-90">{t.farmer.online}</span>
          </span>
          <Video className="size-5 opacity-90" aria-hidden />
          <Phone className="size-5 opacity-90" aria-hidden />
        </div>
        {/* messages */}
        <div
          ref={scrollRef}
          className="h-[30rem] overflow-y-auto px-3 py-3"
          style={{ backgroundImage: "radial-gradient(rgba(31,111,74,0.09) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
          aria-live="polite"
          role="log"
          aria-label={t.farmer.chatTitle}
        >
          {messages.length === 0 ? <p className="mt-10 text-center text-sm text-[#5b6b63]">{t.farmer.noMessages}</p> : null}
          <ul className="grid gap-2">
            {messages.map((m) => {
              const date = m.at.slice(0, 10);
              const showDate = showDateFor.has(m.id);
              const mine = m.from === "farmer";
              return (
                <li key={m.id} className="grid gap-2">
                  {showDate && date ? (
                    <span className="mx-auto rounded-lg bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#5b6b63] shadow-sm">
                      {formatDate(date, lang, { weekday: true })}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug shadow-sm",
                      mine ? "ml-auto rounded-br-md bg-[#d4efc4] text-[#1e2a24]" : "mr-auto rounded-bl-md bg-white text-[#1e2a24]",
                      !initialIds.has(m.id) && "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                    )}
                    data-testid={`chat-${m.kind}`}
                  >
                    <p lang="id">
                      <RichText text={m.textId} />
                    </p>
                    {lang === "en" && m.textEn !== m.textId ? (
                      <p className="mt-1 border-t border-black/5 pt-1 text-[12px] leading-snug text-[#5b6b63]" lang="en">
                        <RichText text={m.textEn} />
                      </p>
                    ) : null}
                    <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#5b6b63]">
                      {formatTime(m.at)}
                      {mine ? <CheckCheck className="size-3.5 text-[#2a78d6]" aria-hidden /> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {/* quick replies */}
        <div className="grid gap-1.5 border-t border-black/5 bg-[#f6f2ea] px-3 py-2.5">
          {pending ? (
            <div className="grid gap-1.5" role="group" aria-label={t.farmer.replyHint}>
              {pending.buttons!.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => actions.chatReply(pending.id, b.value)}
                  data-testid={`reply-${b.value}`}
                  data-tour={`reply-${b.value}`}
                  className="min-h-11 rounded-full border border-[#1f6f4a]/30 bg-white px-4 text-left text-[15px] font-semibold text-[#17573a] shadow-sm hover:bg-[#e3f0e8] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  {b.label}
                </button>
              ))}
            </div>
          ) : messages.length > 0 ? (
            <p className="rounded-xl bg-white/70 px-3 py-2 text-sm text-[#5b6b63]" role="status" data-testid="waiting-offer">
              {t.farmer.waitingOffer}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="flex min-h-11 flex-1 items-center rounded-full bg-white px-4 text-sm text-[#5b6b63]">{t.farmer.replyHint}</div>
            <span className="flex size-11 items-center justify-center rounded-full bg-[#1f6f4a] text-white" aria-hidden>
              <Mic className="size-5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
