"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteEvent } from "@/app/operasional/actions/calendar";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { monthGrid, monthLabel, occursOn, reminderText, shiftMonth, TYPE_LABEL, wibKey, wibTime, whenText, longDay, type CalType, type EventView } from "./common";
import { downloadIcs } from "./ics";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const FILTERS: (CalType | "semua")[] = ["semua", "rapat", "training", "lainnya"];

function EventRow({ event, onOpen }: { event: EventView; onOpen: () => void }) {
  return (
    <button type="button" className={`cal-row cal-tone-${event.type}`} onClick={onOpen}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b>{event.title}</b>
        <span className="small">{whenText(event)}{event.location ? ` · ${event.location}` : ""}</span>
        <span className="cal-tags">
          <span className="cal-tag">{TYPE_LABEL[event.type]}</span>
          {event.isMine && <span className="cal-tag mine">Anda diundang</span>}
          <span className="small">{event.participants.length} peserta</span>
        </span>
      </span>
    </button>
  );
}

function Detail({ event, canManage, onClose }: { event: EventView; canManage: boolean; onClose: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of event.participants) map.set(p.role, [...(map.get(p.role) ?? []), p.name]);
    return [...map.entries()];
  }, [event.participants]);
  return (
    <section className={`admin-card cal-detail cal-tone-${event.type}`} aria-label="Detail acara">
      <div className="card-head">
        <span className="cal-tag">{TYPE_LABEL[event.type]}{event.seriesId ? " · berulang" : ""}</span>
        <button type="button" className="link-btn" style={{ color: "var(--redup)" }} onClick={onClose}>Tutup</button>
      </div>
      <h2>{event.title}</h2>
      <p className="muted">{whenText(event)}</p>
      <dl>
        {event.location && <div><dt>Tempat</dt><dd>{event.location}</dd></div>}
        {event.description && <div><dt>Agenda</dt><dd style={{ whiteSpace: "pre-wrap" }}>{event.description}</dd></div>}
        <div>
          <dt>Peserta ({event.participants.length}){event.isMine ? " · Anda diundang" : ""}</dt>
          <dd>{groups.length ? groups.map(([role, names]) => <div key={role} className="small"><b>{role}:</b> {names.join(", ")}</div>) : <span className="muted">Belum ada peserta</span>}</dd>
        </div>
        <div><dt>Pengingat</dt><dd>{event.reminderMinutes.length ? event.reminderMinutes.map(reminderText).join(", ") : "Tanpa pengingat"}</dd></div>
      </dl>
      <p className="small muted">Dibuat oleh {event.createdByName ?? "-"}</p>
      <div className="cal-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadIcs(event)}>Simpan ke kalender HP (.ics)</button>
        {canManage && <Link className="btn btn-ghost btn-sm" href={`/operasional/kalender/${event.id}/ubah`}>Ubah</Link>}
        {canManage && event.type !== "lainnya" && <Link className="btn btn-ghost btn-sm" href={`/operasional/kalender/hasil/${event.id}`}>Isi hasil</Link>}
        {canManage && <ConfirmAction action={() => deleteEvent(event.id, false)} label={event.seriesId ? "Hapus tanggal ini" : "Hapus"} confirmText={`Hapus "${event.title}"?`} />}
        {canManage && event.seriesId && <ConfirmAction action={() => deleteEvent(event.id, true)} label="Hapus seluruh seri" confirmText={`Hapus SEMUA jadwal berulang "${event.title}"?`} />}
      </div>
    </section>
  );
}

/** Kalender bulan 6x7 (mulai Senin) + agenda 60 hari. Pindah bulan lewat tautan (server), selebihnya state klien. */
export function CalendarView({ month, today, events, canManage, initialDay, initialEvent }: { month: string; today: string; events: EventView[]; canManage: boolean; initialDay: string; initialEvent: string | null }) {
  const [selected, setSelected] = useState(initialDay);
  const [filter, setFilter] = useState<CalType | "semua">("semua");
  const [mine, setMine] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(initialEvent);
  const detailRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => events.filter((e) => (filter === "semua" || e.type === filter) && (!mine || e.isMine)), [events, filter, mine]);
  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, EventView[]>();
    for (const day of days) map.set(day, visible.filter((e) => occursOn(e, day)));
    return map;
  }, [days, visible]);
  const agenda = useMemo(() => {
    const nowMs = Date.now();
    return visible.filter((e) => new Date(e.endAt ?? e.startAt).getTime() >= nowMs).slice(0, 12);
  }, [visible]);
  const detail = detailId ? events.find((e) => e.id === detailId) ?? null : null;

  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [detail]);

  const selectedEvents = byDay.get(selected) ?? visible.filter((e) => occursOn(e, selected));
  const open = (id: string) => setDetailId(id);

  return (
    <>
      <div ref={detailRef}>{detail && <Detail event={detail} canManage={canManage} onClose={() => setDetailId(null)} />}</div>
      <div className="cal-layout">
        <div className="admin-card">
          <div className="cal-bar">
            <div className="cal-nav">
              <Link href={`/operasional/kalender?bulan=${shiftMonth(month, -1)}`} aria-label="Bulan sebelumnya" scroll={false}>&lsaquo;</Link>
              <h2>{monthLabel(month)}</h2>
              <Link href={`/operasional/kalender?bulan=${shiftMonth(month, 1)}`} aria-label="Bulan berikutnya" scroll={false}>&rsaquo;</Link>
              <Link href="/operasional/kalender" scroll={false}>Hari ini</Link>
            </div>
            <div className="cal-filters" role="group" aria-label="Saring acara">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "semua" ? "Semua" : TYPE_LABEL[f]}</button>
              ))}
              <button type="button" aria-pressed={mine} onClick={() => setMine(!mine)}>Undangan saya</button>
            </div>
          </div>

          <div className="cal-grid" aria-label={`Kalender ${monthLabel(month)}`}>
            {WEEKDAYS.map((d) => <div key={d} className="cal-wd">{d}</div>)}
            {days.map((day) => {
              const list = byDay.get(day) ?? [];
              return (
                <button key={day} type="button" aria-label={`${longDay(day)}, ${list.length} acara`} className={`cal-day${day.slice(0, 7) !== month ? " out" : ""}${day === selected ? " sel" : ""}${day === today ? " today" : ""}`} onClick={() => setSelected(day)}>
                  <span className="n">{Number(day.slice(8))}</span>
                  <span className="cal-dots">{list.slice(0, 4).map((e) => <i key={e.id} className={`cal-tone-${e.type}`} />)}</span>
                  <span className="cal-chips">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={`cal-chip cal-tone-${e.type}`}>{wibKey(e.startAt) === day ? `${wibTime(e.startAt)} ` : "↳ "}{e.title}</span>
                    ))}
                    {list.length > 3 && <span className="cal-more">+{list.length - 3} lagi</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="card-head">
              <h2>{longDay(selected)}</h2>
              {canManage && <Link href={`/operasional/kalender/baru?tanggal=${selected < today ? today : selected}`} className="btn btn-primary btn-sm">+ Tambah di tanggal ini</Link>}
            </div>
            <div className="cal-list">
              {selectedEvents.length ? selectedEvents.map((e) => <div key={e.id} className={`cal-tone-${e.type}`}><EventRow event={e} onOpen={() => open(e.id)} /></div>) : <p className="cal-empty">Tidak ada acara.</p>}
            </div>
          </div>
        </div>

        <aside>
          <div className="card-head"><h2>Akan datang</h2></div>
          <div className="cal-list" style={{ marginTop: 0 }}>
            {agenda.length ? agenda.map((e) => <div key={e.id} className={`cal-tone-${e.type}`}><EventRow event={e} onOpen={() => open(e.id)} /></div>) : <p className="cal-empty">Belum ada acara 60 hari ke depan.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
